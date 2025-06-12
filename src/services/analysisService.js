import { OpenAI } from 'openai/client.mjs'
import dotenv from 'dotenv'
import { prisma } from './prisma.js'
import { safeJsonParse } from '../utils/jsonUtils.js'

dotenv.config();

const ai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
});

/**
 * Service d'analyse des conversations pour évaluer la pertinence des messages
 */

/**
 * Délai d'attente entre les analyses de messages groupés (en ms)
 * Permet d'éviter de suralimenter les conversations avec trop de réponses rapides
 */
const MESSAGE_BATCH_DELAY = 5000; // 5 secondes
const messageBatchTimers = new Map(); // Pour suivre les délais par canal

/**
 * Vérifie si un délai d'attente est actif pour le canal
 * @param {string} channelId - ID du canal
 * @param {string} guildId - ID du serveur (optionnel)
 * @returns {boolean} - True si un délai est actif
 */
export function isWaitingForMoreMessages(channelId, guildId = null) {
  const key = `${channelId}-${guildId || 'dm'}`;
  return messageBatchTimers.has(key);
}

/**
 * Démarre un délai d'attente pour le canal spécifié
 * @param {string} channelId - ID du canal
 * @param {string} guildId - ID du serveur (optionnel)
 * @returns {Promise<void>}
 */
export function startMessageBatchDelay(channelId, guildId = null) {
  const key = `${channelId}-${guildId || 'dm'}`;

  // Si un délai existe déjà, le réinitialiser
  if (messageBatchTimers.has(key)) {
    clearTimeout(messageBatchTimers.get(key));
  }

  // Créer un nouveau délai
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      messageBatchTimers.delete(key);
      console.log(`[AnalysisService] Délai d'attente terminé pour le canal ${channelId}`);
      resolve();
    }, MESSAGE_BATCH_DELAY);

    messageBatchTimers.set(key, timer);
    console.log(`[AnalysisService] Délai d'attente démarré pour le canal ${channelId} (${MESSAGE_BATCH_DELAY}ms)`);
  });
}

