import {
  loadConfig,
  saveConfig,
  setChannelTypeEnabled,
  setSchedulerEnabled,
  isSchedulerEnabled,
  setAnalysisEnabled,
  isAnalysisEnabled,
  setAutoRespondEnabled,
  isAutoRespondEnabled,
  defaultConfig,
  setGuildConfig,
  getGuildConfig,
  setGuildAnalysisEnabled,
  isGuildAnalysisEnabled,
  setGuildAutoRespondEnabled,
  isGuildAutoRespondEnabled,
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
    console.error('Erreur lors de la mise à jour de l\'état des questions automatiques:', error);
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
    console.error('Erreur lors de la mise à jour de l\'état du partage de contexte:', error);
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
  const trueValues = ['true', 'on', 'oui', '1', 'yes', 'vrai', 'actif', 'activé'];
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
  ANALYSIS: '🔍',
  AUTO_RESPOND: '🤖',
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
    `${confirmEmoji} - Désactiver\n` +
    `${cancelEmoji} - Activer`
    );

  await addReactions(confirmMessage, [confirmEmoji, cancelEmoji]);
  const filter = (reaction, user) => {
    return [confirmEmoji, cancelEmoji].includes(reaction.emoji.name) &&
           user.id === message.author.id;
  };

  const collected = await createReactionCollector(confirmMessage, filter);

  await safeDeleteMessage(confirmMessage);

  if (collected.size === 0) {
    return message.reply('⏱️ Action annulée - temps écoulé.');
  }

  const reaction = collected.first();
  try {
    return reaction.emoji.name === confirmEmoji ? await onConfirm() : await onCancel();
  } catch (error) {
    console.error('Erreur lors de l\'exécution du callback:', error);
    return message.reply('❌ Une erreur est survenue lors de l\'exécution de l\'action.');
  }
}

async function addReactions(message, emojis) {
  try {
    for (const emoji of emojis) {
      await message.react(emoji);
    }
  } catch (error) {
    console.error('Erreur lors de l\'ajout des réactions:', error);
  }
}

function createReactionCollector(message, filter, time = 60000) {
  return message.awaitReactions({ filter, max: 1, time });
}

async function showConfigList(client, message, showFull) {
    const config = await loadConfig();
  let configMessage = '📝 **Configuration actuelle:**\n\n';

  if (config.scheduler) {
    configMessage += '⏰ **Scheduler:**\n';
    configMessage += `▫️ Service de planification: ${config.scheduler.enabled ? '✅ activé' : '⭕ désactivé'}\n`;
    configMessage += `▫️ Serveurs: ${config.scheduler.channelTypes?.guild ? '✅ activés' : '⭕ désactivés'}\n`;
    configMessage += `▫️ Messages privés: ${config.scheduler.channelTypes?.dm ? '✅ activés' : '⭕ désactivés'}\n`;
    configMessage += `▫️ Groupes: ${config.scheduler.channelTypes?.group ? '✅ activés' : '⭕ désactivés'}\n`;
    configMessage += `▫️ Analyse de pertinence: ${config.scheduler.analysisEnabled !== false ? '✅ activée' : '⭕ désactivée'}\n`;
    configMessage += `▫️ Réponse automatique: ${config.scheduler.autoRespond !== false ? '✅ activée' : '⭕ désactivée'}\n`;
    configMessage += `▫️ Partage de contexte: ${config.scheduler.sharingEnabled !== false ? '✅ activé' : '⭕ désactivé'}\n\n`;

    if (showFull) {
      if (config.scheduler.guilds && Object.keys(config.scheduler.guilds).length > 0) {
        configMessage += '📋 **Serveurs configurés:**\n';
        for (const [guildId, guildConfig] of Object.entries(config.scheduler.guilds)) {
          // Récupérer le nom du serveur si possible
          let serverName = guildId;
          try {
            const guild = client.guilds.cache.get(guildId);
            if (guild) serverName = guild.name;
          } catch (error) {}

          configMessage += `▫️ Serveur ${serverName}: ${guildConfig.enabled !== false ? '✅ activé' : '⭕ désactivé'}\n`;

          // Afficher la configuration spécifique au serveur
          if (guildConfig.analysisEnabled !== undefined) {
            configMessage += `   - Analyse des messages: ${guildConfig.analysisEnabled ? '✅ activée' : '⭕ désactivée'}\n`;
          }
          if (guildConfig.autoRespond !== undefined) {
            configMessage += `   - Réponses automatiques: ${guildConfig.autoRespond ? '✅ activées' : '⭕ désactivées'}\n`;
          }
        }
        configMessage += '\n';
      }

      if (config.scheduler.users && Object.keys(config.scheduler.users).length > 0) {
        configMessage += '👤 **Utilisateurs configurés:**\n';
        for (const [userId, userConfig] of Object.entries(config.scheduler.users)) {
          configMessage += `▫️ Utilisateur ${userId}: ${userConfig.enabled !== false ? '✅ activé' : '⭕ désactivé'}\n`;
        }
        configMessage += '\n';
      }
    }
  }

  const listMessage = await message.reply(configMessage + '\n' +
    `Cliquez sur ${EMOJIS.BACK} pour revenir au menu principal.`);

  await listMessage.react(EMOJIS.BACK);
    const filter = (reaction, user) => {
      return reaction.emoji.name === EMOJIS.BACK && user.id === message.author.id;
    };

  await createReactionCollector(listMessage, filter);
  await safeDeleteMessage(listMessage);
    return showMainMenu(client, message);
}

