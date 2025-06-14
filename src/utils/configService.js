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
    analysisEnabled: true,  // Enables message relevance analysis
    autoRespond: true,      // Allows automatic responses to relevant messages
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

/**
 * Enables or disables message analysis for a specific server
 * @param {string} guildId - Server ID
 * @param {boolean} enabled - Analysis state for this server
 * @returns {Promise<boolean>} - Operation success
 */
export async function setGuildAnalysisEnabled(guildId, enabled) {
  try {
    console.log(`[ConfigService] Changing analysis state for server ${guildId}: ${enabled ? 'enabling' : 'disabling'}`);
    const config = await loadConfig();

    if (!config.scheduler) {
      config.scheduler = defaultConfig.scheduler;
    }
    if (!config.scheduler.guilds) {
      config.scheduler.guilds = {};
    }
    if (!config.scheduler.guilds[guildId]) {
      config.scheduler.guilds[guildId] = { enabled: true };
    }

    config.scheduler.guilds[guildId].analysisEnabled = enabled;

    return saveConfig(config);
  } catch (error) {
    console.error(`[ConfigService] Error updating analysis state for server ${guildId}:`, error);
    return false;
  }
}

/**
 * Enables or disables automatic response for a specific server
 * @param {string} guildId - Server ID
 * @param {boolean} enabled - Auto-response state for this server
 * @returns {Promise<boolean>} - Operation success
 */
export async function setGuildAutoRespondEnabled(guildId, enabled) {
  try {
    console.log(`[ConfigService] Changing auto-response state for server ${guildId}: ${enabled ? 'enabling' : 'disabling'}`);
    const config = await loadConfig();

    if (!config.scheduler) {
      config.scheduler = defaultConfig.scheduler;
    }
    if (!config.scheduler.guilds) {
      config.scheduler.guilds = {};
    }
    if (!config.scheduler.guilds[guildId]) {
      config.scheduler.guilds[guildId] = { enabled: true };
    }

    config.scheduler.guilds[guildId].autoRespond = enabled;

    return saveConfig(config);
  } catch (error) {
    console.error(`[ConfigService] Error updating auto-response state for server ${guildId}:`, error);
    return false;
  }
}

export async function getGuildConfig(guildId) {
  const config = await loadConfig();
  return config.scheduler?.guilds?.[guildId] || { enabled: true, analysisEnabled: true, autoRespond: true };
}

export async function isGuildEnabled(guildId) {
  const guildConfig = await getGuildConfig(guildId);
  return guildConfig.enabled !== false;
}

/**
 * Checks if relevance analysis is enabled for a specific server
 * @param {string} guildId - Server ID
 * @returns {Promise<boolean>} - true if analysis is enabled for this server
 */
export async function isGuildAnalysisEnabled(guildId) {
  const guildConfig = await getGuildConfig(guildId);
  // If server config doesn't specify, use global config
  if (guildConfig.analysisEnabled === undefined) {
    return await isAnalysisEnabled();
  }
  return guildConfig.analysisEnabled !== false;
}

/**
 * Checks if automatic response is enabled for a specific server
 * @param {string} guildId - Server ID
 * @returns {Promise<boolean>} - true if automatic response is enabled for this server
 */
export async function isGuildAutoRespondEnabled(guildId) {
  const guildConfig = await getGuildConfig(guildId);
  // If server config doesn't specify, use global config
  if (guildConfig.autoRespond === undefined) {
    return await isAutoRespondEnabled();
  }
  return guildConfig.autoRespond !== false;
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
 * Checks if relevance analysis is enabled
 * @returns {Promise<boolean>} - true if analysis is enabled
 */
export async function isAnalysisEnabled() {
  const config = await loadConfig();
  const isEnabled = config.scheduler?.analysisEnabled !== false && defaultConfig.scheduler.analysisEnabled !== false;
  console.log(`[ConfigService] Relevance analysis state: ${isEnabled ? 'enabled' : 'disabled'}`);
  return isEnabled;
}

/**
 * Enables or disables relevance analysis
 * @param {boolean} enabled - Analysis state
 * @returns {Promise<boolean>} - Operation success
 */
export async function setAnalysisEnabled(enabled) {
  console.log(`[ConfigService] Changing analysis state: ${enabled ? 'enabling' : 'disabling'}`);
  try {
    const config = await loadConfig();

    if (!config.scheduler) {
      config.scheduler = defaultConfig.scheduler;
    }

    config.scheduler.analysisEnabled = enabled;

    return saveConfig(config);
  } catch (error) {
    console.error('Error updating analysis state:', error);
    return false;
  }
}

/**
 * Checks if automatic response is enabled
 * @returns {Promise<boolean>} - true if automatic response is enabled
 */
export async function isAutoRespondEnabled() {
  const config = await loadConfig();
  const isEnabled = config.scheduler?.autoRespond !== false && defaultConfig.scheduler.autoRespond !== false;
  console.log(`[ConfigService] Auto-response state: ${isEnabled ? 'enabled' : 'disabled'}`);
  return isEnabled;
}

/**
 * Enables or disables automatic response
 * @param {boolean} enabled - Auto-response state
 * @returns {Promise<boolean>} - Operation success
 */
export async function setAutoRespondEnabled(enabled) {
  console.log(`[ConfigService] Changing auto-response state: ${enabled ? 'enabling' : 'disabling'}`);
  try {
    const config = await loadConfig();

    if (!config.scheduler) {
      config.scheduler = defaultConfig.scheduler;
    }

    config.scheduler.autoRespond = enabled;

    return saveConfig(config);
  } catch (error) {
    console.error('Error updating auto-response state:', error);
    return false;
  }
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
