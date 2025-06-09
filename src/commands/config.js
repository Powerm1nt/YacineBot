import {
  loadConfig,
  saveConfig,
  setChannelTypeEnabled,
  setSchedulerEnabled,
  isSchedulerEnabled,
  defaultConfig
} from '../utils/configService.js'
import { initScheduler, stopScheduler } from '../services/schedulerService.js'

export const metadata = {
  name: 'config',
  description: 'Gère la configuration du bot',
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
  SCHEDULER: '⏰'
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

async function handleConfirmationDialog(message, options) {
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
  return reaction.emoji.name === confirmEmoji ? onConfirm() : onCancel();
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
    configMessage += `▫️ Groupes: ${config.scheduler.channelTypes?.group ? '✅ activés' : '⭕ désactivés'}\n\n`;

    if (showFull) {
      if (config.scheduler.guilds && Object.keys(config.scheduler.guilds).length > 0) {
        configMessage += '📋 **Serveurs configurés:**\n';
        for (const [guildId, guildConfig] of Object.entries(config.scheduler.guilds)) {
          configMessage += `▫️ Serveur ${guildId}: ${guildConfig.enabled !== false ? '✅ activé' : '⭕ désactivé'}\n`;
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
  return handleConfirmationDialog(message, {
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

  return handleConfirmationDialog(message, {
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

async function confirmReset(client, message) {
  return handleConfirmationDialog(message, {
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

  const setMessage = await message.reply(
    '**⚙️ Modification de la configuration**\n\n' +
    '**Options disponibles:**\n' +
    `${EMOJIS.SCHEDULER} Service de planification: ${schedulerServiceEnabled ? '✅ activé' : '⭕ désactivé'}\n` +
    `${EMOJIS.GUILD} Serveurs: ${guildEnabled ? '✅ activés' : '⭕ désactivés'}\n` +
    `${EMOJIS.DM} Messages privés: ${dmEnabled ? '✅ activés' : '⭕ désactivés'}\n` +
    `${EMOJIS.GROUP} Groupes: ${groupEnabled ? '✅ activés' : '⭕ désactivés'}\n\n` +
    `${EMOJIS.BACK} Retour au menu principal\n\n` +
    'Cliquez sur une réaction pour modifier un paramètre...'
  );

  await addReactions(setMessage, [EMOJIS.SCHEDULER, EMOJIS.GUILD, EMOJIS.DM, EMOJIS.GROUP, EMOJIS.BACK]);

  const filter = (reaction, user) => {
    return [EMOJIS.SCHEDULER, EMOJIS.GUILD, EMOJIS.DM, EMOJIS.GROUP, EMOJIS.BACK].includes(reaction.emoji.name) &&
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
    case EMOJIS.BACK:
      return showMainMenu(client, message);
  }
}

async function showStatus(client, message) {
  try {
    const config = await loadConfig();
    const { getSchedulerStatus } = await import('../services/schedulerService.js');

    let statusMessage = '🤖 **État du bot:**\n\n';

    statusMessage += '⚙️ **Configuration:**\n';
    statusMessage += `▫️ Service de planification: ${config.scheduler?.enableScheduler ? '✅ activé' : '⭕ désactivé'}\n`;
    statusMessage += `▫️ Serveurs: ${config.scheduler?.channelTypes?.guild ? '✅ activés' : '⭕ désactivés'}\n`;
    statusMessage += `▫️ Messages privés: ${config.scheduler?.channelTypes?.dm ? '✅ activés' : '⭕ désactivés'}\n`;
    statusMessage += `▫️ Groupes: ${config.scheduler?.channelTypes?.group ? '✅ activés' : '⭕ désactivés'}\n\n`;

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
