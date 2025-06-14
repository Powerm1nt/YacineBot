import {
  loadConfig,
  saveConfig,
  setChannelTypeEnabled,
  setSchedulerEnabled,
  isSchedulerEnabled,
  defaultConfig,
  setGuildConfig,
  getGuildConfig,
  isConversationAnalysisDisabled,
  setConversationAnalysisDisabled,
  setGuildEnabled
} from '../utils/configService.js'

// Helper functions for settings not yet implemented in configService
async function setAutoQuestionEnabled(enabled) {
  try {
    const config = await loadConfig();
    if (!config.scheduler) config.scheduler = {...defaultConfig.scheduler};
    config.scheduler.autoQuestion = enabled;
    return saveConfig(config);
  } catch (error) {
    console.error('Error updating automatic questions state:', error);
    return false;
  }
}

async function isAutoQuestionEnabled() {
  const config = await loadConfig();
  return config.scheduler?.autoQuestion !== false && defaultConfig.scheduler.autoQuestion !== false;
}

async function setSharingEnabled(enabled) {
  try {
    const config = await loadConfig();
    if (!config.scheduler) config.scheduler = {...defaultConfig.scheduler};
    config.scheduler.sharingEnabled = enabled;
    return saveConfig(config);
  } catch (error) {
    console.error('Error updating context sharing state:', error);
    return false;
  }
}

async function isSharingEnabled() {
  const config = await loadConfig();
  return config.scheduler?.sharingEnabled !== false && defaultConfig.scheduler.sharingEnabled !== false;
}
import { initScheduler, stopScheduler } from '../services/schedulerService.js'

export const metadata = {
  name: 'config',
  description: 'Manages bot configuration',
  restricted: true,
  usage: 'config'
};

export function isValueTrue(value) {
  const trueValues = ['true', 'on', 'yes', '1', 'active', 'enabled'];
  return trueValues.includes(value.toLowerCase());
}

const EMOJIS = {
  LIST: '📋',
  FULL_LIST: '📜',
  SET: '⚙️',
  RESET: '🔄',
  STATUS: '📊',
  BACK: '⬅️',
  CONFIRM: '✅',
  CANCEL: '❌',
  GUILD: '🏠',
  DM: '💬',
  GROUP: '👥',
  ENABLE: '✅',
  DISABLE: '⭕',
  SCHEDULER: '⏰',
  AUTO_QUESTION: '❓',
  SHARING: '🔄',
  SERVER: '🏢',
  SERVER_CONFIG: '🛠️',
  CONVERSATION: '💭',
  GUILD_MANAGEMENT: '🌐'
};

async function safeDeleteMessage(message) {
  try {
    await message.delete();
  } catch (error) {}
}

async function showTemporaryMessage(client, message, content, delay = 2000) {
  const tempMessage = await message.reply(content);
    setTimeout(async () => {
    await safeDeleteMessage(tempMessage);
    return showMainMenu(client, message);
  }, delay);
}

  async function handleConfirmationDialog(client, message, options) {
  const {
    title,
    description,
    confirmEmoji = '⭕',
    cancelEmoji = '✅',
    onConfirm,
    onCancel = () => showMainMenu(client, message)
  } = options;
    const confirmMessage = await message.reply(
    `**${title}**\n\n${description}\n\n` +
    `${confirmEmoji} - Disable\n` +
    `${cancelEmoji} - Enable`
    );

  await addReactions(confirmMessage, [confirmEmoji, cancelEmoji]);
  const filter = (reaction, user) => {
    return [confirmEmoji, cancelEmoji].includes(reaction.emoji.name) &&
           user.id === message.author.id;
  };

  const collected = await createReactionCollector(confirmMessage, filter);

  await safeDeleteMessage(confirmMessage);

  if (collected.size === 0) {
    return message.reply('⏱️ Action canceled - time expired.');
  }

  const reaction = collected.first();
  try {
    return reaction.emoji.name === confirmEmoji ? await onConfirm() : await onCancel();
  } catch (error) {
    console.error('Error executing callback:', error);
    return message.reply('❌ An error occurred while executing the action.');
  }
}

async function addReactions(message, emojis) {
  try {
    for (const emoji of emojis) {
      await message.react(emoji);
    }
  } catch (error) {
    console.error('Error adding reactions:', error);
  }
}

