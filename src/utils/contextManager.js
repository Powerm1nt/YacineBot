/**
 * Gestionnaire de contexte pour les conversations par serveur/canal/DM
 * Intégration avec Prisma pour la persistance des données
 */
import { getContextKey } from './commandUtils.js';
import { prisma } from '../models/index.js';
import { conversationService } from '../services/conversationService.js';

// Cache en mémoire pour les performances
const guildConversations = new Map() // Conversations de serveurs
const dmConversations = new Map()     // Conversations privées (DM)
const groupConversations = new Map()  // Conversations de groupe

// Statistiques de contexte pour la surveillance
let contextStats = {
  totalContextsCreated: 0,
  totalContextsCleanedUp: 0,
  lastCleanupTime: null,
  contextCounts: {
    guild: 0,
    dm: 0, 
    group: 0
  }
};

// Configuration du nettoyage automatique
const CLEANUP_CONFIG = {
  // Période d'inactivité (en heures) avant qu'un contexte soit considéré comme obsolète
  inactivityThreshold: 12,  // Réduit à 12h au lieu de 24h pour libérer la mémoire plus rapidement
  // Limite maximale de contextes par type pour éviter les fuites de mémoire
  maxContexts: {
    guild: 75,  // Réduit pour limiter l'utilisation mémoire
    dm: 40,
    group: 25
  },
  // Intervalle entre les nettoyages automatiques (en heures)
  cleanupInterval: 2  // Augmentation de la fréquence de nettoyage
};

// Initialiser le nettoyage périodique des contextes
setInterval(() => {
  const cleanedCount = cleanupOldContexts();
  console.log(`Nettoyage périodique des contextes: ${cleanedCount} contextes supprimés`);
  updateContextStats();
}, CLEANUP_CONFIG.cleanupInterval * 60 * 60 * 1000); // Convertir les heures en millisecondes

/**
 * Récupère les données de contexte pour un message
 * @param {Object} message - Message Discord
 * @returns {Object} - Données de contexte
 */
export async function getContextData(message) {
  const context = getContextKey(message)
  let contextData = null;

  // Vérifier d'abord le cache en mémoire pour des performances optimales
  switch (context.type) {
    case 'guild':
      contextData = guildConversations.get(context.key);
      break;
    case 'dm':
      contextData = dmConversations.get(context.key);
      break;
    case 'group':
      contextData = groupConversations.get(context.key);
      break;
  }

  // Si les données sont en cache, les retourner immédiatement
  if (contextData) {
    return contextData;
  }

  // Sinon, tenter de récupérer depuis la base de données
  try {
    const guildId = context.type === 'guild' ? message.guild?.id : null;
    const channelId = context.key;

    // Récupérer les messages récents
    const recentMessages = await conversationService.getRecentMessages(channelId, guildId, 10);

    if (recentMessages.length > 0) {
      // Créer un objet contextData à partir des messages de la base de données
      const lastMessage = recentMessages[0]; // Le plus récent en premier

      // Construire la liste des participants à partir des messages
      const participants = [];
      const participantMap = new Map();

      recentMessages.forEach(msg => {
        if (!participantMap.has(msg.userId)) {
          participantMap.set(msg.userId, {
            id: msg.userId,
            name: msg.userName,
            messageCount: 1,
            firstSeen: msg.createdAt.toISOString(),
            lastActive: msg.createdAt.toISOString()
          });
        } else {
          const participant = participantMap.get(msg.userId);
          participant.messageCount += 1;

          // Mettre à jour lastActive si ce message est plus récent
          if (new Date(msg.createdAt) > new Date(participant.lastActive)) {
            participant.lastActive = msg.createdAt.toISOString();
          }
        }
      });

      // Convertir la Map en tableau pour les participants
      participantMap.forEach(participant => {
        participants.push(participant);
      });

      contextData = {
        lastResponseId: lastMessage.isBot ? lastMessage.id : null,
        lastMessageTimestamp: lastMessage.createdAt.toISOString(),
        lastAuthorId: lastMessage.userId,
        lastAuthorName: lastMessage.userName,
        participants: participants
      };

      // Mettre en cache pour les prochaines requêtes
      switch (context.type) {
        case 'guild':
          guildConversations.set(context.key, contextData);
          break;
        case 'dm':
          dmConversations.set(context.key, contextData);
          break;
        case 'group':
          groupConversations.set(context.key, contextData);
          break;
      }

      return contextData;
    }
  } catch (error) {
    console.error('Erreur lors de la récupération du contexte depuis la base de données:', error);
  }

  // Si rien n'est trouvé ou en cas d'erreur, retourner un objet vide
  return {};
}

/**
 * Stocke l'ID de réponse pour un contexte spécifique et persiste dans la base de données
 * @param {Object} message - Message Discord
 * @param {string} responseId - ID de réponse OpenAI
 * @returns {boolean} - Succès
 */
