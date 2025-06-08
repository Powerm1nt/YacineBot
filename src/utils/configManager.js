import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Obtenir le chemin du répertoire actuel
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chemin vers le fichier de configuration
const configPath = path.join(__dirname, '..', '..', 'config.json');

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
 * Charge la configuration du bot
 * @returns {Object} - Configuration chargée
 */
export function loadConfig() {
  try {
    // Vérifier si le fichier existe
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);
      return config;
    } else {
      // Créer le fichier avec la config par défaut
      saveConfig(defaultConfig);
      return defaultConfig;
    }
  } catch (error) {
    console.error('Erreur lors du chargement de la configuration:', error);
    return defaultConfig;
  }
}

/**
 * Sauvegarde la configuration du bot
 * @param {Object} config - Configuration à sauvegarder
 * @returns {boolean} - Succès de la sauvegarde
 */
export function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la configuration:', error);
    return false;
  }
}

/**
 * Récupère la configuration du scheduler
 * @returns {Object} - Configuration du scheduler
 */
export function getSchedulerConfig() {
  const config = loadConfig();
  if (!config.scheduler) {
    config.scheduler = defaultConfig.scheduler;
    saveConfig(config);
  }
  return config.scheduler;
}

/**
 * Définit la configuration d'un serveur pour le scheduler
 * @param {string} guildId - ID du serveur
 * @param {Object} guildConfig - Configuration du serveur
 * @returns {boolean} - Succès de l'opération
 */
export function setGuildConfig(guildId, guildConfig) {
  try {
    const config = loadConfig();

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
    return saveConfig(config);
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
export function getGuildConfig(guildId) {
  const config = loadConfig();
  return config.scheduler?.guilds?.[guildId] || { enabled: true };
}

/**
 * Vérifie si un serveur est activé pour le scheduler
 * @param {string} guildId - ID du serveur
 * @returns {boolean} - true si le serveur est activé
 */
export function isGuildEnabled(guildId) {
  const guildConfig = getGuildConfig(guildId);
  return guildConfig.enabled !== false; // Par défaut activé si non spécifié
}

/**
 * Définit l'état activé/désactivé pour un type de canal
 * @param {string} channelType - Type de canal (guild, dm, group)
 * @param {boolean} enabled - État d'activation
 * @returns {boolean} - Succès de l'opération
 */
export function setChannelTypeEnabled(channelType, enabled) {
  try {
    const config = loadConfig();

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
    return saveConfig(config);
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
export function isChannelTypeEnabled(channelType) {
  const config = loadConfig();
  const defaultValue = defaultConfig.scheduler.channelTypes[channelType];
  return config.scheduler?.channelTypes?.[channelType] !== false && defaultValue !== false;
}