function createReactionCollector(message, filter, time = 60000) {
  return message.awaitReactions({ filter, max: 1, time });
}

async function showConfigList(client, message, showFull) {
    const config = await loadConfig();
  let configMessage = '📝 **Current Configuration:**\n\n';

  if (config.scheduler) {
    configMessage += '⏰ **Scheduler:**\n';
    configMessage += `▫️ Scheduling service: ${config.scheduler.enabled ? '✅ enabled' : '⭕ disabled'}\n`;
    configMessage += `▫️ Servers: ${config.scheduler.channelTypes?.guild ? '✅ enabled' : '⭕ disabled'}\n`;
    configMessage += `▫️ Private messages: ${config.scheduler.channelTypes?.dm ? '✅ enabled' : '⭕ disabled'}\n`;
    configMessage += `▫️ Groups: ${config.scheduler.channelTypes?.group ? '✅ enabled' : '⭕ disabled'}\n`;
    configMessage += `▫️ Context sharing: ${config.scheduler.sharingEnabled !== false ? '✅ enabled' : '⭕ disabled'}\n\n`;

    if (showFull) {
      if (config.scheduler.guilds && Object.keys(config.scheduler.guilds).length > 0) {
        configMessage += '📋 **Configured Servers:**\n';
        for (const [guildId, guildConfig] of Object.entries(config.scheduler.guilds)) {
          // Get server name if possible
          let serverName = guildId;
          try {
            const guild = client.guilds.cache.get(guildId);
            if (guild) serverName = guild.name;
          } catch (error) {}

          configMessage += `▫️ Server ${serverName}: ${guildConfig.enabled !== false ? '✅ enabled' : '⭕ disabled'}\n`;
        }
        configMessage += '\n';
      }

      if (config.scheduler.users && Object.keys(config.scheduler.users).length > 0) {
        configMessage += '👤 **Configured Users:**\n';
        for (const [userId, userConfig] of Object.entries(config.scheduler.users)) {
          configMessage += `▫️ User ${userId}: ${userConfig.enabled !== false ? '✅ enabled' : '⭕ disabled'}\n`;
        }
        configMessage += '\n';
      }
    }
  }

  const listMessage = await message.reply(configMessage + '\n' +
    `Click on ${EMOJIS.BACK} to return to the main menu.`);

  await listMessage.react(EMOJIS.BACK);
    const filter = (reaction, user) => {
      return reaction.emoji.name === EMOJIS.BACK && user.id === message.author.id;
    };

  await createReactionCollector(listMessage, filter);
  await safeDeleteMessage(listMessage);
    return showMainMenu(client, message);
}

/**
 * Generic toggle function for all settings
 * @param {Object} client - Discord client
 * @param {Object} message - Discord message
 * @param {string} title - Dialog title
 * @param {boolean} currentValue - Current setting value
 * @param {Function} setEnabledFunc - Function to set the setting value
 * @param {string} settingName - Name of the setting for display
 * @param {Function} additionalAction - Optional additional action to perform when toggling (e.g., stopScheduler)
 * @returns {Promise<void>}
 */
async function toggleSetting(client, message, title, currentValue, setEnabledFunc, settingName, additionalAction = null) {
  return handleConfirmationDialog(client, message, {
    title,
    description: `Current state: ${currentValue ? '✅ enabled' : '⭕ disabled'}`,
    confirmEmoji: '⭕',
    cancelEmoji: '✅',
    onConfirm: async () => {
      if (currentValue !== false) {
        await setEnabledFunc(false);
        if (additionalAction) await additionalAction(false);
        await showTemporaryMessage(client, message, `✅ ${settingName} is now disabled ⭕`);
      }
      return showSetMenu(client, message);
    },
    onCancel: async () => {
      if (currentValue !== true) {
        await setEnabledFunc(true);
        if (additionalAction) await additionalAction(true);
        await showTemporaryMessage(client, message, `✅ ${settingName} is now enabled ✅`);
      }
      return showSetMenu(client, message);
    }
  });
}

// Specific toggle functions using the generic toggle function
async function toggleSchedulerService(client, message, currentValue) {
  return toggleSetting(
    client, 
    message, 
    'Modify Scheduling Service', 
    currentValue, 
    setSchedulerEnabled, 
    'The scheduling service',
    async (enabled) => enabled ? await initScheduler(client) : await stopScheduler()
  );
}

