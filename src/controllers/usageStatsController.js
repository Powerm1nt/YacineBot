/**
 * Contrôleur pour la gestion des statistiques d'utilisation
 */
import { usageStatsService } from '../services/usageStatsService.js';

/**
 * Enregistre une nouvelle entrée dans les statistiques d'utilisation
 * @param {string} userId - ID Discord de l'utilisateur
 * @param {string} commandType - Type de commande utilisée
 * @param {number} tokensUsed - Nombre de tokens utilisés (si applicable)
 * @param {string} guildId - ID de la guilde (facultatif)
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export async function logUsage(userId, commandType, tokensUsed = 0, guildId = null) {
  return await usageStatsService.logUsage(userId, commandType, tokensUsed, guildId);
}

/**
 * Récupère les statistiques d'utilisation d'un utilisateur
 * @param {string} userId - ID Discord de l'utilisateur
 * @param {Date} startDate - Date de début pour les statistiques
 * @param {Date} endDate - Date de fin pour les statistiques
 * @returns {Promise<Array>} - Statistiques d'utilisation
 */
export async function getUserStats(userId, startDate = null, endDate = null) {
  return await usageStatsService.getUserStats(userId, startDate, endDate);
}

/**
 * Récupère les statistiques d'utilisation d'une guilde
 * @param {string} guildId - ID Discord de la guilde
 * @param {Date} startDate - Date de début pour les statistiques
 * @param {Date} endDate - Date de fin pour les statistiques
 * @returns {Promise<Array>} - Statistiques d'utilisation
 */
export async function getGuildStats(guildId, startDate = null, endDate = null) {
  return await usageStatsService.getGuildStats(guildId, startDate, endDate);
}

export const usageStatsController = {
  logUsage,
  getUserStats,
  getGuildStats
};