export async function saveContextResponse(message, responseId) {
  if (!message || !responseId) {
    console.error('Invalid parameters for saveContextResponse')
    return false
  }

  const context = getContextKey(message)
  const authorName = message.author.globalName || message.author.username;
  const contextData = {
    lastResponseId: responseId,
    lastMessageTimestamp: new Date().toISOString(),
    lastAuthorId: message.author.id,
    lastAuthorName: authorName,
    participants: await getParticipants(context, message.author.id, authorName)
  }

  // Vérifier si c'est un nouveau contexte en mémoire
  let isNewContext = false;
  switch (context.type) {
    case 'guild':
      isNewContext = !guildConversations.has(context.key);
      guildConversations.set(context.key, contextData);
      break;
    case 'dm':
      isNewContext = !dmConversations.has(context.key);
      dmConversations.set(context.key, contextData);
      break;
    case 'group':
      isNewContext = !groupConversations.has(context.key);
      groupConversations.set(context.key, contextData);
      break;
    default:
      return false;
  }

  // Sauvegarder dans la base de données
  try {
    const guildId = context.type === 'guild' ? message.guild?.id : null;
    const channelId = context.key;

    // Stocker la réponse du bot comme un message
    if (message.content) {
      await conversationService.addMessage(
        channelId,
        message.author.id,
        authorName,
        message.content,
        false, // isBot=false car c'est le message de l'utilisateur
        guildId
      );
    }

    // Mettre à jour les statistiques si c'est un nouveau contexte
    if (isNewContext) {
      contextStats.totalContextsCreated++;

      // Vérifier si le nombre de contextes dépasse les limites
      const currentSize = {
        guild: guildConversations.size,
        dm: dmConversations.size,
        group: groupConversations.size
      };

      const maxSize = CLEANUP_CONFIG.maxContexts[context.type];
      if (currentSize[context.type] > maxSize * 0.9) { // À 90% de la capacité, lancer un nettoyage préventif
        console.log(`Nettoyage préventif des contextes ${context.type}: ${currentSize[context.type]}/${maxSize}`);
        await cleanupOldContexts();
      }
    }

    updateContextStats();
    console.log(`Stored response ID ${responseId} for ${context.type} context ${context.key}`)
    return true;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde du contexte dans la base de données:', error);
    return false;
  }
}

/**
 * Met à jour la liste des participants récents dans un contexte
 * @param {Object} context - Objet de contexte avec type et clé
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userName - Nom de l'utilisateur
 * @returns {Promise<Array>} - Liste mise à jour des participants
 */
async function getParticipants(context, userId, userName) {
  let contextData = {}

  // Récupérer les données de contexte selon le type
  switch (context.type) {
    case 'guild':
      contextData = guildConversations.get(context.key) || {}
      break
    case 'dm':
      contextData = dmConversations.get(context.key) || {}
      break
    case 'group':
      contextData = groupConversations.get(context.key) || {}
      break
  }

  const participants = contextData.participants || []

  // Vérifier si l'utilisateur est déjà dans la liste
  const existingIndex = participants.findIndex(p => p.id === userId)

  if (existingIndex >= 0) {
    // Mettre à jour les informations de l'utilisateur existant
    const existing = participants[existingIndex]
    // Supprimer l'entrée existante
    participants.splice(existingIndex, 1)

    // Ajouter l'utilisateur mis à jour au début de la liste
    participants.unshift({
      ...existing,
      name: userName,  // Mettre à jour le nom au cas où il aurait changé
      messageCount: (existing.messageCount || 0) + 1,
      lastActive: new Date().toISOString()
    })
  } else {
    // Ajouter l'utilisateur au début de la liste
    participants.unshift({
      id: userId,
      name: userName,
      messageCount: 1,
      firstSeen: new Date().toISOString(),
      lastActive: new Date().toISOString()
    })
  }

  // Limiter à 10 participants récents
  return participants.slice(0, 10)
}

/**
 * Réinitialise le contexte pour un message et supprime les conversations dans la base de données
 * @param {Object} message - Message Discord
 * @returns {Promise<boolean>} - Succès
 */
export async function resetContext(message) {
  if (!message) {
    console.error('Invalid message object passed to resetContext')
    return false
  }

  const context = getContextKey(message)

  // Supprimer le contexte du stockage en mémoire
  switch (context.type) {
    case 'guild':
      guildConversations.delete(context.key)
      break
    case 'dm':
      dmConversations.delete(context.key)
      break
    case 'group':
      groupConversations.delete(context.key)
      break
    default:
      return false
  }

  // Supprimer également de la base de données
  try {
    const guildId = context.type === 'guild' ? message.guild?.id : null;
    await conversationService.deleteConversationHistory(context.key, guildId);
    console.log(`Reset context for ${context.type} context ${context.key} (database cleared)`)
    return true;
  } catch (error) {
    console.error(`Error resetting context in database for ${context.type} ${context.key}:`, error);
    return false;
  }
}