async function toggleChannelTypeSetting(client, message, settingType, currentValue) {
  const settingNames = {
    guild: 'servers',
    dm: 'private messages',
    group: 'groups'
  };

  return toggleSetting(
    client,
    message,
    `Modify setting: ${settingNames[settingType]}`,
    currentValue,
    (enabled) => setChannelTypeEnabled(settingType, enabled),
    `${settingNames[settingType]} are now`
  );
}


async function toggleAutoQuestionSetting(client, message, currentValue) {
  return toggleSetting(
    client,
    message,
    'Modify Automatic Questions',
    currentValue,
    setAutoQuestionEnabled,
    'Automatic questions'
  );
}

async function toggleSharingSetting(client, message, currentValue) {
  return toggleSetting(
    client,
    message,
    'Modify Context Sharing',
    currentValue,
    setSharingEnabled,
    'Context sharing'
  );
}

async function confirmReset(client, message) {
  return handleConfirmationDialog(client, message, {
    title: '🔄 Reset Configuration',
    description: 'Are you sure you want to reset all configuration to default values?\n\nThis action cannot be undone!',
    onConfirm: async () => {
      await saveConfig(defaultConfig);
      await showTemporaryMessage(client, message,
        '✅ All configurations have been reset to default values.'
      );
    }
  });
}

async function showSetMenu(client, message) {
  const config = await loadConfig();
  const schedulerServiceEnabled = await isSchedulerEnabled();
  const guildEnabled = config.scheduler?.channelTypes?.guild ?? true;
  const dmEnabled = config.scheduler?.channelTypes?.dm ?? true;
  const groupEnabled = config.scheduler?.channelTypes?.group ?? true;
  const autoQuestionEnabled = await isAutoQuestionEnabled();
  const sharingEnabled = await isSharingEnabled();

  const setMessage = await message.reply(
    '**⚙️ Modify Configuration**\n\n' +
    '**Available Options:**\n' +
    `${EMOJIS.SCHEDULER} Scheduling service: ${schedulerServiceEnabled ? '✅ enabled' : '⭕ disabled'}\n` +
    `${EMOJIS.GUILD} Servers: ${guildEnabled ? '✅ enabled' : '⭕ disabled'}\n` +
    `${EMOJIS.DM} Private messages: ${dmEnabled ? '✅ enabled' : '⭕ disabled'}\n` +
    `${EMOJIS.GROUP} Groups: ${groupEnabled ? '✅ enabled' : '⭕ disabled'}\n` +
    `${EMOJIS.AUTO_QUESTION} Automatic questions: ${autoQuestionEnabled ? '✅ enabled' : '⭕ disabled'}\n` +
    `${EMOJIS.SHARING} Context sharing: ${sharingEnabled ? '✅ enabled' : '⭕ disabled'}\n` +
    `${EMOJIS.CONVERSATION} Conversation analysis: Manage disabled conversations\n` +
    `${EMOJIS.GUILD_MANAGEMENT} Server management: Enable/disable entire servers\n\n` +
    `${EMOJIS.BACK} Back to main menu\n\n` +
    'Click on a reaction to modify a setting...'
  );

  const allEmojis = [
    EMOJIS.SCHEDULER, EMOJIS.GUILD, EMOJIS.DM, EMOJIS.GROUP,
    EMOJIS.AUTO_QUESTION, EMOJIS.SHARING, 
    EMOJIS.CONVERSATION, EMOJIS.GUILD_MANAGEMENT, EMOJIS.BACK
  ];

  await addReactions(setMessage, allEmojis);

  const filter = (reaction, user) => {
    return allEmojis.includes(reaction.emoji.name) &&
           user.id === message.author.id;
  };

  const collected = await createReactionCollector(setMessage, filter);

  if (collected.size === 0) {
    return setMessage.edit('⏱️ Configuration canceled - time expired.');
  }

  const reaction = collected.first();

  await safeDeleteMessage(setMessage);

  switch (reaction.emoji.name) {
    case EMOJIS.SCHEDULER:
      return toggleSchedulerService(client, message, schedulerServiceEnabled);
    case EMOJIS.GUILD:
      return toggleChannelTypeSetting(client, message, 'guild', guildEnabled);
    case EMOJIS.DM:
      return toggleChannelTypeSetting(client, message, 'dm', dmEnabled);
    case EMOJIS.GROUP:
      return toggleChannelTypeSetting(client, message, 'group', groupEnabled);
    case EMOJIS.AUTO_QUESTION:
      return toggleAutoQuestionSetting(client, message, autoQuestionEnabled);
    case EMOJIS.SHARING:
      return toggleSharingSetting(client, message, sharingEnabled);
    case EMOJIS.CONVERSATION:
      return showConversationMenu(client, message);
    case EMOJIS.GUILD_MANAGEMENT:
      return showGuildManagementMenu(client, message);
    case EMOJIS.BACK:
      return showMainMenu(client, message);
  }
}