/**
 * Évalue la pertinence d'un message
 * @param {string} content - Contenu du message
 * @param {string} contextInfo - Informations de contexte (optionnel)
 * @returns {Promise<Object>} - Résultat d'analyse avec score et hasKeyInfo
 */
  export async function analyzeMessageRelevance(content, contextInfo = '', isFromBot = false, channelName = '', guildId = null, channelPermissions = null) {
  try {
    console.log(`[AnalysisService] Analyse de pertinence demandée - Contenu: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}", Contexte: ${contextInfo ? 'Fourni' : 'Non fourni'}, Bot: ${isFromBot}, Canal: ${channelName || 'Non spécifié'}, Serveur: ${guildId || 'DM'}`);

    // Vérifier si le bot a les permissions d'écriture dans ce canal
    if (channelPermissions && !channelPermissions.has('SEND_MESSAGES')) {
      console.log(`[AnalysisService] Pas de permission d'écriture dans le canal - Analyse annulée`);
      return { relevanceScore: 0, hasKeyInfo: false };
    }

    // Vérifier si le guild est activé (pour les messages de serveur)
    if (guildId) {
      const { isGuildEnabled, isSchedulerEnabled, isAnalysisEnabled } = await import('../utils/configService.js');

      // Vérifier si le service de planification et l'analyse sont activés
      if (!(await isSchedulerEnabled())) {
        console.log(`[AnalysisService] Le service de planification est désactivé - Analyse annulée`);
        return { relevanceScore: 0, hasKeyInfo: false };
      }

      if (!(await isAnalysisEnabled())) {
        console.log(`[AnalysisService] L'analyse de pertinence est désactivée - Analyse annulée`);
        return { relevanceScore: 0, hasKeyInfo: false };
      }

      if (!(await isGuildEnabled(guildId))) {
        console.log(`[AnalysisService] Le serveur ${guildId} est désactivé - Analyse annulée`);
        return { relevanceScore: 0, hasKeyInfo: false };
      }
    }

    if (!content || content.trim() === '') {
      console.log('[AnalysisService] Contenu vide, retour score zéro');
      return { relevanceScore: 0, hasKeyInfo: false };
    }

    // Si le message provient d'un bot, ne pas analyser pour économiser des appels API
    if (isFromBot) {
      console.log('[AnalysisService] Message provenant d\'un bot, analyse ignorée');
      return { relevanceScore: 0.1, hasKeyInfo: false }; // Score par défaut plus élevé pour les bots avec indicateur d'information clé
    }

    // Ajuster le score initial en fonction du canal
    let channelRelevanceModifier = 0.2; // Bonus par défaut pour tous les canaux
    if (channelName) {
      const channelNameLower = channelName.toLowerCase();
      // Canaux où on est plus susceptible de vouloir participer
      if (channelNameLower.includes('général') || channelNameLower.includes('general') || 
          channelNameLower.includes('discussion') || channelNameLower.includes('chat') ||
          channelNameLower.includes('meme') || channelNameLower.includes('fun') ||
          channelNameLower.includes('social') || channelNameLower.includes('random')) {
        channelRelevanceModifier = 0.4; // Beaucoup plus susceptible de répondre
      }
      // Canaux où on est moins susceptible de vouloir participer
      else if (channelNameLower.includes('admin') || channelNameLower.includes('mod') || 
               channelNameLower.includes('annonce') || channelNameLower.includes('règle') ||
               channelNameLower.includes('important')) {
        channelRelevanceModifier = 0; // Neutre pour ces canaux
      }
    }

    const systemInstructions = `Tu es un système d'analyse de pertinence de messages. 

Évalue la pertinence du message fourni selon les critères suivants:
1. Pertinence dans la conversation
2. Informations utiles ou importantes contenues dans le message
3. Potentiel d'apporter de la valeur à la conversation
4. Adéquation au canal dans lequel le message est posté (si spécifié)

Réponds UNIQUEMENT au format JSON brut (sans formatage markdown, sans bloc de code) avec deux propriétés:
- relevanceScore: un nombre entre 0 et 1 (0 = non pertinent, 1 = très pertinent)
- hasKeyInfo: booléen indiquant si le message contient des informations clés importantes (true/false)

IMPORTANT: N'utilise PAS de bloc de code markdown (\`\`\`) dans ta réponse, renvoie uniquement l'objet JSON brut.`;

    console.log('[AnalysisService] Envoi de la demande d\'analyse à l\'API OpenAI');

    const channelContext = channelName ? `Canal: #${channelName}\n` : '';

    const response = await ai.responses.create({
      model: 'gpt-4.1-nano',
      input: `${channelContext}${contextInfo ? 'Contexte: ' + contextInfo + '\n\n' : ''}Message à analyser: ${content}`,
      instructions: systemInstructions,
    });

    console.log('[AnalysisService] Réponse reçue de l\'API OpenAI');

    // Extraire le JSON de la réponse
    const result = safeJsonParse(response.output_text, null);

    // Valider le format
    if (!result || typeof result.relevanceScore !== 'number' || typeof result.hasKeyInfo !== 'boolean') {
      console.error('[AnalysisService] Format de réponse invalide:', response.output_text);
      return { relevanceScore: 0.4, hasKeyInfo: false };
    }

    // Appliquer le modificateur basé sur le canal si présent
    if (channelRelevanceModifier && result.relevanceScore) {
      const adjustedScore = Math.min(1, Math.max(0, result.relevanceScore + channelRelevanceModifier));
      console.log(`[AnalysisService] Score ajusté pour le canal #${channelName}: ${result.relevanceScore.toFixed(2)} -> ${adjustedScore.toFixed(2)}`);
      result.relevanceScore = adjustedScore;
    }

    console.log(`[AnalysisService] Analyse complétée - Score final: ${result.relevanceScore.toFixed(2)}, InfoClé: ${result.hasKeyInfo}`);
    return result;
  } catch (error) {
    console.error('Erreur lors de l\'analyse de pertinence:', error);
    return { relevanceScore: 0, hasKeyInfo: false }; // Valeur par défaut en cas d'erreur
  }
}

/**
 * Évalue la pertinence globale d'une conversation et génère un résumé
 * @param {Array} messages - Liste des messages de la conversation
 * @returns {Promise<Object>} - Résultat avec score global et résumé
 */