/**
 * Récupère l'ID de la dernière réponse pour un message
 * @param {Object} message - Message Discord
 * @returns {Promise<string|null>} - ID de la dernière réponse ou null
 */
export async function getLastResponseId(message) {
  const contextData = await getContextData(message)
  return contextData.lastResponseId || null
}

/**
 * Récupère la liste des participants pour un contexte
 * @param {Object} message - Message Discord
 * @returns {Array} - Liste des participants
 */
export function getParticipantsList(message) {
  const contextData = getContextData(message)
  return contextData.participants || []
}

/**
 * Formate une liste de participants pour être incluse dans le contexte
 * @param {Array} participants - Liste des participants
 * @returns {string} - Texte formaté des participants
 */
export function formatParticipantsInfo(participants) {
  if (!participants || participants.length === 0) {
    return ''
  }

  const participantsInfo = participants.map(p => {
    return `${p.name} (ID: ${p.id})`
  }).join(', ')

  return `[Participants: ${participantsInfo}]`
}

/**
 * Met à jour les statistiques des contextes en mémoire
 * @returns {Object} Statistiques actuelles des contextes
 */
function updateContextStats() {
  contextStats.contextCounts = {
    guild: guildConversations.size,
    dm: dmConversations.size,
    group: groupConversations.size,
    total: guildConversations.size + dmConversations.size + groupConversations.size
  };
  return contextStats;
}

/**
 * Récupère les statistiques actuelles des contextes
 * @returns {Object} Statistiques de gestion des contextes
 */
export function getContextStats() {
  updateContextStats();
  return {
    ...contextStats,
    memoryUsage: process.memoryUsage(),
    config: CLEANUP_CONFIG
  };
}

/**
 * Nettoie les contextes inactifs et limite la taille totale des caches
 * @returns {Promise<number>} - Nombre de contextes nettoyés
 */
export async function cleanupOldContexts() {
  let cleanCount = 0
  const now = new Date()
  const inactivityThreshold = CLEANUP_CONFIG.inactivityThreshold || 24;
  const inactivityDate = new Date(now.getTime() - inactivityThreshold * 60 * 60 * 1000);

  contextStats.lastCleanupTime = now.toISOString();

  // Fonction helper pour nettoyer un stockage spécifique
  const cleanupStorage = (storage, type) => {
    let count = 0;
    let entriesArray = [];

    // Créer un tableau des entrées pour tri et gestion
    storage.forEach((contextData, contextKey) => {
      entriesArray.push({
        key: contextKey,
        data: contextData,
        lastActivity: contextData.lastMessageTimestamp ? new Date(contextData.lastMessageTimestamp) : new Date(0)
      });
    });

    // 1. Supprimer les contextes inactifs
    const inactiveEntries = entriesArray.filter(entry => entry.lastActivity < inactivityDate);
    inactiveEntries.forEach(entry => {
      storage.delete(entry.key);
      count++;
    });

    // 2. Si encore trop de contextes, supprimer les plus anciens
    const maxAllowed = CLEANUP_CONFIG.maxContexts[type.toLowerCase()] || 100;
    if (storage.size > maxAllowed) {
      // Trier par date d'activité (du plus ancien au plus récent)
      entriesArray.sort((a, b) => a.lastActivity - b.lastActivity);

      // Supprimer les plus anciens jusqu'à atteindre la limite
      const excessCount = storage.size - maxAllowed;
      entriesArray.slice(0, excessCount).forEach(entry => {
        if (storage.has(entry.key)) { // Vérifier si la clé existe encore
          storage.delete(entry.key);
          count++;
        }
      });
    }

    console.log(`Nettoyage de ${count} contextes de conversation ${type} en mémoire (inactifs: ${inactiveEntries.length}, taille: ${storage.size}/${maxAllowed})`);
    return count;
  };

  // Nettoyer chaque type de stockage en mémoire séparément
  cleanCount += cleanupStorage(guildConversations, 'guild');
  cleanCount += cleanupStorage(dmConversations, 'dm');
  cleanCount += cleanupStorage(groupConversations, 'group');

  // Nettoyer également les anciennes conversations dans la base de données
  try {
    // Récupérer et supprimer les conversations inactives depuis plus de 'inactivityThreshold' heures
    const oldConversations = await prisma.conversation.findMany({
      where: {
        updatedAt: {
          lt: inactivityDate
        }
      }
    });

    if (oldConversations.length > 0) {
      await prisma.conversation.deleteMany({
        where: {
          id: {
            in: oldConversations.map(conv => conv.id)
          }
        }
      });

      console.log(`Nettoyage de ${oldConversations.length} conversations anciennes dans la base de données`);
      cleanCount += oldConversations.length;
    }
  } catch (error) {
    console.error('Erreur lors du nettoyage des conversations dans la base de données:', error);
  }

  contextStats.totalContextsCleanedUp += cleanCount;
  updateContextStats();

  console.log(`Nettoyage total: ${cleanCount} contextes de conversation supprimés`);
  return cleanCount;
}
