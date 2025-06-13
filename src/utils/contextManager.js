import { getContextKey } from './commandUtils.js';
import { prisma } from '../services/prisma.js';
import { conversationService } from '../services/conversationService.js';
import { convertBigIntsToStrings } from './jsonUtils.js';
import { analysisService } from '../services/analysisService.js';
import { isUsingDeepSeekAPI } from '../services/aiService.js';

const guildConversations = new Map()
const dmConversations = new Map()
const groupConversations = new Map()
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

const CLEANUP_CONFIG = {
  inactivityThreshold: 12,
  maxContexts: {
    guild: 75,
    dm: 80,
    group: 50
  },
  cleanupInterval: 2
};

setInterval(() => {
  const cleanedCount = cleanupOldContexts();
  console.log(`Nettoyage périodique des contextes: ${cleanedCount} contextes supprimés`);
  updateContextStats();
}, CLEANUP_CONFIG.cleanupInterval * 60 * 60 * 1000);

/**
 * Utility function to limit the size of participants data
 * @param {Array} participants - List of participants
 * @param {number} maxSize - Maximum size in characters
 * @returns {Array} - Filtered list of participants
 */
export function limitParticipantsSize(participants, maxSize = 450) {
  if (!participants || !Array.isArray(participants)) {
    return [];
  }

  // Sort by message count (most active first)
  const sortedParticipants = [...participants].sort((a, b) => 
    (b.messageCount || 1) - (a.messageCount || 1)
  );

  const result = [];
  let jsonSize = 0;

  // Add participants one by one until approaching the limit
  for (const p of sortedParticipants) {
    // Create simplified participant object
    const participant = {
      id: p.id,
      name: String(p.name).substring(0, 20), // Limit name length
      messageCount: p.messageCount || 1
    };

    // Calculate size with this participant added
    const testArr = [...result, participant];
    const testSize = JSON.stringify(testArr).length;

    if (testSize > maxSize) {
      break; // Stop adding if we exceed the limit
    }

    result.push(participant);
    jsonSize = testSize;
  }

  console.log(`Optimized participants: ${result.length}/${participants.length} included, size: ${jsonSize} chars`);
  return result;
}

export async function getContextData(message) {
  const context = getContextKey(message)
  let contextData = null;

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

  if (contextData) {
    return contextData;
  }

  try {
    const guildId = context.type === 'guild' ? message.guild?.id : null;
    const channelId = context.key;

    // Récupérer la conversation complète et les messages récents via conversationService
    const conversation = await prisma.conversation.findUnique({
      where: {
        channelId_guildId: {
          channelId,
          guildId: guildId || ""
        }
      },
      select: {
        lastResponseId: true,
        updatedAt: true
      }
    });

    const recentMessages = await conversationService.getRecentMessages(channelId, guildId, 10);

    if (recentMessages.length > 0) {
      const lastMessage = recentMessages[0];

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

          if (new Date(msg.createdAt) > new Date(participant.lastActive)) {
            participant.lastActive = msg.createdAt.toISOString();
          }
        }
      });

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

  return {};
}

