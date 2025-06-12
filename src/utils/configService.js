import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const defaultConfig = {
  scheduler: {
    enabled: true,
    guilds: {},
    users: {},
    channelTypes: {
      guild: true,
      dm: true,
      group: true
    },
    analysisEnabled: true,  // Active l'analyse de pertinence des messages
    autoRespond: true,      // Permet de répondre automatiquement aux messages pertinents
    sharingEnabled: true    // Active le partage de contexte
  }
};

const MAIN_CONFIG_KEY = 'main';

export async function loadConfig() {
  try {
    const configRecord = await prisma.config.findUnique({
      where: { key: MAIN_CONFIG_KEY }
    });

    if (configRecord && configRecord?.value) {
      return configRecord.value;
    } else {
      await saveConfig(defaultConfig);
      return defaultConfig;
    }
  } catch (error) {
    console.error('Erreur lors du chargement de la configuration:', error);
    return defaultConfig;
  }
}

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

export async function setGuildConfig(guildId, guildConfig) {
  try {
    const config = await loadConfig();

    if (!config.scheduler) {
      config.scheduler = defaultConfig.scheduler;
    }
    if (!config.scheduler.guilds) {
      config.scheduler.guilds = {};
    }

    config.scheduler.guilds[guildId] = guildConfig;

    return saveConfig(config)
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la configuration du serveur:', error);
    return false;
  }
}

export async function getGuildConfig(guildId) {
  const config = await loadConfig();
  return config.scheduler?.guilds?.[guildId] || { enabled: true };
}

export async function isGuildEnabled(guildId) {
  const guildConfig = await getGuildConfig(guildId);
  return guildConfig.enabled !== false;
}

export async function setChannelTypeEnabled(channelType, enabled) {
  try {
    const config = await loadConfig();

    if (!config.scheduler) {
      config.scheduler = defaultConfig.scheduler;
    }
    if (!config.scheduler.channelTypes) {
      config.scheduler.channelTypes = defaultConfig.scheduler.channelTypes;
    }

    config.scheduler.channelTypes[channelType] = enabled;

    return saveConfig(config)
  } catch (error) {
    console.error(`Erreur lors de la mise à jour du type de canal ${channelType}:`, error);
    return false;
  }
}

export async function isChannelTypeEnabled(channelType) {
  const config = await loadConfig();
  const defaultValue = defaultConfig.scheduler.channelTypes[channelType];
  return config.scheduler?.channelTypes?.[channelType] !== false && defaultValue !== false;
}

export async function setSchedulerEnabled(enabled) {
  try {
    const config = await loadConfig();

    if (!config.scheduler) {
      config.scheduler = defaultConfig.scheduler;
    }

    config.scheduler.enabled = enabled;

    return saveConfig(config)
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'état du scheduler:', error);
    return false;
  }
}

/**
 * Vérifie si le système est en état de surcharge de tâches
 * @returns {Promise<boolean>} - true si la limite de tâches est atteinte
 */
export async function isTaskLimitReached() {
  try {
    // Importer dynamiquement pour éviter les références circulaires
    const { taskService } = await import('../services/taskService.js');
    const MAX_ACTIVE_TASKS = parseInt(process.env.MAX_ACTIVE_TASKS || '100', 10);
    return taskService.getActiveTaskCount() >= MAX_ACTIVE_TASKS;
  } catch (error) {
    console.error('Erreur lors de la vérification de la limite de tâches:', error);
    return false;
  }
}

export async function isSchedulerEnabled() {
  const config = await loadConfig();

  if (config.scheduler && config.scheduler.hasOwnProperty('enabled')) {
    console.log(`[ConfigService] État du planificateur: ${config.scheduler.enabled ? 'activé' : 'désactivé'}`);
    return config.scheduler.enabled === true;
  }

  console.log(`[ConfigService] État par défaut du planificateur: ${defaultConfig.scheduler.enabled ? 'activé' : 'désactivé'}`);
  return defaultConfig.scheduler.enabled;
}

/**
 * Vérifie si l'analyse de pertinence est activée
 * @returns {Promise<boolean>} - true si l'analyse est activée
 */
export async function isAnalysisEnabled() {
  const config = await loadConfig();
  const isEnabled = config.scheduler?.analysisEnabled !== false && defaultConfig.scheduler.analysisEnabled !== false;
  console.log(`[ConfigService] État de l'analyse de pertinence: ${isEnabled ? 'activée' : 'désactivée'}`);
  return isEnabled;
}

/**
 * Active ou désactive l'analyse de pertinence
 * @param {boolean} enabled - État de l'analyse
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export async function setAnalysisEnabled(enabled) {
  console.log(`[ConfigService] Modification de l'état de l'analyse: ${enabled ? 'activation' : 'désactivation'}`);
  try {
    const config = await loadConfig();

    if (!config.scheduler) {
      config.scheduler = defaultConfig.scheduler;
    }

    config.scheduler.analysisEnabled = enabled;

    return saveConfig(config);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'état de l\'analyse:', error);
    return false;
  }
}

/**
 * Vérifie si la réponse automatique est activée
 * @returns {Promise<boolean>} - true si la réponse automatique est activée
 */
export async function isAutoRespondEnabled() {
  const config = await loadConfig();
  const isEnabled = config.scheduler?.autoRespond !== false && defaultConfig.scheduler.autoRespond !== false;
  console.log(`[ConfigService] État de la réponse automatique: ${isEnabled ? 'activée' : 'désactivée'}`);
  return isEnabled;
}

/**
 * Active ou désactive la réponse automatique
 * @param {boolean} enabled - État de la réponse automatique
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export async function setAutoRespondEnabled(enabled) {
  console.log(`[ConfigService] Modification de l'état de la réponse automatique: ${enabled ? 'activation' : 'désactivation'}`);
  try {
    const config = await loadConfig();

    if (!config.scheduler) {
      config.scheduler = defaultConfig.scheduler;
    }

    config.scheduler.autoRespond = enabled;

    return saveConfig(config);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'état de la réponse automatique:', error);
    return false;
  }
}
