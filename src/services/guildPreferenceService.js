/**
 * Service pour gérer les préférences de guilde
 */
import { prisma } from '../models/prisma.js';

/**
 * Récupère les préférences d'une guilde
 * @param {string} guildId - ID de la guilde Discord
 * @returns {Promise<Object>} - Préférences de guilde ou objet vide
 */
export async function getGuildPreferences(guildId) {
  try {
    const preferences = await prisma.guildPreference.findUnique({
      where: {
        guildId
      }
    });

    return preferences || {};
  } catch (error) {
    console.error('Erreur lors de la récupération des préférences:', error);
    return {};
  }
}

/**
 * Enregistre les préférences d'une guilde
 * @param {string} guildId - ID de la guilde Discord
 * @param {Object} preferences - Objet contenant les préférences
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export async function saveGuildPreferences(guildId, preferences) {
  try {
    await prisma.guildPreference.upsert({
      where: {
        guildId
      },
      update: {
        ...preferences,
        updatedAt: new Date()
      },
      create: {
        guildId,
        ...preferences
      }
    });

    return true;
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement des préférences:', error);
    return false;
  }
}

/**
 * Met à jour une préférence spécifique pour une guilde
 * @param {string} guildId - ID de la guilde Discord
 * @param {string} key - Clé de la préférence à mettre à jour
 * @param {any} value - Nouvelle valeur
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export async function updateGuildPreference(guildId, key, value) {
  try {
    // Vérifier si la préférence existe
    const preference = await prisma.guildPreference.findUnique({
      where: { guildId }
    });

    if (!preference) {
      // Créer un nouvel enregistrement avec cette préférence
      const data = { [key]: value };
      await prisma.guildPreference.create({
        data: {
          guildId,
          ...data
        }
      });
    } else {
      // Mettre à jour la préférence existante
      await prisma.guildPreference.update({
        where: { guildId },
        data: {
          [key]: value,
          updatedAt: new Date()
        }
      });
    }

    return true;
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la préférence:', error);
    return false;
  }
}

export const guildPreferenceService = {
  getGuildPreferences,
  saveGuildPreferences,
  updateGuildPreference
};
