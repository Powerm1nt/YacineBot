import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Configuration par défaut
 */
const defaultConfig = {
  // Configuration des canaux pour le scheduler
  scheduler: {
    // Configuration des serveurs (guild)
    guilds: {},
    // Configuration des utilisateurs (DM)
    users: {},
    // Configuration globale par type de canal
    channelTypes: {
      guild: true,    // Serveurs activés par défaut
      dm: true,       // Messages privés activés par défaut
      group: true     // Groupes activés par défaut
    }
  }
};

/**
 * Clé utilisée pour stocker la configuration principale dans la base de données
 */
const MAIN_CONFIG_KEY = 'main';

/**
 * Charge la configuration du bot depuis la base de données
 * @returns {Object} - Configuration chargée
 */
export async function loadConfig() {
  try {
    // Rechercher la configuration dans la base de données
    const configRecord = await prisma.config.findUnique({
      where: { key: MAIN_CONFIG_KEY }
    });

    if (configRecord) {
      return configRecord.value;
    } else {
      // Si aucune configuration n'existe, créer une nouvelle avec les valeurs par défaut
      await saveConfig(defaultConfig);
      return defaultConfig;
    }
  } catch (error) {
    console.error('Erreur lors du chargement de la configuration:', error);
    return defaultConfig;
  }
}

/**
 * Sauvegarde la configuration du bot dans la base de données
 * @param {Object} config - Configuration à sauvegarder
 * @returns {boolean} - Succès de la sauvegarde
 */
export async function saveConfig(config) {
  try {
    await prisma.config.upsert({
      where: { key: MAIN_CONFIG_KEY },
      update: { 
        value: config,
        updatedAt: new Date()
      },
      create: {
        key: MAIN_CONFIG_KEY,
        value: config
      }
    });
    return true;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la configuration:', error);
    return false;
  }
}

/**
 * Définit la configuration d'un serveur pour le scheduler
 * @param {string} guildId - ID du serveur
 * @param {Object} guildConfig - Configuration du serveur
 * @returns {boolean} - Succès de l'opération
 */
export async function setGuildConfig(guildId, guildConfig) {
  try {
    const config = await loadConfig();

    // S'assurer que la structure est complète
    if (!config.scheduler) {
      config.scheduler = defaultConfig.scheduler;
    }
    if (!config.scheduler.guilds) {
      config.scheduler.guilds = {};
    }

    // Mettre à jour la configuration du serveur
    config.scheduler.guilds[guildId] = guildConfig;

    // Sauvegarder la configuration
    return await saveConfig(config);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la configuration du serveur:', error);
    return false;
  }
}

/**
 * Récupère la configuration d'un serveur
 * @param {string} guildId - ID du serveur
 * @returns {Object} - Configuration du serveur
 */
export async function getGuildConfig(guildId) {
  const config = await loadConfig();
  return config.scheduler?.guilds?.[guildId] || { enabled: true };
}

/**
 * Vérifie si un serveur est activé pour le scheduler
 * @param {string} guildId - ID du serveur
 * @returns {boolean} - true si le serveur est activé
 */
export async function isGuildEnabled(guildId) {
  const guildConfig = await getGuildConfig(guildId);
  return guildConfig.enabled !== false; // Par défaut activé si non spécifié
}

/**
 * Définit l'état activé/désactivé pour un type de canal
 * @param {string} channelType - Type de canal (guild, dm, group)
 * @param {boolean} enabled - État d'activation
 * @returns {boolean} - Succès de l'opération
 */
export async function setChannelTypeEnabled(channelType, enabled) {
  try {
    const config = await loadConfig();

    // S'assurer que la structure est complète
    if (!config.scheduler) {
      config.scheduler = defaultConfig.scheduler;
    }
    if (!config.scheduler.channelTypes) {
      config.scheduler.channelTypes = defaultConfig.scheduler.channelTypes;
    }

    // Mettre à jour la configuration
    config.scheduler.channelTypes[channelType] = enabled;

    // Sauvegarder la configuration
    return await saveConfig(config);
  } catch (error) {
    console.error(`Erreur lors de la mise à jour du type de canal ${channelType}:`, error);
    return false;
  }
}

/**
 * Vérifie si un type de canal est activé
 * @param {string} channelType - Type de canal (guild, dm, group)
 * @returns {boolean} - true si le type de canal est activé
 */
export async function isChannelTypeEnabled(channelType) {
  const config = await loadConfig();
  const defaultValue = defaultConfig.scheduler.channelTypes[channelType];
  return config.scheduler?.channelTypes?.[channelType] !== false && defaultValue !== false;
}