export async function saveContextResponse(message, responseId) {
  if (!message || !responseId) {
    console.error('Invalid parameters for saveContextResponse')
    return false
  }

  // Check if we're using DeepSeek API, which has a different response ID format
  if (typeof responseId !== 'string') {
    console.error(`Format d'ID de réponse invalide: ${responseId}. L'ID doit être une chaîne de caractères.`)
    return false
  }

  // When using standard OpenAI API, response IDs must start with 'resp'
  // When using DeepSeek API, response IDs have a different format (UUID)
  if (!isUsingDeepSeekAPI() && !responseId.startsWith('resp')) {
    console.error(`Format d'ID de réponse invalide: ${responseId}. Les IDs doivent commencer par 'resp'`)
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

  try {
    const guildId = context.type === 'guild' ? message.guild?.id : null;
    const channelId = context.key;

    if (message.content) {
      // Analyser la pertinence du message de l'utilisateur
      let relevanceScore = 0.2;
      let hasKeyInfo = false;

      try {
        // Récupérer les messages récents pour le contexte
        const recentMessages = await conversationService.getRecentMessages(channelId, guildId, 3);
        const contextForAnalysis = recentMessages.length > 0 ? 
          recentMessages.map(msg => `${msg.userName}: ${msg.content}`).join('\n') : '';

        if (analysisService && typeof analysisService.analyzeMessageRelevance === 'function') {
          const analysis = await analysisService.analyzeMessageRelevance(message.content, contextForAnalysis);
          relevanceScore = analysis.relevanceScore;
          hasKeyInfo = analysis.hasKeyInfo;
        }
      } catch (analysisError) {
        console.error('Erreur lors de l\'analyse du message:', analysisError);
      }

      // Ajouter le message avec les scores d'analyse
      await conversationService.addMessage(
        channelId,
        message.author.id,
        authorName,
        message.content,
        false,
        guildId,
        relevanceScore,
        hasKeyInfo,
        false // isAnalyzed parameter (default false)
      );
    }

    try {
      await prisma.conversation.upsert({
        where: {
          channelId_guildId: {
            channelId: channelId,
            guildId: guildId || ""
          }
        },
        update: {
          lastResponseId: responseId,
          updatedAt: new Date()
        },
        create: {
          channelId: channelId,
          guildId: guildId || "",
          lastResponseId: responseId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de l\'ID de réponse dans la base de données:', error);
    }

    if (isNewContext) {
      contextStats.totalContextsCreated++;

      const currentSize = {
        guild: guildConversations.size,
        dm: dmConversations.size,
        group: groupConversations.size
      };

      const maxSize = CLEANUP_CONFIG.maxContexts[context.type];
      if (currentSize[context.type] > maxSize * 0.9) {
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

async function getParticipants(context, userId, userName) {
  let contextData = {}

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

  const existingIndex = participants.findIndex(p => p.id === userId)

  if (existingIndex >= 0) {
    const existing = participants[existingIndex]
    participants.splice(existingIndex, 1)

    participants.unshift({
      ...existing,
      name: userName,
      messageCount: (existing.messageCount || 0) + 1,
      lastActive: new Date().toISOString()
    })
  } else {
    participants.unshift({
      id: userId,
      name: userName,
      messageCount: 1,
      firstSeen: new Date().toISOString(),
      lastActive: new Date().toISOString()
    })
  }

  return participants.slice(0, 10)
}

export async function resetContext(message) {
  if (!message) {
    console.error('Invalid message object passed to resetContext')
    return false
  }

  const context = getContextKey(message)

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

export async function getLastResponseId(message) {
  const context = getContextKey(message);
  const guildId = context.type === 'guild' ? message.guild?.id : null;
  const channelId = context.key;

  try {
    const conversation = await prisma.conversation.findUnique({
      where: {
        channelId_guildId: {
          channelId: channelId,
          guildId: guildId || ""
        }
      },
      select: {
        lastResponseId: true
      }
    });

    if (conversation?.lastResponseId &&
        typeof conversation.lastResponseId === 'string' &&
        conversation.lastResponseId.startsWith('resp')) {
      return conversation.lastResponseId;
    }
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'ID de réponse depuis la base de données:', error);
  }

  return null;
}

export function getParticipantsList(message) {
  const contextData = getContextData(message)
  return contextData.participants || []
}

export function formatParticipantsInfo(participants) {
  if (!participants || participants.length === 0) {
    return ''
  }

  const participantsInfo = participants.map(p => {
    return `${p.name} (ID: ${p.id})`
  }).join(', ')

  return `[Participants: ${participantsInfo}]`
}

function updateContextStats() {
  contextStats.contextCounts = {
    guild: guildConversations.size,
    dm: dmConversations.size,
    group: groupConversations.size,
    total: guildConversations.size + dmConversations.size + groupConversations.size
  };
  return contextStats;
}

export function getContextStats() {
  updateContextStats();
  return {
    ...contextStats,
    memoryUsage: process.memoryUsage(),
    config: CLEANUP_CONFIG
  };
}

/**
 * Partage une conversation avec un utilisateur spécifié
 * @param {Object} message - Message Discord pour obtenir le contexte
 * @param {string} shareWithUserId - ID de l'utilisateur avec qui partager
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export async function shareContextWithUser(message, shareWithUserId) {
  try {
    if (!message || !shareWithUserId) return false;

    const context = getContextKey(message);
    const channelId = context.key;
    const guildId = context.type === 'guild' ? message.guild?.id : null;

    // Utiliser le service d'analyse pour partager la conversation
    return await analysisService.shareConversation(channelId, guildId, shareWithUserId);
  } catch (error) {
    console.error('Erreur lors du partage du contexte:', error);
    return false;
  }
}

/**
 * Récupère les conversations partagées avec un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Array>} - Liste des conversations partagées
 */
export async function getSharedContexts(userId) {
  try {
    if (!userId) return [];

    // Utiliser le service d'analyse pour récupérer les conversations partagées
    return await analysisService.getSharedConversations(userId);
  } catch (error) {
    console.error('Erreur lors de la récupération des contextes partagés:', error);
    return [];
  }
}

/**
 * Récupère tous les contextes en mémoire
 * @returns {Array} Tableau de tous les contextes
 */
export function getAllContexts() {
  const contexts = [];

  // Parcourir les contextes de serveur
  guildConversations.forEach((data, key) => {
    contexts.push({
      type: 'guild',
      key,
      data: convertBigIntsToStrings(JSON.parse(JSON.stringify(data)))
    });
  });

  // Parcourir les contextes de messages privés
  dmConversations.forEach((data, key) => {
    contexts.push({
      type: 'dm',
      key,
      data: convertBigIntsToStrings(JSON.parse(JSON.stringify(data)))
    });
  });

  // Parcourir les contextes de groupes
  groupConversations.forEach((data, key) => {
    contexts.push({
      type: 'group',
      key,
      data: convertBigIntsToStrings(JSON.parse(JSON.stringify(data)))
    });
  });

  return contexts;
}

export async function cleanupOldContexts() {
  let cleanCount = 0
  const now = new Date()
  const inactivityThreshold = CLEANUP_CONFIG.inactivityThreshold || 24;
  const inactivityDate = new Date(now.getTime() - inactivityThreshold * 60 * 60 * 1000);

  contextStats.lastCleanupTime = now.toISOString();

  const cleanupStorage = (storage, type) => {
    let count = 0;
    let entriesArray = [];

    storage.forEach((contextData, contextKey) => {
      entriesArray.push({
        key: contextKey,
        data: contextData,
        lastActivity: contextData.lastMessageTimestamp ? new Date(contextData.lastMessageTimestamp) : new Date(0)
      });
    });

    const inactiveEntries = entriesArray.filter(entry => entry.lastActivity < inactivityDate);
    inactiveEntries.forEach(entry => {
      storage.delete(entry.key);
      count++;
    });

    const maxAllowed = CLEANUP_CONFIG.maxContexts[type.toLowerCase()] || 100;
    if (storage.size > maxAllowed) {
      entriesArray.sort((a, b) => a.lastActivity - b.lastActivity);

      const excessCount = storage.size - maxAllowed;
      entriesArray.slice(0, excessCount).forEach(entry => {
        if (storage.has(entry.key)) {
          storage.delete(entry.key);
          count++;
        }
      });
    }

    console.log(`Nettoyage de ${count} contextes de conversation ${type} en mémoire (inactifs: ${inactiveEntries.length}, taille: ${storage.size}/${maxAllowed})`);
    return count;
  };

  cleanCount += cleanupStorage(guildConversations, 'guild');
  cleanCount += cleanupStorage(dmConversations, 'dm');
  cleanCount += cleanupStorage(groupConversations, 'group');

  try {
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