async function showConversationMenu(client, message) {
  try {
    const config = await loadConfig();

    // Get the list of disabled conversations
    const disabledConversations = config.scheduler?.disabledConversations || {};
    const disabledCount = Object.keys(disabledConversations).length;

    let menuContent = '💭 **Conversation Analysis Management**\n\n';

    if (disabledCount === 0) {
      menuContent += 'No conversations currently have analysis disabled.\n\n';
    } else {
      menuContent += `**${disabledCount} conversation(s) with disabled analysis:**\n`;

      // List all disabled conversations
      for (const [key, value] of Object.entries(disabledConversations)) {
        if (value === true) {
          const [channelId, guildId] = key.split('-');
          let locationInfo = `Channel: ${channelId}`;

          // Try to get guild name if possible
          if (guildId && guildId !== 'dm') {
            try {
              const guild = client.guilds.cache.get(guildId);
              if (guild) {
                locationInfo += ` (Server: ${guild.name})`;
              } else {
                locationInfo += ` (Server: ${guildId})`;
              }
            } catch (error) {
              locationInfo += ` (Server: ${guildId})`;
            }
          } else {
            locationInfo += ' (Private Messages)';
          }

          menuContent += `▫️ ${locationInfo}\n`;
        }
      }
      menuContent += '\n';
    }

    // Instructions
    menuContent += '**Available Actions:**\n';
    menuContent += '1️⃣ - Disable analysis for a conversation (by channel ID)\n';
    menuContent += '2️⃣ - Re-enable analysis for a conversation (by channel ID)\n';
    menuContent += `${EMOJIS.BACK} - Back to configuration menu\n\n`;
    menuContent += 'Click on a reaction to continue...';

    const menuMessage = await message.reply(menuContent);

    // Add reactions
    await addReactions(menuMessage, ['1️⃣', '2️⃣', EMOJIS.BACK]);

    // Wait for reaction
    const filter = (reaction, user) => {
      return ['1️⃣', '2️⃣', EMOJIS.BACK].includes(reaction.emoji.name) && 
             user.id === message.author.id;
    };

    const collected = await createReactionCollector(menuMessage, filter);

    await safeDeleteMessage(menuMessage);

    if (collected.size === 0) {
      return message.reply('⏱️ Action canceled - time expired.');
    }

    const reaction = collected.first();

    switch (reaction.emoji.name) {
      case '1️⃣':
        return promptForConversationDisable(client, message);
      case '2️⃣':
        return promptForConversationEnable(client, message);
      case EMOJIS.BACK:
        return showSetMenu(client, message);
    }
  } catch (error) {
    console.error('Error displaying conversation menu:', error);
    await message.reply('❌ An error occurred while displaying the conversation menu.');
    return showSetMenu(client, message);
  }
}

