/**
 * Service pour gérer les conversations
 */
import { prisma } from './prisma.js';

/**
 * Map pour suivre les conversations actives et les blocs de messages
 * Structure: Map<channelId-guildId, { lastActivity: Date, messageCount: number }>
 */
const activeConversations = new Map();

/**
 * Délai d'inactivité en ms avant qu'une conversation soit considérée comme terminée
 */
const CONVERSATION_TIMEOUT = 60000; // 1 minute

/**
 * Vérifie si une conversation est active dans le canal spécifié
 * @param {string} channelId - ID du canal
 * @param {string} guildId - ID de la guilde (facultatif)
 * @returns {boolean} - True si la conversation est active
 */
export function isActiveConversation(channelId, guildId = null) {
  const key = `${channelId}-${guildId || 'dm'}`;
  const conversation = activeConversations.get(key);

  if (!conversation) return false;

  // Vérifier si la conversation n'a pas expiré
  const now = new Date();
  const elapsed = now - conversation.lastActivity;

  if (elapsed > CONVERSATION_TIMEOUT) {
    // La conversation a expiré, la supprimer
    activeConversations.delete(key);
    console.log(`[ConversationService] Conversation expirée dans le canal ${channelId} après ${elapsed}ms d'inactivité`);
    return false;
  }

  return true;
}

/**
 * Enregistre une activité dans la conversation
 * @param {string} channelId - ID du canal
 * @param {string} guildId - ID de la guilde (facultatif)
 */
export function registerConversationActivity(channelId, guildId = null) {
  const key = `${channelId}-${guildId || 'dm'}`;
  const conversation = activeConversations.get(key) || { messageCount: 0 };

  conversation.lastActivity = new Date();
  conversation.messageCount++;

  activeConversations.set(key, conversation);
  console.log(`[ConversationService] Activité enregistrée dans le canal ${channelId} - Total: ${conversation.messageCount} messages`);
}

/**
 * Récupère l'historique de conversation pour un canal
 * @param {string} channelId - ID du canal Discord
 * @param {string} guildId - ID de la guilde (facultatif pour les DMs)
 * @returns {Promise<Array>} - Historique des messages
 */
export async function getConversationHistory(channelId, guildId = null) {
  try {
    // Chercher la conversation existante
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

    return conversation?.messages || [];
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique:', error);
    return [];
  }
}

/**
 * Ajoute un nouveau message à une conversation
 * @param {string} channelId - ID du canal Discord
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userName - Nom de l'utilisateur
 * @param {string} content - Contenu du message
 * @param {boolean} isBot - Si le message est d'un bot
 * @param {string} guildId - ID de la guilde (facultatif pour les DMs)
 * @param {number} relevanceScore - Score de pertinence du message (0-1)
 * @param {boolean} hasKeyInfo - Si le message contient des informations clés
 * @param {boolean} isAnalyzed - Si le message a déjà été analysé
 * @param {string} channelName - Nom du canal Discord (facultatif)
 * @returns {Promise<Object>} - Message ajouté
 */
