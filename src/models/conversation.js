/**
 * Modèle de données pour les conversations
 */
import { prisma } from './index.js';

/**
 * Récupère une conversation par son ID de canal et de guilde
 */
export async function getConversationByChannelId(channelId, guildId = null) {
  return await prisma.conversation.findUnique({
    where: {
      channelId_guildId: {
        channelId,
        guildId
      }
    },
    include: {
      messages: true
    }
  });
}

/**
 * Crée une nouvelle conversation
 */
export async function createConversation(channelId, guildId = null) {
  return await prisma.conversation.create({
    data: {
      channelId,
      guildId
    }
  });
}

/**
 * Met à jour une conversation
 */
export async function updateConversation(id, data) {
  return await prisma.conversation.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date()
    }
  });
}

/**
 * Ajoute un message à une conversation
 */
export async function addMessageToConversation(conversationId, message) {
  return await prisma.message.create({
    data: {
      conversationId,
      userId: message.userId,
      userName: message.userName,
      content: message.content,
      isBot: message.isBot || false
    }
  });
}

/**
 * Supprime une conversation et tous ses messages
 */
export async function deleteConversation(channelId, guildId = null) {
  return await prisma.conversation.delete({
    where: {
      channelId_guildId: {
        channelId,
        guildId
      }
    }
  });
}

export const conversationModel = {
  getConversationByChannelId,
  createConversation,
  updateConversation,
  addMessageToConversation,
  deleteConversation
};