export async function analyzeConversationRelevance(messages) {
  try {
    console.log(`[AnalysisService] Analyse de conversation demandée - ${messages?.length || 0} messages`);

    if (!messages || messages.length === 0) {
      console.log('[AnalysisService] Aucun message à analyser, retour score zéro');
      return { relevanceScore: 0, topicSummary: null };
    }

    // Limiter le nombre de messages pour l'analyse
    const messagesToAnalyze = messages.slice(-20);
    console.log(`[AnalysisService] Analyse limitée à ${messagesToAnalyze.length} messages récents`);

    const messageContent = messagesToAnalyze.map(msg => {
      return `${msg.userName}: ${msg.content}`;
    }).join('\n');

    const systemInstructions = `Tu es un système d'analyse de pertinence de conversations.

Analyse la conversation fournie et réponds UNIQUEMENT au format JSON brut (sans formatage markdown, sans bloc de code) avec deux propriétés:
- relevanceScore: un nombre entre 0 et 1 indiquant la pertinence globale de la conversation
- topicSummary: un résumé concis (max 100 caractères) des principaux sujets abordés

IMPORTANT: N'utilise PAS de bloc de code markdown (\`\`\`) dans ta réponse, renvoie uniquement l'objet JSON brut.`;

    const response = await ai.responses.create({
      model: 'gpt-4.1-nano',
      input: `Conversation à analyser:\n${messageContent}`,
      instructions: systemInstructions,
    });

    // Extraire le JSON de la réponse
    const result = safeJsonParse(response.output_text, null);

    // Valider le format
    if (!result || typeof result.relevanceScore !== 'number' || typeof result.topicSummary !== 'string') {
      console.error('Format de réponse invalide pour la conversation:', response.output_text);
      return { relevanceScore: 0.5, topicSummary: 'Analyse impossible' };
    }

    return result;
  } catch (error) {
    console.error('Erreur lors de l\'analyse de la conversation:', error);
    return { relevanceScore: 0.5, topicSummary: 'Erreur d\'analyse' };
  }
}

/**
 * Met à jour le score de pertinence d'une conversation existante
 * @param {string} channelId - ID du canal
 * @param {string} guildId - ID de la guilde (optionnel)
 * @param {Object} client - Client Discord (optionnel, pour créer des tâches planifiées)
 * @returns {Promise<Object>} - Résultat de la mise à jour
 */
export async function updateConversationRelevance(channelId, guildId = null, client = null) {
  try {
    console.log(`[AnalysisService] Mise à jour de la pertinence de conversation - Canal: ${channelId}, Serveur: ${guildId || 'DM'}`);

    // Vérifier si le bot a les permissions d'écriture dans ce canal
    if (client) {
      try {
        const formattedChannelId = channelId.split("_")[1];
        const channel = await client.channels.fetch(formattedChannelId);
        if (channel) {
          // Vérifier si le canal est dans une guilde (serveur)
          if (channel.guild) {
            // Obtenir l'objet membre de la guilde qui représente le bot
            const botMember = channel.guild.members.me || await channel.guild.members.fetch(client.user.id);
            const botPermissions = channel.permissionsFor(botMember);
            if (!botPermissions || !botPermissions.has('SEND_MESSAGES')) {
              console.log(`[AnalysisService] Pas de permission d'écriture dans le canal ${channelId} - Analyse annulée`);
              return null;
            }
          } else {
            // Pour les canaux hors guilde (DM par exemple), on suppose que le bot peut écrire
            console.log(`[AnalysisService] Canal ${channelId} hors serveur - Permission d'écriture supposée`);
          }
        }
      } catch (permError) {
        console.error('[AnalysisService] Erreur lors de la vérification des permissions:', permError);
      }
    }

    // Vérifier si le guild est activé (pour les messages de serveur)
    if (guildId) {
      const { isGuildEnabled, isSchedulerEnabled, isAnalysisEnabled } = await import('../utils/configService.js');

      // Vérifier si le service de planification et l'analyse sont activés
      if (!(await isSchedulerEnabled())) {
        console.log(`[AnalysisService] Le service de planification est désactivé - Analyse annulée pour le canal ${channelId}`);
        return null;
      }

      if (!(await isAnalysisEnabled())) {
        console.log(`[AnalysisService] L'analyse de pertinence est désactivée - Analyse annulée pour le canal ${channelId}`);
        return null;
      }

      if (!(await isGuildEnabled(guildId))) {
        console.log(`[AnalysisService] Le serveur ${guildId} est désactivé - Analyse annulée pour le canal ${channelId}`);
        return null;
      }
    }

    // Récupérer la conversation et ses messages
    const conversation = await prisma.conversation.findUnique({
      where: {
        channelId_guildId: {
          channelId,
          guildId: guildId || ""
        }
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!conversation) {
      console.log(`[AnalysisService] Aucune conversation trouvée pour Canal: ${channelId}, Serveur: ${guildId || 'DM'}`);
      return null;
    }

    console.log(`[AnalysisService] Conversation trouvée - ID: ${conversation.id}, ${conversation.messages.length} messages`);

    if (!conversation) {
      return null;
    }

    // Analyser la conversation
    const analysis = await analyzeConversationRelevance(conversation.messages);

    // Mettre à jour la conversation dans la base de données
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        relevanceScore: analysis.relevanceScore,
        topicSummary: analysis.topicSummary,
        updatedAt: new Date()
      }
    });

    // Si le client est fourni et que le service de surveillance des messages est disponible,
    // créer une tâche planifiée si la conversation est pertinente (seuil fortement abaissé)
    if (!(client && analysis.relevanceScore >= 0.4)) {
      if (client) {
        console.log(`[AnalysisService] Score de pertinence trop faible (${analysis.relevanceScore.toFixed(2)}) - Pas de tâche planifiée`)
      }
    } else {
      console.log(`[AnalysisService] Score de pertinence suffisant (${analysis.relevanceScore.toFixed(2)}) - Tentative de création de tâche planifiée`)
      try {
        const { messageMonitoringService } = await import('./messageMonitoringService.js')
        const taskCreated = await messageMonitoringService.createScheduledTask(
          client,
          channelId,
          guildId,
          analysis.relevanceScore,
          analysis.topicSummary
        )

        if (taskCreated) {
          console.log(`[AnalysisService] Tâche planifiée créée avec succès pour le canal ${channelId} - Sujet: "${analysis.topicSummary}"`)
        } else {
          console.log(`[AnalysisService] Création de tâche planifiée échouée ou ignorée pour le canal ${channelId}`)
        }
      } catch (taskError) {
        console.error('[AnalysisService] Erreur lors de la création d\'une tâche planifiée pour la conversation:', taskError)
      }
    }

    return updatedConversation;
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la pertinence de la conversation:', error);
    return null;
  }
}