async function toggleSchedulerService(client, message, currentValue) {
  return handleConfirmationDialog(client, message, {
    title: 'Modification du service de planification',
    description: `État actuel: ${currentValue ? '✅ activé' : '⭕ désactivé'}`,
    confirmEmoji: '⭕',
    cancelEmoji: '✅',
    onConfirm: async () => {
      if (currentValue !== false) {
        await setSchedulerEnabled(false);
        await stopScheduler();
        await showTemporaryMessage(client, message, '✅ Le service de planification est maintenant désactivé ⭕');
      }
      return showSetMenu(client, message);
    },
    onCancel: async () => {
      if (currentValue !== true) {
        await setSchedulerEnabled(true);
        await initScheduler(client);
        await showTemporaryMessage(client, message, '✅ Le service de planification est maintenant activé ✅');
      }
      return showSetMenu(client, message);
    }
  });
}

async function toggleSetting(client, message, settingType, currentValue) {
  const settingNames = {
    guild: 'serveurs',
    dm: 'messages privés',
    group: 'groupes'
  };

  return handleConfirmationDialog(client, message, {
    title: `Modification du paramètre: ${settingNames[settingType]}`,
    description: `État actuel: ${currentValue ? '✅ activé' : '⭕ désactivé'}`,
    cancelEmoji: '⭕',
    confirmEmoji: '✅',
    onConfirm: async () => {
      if (currentValue !== false) {
        await setChannelTypeEnabled(settingType, false);
        await showTemporaryMessage(client, message,
          `✅ Les ${settingNames[settingType]} sont maintenant désactivés ⭕ pour le scheduler.`
        );
      }
      return showSetMenu(client, message);
    },
    onCancel: async () => {
      if (currentValue !== true) {
        await setChannelTypeEnabled(settingType, true);
        await showTemporaryMessage(client, message,
          `✅ Les ${settingNames[settingType]} sont maintenant activés ✅ pour le scheduler.`
        );
      }
      return showSetMenu(client, message);
    }
  });
}

async function toggleAnalysisSetting(client, message, currentValue) {
  return handleConfirmationDialog(client, message, {
    title: 'Modification de l\'analyse de pertinence',
    description: `État actuel: ${currentValue ? '✅ activée' : '⭕ désactivée'}`,
    confirmEmoji: '⭕',
    cancelEmoji: '✅',
    onConfirm: async () => {
      if (currentValue !== false) {
        await setAnalysisEnabled(false);
        await showTemporaryMessage(client, message, '✅ L\'analyse de pertinence est maintenant désactivée ⭕');
      }
      return showSetMenu(client, message);
    },
    onCancel: async () => {
      if (currentValue !== true) {
        await setAnalysisEnabled(true);
        await showTemporaryMessage(client, message, '✅ L\'analyse de pertinence est maintenant activée ✅');
      }
      return showSetMenu(client, message);
    }
  });
}

