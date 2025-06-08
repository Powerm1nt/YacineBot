/**
 * Service de compatibilité pour Supabase (transition vers Prisma)
 * Maintient la compatibilité avec l'ancien code tout en utilisant les nouveaux services
 */
import { supabase } from '../app.js';
import { conversationService } from './conversationService.js';
import { guildPreferenceService } from './guildPreferenceService.js';
import { usageStatsService } from './usageStatsService.js';

/**
 * Récupère l'historique de conversation d'un utilisateur
 * @param {string} userId - ID Discord de l'utilisateur
 * @returns {Promise<Array>} - Historique de conversation ou tableau vide si aucun historique
 * @deprecated Utilisez conversationService.getConversationHistory à la place
 */
export async function getUserConversationHistory(userId) {
  try {
    // Appel au nouveau service (canal DM = userId)
    const messages = await conversationService.getConversationHistory(userId);

    // Format de retour compatible avec l'ancien code
    return messages.map(msg => ({
      role: msg.isBot ? 'assistant' : 'user',
      content: msg.content,
      userId: msg.userId,
      userName: msg.userName
    }));
  } catch (error) {
    console.error('Erreur dans getUserConversationHistory:', error);
    return [];
  }
}

/**
 * Enregistre l'historique de conversation d'un utilisateur
 * @param {string} userId - ID Discord de l'utilisateur
 * @param {Array} messages - Tableau des messages de la conversation
 * @returns {Promise<boolean>} - Succès de l'opération
 * @deprecated Utilisez conversationService.addMessage à la place
 */
export async function saveUserConversationHistory(userId, messages) {
  try {
    // Dans cette version de transition, nous allons juste ajouter le dernier message
    // plutôt que de remplacer tout l'historique
    if (messages && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      await conversationService.addMessage(
        userId, // channelId = userId pour un DM
        lastMessage.userId || userId,
        lastMessage.userName || 'Utilisateur',
        lastMessage.content,
        lastMessage.role === 'assistant'
      );
    }

    return true;
  } catch (error) {
    console.error('Erreur dans saveUserConversationHistory:', error);
    return false;
  }
}

/**
 * Supprime l'historique de conversation d'un utilisateur
 * @param {string} userId - ID Discord de l'utilisateur
 * @returns {Promise<boolean>} - Succès de l'opération
 * @deprecated Utilisez conversationService.deleteConversationHistory à la place
 */
export async function deleteUserConversationHistory(userId) {
  try {
    return await conversationService.deleteConversationHistory(userId);
  } catch (error) {
    console.error('Erreur dans deleteUserConversationHistory:', error);
    return false;
  }
}

/**
 * Enregistre une nouvelle entrée dans les statistiques d'utilisation
 * @param {string} userId - ID Discord de l'utilisateur
 * @param {string} commandType - Type de commande utilisée
 * @param {number} tokensUsed - Nombre de tokens utilisés (si applicable)
 * @returns {Promise<boolean>} - Succès de l'opération
 * @deprecated Utilisez usageStatsService.logUsage à la place
 */
export async function logUsageStatistics(userId, commandType, tokensUsed = 0) {
  return await usageStatsService.logUsage(userId, commandType, tokensUsed);
}

/**
 * Récupère les préférences utilisateur
 * @param {string} userId - ID Discord de l'utilisateur
 * @returns {Promise<Object>} - Préférences utilisateur ou objet vide
 * @deprecated Utilisez guildPreferenceService.getGuildPreferences à la place
 */
export async function getUserPreferences(userId) {
  try {
    // Rétrocompatibilité - considère les préférences utilisateur comme des préférences de guilde
    return await guildPreferenceService.getGuildPreferences(userId);
  } catch (error) {
    console.error('Erreur dans getUserPreferences:', error);
    return {};
  }
}

/**
 * Enregistre les préférences utilisateur
 * @param {string} userId - ID Discord de l'utilisateur
 * @param {Object} preferences - Objet contenant les préférences
 * @returns {Promise<boolean>} - Succès de l'opération
 * @deprecated Utilisez guildPreferenceService.saveGuildPreferences à la place
 */
export async function saveUserPreferences(userId, preferences) {
  try {
    // Rétrocompatibilité - considère les préférences utilisateur comme des préférences de guilde
    return await guildPreferenceService.saveGuildPreferences(userId, preferences);
  } catch (error) {
    console.error('Erreur dans saveUserPreferences:', error);
    return false;
  }
}

/**
 * Vérifie l'état de la connexion à Supabase
 * @returns {Promise<boolean>} - Statut de la connexion
 */
export async function checkSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('health_check').select('*').limit(1);
    return !error;
  } catch (error) {
    console.error('Erreur de connexion à Supabase:', error);
    return false;
  }
}

// Exporter un objet pour l'utilisation avec les imports nommés
export const supabaseService = {
  getUserConversationHistory,
  saveUserConversationHistory,
  deleteUserConversationHistory,
  logUsageStatistics,
  getUserPreferences,
  saveUserPreferences,
  checkSupabaseConnection
};