/**
 * Partage une conversation avec un utilisateur spécifié
 * @param {string} channelId - ID du canal de la conversation
 * @param {string} guildId - ID de la guilde (optionnel)
 * @param {string} shareWithUserId - ID de l'utilisateur avec qui partager
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export async function shareConversation(channelId, guildId = null, shareWithUserId) {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: {
        channelId_guildId: {
          channelId,
          guildId: guildId || ""
        }
      }
    });

    if (!conversation) {
      return false;
    }

    // Récupérer la liste actuelle des partages
    let sharedWith = conversation.sharedWith || [];

    // Ajouter l'utilisateur s'il n'est pas déjà dans la liste
    if (!sharedWith.includes(shareWithUserId)) {
      sharedWith.push(shareWithUserId);
    }

    // Mettre à jour la conversation
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        isShared: true,
        sharedWith: sharedWith,
        updatedAt: new Date()
      }
    });

    return true;
  } catch (error) {
    console.error('Erreur lors du partage de la conversation:', error);
    return false;
  }
}

/**
 * Récupère les conversations partagées avec un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Array>} - Liste des conversations partagées
 */
export async function getSharedConversations(userId) {
  try {
    // Trouver toutes les conversations partagées avec cet utilisateur
    return await prisma.conversation.findMany({
      where: {
        isShared: true,
        sharedWith: { has: userId }
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc'
          },
          // Récupérer uniquement les messages pertinents pour un aperçu
          where: {
            OR: [
              { hasKeyInfo: true },
              { relevanceScore: { gte: 0.7 } }
            ]
          }
        }
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des conversations partagées:', error);
    return [];
  }
}

/**
 * Vérifie si le système a atteint la limite de tâches actives
 * @returns {boolean} - true si la limite est atteinte, false sinon
 */
function isTaskLimitReached() {
  try {
    // Import dynamique pour éviter les références circulaires
    const MAX_ACTIVE_TASKS = parseInt(process.env.MAX_ACTIVE_TASKS || '100', 10);

    // Vérifier avec taskService combien de tâches sont actives
    return taskService.getActiveTaskCount() >= MAX_ACTIVE_TASKS;
  } catch (error) {
    console.error('Erreur lors de la vérification de la limite de tâches:', error);
    return false; // Par défaut, on suppose que la limite n'est pas atteinte
  }
}

export const analysisService = {
  analyzeMessageRelevance,
  analyzeConversationRelevance,
  updateConversationRelevance,
  shareConversation,
  getSharedConversations,
  isWaitingForMoreMessages,
  startMessageBatchDelay,
  isTaskLimitReached
};