export async function addMessage(channelId, userId, userName, content, isBot = false, guildId = null, relevanceScore = 0, hasKeyInfo = false, isAnalyzed = false, channelName = null) {
  try {
    // Enregistrer l'activité de conversation
    registerConversationActivity(channelId, guildId);

    // Chercher ou créer la conversation avec upsert pour éviter les erreurs de contrainte unique
    const conversation = await prisma.conversation.upsert({
      where: {
        channelId_guildId: {
          channelId,
          guildId: guildId || ""
        }
      },
      update: {
        updatedAt: new Date()
        // Ne pas mettre à jour le nom du canal ici car il n'est pas reconnu comme argument
      },
      create: {
        channelId,
        guildId: guildId || "",
        // Ne pas essayer de définir channelName lors de la création
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Si un nom de canal est fourni, le mettre à jour séparément après la création de la conversation
    if (channelName) {
      await setChannelName(channelId, guildId, channelName);
    }

    // Ajouter le message avec les scores de pertinence
    return await prisma.message.create({
      data: {
        conversationId: conversation.id,
        userId,
        userName,
        content,
        isBot,
        relevanceScore,
        hasKeyInfo,
        isAnalyzed
      }
    });
  } catch (error) {
    console.error('Erreur lors de l\'ajout du message:', error);
    throw error;
  }
}

/**
 * Supprime l'historique de conversation d'un canal
 * @param {string} channelId - ID du canal Discord
 * @param {string} guildId - ID de la guilde (facultatif pour les DMs)
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export async function deleteConversationHistory(channelId, guildId = null) {
  try {
    await prisma.conversation.delete({
      where: {
        channelId_guildId: {
          channelId,
          guildId: guildId || ""
        }
      }
    });

    return true;
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'historique:', error);
    return false;
  }
}

/**
 * Récupère les derniers messages d'une conversation
 * @param {string} channelId - ID du canal Discord
 * @param {string} guildId - ID de la guilde (facultatif pour les DMs)
 * @param {number} limit - Nombre de messages à récupérer
 * @returns {Promise<Array>} - Messages récents
 */
export async function getRecentMessages(channelId, guildId = null, limit = 10) {
  try {
    console.log(`[ConversationService] Récupération des messages pour le canal ${channelId}, serveur ${guildId || 'DM'}, limite ${limit}`);

    // Get the conversation ID first
    const conversation = await prisma.conversation.findUnique({
      where: {
        channelId_guildId: {
          channelId,
          guildId: guildId || ""
        }
      },
      select: {
        id: true
      }
    });

    if (!conversation) {
      console.log(`[ConversationService] Aucune conversation trouvée pour le canal ${channelId}`);
      return [];
    }

    // Get relevant messages (relevanceScore >= 0.6)
    const relevantMessages = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        relevanceScore: { gte: 0.6 }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`[ConversationService] ${relevantMessages.length} messages pertinents trouvés (relevanceScore >= 0.6)`);

    // Get recent messages
    const recentMessages = await prisma.message.findMany({
      where: {
        conversationId: conversation.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    console.log(`[ConversationService] ${recentMessages.length} messages récents trouvés (limité à ${limit})`);

    // Combine both sets, remove duplicates by ID, and sort by creation date (newest first)
    const messageMap = new Map();

    // Add all messages to the map with ID as key to remove duplicates
    [...relevantMessages, ...recentMessages].forEach(msg => {
      messageMap.set(msg.id, msg);
    });

    // Convert map values to array and sort by creation date
    const combinedMessages = Array.from(messageMap.values()).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    console.log(`[ConversationService] ${combinedMessages.length} messages combinés après déduplication`);

    return combinedMessages;
  } catch (error) {
    console.error('Erreur lors de la récupération des messages récents:', error);
    return [];
  }
}

// Helper to update channel name for a conversation
async function updateChannelName(channelId, guildId, channelName) {
  if (!channelName) return null;

  try {
    return await prisma.conversation.update({
      where: {
        channelId_guildId: {
          channelId,
          guildId: guildId || ""
        }
      },
      data: {
        channelName
      }
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du nom du canal:', error);
    return null;
  }
}

/**
 * Mise à jour du nom de canal pour une conversation existante
 * Séparé de l'upsert pour éviter les erreurs de validation Prisma
 * @param {string} channelId - ID du canal Discord
 * @param {string} guildId - ID de la guilde (facultatif)
 * @param {string} channelName - Nom du canal à mettre à jour
 * @returns {Promise<Object|null>} - Conversation mise à jour ou null en cas d'erreur
 */
async function setChannelName(channelId, guildId, channelName) {
  if (!channelName) return null;

  try {
    console.log(`[ConversationService] Mise à jour du nom de canal pour ${channelId} avec ${channelName}`);
    return await updateChannelName(channelId, guildId, channelName);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du nom du canal:', error);
    return null;
  }
}

export const conversationService = {
  getConversationHistory,
  addMessage,
  deleteConversationHistory,
  getRecentMessages,
  isActiveConversation,
  registerConversationActivity,
  updateChannelName,
  setChannelName
};