async function showGuildManagementMenu(client, message) {
  try {
    const config = await loadConfig();

    // Get the list of guilds
    const guilds = config.scheduler?.guilds || {};

    // Count disabled guilds
    let disabledCount = 0;
    for (const [guildId, guildConfig] of Object.entries(guilds)) {
      if (guildConfig.enabled === false) {
        disabledCount++;
      }
    }

    let menuContent = '🌐 **Server Management**\n\n';

    if (Object.keys(guilds).length === 0) {
      menuContent += 'No server has specific configuration currently.\n\n';
    } else {
      menuContent += `**${Object.keys(guilds).length} configured server(s), including ${disabledCount} disabled:**\n`;

      // List all guilds
      for (const [guildId, guildConfig] of Object.entries(guilds)) {
        let guildName = guildId;

        // Try to get guild name if possible
        try {
          const guild = client.guilds.cache.get(guildId);
          if (guild) {
            guildName = guild.name;
          }
        } catch (error) {
          // Keep the ID as name if we can't get the guild
        }

        const isEnabled = guildConfig.enabled !== false;
        menuContent += `▫️ ${guildName} (${guildId}): ${isEnabled ? '✅ enabled' : '⭕ disabled'}\n`;
      }
      menuContent += '\n';
    }

    // Instructions
    menuContent += '**Available Actions:**\n';
    menuContent += '1️⃣ - Disable an entire server (by ID)\n';
    menuContent += '2️⃣ - Re-enable an entire server (by ID)\n';
    menuContent += `${EMOJIS.BACK} - Back to configuration menu\n\n`;
    menuContent += 'Click on a reaction to continue...';

    const menuMessage = await message.reply(menuContent);

    // Add reactions
    await addReactions(menuMessage, ['1️⃣', '2️⃣', EMOJIS.BACK]);

    // Wait for reaction
    const filter = (reaction, user) => {
      return ['1️⃣', '2️⃣', EMOJIS.BACK].includes(reaction.emoji.name) && 
             user.id === message.author.id;
    };

    const collected = await createReactionCollector(menuMessage, filter);

    await safeDeleteMessage(menuMessage);

    if (collected.size === 0) {
      return message.reply('⏱️ Action canceled - time expired.');
    }

    const reaction = collected.first();

    switch (reaction.emoji.name) {
      case '1️⃣':
        return promptForGuildDisable(client, message);
      case '2️⃣':
        return promptForGuildEnable(client, message);
      case EMOJIS.BACK:
        return showSetMenu(client, message);
    }
  } catch (error) {
    console.error('Error displaying server management menu:', error);
    await message.reply('❌ An error occurred while displaying the server management menu.');
    return showSetMenu(client, message);
  }
}

/**
 * Generic prompt function for enabling/disabling conversations or guilds
 * @param {Object} client - Discord client
 * @param {Object} message - Discord message
 * @param {Object} options - Options for the prompt
 * @returns {Promise<void>}
 */
async function promptForToggle(client, message, options) {
  const {
    type, // 'conversation' or 'guild'
    action, // 'enable' or 'disable'
    title,
    promptText,
    checkFunction, // Function to check if the item exists and can be toggled
    toggleFunction, // Function to toggle the item
    returnMenu, // Function to return to the menu
    errorMessage,
    successMessage,
    listItems = null // Optional list of items to display
  } = options;

  try {
    // Check if there are no items to enable (only for enable action)
    if (action === 'enable' && listItems && listItems.length === 0) {
      await message.reply(`ℹ️ No ${type}s are currently disabled.`);
      return returnMenu(client, message);
    }

    let promptContent = `**${title}**\n\n`;

    // Add list of items if provided
    if (listItems) {
      promptContent += `${type === 'guild' ? 'Disabled servers' : 'Disabled conversations'}:\n`;
      listItems.forEach(item => {
        promptContent += `▫️ ${item.name || item.id}${item.id !== item.name ? ` (ID: ${item.id})` : ''}\n`;
      });
      promptContent += '\n';
    }

    promptContent += promptText;
    promptContent += '\nType `cancel` to return to the previous menu.';

    const promptMessage = await message.reply(promptContent);

    // Create message collector
    const filter = m => m.author.id === message.author.id;
    const collector = message.channel.createMessageCollector({ filter, time: 60000, max: 1 });

    collector.on('collect', async m => {
      await safeDeleteMessage(promptMessage);
      await safeDeleteMessage(m);

      const input = m.content.trim();

      if (input.toLowerCase() === 'cancel') {
        return returnMenu(client, message);
      }

      // Parse input based on type
      let id, secondaryId = null;
      if (type === 'conversation') {
        const parts = input.split(' ');
        id = parts[0]; // channelId
        secondaryId = parts.length > 1 ? parts[1] : null; // guildId

        if (!id || id.length < 10) {
          await message.reply('❌ Invalid channel ID. Please try again.');
          return returnMenu(client, message);
        }
      } else { // guild
        id = input; // guildId

        if (!id || id.length < 10) {
          await message.reply('❌ Invalid server ID. Please try again.');
          return returnMenu(client, message);
        }
      }

      // Check if the item can be toggled
      const checkResult = await checkFunction(id, secondaryId, client);
      if (checkResult.error) {
        await message.reply(checkResult.message);
        return returnMenu(client, message);
      }

      // Toggle the item
      const success = await toggleFunction(id, secondaryId, action === 'disable');

      if (success) {
        await message.reply(successMessage(id, secondaryId, checkResult.name));
      } else {
        await message.reply(errorMessage);
      }

      return returnMenu(client, message);
    });

    collector.on('end', async collected => {
      if (collected.size === 0) {
        await safeDeleteMessage(promptMessage);
        await message.reply('⏱️ Action canceled - time expired.');
        return returnMenu(client, message);
      }
    });
  } catch (error) {
    console.error(`Error ${action}ing a ${type}:`, error);
    await message.reply(`❌ An error occurred while ${action}ing the ${type}.`);
    return returnMenu(client, message);
  }
}

