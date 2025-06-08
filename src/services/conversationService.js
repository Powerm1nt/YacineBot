/**
 * Service pour gérer les conversations
 */
import { prisma } from '../models/index.js';

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
          guildId
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
 * @returns {Promise<Object>} - Message ajouté
 */
export async function addMessage(channelId, userId, userName, content, isBot = false, guildId = null) {
  try {
    // Chercher ou créer la conversation
    let conversation = await prisma.conversation.findUnique({
      where: {
        channelId_guildId: {
          channelId,
          guildId
        }
      }
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          channelId,
          guildId
        }
      });
    } else {
      // Mettre à jour le timestamp
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() }
      });
    }

    // Ajouter le message
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        userId,
        userName,
        content,
        isBot
      }
    });

    return message;
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
          guildId
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
    const conversation = await prisma.conversation.findUnique({
      where: {
        channelId_guildId: {
          channelId,
          guildId
        }
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: limit
        }
      }
    });

    return conversation?.messages || [];
  } catch (error) {
    console.error('Erreur lors de la récupération des messages récents:', error);
    return [];
  }
}

export const conversationService = {
  getConversationHistory,
  addMessage,
  deleteConversationHistory,
  getRecentMessages
};
