/**
 * Modèle de données pour les préférences de guilde
 */
import { prisma } from './index.js';

/**
 * Récupère les préférences d'une guilde par son ID
 */
export async function getGuildPreferenceById(guildId) {
  return await prisma.guildPreference.findUnique({
    where: { guildId }
  });
}

/**
 * Crée de nouvelles préférences pour une guilde
 */
export async function createGuildPreference(guildId, data) {
  return await prisma.guildPreference.create({
    data: {
      guildId,
      ...data
    }
  });
}

/**
 * Met à jour les préférences d'une guilde
 */
export async function updateGuildPreference(guildId, data) {
  return await prisma.guildPreference.update({
    where: { guildId },
    data: {
      ...data,
      updatedAt: new Date()
    }
  });
}

/**
 * Supprime les préférences d'une guilde
 */
export async function deleteGuildPreference(guildId) {
  return await prisma.guildPreference.delete({
    where: { guildId }
  });
}

/**
 * Crée ou met à jour les préférences d'une guilde
 */
export async function upsertGuildPreference(guildId, data) {
  return await prisma.guildPreference.upsert({
    where: { guildId },
    update: {
      ...data,
      updatedAt: new Date()
    },
    create: {
      guildId,
      ...data
    }
  });
}

export const guildPreferenceModel = {
  getGuildPreferenceById,
  createGuildPreference,
  updateGuildPreference,
  deleteGuildPreference,
  upsertGuildPreference
};