// Check functions for conversations and guilds
async function checkConversation(channelId, guildId, client) {
  if (guildId) {
    // For server channels, we could check if the channel exists in the server
    // but we'll skip that for now as it would require additional API calls
    return { error: false };
  }
  return { error: false };
}

async function checkConversationEnabled(channelId, guildId, client) {
  const config = await loadConfig();
  const disabledConversations = config.scheduler?.disabledConversations || {};
  const conversationKey = `${channelId}-${guildId || 'dm'}`;

  if (!disabledConversations[conversationKey]) {
    return { 
      error: true, 
      message: `ℹ️ Analysis is not disabled for channel ${channelId}${guildId ? ` in server ${guildId}` : ''}.` 
    };
  }

  return { error: false };
}

async function checkGuild(guildId, _, client) {
  // Check if the guild exists
  const guild = client.guilds.cache.get(guildId);
  let name = guildId;

  if (guild) {
    name = guild.name;
  } else {
    // Guild not found, but we'll allow it with a warning
    return { 
      error: false, 
      warning: true, 
      message: '⚠️ Warning: This server is not accessible by the bot. You can still disable it, but verify that the ID is correct.',
      name
    };
  }

  return { error: false, name };
}

async function checkGuildEnabled(guildId, _, client) {
  const config = await loadConfig();
  const guilds = config.scheduler?.guilds || {};
  const guildConfig = guilds[guildId];

  if (!guildConfig || guildConfig.enabled !== false) {
    return { 
      error: true, 
      message: `ℹ️ Server ${guildId} is not disabled.` 
    };
  }

  // Try to get guild name if possible
  let name = guildId;
  try {
    const guild = client.guilds.cache.get(guildId);
    if (guild) {
      name = guild.name;
    }
  } catch (error) {
    // Keep the ID as name if we can't get the guild
  }

  return { error: false, name };
}

// Wrapper functions for the specific prompts
async function promptForConversationDisable(client, message) {
  return promptForToggle(client, message, {
    type: 'conversation',
    action: 'disable',
    title: 'Disable Analysis for a Conversation',
    promptText: 'Please enter the channel ID for which you want to disable analysis.\n' +
                'Format: `channelId` or `channelId guildId` (for server channels)\n\n' +
                'Example: `123456789012345678` or `123456789012345678 987654321098765432`',
    checkFunction: checkConversation,
    toggleFunction: setConversationAnalysisDisabled,
    returnMenu: showConversationMenu,
    errorMessage: '❌ An error occurred while disabling analysis for this conversation.',
    successMessage: (channelId, guildId) => `✅ Analysis has been disabled for channel ${channelId}${guildId ? ` in server ${guildId}` : ''}.`
  });
}

