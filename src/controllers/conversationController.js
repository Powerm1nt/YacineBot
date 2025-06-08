/**
 * Contrôleur pour la gestion des conversations
 */
import { conversationService } from '../services/conversationService.js';

/**
 * Récupère l'historique de conversation pour un canal
 * @param {string} channelId - ID du canal Discord
 * @param {string} guildId - ID de la guilde (facultatif pour les DMs)
 * @returns {Promise<Array>} - Historique des messages
 */
export async function getConversationHistory(channelId, guildId = null) {
  return await conversationService.getConversationHistory(channelId, guildId);
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
  return await conversationService.addMessage(channelId, userId, userName, content, isBot, guildId);
}

/**
 * Supprime l'historique de conversation d'un canal
 * @param {string} channelId - ID du canal Discord
 * @param {string} guildId - ID de la guilde (facultatif pour les DMs)
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export async function deleteConversationHistory(channelId, guildId = null) {
  return await conversationService.deleteConversationHistory(channelId, guildId);
}

/**
 * Récupère les derniers messages d'une conversation
 * @param {string} channelId - ID du canal Discord
 * @param {string} guildId - ID de la guilde (facultatif pour les DMs)
 * @param {number} limit - Nombre de messages à récupérer
 * @returns {Promise<Array>} - Messages récents
 */
export async function getRecentMessages(channelId, guildId = null, limit = 10) {
  return await conversationService.getRecentMessages(channelId, guildId, limit);
}

export const conversationController = {
  getConversationHistory,
  addMessage,
  deleteConversationHistory,
  getRecentMessages
};