async function toggleAutoRespondSetting(client, message, currentValue) {
  return handleConfirmationDialog(client, message, {
    title: 'Modification de la réponse automatique',
    description: `État actuel: ${currentValue ? '✅ activée' : '⭕ désactivée'}`,
    confirmEmoji: '⭕',
    cancelEmoji: '✅',
    onConfirm: async () => {
      if (currentValue !== false) {
        await setAutoRespondEnabled(false);
        await showTemporaryMessage(client, message, '✅ La réponse automatique est maintenant désactivée ⭕');
      }
      return showSetMenu(client, message);
    },
    onCancel: async () => {
      if (currentValue !== true) {
        await setAutoRespondEnabled(true);
        await showTemporaryMessage(client, message, '✅ La réponse automatique est maintenant activée ✅');
      }
      return showSetMenu(client, message);
    }
  });
}

async function toggleAutoQuestionSetting(client, message, currentValue) {
  return handleConfirmationDialog(client, message, {
    title: 'Modification des questions automatiques',
    description: `État actuel: ${currentValue ? '✅ activées' : '⭕ désactivées'}`,
    confirmEmoji: '⭕',
    cancelEmoji: '✅',
    onConfirm: async () => {
      if (currentValue !== false) {
        await setAutoQuestionEnabled(false);
        await showTemporaryMessage(client, message, '✅ Les questions automatiques sont maintenant désactivées ⭕');
      }
      return showSetMenu(client, message);
    },
    onCancel: async () => {
      if (currentValue !== true) {
        await setAutoQuestionEnabled(true);
        await showTemporaryMessage(client, message, '✅ Les questions automatiques sont maintenant activées ✅');
      }
      return showSetMenu(client, message);
    }
  });
}

async function toggleSharingSetting(client, message, currentValue) {
  return handleConfirmationDialog(client, message, {
    title: 'Modification du partage de contexte',
    description: `État actuel: ${currentValue ? '✅ activé' : '⭕ désactivé'}`,
    confirmEmoji: '⭕',
    cancelEmoji: '✅',
    onConfirm: async () => {
      if (currentValue !== false) {
        await setSharingEnabled(false);
        await showTemporaryMessage(client, message, '✅ Le partage de contexte est maintenant désactivé ⭕');
      }
      return showSetMenu(client, message);
    },
    onCancel: async () => {
      if (currentValue !== true) {
        await setSharingEnabled(true);
        await showTemporaryMessage(client, message, '✅ Le partage de contexte est maintenant activé ✅');
      }
      return showSetMenu(client, message);
    }
  });
}