async function promptForConversationEnable(client, message) {
  // Get the list of disabled conversations
  const config = await loadConfig();
  const disabledConversations = config.scheduler?.disabledConversations || {};
  const disabledCount = Object.keys(disabledConversations).length;

  // Create a list of disabled conversations for display
  const disabledList = [];
  for (const [key, value] of Object.entries(disabledConversations)) {
    if (value === true) {
      const [channelId, guildId] = key.split('-');
      let locationInfo = `Channel: ${channelId}`;

      // Try to get guild name if possible
      if (guildId && guildId !== 'dm') {
        try {
          const guild = client.guilds.cache.get(guildId);
          if (guild) {
            locationInfo += ` (Server: ${guild.name})`;
          } else {
            locationInfo += ` (Server: ${guildId})`;
          }
        } catch (error) {
          locationInfo += ` (Server: ${guildId})`;
        }
      } else {
        locationInfo += ' (Private Messages)';
      }

      disabledList.push({ id: channelId, secondaryId: guildId !== 'dm' ? guildId : null, name: locationInfo });
    }
  }

  return promptForToggle(client, message, {
    type: 'conversation',
    action: 'enable',
    title: 'Re-enable Analysis for a Conversation',
    promptText: 'Please enter the channel ID for which you want to re-enable analysis.\n' +
                'Format: `channelId` or `channelId guildId` (for server channels)\n\n' +
                'Example: `123456789012345678` or `123456789012345678 987654321098765432`',
    checkFunction: checkConversationEnabled,
    toggleFunction: setConversationAnalysisDisabled,
    returnMenu: showConversationMenu,
    errorMessage: '❌ An error occurred while re-enabling analysis for this conversation.',
    successMessage: (channelId, guildId) => `✅ Analysis has been re-enabled for channel ${channelId}${guildId ? ` in server ${guildId}` : ''}.`,
    listItems: disabledList
  });
}

async function promptForGuildDisable(client, message) {
  // Get the list of available guilds
  let availableGuilds = [];
  client.guilds.cache.forEach(guild => {
    availableGuilds.push({ id: guild.id, name: guild.name });
  });

  return promptForToggle(client, message, {
    type: 'guild',
    action: 'disable',
    title: 'Disable an Entire Server',
    promptText: 'Please enter the ID of the server you want to disable.\n' +
                'Example: `123456789012345678`',
    checkFunction: checkGuild,
    toggleFunction: setGuildEnabled,
    returnMenu: showGuildManagementMenu,
    errorMessage: '❌ An error occurred while disabling the server.',
    successMessage: (guildId, _, name) => `✅ Server ${name} has been disabled.`,
    listItems: availableGuilds
  });
}

async function promptForGuildEnable(client, message) {
  const config = await loadConfig();
  const guilds = config.scheduler?.guilds || {};

  // Find disabled guilds
  const disabledGuilds = [];
  for (const [guildId, guildConfig] of Object.entries(guilds)) {
    if (guildConfig.enabled === false) {
      let guildName = guildId;

      // Try to get guild name if possible
      try {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          guildName = guild.name;
        }
      } catch (error) {
        // Keep the ID as name if we can't get the guild
      }

      disabledGuilds.push({ id: guildId, name: guildName });
    }
  }

  return promptForToggle(client, message, {
    type: 'guild',
    action: 'enable',
    title: 'Re-enable a Server',
    promptText: 'Please enter the ID of the server you want to re-enable.\n' +
                'Example: `123456789012345678`',
    checkFunction: checkGuildEnabled,
    toggleFunction: setGuildEnabled,
    returnMenu: showGuildManagementMenu,
    errorMessage: '❌ An error occurred while re-enabling the server.',
    successMessage: (guildId, _, name) => `✅ Server ${name} has been re-enabled.`,
    listItems: disabledGuilds
  });
}

