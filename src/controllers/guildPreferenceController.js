/**
 * Contrôleur pour la gestion des préférences de guilde
 */
import { guildPreferenceService } from '../services/guildPreferenceService.js';

/**
 * Récupère les préférences d'une guilde
 * @param {string} guildId - ID de la guilde Discord
 * @returns {Promise<Object>} - Préférences de guilde ou objet vide
 */
export async function getGuildPreferences(guildId) {
  return await guildPreferenceService.getGuildPreferences(guildId);
}

/**
 * Enregistre les préférences d'une guilde
 * @param {string} guildId - ID de la guilde Discord
 * @param {Object} preferences - Objet contenant les préférences
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export async function saveGuildPreferences(guildId, preferences) {
  return await guildPreferenceService.saveGuildPreferences(guildId, preferences);
}

/**
 * Met à jour une préférence spécifique pour une guilde
 * @param {string} guildId - ID de la guilde Discord
 * @param {string} key - Clé de la préférence à mettre à jour
 * @param {any} value - Nouvelle valeur
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export async function updateGuildPreference(guildId, key, value) {
  return await guildPreferenceService.updateGuildPreference(guildId, key, value);
}

export const guildPreferenceController = {
  getGuildPreferences,
  saveGuildPreferences,
  updateGuildPreference
};