async function confirmReset(client, message) {
  return handleConfirmationDialog(client, message, {
    title: '🔄 Réinitialisation de la configuration',
    description: 'Êtes-vous sûr de vouloir réinitialiser toute la configuration aux valeurs par défaut?\n\nCette action ne peut pas être annulée!',
    onConfirm: async () => {
      await saveConfig(defaultConfig);
      await showTemporaryMessage(client, message,
        '✅ Toutes les configurations ont été réinitialisées aux valeurs par défaut.'
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
  const analysisEnabled = await isAnalysisEnabled();
  const autoRespondEnabled = await isAutoRespondEnabled();
  const autoQuestionEnabled = await isAutoQuestionEnabled();
  const sharingEnabled = await isSharingEnabled();

  const setMessage = await message.reply(
    '**⚙️ Modification de la configuration**\n\n' +
    '**Options disponibles:**\n' +
    `${EMOJIS.SCHEDULER} Service de planification: ${schedulerServiceEnabled ? '✅ activé' : '⭕ désactivé'}\n` +
    `${EMOJIS.GUILD} Serveurs: ${guildEnabled ? '✅ activés' : '⭕ désactivés'}\n` +
    `${EMOJIS.DM} Messages privés: ${dmEnabled ? '✅ activés' : '⭕ désactivés'}\n` +
    `${EMOJIS.GROUP} Groupes: ${groupEnabled ? '✅ activés' : '⭕ désactivés'}\n` +
    `${EMOJIS.ANALYSIS} Analyse de pertinence: ${analysisEnabled ? '✅ activée' : '⭕ désactivée'}\n` +
    `${EMOJIS.AUTO_RESPOND} Réponse automatique: ${autoRespondEnabled ? '✅ activée' : '⭕ désactivée'}\n` +
    `${EMOJIS.AUTO_QUESTION} Questions automatiques: ${autoQuestionEnabled ? '✅ activées' : '⭕ désactivées'}\n` +
    `${EMOJIS.SHARING} Partage de contexte: ${sharingEnabled ? '✅ activé' : '⭕ désactivé'}\n` +
    `${EMOJIS.CONVERSATION} Analyse de conversation: Gérer les conversations désactivées\n` +
    `${EMOJIS.GUILD_MANAGEMENT} Gestion des serveurs: Activer/désactiver des serveurs entiers\n\n` +
    `${EMOJIS.BACK} Retour au menu principal\n\n` +
    'Cliquez sur une réaction pour modifier un paramètre...'
  );

  const allEmojis = [
    EMOJIS.SCHEDULER, EMOJIS.GUILD, EMOJIS.DM, EMOJIS.GROUP,
    EMOJIS.ANALYSIS, EMOJIS.AUTO_RESPOND, 
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
    return setMessage.edit('⏱️ Configuration annulée - temps écoulé.');
  }

  const reaction = collected.first();

  await safeDeleteMessage(setMessage);

  switch (reaction.emoji.name) {
    case EMOJIS.SCHEDULER:
      return toggleSchedulerService(client, message, schedulerServiceEnabled);
    case EMOJIS.GUILD:
      return toggleSetting(client, message, 'guild', guildEnabled);
    case EMOJIS.DM:
      return toggleSetting(client, message, 'dm', dmEnabled);
    case EMOJIS.GROUP:
      return toggleSetting(client, message, 'group', groupEnabled);
    case EMOJIS.ANALYSIS:
      return toggleAnalysisSetting(client, message, analysisEnabled);
    case EMOJIS.AUTO_RESPOND:
      return toggleAutoRespondSetting(client, message, autoRespondEnabled);
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

    let menuContent = '💭 **Gestion des analyses de conversation**\n\n';

    if (disabledCount === 0) {
      menuContent += 'Aucune conversation n\'a d\'analyse désactivée actuellement.\n\n';
    } else {
      menuContent += `**${disabledCount} conversation(s) avec analyse désactivée:**\n`;

      // List all disabled conversations
      for (const [key, value] of Object.entries(disabledConversations)) {
        if (value === true) {
          const [channelId, guildId] = key.split('-');
          let locationInfo = `Canal: ${channelId}`;

          // Try to get guild name if possible
          if (guildId && guildId !== 'dm') {
            try {
              const guild = client.guilds.cache.get(guildId);
              if (guild) {
                locationInfo += ` (Serveur: ${guild.name})`;
              } else {
                locationInfo += ` (Serveur: ${guildId})`;
              }
            } catch (error) {
              locationInfo += ` (Serveur: ${guildId})`;
            }
          } else {
            locationInfo += ' (Messages privés)';
          }

          menuContent += `▫️ ${locationInfo}\n`;
        }
      }
      menuContent += '\n';
    }

    // Instructions
    menuContent += '**Actions disponibles:**\n';
    menuContent += '1️⃣ - Désactiver l\'analyse pour une conversation (par ID de canal)\n';
    menuContent += '2️⃣ - Réactiver l\'analyse pour une conversation (par ID de canal)\n';
    menuContent += `${EMOJIS.BACK} - Retour au menu de configuration\n\n`;
    menuContent += 'Cliquez sur une réaction pour continuer...';

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
      return message.reply('⏱️ Action annulée - temps écoulé.');
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
    console.error('Erreur lors de l\'affichage du menu de conversation:', error);
    await message.reply('❌ Une erreur est survenue lors de l\'affichage du menu de conversation.');
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

    let menuContent = '🌐 **Gestion des serveurs**\n\n';

    if (Object.keys(guilds).length === 0) {
      menuContent += 'Aucun serveur n\'a de configuration spécifique actuellement.\n\n';
    } else {
      menuContent += `**${Object.keys(guilds).length} serveur(s) configuré(s), dont ${disabledCount} désactivé(s):**\n`;

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
        menuContent += `▫️ ${guildName} (${guildId}): ${isEnabled ? '✅ activé' : '⭕ désactivé'}\n`;
      }
      menuContent += '\n';
    }

    // Instructions
    menuContent += '**Actions disponibles:**\n';
    menuContent += '1️⃣ - Désactiver un serveur entier (par ID)\n';
    menuContent += '2️⃣ - Réactiver un serveur entier (par ID)\n';
    menuContent += `${EMOJIS.BACK} - Retour au menu de configuration\n\n`;
    menuContent += 'Cliquez sur une réaction pour continuer...';

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
      return message.reply('⏱️ Action annulée - temps écoulé.');
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
    console.error('Erreur lors de l\'affichage du menu de gestion des serveurs:', error);
    await message.reply('❌ Une erreur est survenue lors de l\'affichage du menu de gestion des serveurs.');
    return showSetMenu(client, message);
  }
}

async function promptForConversationDisable(client, message) {
  try {
    const promptMessage = await message.reply(
      '**Désactiver l\'analyse pour une conversation**\n\n' +
      'Veuillez entrer l\'ID du canal pour lequel vous souhaitez désactiver l\'analyse.\n' +
      'Format: `channelId` ou `channelId guildId` (pour les canaux de serveur)\n\n' +
      'Exemple: `123456789012345678` ou `123456789012345678 987654321098765432`\n\n' +
      'Tapez `annuler` pour revenir au menu précédent.'
    );

    // Create message collector
    const filter = m => m.author.id === message.author.id;
    const collector = message.channel.createMessageCollector({ filter, time: 60000, max: 1 });

    collector.on('collect', async m => {
      await safeDeleteMessage(promptMessage);
      await safeDeleteMessage(m);

      const input = m.content.trim();

      if (input.toLowerCase() === 'annuler') {
        return showConversationMenu(client, message);
      }

      const parts = input.split(' ');
      const channelId = parts[0];
      const guildId = parts.length > 1 ? parts[1] : null;

      if (!channelId || channelId.length < 10) {
        await message.reply('❌ ID de canal invalide. Veuillez réessayer.');
        return showConversationMenu(client, message);
      }

      // Disable analysis for the conversation
      const success = await setConversationAnalysisDisabled(channelId, guildId, true);

      if (success) {
        await message.reply(`✅ L'analyse a été désactivée pour le canal ${channelId}${guildId ? ` dans le serveur ${guildId}` : ''}.`);
      } else {
        await message.reply('❌ Une erreur est survenue lors de la désactivation de l\'analyse pour cette conversation.');
      }

      return showConversationMenu(client, message);
    });

    collector.on('end', async collected => {
      if (collected.size === 0) {
        await safeDeleteMessage(promptMessage);
        await message.reply('⏱️ Action annulée - temps écoulé.');
        return showConversationMenu(client, message);
      }
    });
  } catch (error) {
    console.error('Erreur lors de la désactivation de l\'analyse pour une conversation:', error);
    await message.reply('❌ Une erreur est survenue lors de la désactivation de l\'analyse pour une conversation.');
    return showConversationMenu(client, message);
  }
}

async function promptForConversationEnable(client, message) {
  try {
    // Get the list of disabled conversations
    const config = await loadConfig();
    const disabledConversations = config.scheduler?.disabledConversations || {};
    const disabledCount = Object.keys(disabledConversations).length;

    if (disabledCount === 0) {
      await message.reply('ℹ️ Aucune conversation n\'a d\'analyse désactivée actuellement.');
      return showConversationMenu(client, message);
    }

    const promptMessage = await message.reply(
      '**Réactiver l\'analyse pour une conversation**\n\n' +
      'Veuillez entrer l\'ID du canal pour lequel vous souhaitez réactiver l\'analyse.\n' +
      'Format: `channelId` ou `channelId guildId` (pour les canaux de serveur)\n\n' +
      'Exemple: `123456789012345678` ou `123456789012345678 987654321098765432`\n\n' +
      'Tapez `annuler` pour revenir au menu précédent.'
    );

    // Create message collector
    const filter = m => m.author.id === message.author.id;
    const collector = message.channel.createMessageCollector({ filter, time: 60000, max: 1 });

    collector.on('collect', async m => {
      await safeDeleteMessage(promptMessage);
      await safeDeleteMessage(m);

      const input = m.content.trim();

      if (input.toLowerCase() === 'annuler') {
        return showConversationMenu(client, message);
      }

      const parts = input.split(' ');
      const channelId = parts[0];
      const guildId = parts.length > 1 ? parts[1] : null;

      if (!channelId || channelId.length < 10) {
        await message.reply('❌ ID de canal invalide. Veuillez réessayer.');
        return showConversationMenu(client, message);
      }

      // Check if the conversation is actually disabled
      const conversationKey = `${channelId}-${guildId || 'dm'}`;
      if (!disabledConversations[conversationKey]) {
        await message.reply(`ℹ️ L'analyse n'est pas désactivée pour le canal ${channelId}${guildId ? ` dans le serveur ${guildId}` : ''}.`);
        return showConversationMenu(client, message);
      }

      // Enable analysis for the conversation
      const success = await setConversationAnalysisDisabled(channelId, guildId, false);

      if (success) {
        await message.reply(`✅ L'analyse a été réactivée pour le canal ${channelId}${guildId ? ` dans le serveur ${guildId}` : ''}.`);
      } else {
        await message.reply('❌ Une erreur est survenue lors de la réactivation de l\'analyse pour cette conversation.');
      }

      return showConversationMenu(client, message);
    });

    collector.on('end', async collected => {
      if (collected.size === 0) {
        await safeDeleteMessage(promptMessage);
        await message.reply('⏱️ Action annulée - temps écoulé.');
        return showConversationMenu(client, message);
      }
    });
  } catch (error) {
    console.error('Erreur lors de la réactivation de l\'analyse pour une conversation:', error);
    await message.reply('❌ Une erreur est survenue lors de la réactivation de l\'analyse pour une conversation.');
    return showConversationMenu(client, message);
  }
}

async function promptForGuildDisable(client, message) {
  try {
    // Get the list of available guilds
    let availableGuilds = [];
    client.guilds.cache.forEach(guild => {
      availableGuilds.push({ id: guild.id, name: guild.name });
    });

    let promptContent = '**Désactiver un serveur entier**\n\n';

    if (availableGuilds.length > 0) {
      promptContent += 'Serveurs disponibles:\n';
      availableGuilds.forEach(guild => {
        promptContent += `▫️ ${guild.name} (ID: ${guild.id})\n`;
      });
      promptContent += '\n';
    }

    promptContent += 'Veuillez entrer l\'ID du serveur que vous souhaitez désactiver.\n';
    promptContent += 'Exemple: `123456789012345678`\n\n';
    promptContent += 'Tapez `annuler` pour revenir au menu précédent.';

    const promptMessage = await message.reply(promptContent);

    // Create message collector
    const filter = m => m.author.id === message.author.id;
    const collector = message.channel.createMessageCollector({ filter, time: 60000, max: 1 });

    collector.on('collect', async m => {
      await safeDeleteMessage(promptMessage);
      await safeDeleteMessage(m);

      const input = m.content.trim();

      if (input.toLowerCase() === 'annuler') {
        return showGuildManagementMenu(client, message);
      }

      const guildId = input;

      if (!guildId || guildId.length < 10) {
        await message.reply('❌ ID de serveur invalide. Veuillez réessayer.');
        return showGuildManagementMenu(client, message);
      }

      // Check if the guild exists
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        await message.reply('⚠️ Attention: Ce serveur n\'est pas accessible par le bot. Vous pouvez quand même le désactiver, mais vérifiez que l\'ID est correct.');
      }

      // Disable the guild
      const success = await setGuildEnabled(guildId, false);

      if (success) {
        await message.reply(`✅ Le serveur ${guild ? guild.name : guildId} a été désactivé.`);
      } else {
        await message.reply('❌ Une erreur est survenue lors de la désactivation du serveur.');
      }

      return showGuildManagementMenu(client, message);
    });

    collector.on('end', async collected => {
      if (collected.size === 0) {
        await safeDeleteMessage(promptMessage);
        await message.reply('⏱️ Action annulée - temps écoulé.');
        return showGuildManagementMenu(client, message);
      }
    });
  } catch (error) {
    console.error('Erreur lors de la désactivation d\'un serveur:', error);
    await message.reply('❌ Une erreur est survenue lors de la désactivation du serveur.');
    return showGuildManagementMenu(client, message);
  }
}

async function promptForGuildEnable(client, message) {
  try {
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

    if (disabledGuilds.length === 0) {
      await message.reply('ℹ️ Aucun serveur n\'est désactivé actuellement.');
      return showGuildManagementMenu(client, message);
    }

    let promptContent = '**Réactiver un serveur**\n\n';
    promptContent += 'Serveurs désactivés:\n';

    disabledGuilds.forEach(guild => {
      promptContent += `▫️ ${guild.name} (ID: ${guild.id})\n`;
    });

    promptContent += '\nVeuillez entrer l\'ID du serveur que vous souhaitez réactiver.\n';
    promptContent += 'Exemple: `123456789012345678`\n\n';
    promptContent += 'Tapez `annuler` pour revenir au menu précédent.';

    const promptMessage = await message.reply(promptContent);

    // Create message collector
    const filter = m => m.author.id === message.author.id;
    const collector = message.channel.createMessageCollector({ filter, time: 60000, max: 1 });

    collector.on('collect', async m => {
      await safeDeleteMessage(promptMessage);
      await safeDeleteMessage(m);

      const input = m.content.trim();

      if (input.toLowerCase() === 'annuler') {
        return showGuildManagementMenu(client, message);
      }

      const guildId = input;

      if (!guildId || guildId.length < 10) {
        await message.reply('❌ ID de serveur invalide. Veuillez réessayer.');
        return showGuildManagementMenu(client, message);
      }

      // Check if the guild is actually disabled
      const guildConfig = guilds[guildId];
      if (!guildConfig || guildConfig.enabled !== false) {
        await message.reply(`ℹ️ Le serveur ${guildId} n'est pas désactivé.`);
        return showGuildManagementMenu(client, message);
      }

      // Enable the guild
      const success = await setGuildEnabled(guildId, true);

      if (success) {
        // Try to get guild name if possible
        let guildName = guildId;
        try {
          const guild = client.guilds.cache.get(guildId);
          if (guild) {
            guildName = guild.name;
          }
        } catch (error) {
          // Keep the ID as name if we can't get the guild
        }

        await message.reply(`✅ Le serveur ${guildName} a été réactivé.`);
      } else {
        await message.reply('❌ Une erreur est survenue lors de la réactivation du serveur.');
      }

      return showGuildManagementMenu(client, message);
    });

    collector.on('end', async collected => {
      if (collected.size === 0) {
        await safeDeleteMessage(promptMessage);
        await message.reply('⏱️ Action annulée - temps écoulé.');
        return showGuildManagementMenu(client, message);
      }
    });
  } catch (error) {
    console.error('Erreur lors de la réactivation d\'un serveur:', error);
    await message.reply('❌ Une erreur est survenue lors de la réactivation du serveur.');
    return showGuildManagementMenu(client, message);
  }
}

async function showStatus(client, message) {
  try {
    const config = await loadConfig();
    const { getSchedulerStatus } = await import('../services/schedulerService.js');

    let statusMessage = '🤖 **État du bot:**\n\n';

    statusMessage += '⚙️ **Configuration:**\n';
    statusMessage += `▫️ Service de planification: ${config.scheduler?.enabled ? '✅ activé' : '⭕ désactivé'}\n`;
    statusMessage += `▫️ Serveurs: ${config.scheduler?.channelTypes?.guild ? '✅ activés' : '⭕ désactivés'}\n`;
    statusMessage += `▫️ Messages privés: ${config.scheduler?.channelTypes?.dm ? '✅ activés' : '⭕ désactivés'}\n`;
    statusMessage += `▫️ Groupes: ${config.scheduler?.channelTypes?.group ? '✅ activés' : '⭕ désactivés'}\n`;
    statusMessage += `▫️ Analyse de pertinence: ${config.scheduler?.analysisEnabled !== false ? '✅ activée' : '⭕ désactivée'}\n`;
    statusMessage += `▫️ Réponse automatique: ${config.scheduler?.autoRespond !== false ? '✅ activée' : '⭕ désactivée'}\n`;
    statusMessage += `▫️ Questions automatiques: ${config.scheduler?.autoQuestion !== false ? '✅ activées' : '⭕ désactivées'}\n`;
    statusMessage += `▫️ Partage de contexte: ${config.scheduler?.sharingEnabled !== false ? '✅ activé' : '⭕ désactivé'}\n`;

    // Afficher les informations sur les conversations désactivées
    const disabledConversations = config.scheduler?.disabledConversations || {};
    const disabledConversationsCount = Object.keys(disabledConversations).length;
    statusMessage += `▫️ Conversations avec analyse désactivée: ${disabledConversationsCount}\n`;

    // Afficher les informations sur les serveurs désactivés
    const guilds = config.scheduler?.guilds || {};
    let disabledGuildsCount = 0;
    for (const [guildId, guildConfig] of Object.entries(guilds)) {
      if (guildConfig.enabled === false) {
        disabledGuildsCount++;
      }
    }
    statusMessage += `▫️ Serveurs désactivés: ${disabledGuildsCount}\n`;

    const schedulerStatus = getSchedulerStatus();
    if (schedulerStatus) {
      statusMessage += '⏰ **Scheduler:**\n';
      statusMessage += `▫️ État: ${schedulerStatus.active ? '✅ actif' : '⭕ inactif'}\n`;
      statusMessage += `▫️ Tâches: ${schedulerStatus.taskCount}\n`;
      statusMessage += `▫️ Heure actuelle: ${schedulerStatus.currentTime} (${schedulerStatus.timezone})\n`;
      statusMessage += `▫️ Heures actives: ${schedulerStatus.inActiveHours ? '✅ oui' : '⭕ non'} (${schedulerStatus.config.activeHours})\n\n`;

      if (schedulerStatus.nextTask) {
        statusMessage += '⏱️ **Prochaine tâche:**\n';
        statusMessage += `▫️ Tâche #${schedulerStatus.nextTask.number}\n`;
        statusMessage += `▫️ Exécution: ${schedulerStatus.nextTask.nextExecution}\n`;
        statusMessage += `▫️ Temps restant: ${schedulerStatus.nextTask.timeLeft}\n`;
      }
    }

    statusMessage += '\n' + `Cliquez sur ${EMOJIS.BACK} pour revenir au menu principal.`;

    const statusReply = await message.reply(statusMessage);
    await statusReply.react(EMOJIS.BACK);

    const filter = (reaction, user) => {
      return reaction.emoji.name === EMOJIS.BACK && user.id === message.author.id;
    };

    await createReactionCollector(statusReply, filter);

    await safeDeleteMessage(statusReply);

    return showMainMenu(client, message);
  } catch (error) {
    console.error('Erreur lors de la récupération du statut:', error);
    await showTemporaryMessage(client, message, '❌ Une erreur est survenue lors de la récupération du statut.', 3000);
  }
}

async function showMainMenu(client, message) {
  const menuMessage = await message.reply(
    '**📝 Menu de Configuration**\n\n' +
    `${EMOJIS.LIST} - Afficher la configuration actuelle\n` +
    `${EMOJIS.FULL_LIST} - Afficher la configuration détaillée\n` +
    `${EMOJIS.SET} - Modifier la configuration\n` +
    `${EMOJIS.RESET} - Réinitialiser la configuration\n` +
    `${EMOJIS.STATUS} - Afficher le statut du bot\n\n` +
    'Cliquez sur une réaction pour continuer...'
  );

  await addReactions(menuMessage, [EMOJIS.LIST, EMOJIS.FULL_LIST, EMOJIS.SET, EMOJIS.RESET, EMOJIS.STATUS]);

  const filter = (reaction, user) => {
    return [EMOJIS.LIST, EMOJIS.FULL_LIST, EMOJIS.SET, EMOJIS.RESET, EMOJIS.STATUS].includes(reaction.emoji.name)
      && user.id === message.author.id;
  };

  const collected = await createReactionCollector(menuMessage, filter);

  if (collected.size === 0) {
    return menuMessage.edit('⏱️ Configuration annulée - temps écoulé.');
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
    console.error('Erreur lors du traitement de la commande de configuration:', error);
    await message.reply('❌ Une erreur est survenue lors du traitement de la commande. Veuillez réessayer plus tard.');
  }
}