async function showStatus(client, message) {
  try {
    const config = await loadConfig();
    const { getSchedulerStatus } = await import('../services/schedulerService.js');

    let statusMessage = '🤖 **Bot Status:**\n\n';

    statusMessage += '⚙️ **Configuration:**\n';
    statusMessage += `▫️ Scheduling service: ${config.scheduler?.enabled ? '✅ enabled' : '⭕ disabled'}\n`;
    statusMessage += `▫️ Servers: ${config.scheduler?.channelTypes?.guild ? '✅ enabled' : '⭕ disabled'}\n`;
    statusMessage += `▫️ Private messages: ${config.scheduler?.channelTypes?.dm ? '✅ enabled' : '⭕ disabled'}\n`;
    statusMessage += `▫️ Groups: ${config.scheduler?.channelTypes?.group ? '✅ enabled' : '⭕ disabled'}\n`;
    statusMessage += `▫️ Automatic questions: ${config.scheduler?.autoQuestion !== false ? '✅ enabled' : '⭕ disabled'}\n`;
    statusMessage += `▫️ Context sharing: ${config.scheduler?.sharingEnabled !== false ? '✅ enabled' : '⭕ disabled'}\n`;

    // Display information about disabled conversations
    const disabledConversations = config.scheduler?.disabledConversations || {};
    const disabledConversationsCount = Object.keys(disabledConversations).length;
    statusMessage += `▫️ Conversations with disabled analysis: ${disabledConversationsCount}\n`;

    // Display information about disabled servers
    const guilds = config.scheduler?.guilds || {};
    let disabledGuildsCount = 0;
    for (const [guildId, guildConfig] of Object.entries(guilds)) {
      if (guildConfig.enabled === false) {
        disabledGuildsCount++;
      }
    }
    statusMessage += `▫️ Disabled servers: ${disabledGuildsCount}\n`;

    const schedulerStatus = getSchedulerStatus();
    if (schedulerStatus) {
      statusMessage += '⏰ **Scheduler:**\n';
      statusMessage += `▫️ Status: ${schedulerStatus.active ? '✅ active' : '⭕ inactive'}\n`;
      statusMessage += `▫️ Tasks: ${schedulerStatus.taskCount}\n`;
      statusMessage += `▫️ Current time: ${schedulerStatus.currentTime} (${schedulerStatus.timezone})\n`;
      statusMessage += `▫️ Active hours: ${schedulerStatus.inActiveHours ? '✅ yes' : '⭕ no'} (${schedulerStatus.config.activeHours})\n\n`;

      if (schedulerStatus.nextTask) {
        statusMessage += '⏱️ **Next task:**\n';
        statusMessage += `▫️ Task #${schedulerStatus.nextTask.number}\n`;
        statusMessage += `▫️ Execution: ${schedulerStatus.nextTask.nextExecution}\n`;
        statusMessage += `▫️ Time left: ${schedulerStatus.nextTask.timeLeft}\n`;
      }
    }

    statusMessage += '\n' + `Click on ${EMOJIS.BACK} to return to the main menu.`;

    const statusReply = await message.reply(statusMessage);
    await statusReply.react(EMOJIS.BACK);

    const filter = (reaction, user) => {
      return reaction.emoji.name === EMOJIS.BACK && user.id === message.author.id;
    };

    await createReactionCollector(statusReply, filter);

    await safeDeleteMessage(statusReply);

    return showMainMenu(client, message);
  } catch (error) {
    console.error('Error retrieving status:', error);
    await showTemporaryMessage(client, message, '❌ An error occurred while retrieving the status.', 3000);
  }
}

async function showMainMenu(client, message) {
  const menuMessage = await message.reply(
    '**📝 Configuration Menu**\n\n' +
    `${EMOJIS.LIST} - Show current configuration\n` +
    `${EMOJIS.FULL_LIST} - Show detailed configuration\n` +
    `${EMOJIS.SET} - Modify configuration\n` +
    `${EMOJIS.RESET} - Reset configuration\n` +
    `${EMOJIS.STATUS} - Show bot status\n\n` +
    'Click on a reaction to continue...'
  );

  await addReactions(menuMessage, [EMOJIS.LIST, EMOJIS.FULL_LIST, EMOJIS.SET, EMOJIS.RESET, EMOJIS.STATUS]);

  const filter = (reaction, user) => {
    return [EMOJIS.LIST, EMOJIS.FULL_LIST, EMOJIS.SET, EMOJIS.RESET, EMOJIS.STATUS].includes(reaction.emoji.name)
      && user.id === message.author.id;
  };

  const collected = await createReactionCollector(menuMessage, filter);

  if (collected.size === 0) {
    return menuMessage.edit('⏱️ Configuration canceled - time expired.');
  }

  const reaction = collected.first();

  await safeDeleteMessage(menuMessage);

  switch (reaction.emoji.name) {
    case EMOJIS.LIST:
      return showConfigList(client, message, false);
    case EMOJIS.FULL_LIST:
      return showConfigList(client, message, true);
    case EMOJIS.SET:
      return showSetMenu(client, message);
    case EMOJIS.RESET:
      return confirmReset(client, message);
    case EMOJIS.STATUS:
      return showStatus(client, message);
  }
}

export async function config(client, message, args) {
  try {
    await showMainMenu(client, message);
  } catch (error) {
    console.error('Error processing configuration command:', error);
    await message.reply('❌ An error occurred while processing the command. Please try again later.');
  }
}
