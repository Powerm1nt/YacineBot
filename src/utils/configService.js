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
    sharingEnabled: true,   // Enables context sharing
    disabledConversations: {}  // Conversations for which analysis is disabled
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
    console.error('Error loading configuration:', error);
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
    console.error('Error saving configuration:', error);
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
    console.error('Error updating server configuration:', error);
    return false;
  }
}

/**
 * Enables or disables an entire server
 * @param {string} guildId - Server ID
 * @param {boolean} enabled - Server state (enabled/disabled)
 * @returns {Promise<boolean>} - Operation success
 */
export async function setGuildEnabled(guildId, enabled) {
  try {
    console.log(`[ConfigService] Changing server ${guildId} state: ${enabled ? 'enabling' : 'disabling'}`);
    const config = await loadConfig();

    if (!config.scheduler) {
      config.scheduler = defaultConfig.scheduler;
    }
    if (!config.scheduler.guilds) {
      config.scheduler.guilds = {};
    }
    if (!config.scheduler.guilds[guildId]) {
      config.scheduler.guilds[guildId] = {};
    }

    config.scheduler.guilds[guildId].enabled = enabled;

    return saveConfig(config);
  } catch (error) {
    console.error(`[ConfigService] Error updating server ${guildId} state:`, error);
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
    console.error(`Error updating channel type ${channelType}:`, error);
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
    console.error('Error updating scheduler state:', error);
    return false;
  }
}


export async function isSchedulerEnabled() {
  const config = await loadConfig();

  if (config.scheduler && config.scheduler.hasOwnProperty('enabled')) {
    console.log(`[ConfigService] Scheduler state: ${config.scheduler.enabled ? 'enabled' : 'disabled'}`);
    return config.scheduler.enabled === true;
  }

  console.log(`[ConfigService] Default scheduler state: ${defaultConfig.scheduler.enabled ? 'enabled' : 'disabled'}`);
  return defaultConfig.scheduler.enabled;
}


/**
 * Checks if analysis is disabled for a specific conversation
 * @param {string} channelId - Channel ID
 * @param {string} guildId - Server ID (optional)
 * @returns {Promise<boolean>} - true if analysis is disabled for this conversation
 */
export async function isConversationAnalysisDisabled(channelId, guildId = null) {
  try {
    const config = await loadConfig();
    const conversationKey = `${channelId}-${guildId || 'dm'}`;

    if (!config.scheduler || !config.scheduler.disabledConversations) {
      return false;
    }

    const isDisabled = config.scheduler.disabledConversations[conversationKey] === true;
    console.log(`[ConfigService] Analysis state for conversation ${conversationKey}: ${isDisabled ? 'disabled' : 'enabled'}`);
    return isDisabled;
  } catch (error) {
    console.error(`[ConfigService] Error checking analysis state for conversation ${channelId}:`, error);
    return false;
  }
}

/**
 * Enables or disables analysis for a specific conversation
 * @param {string} channelId - Channel ID
 * @param {string} guildId - Server ID (optional)
 * @param {boolean} disabled - true to disable analysis, false to enable it
 * @returns {Promise<boolean>} - Operation success
 */
export async function setConversationAnalysisDisabled(channelId, guildId = null, disabled) {
  try {
    const conversationKey = `${channelId}-${guildId || 'dm'}`;
    console.log(`[ConfigService] Changing analysis state for conversation ${conversationKey}: ${disabled ? 'disabling' : 'enabling'}`);

    const config = await loadConfig();

    if (!config.scheduler) {
      config.scheduler = defaultConfig.scheduler;
    }

    if (!config.scheduler.disabledConversations) {
      config.scheduler.disabledConversations = {};
    }

    if (disabled) {
      config.scheduler.disabledConversations[conversationKey] = true;
    } else {
      delete config.scheduler.disabledConversations[conversationKey];
    }

    return saveConfig(config);
  } catch (error) {
    console.error(`[ConfigService] Error updating analysis state for conversation ${channelId}:`, error);
    return false;
  }
}
