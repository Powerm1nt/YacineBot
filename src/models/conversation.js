import { prisma } from './index.js';

/**
 * Modèle de données pour les conversations
 */

/**
 * Récupère une conversation par son ID de canal et de guilde
 */
export async function getConversationByChannelId(channelId, guildId = null) {
  return prisma.conversation.findUnique({
    where: {
      channelId_guildId: {
        channelId,
        guildId: guildId || ""
      }
    },
    include: {
      messages: true
    }
  })
}

/**
 * Crée une nouvelle conversation
 */
export async function createConversation(channelId, guildId = null) {
  return prisma.conversation.create({
    data: {
      channelId,
      guildId: guildId || ""
    }
  })
}

/**
 * Met à jour une conversation
 */
export async function updateConversation(id, data) {
  return prisma.conversation.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date()
    }
  })
}

/**
 * Ajoute un message à une conversation
 */
export async function addMessageToConversation(conversationId, message) {
  return prisma.message.create({
    data: {
      conversationId,
      userId: message.userId,
      userName: message.userName,
      content: message.content,
      isBot: message.isBot || false
    }
  })
}

/**
 * Supprime une conversation et tous ses messages
 */
export async function deleteConversation(channelId, guildId = null) {
  return prisma.conversation.delete({
    where: {
      channelId_guildId: {
        channelId,
        guildId: guildId || ""
      }
    }
  })
}

