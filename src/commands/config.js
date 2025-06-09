import { loadConfig, saveConfig, setChannelTypeEnabled } from '../utils/configService.js';

export const metadata = {
  name: 'config',
  description: 'Gère la configuration du bot',
  restricted: true,
  usage: 'config'
};

/**
 * Détermine si une valeur textuelle représente un booléen vrai
 * @param {string} value - Valeur à vérifier
 * @returns {boolean} - true si la valeur représente un booléen vrai
 */
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
  DISABLE: '⭕'
};

/**
 * Ajoute les réactions à un message
 * @param {Object} message - Le message Discord
 * @param {Array} emojis - Les emojis à ajouter
 */
async function addReactions(message, emojis) {
  try {
    for (const emoji of emojis) {
      await message.react(emoji);
    }
        } catch (error) {
    console.error('Erreur lors de l\'ajout des réactions:', error);
        }
    }

/**
 * Crée un collecteur de réactions
 * @param {Object} message - Le message Discord
 * @param {Object} filter - Le filtre pour les réactions
 * @param {number} time - Le temps d'attente en ms
 * @returns {Promise} - Promise qui résout avec la réaction collectée
 */
function createReactionCollector(message, filter, time = 60000) {
  return message.awaitReactions({ filter, max: 1, time });
  }

/**
 * Affiche la liste de configuration
 * @param {Object} client - Le client Discord
 * @param {Object} message - Le message Discord
 * @param {boolean} showFull - Afficher la liste complète
 */
async function showConfigList(client, message, showFull) {
  const config = await loadConfig();
  let configMessage = '📝 **Configuration actuelle:**\n\n';

  if (config.scheduler) {
    configMessage += '⏰ **Scheduler:**\n';
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
  try {
    await listMessage.delete();
  } catch (error) {}
  return showMainMenu(client, message);
}

/**
 * Bascule un paramètre entre activé et désactivé
 * @param {Object} client - Le client Discord
 * @param {Object} message - Le message Discord
 * @param {string} settingType - Le type de paramètre (guild, dm, group)
 * @param {boolean} currentValue - La valeur actuelle
 */
async function toggleSetting(client, message, settingType, currentValue) {
  let settingName = '';
  switch (settingType) {
    case 'guild': settingName = 'serveurs'; break;
    case 'dm': settingName = 'messages privés'; break;
    case 'group': settingName = 'groupes'; break;
  }
  const toggleMessage = await message.reply(
    `**Modification du paramètre: ${settingName}**\n\n` +
    `État actuel: ${currentValue ? '✅ activé' : '⭕ désactivé'}\n\n` +
    `${EMOJIS.ENABLE} - Activer\n` +
    `${EMOJIS.DISABLE} - Désactiver\n` +
    `${EMOJIS.CANCEL} - Annuler\n\n` +
    'Cliquez sur une réaction pour confirmer...'
  );

  await addReactions(toggleMessage, [EMOJIS.ENABLE, EMOJIS.DISABLE, EMOJIS.CANCEL]);

  const filter = (reaction, user) => {
    return [EMOJIS.ENABLE, EMOJIS.DISABLE, EMOJIS.CANCEL].includes(reaction.emoji.name) &&
           user.id === message.author.id;
  };

  const collected = await createReactionCollector(toggleMessage, filter);

  if (collected.size === 0) {
    return toggleMessage.edit('⏱️ Modification annulée - temps écoulé.');
      }

  const reaction = collected.first();

  try {
    await toggleMessage.delete();
  } catch (error) {}

  if (reaction.emoji.name === EMOJIS.CANCEL) {
      return showSetMenu(client, message);
  }

  const newValue = reaction.emoji.name === EMOJIS.ENABLE;

  if (newValue !== currentValue) {
    await setChannelTypeEnabled(settingType, newValue);
    const confirmMessage = await message.reply(
      `✅ Les ${settingName} sont maintenant ${newValue ? 'activés ✅' : 'désactivés ⭕'} pour le scheduler.`
    );

    setTimeout(async () => {
      try {
        await confirmMessage.delete();
      } catch (error) {}
      return showSetMenu(client, message);
    }, 2000);
  } else {
    return showSetMenu(client, message);
}
}

/**
 * Affiche le menu de modification
 * @param {Object} client - Le client Discord
 * @param {Object} message - Le message Discord
 */
async function showSetMenu(client, message) {
  const config = await loadConfig();
  const guildEnabled = config.scheduler?.channelTypes?.guild ?? true;
  const dmEnabled = config.scheduler?.channelTypes?.dm ?? true;
  const groupEnabled = config.scheduler?.channelTypes?.group ?? true;

  const setMessage = await message.reply(
    '**⚙️ Modification de la configuration**\n\n' +
    '**Options disponibles:**\n' +
    `${EMOJIS.GUILD} Serveurs: ${guildEnabled ? '✅ activés' : '⭕ désactivés'}\n` +
    `${EMOJIS.DM} Messages privés: ${dmEnabled ? '✅ activés' : '⭕ désactivés'}\n` +
    `${EMOJIS.GROUP} Groupes: ${groupEnabled ? '✅ activés' : '⭕ désactivés'}\n\n` +
    `${EMOJIS.BACK} Retour au menu principal\n\n` +
    'Cliquez sur une réaction pour modifier un paramètre...'
  );

  await addReactions(setMessage, [EMOJIS.GUILD, EMOJIS.DM, EMOJIS.GROUP, EMOJIS.BACK]);

  const filter = (reaction, user) => {
    return [EMOJIS.GUILD, EMOJIS.DM, EMOJIS.GROUP, EMOJIS.BACK].includes(reaction.emoji.name) &&
           user.id === message.author.id;
  };

  const collected = await createReactionCollector(setMessage, filter);

  if (collected.size === 0) {
    return setMessage.edit('⏱️ Configuration annulée - temps écoulé.');
  }

  const reaction = collected.first();

  try {
    await setMessage.delete();
  } catch (error) {}

  switch (reaction.emoji.name) {
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

/**
 * Demande confirmation pour réinitialiser la configuration
 * @param {Object} client - Le client Discord
 * @param {Object} message - Le message Discord
 */
async function confirmReset(client, message) {
  const confirmMessage = await message.reply(
    '**🔄 Réinitialisation de la configuration**\n\n' +
    'Êtes-vous sûr de vouloir réinitialiser toute la configuration aux valeurs par défaut?\n\n' +
    `${EMOJIS.CONFIRM} - Confirmer la réinitialisation\n` +
    `${EMOJIS.CANCEL} - Annuler\n\n` +
    'Cette action ne peut pas être annulée!'
  );

  await addReactions(confirmMessage, [EMOJIS.CONFIRM, EMOJIS.CANCEL]);

  const filter = (reaction, user) => {
    return [EMOJIS.CONFIRM, EMOJIS.CANCEL].includes(reaction.emoji.name) &&
           user.id === message.author.id;
  };

  const collected = await createReactionCollector(confirmMessage, filter);

  if (collected.size === 0) {
    return confirmMessage.edit('⏱️ Réinitialisation annulée - temps écoulé.');
  }

  const reaction = collected.first();

  try {
    await confirmMessage.delete();
  } catch (error) {}

  if (reaction.emoji.name === EMOJIS.CONFIRM) {
    const defaultConfig = {
      scheduler: {
        channelTypes: {
          guild: true,
          dm: true,
          group: true
        }
      }
    };
    await saveConfig(defaultConfig);

    const resetConfirmMessage = await message.reply('✅ Toutes les configurations ont été réinitialisées aux valeurs par défaut.');

    setTimeout(async () => {
      try {
        await resetConfirmMessage.delete();
      } catch (error) {}
      return showMainMenu(client, message);
    }, 2000);
  } else {
    return showMainMenu(client, message);
  }
}

/**
 * Affiche le statut du bot
 * @param {Object} client - Le client Discord
 * @param {Object} message - Le message Discord
 */
async function showStatus(client, message) {
  try {
    const config = await loadConfig();
    const { getSchedulerStatus } = await import('../services/schedulerService.js');

    let statusMessage = '🤖 **État du bot:**\n\n';

    statusMessage += '⚙️ **Configuration:**\n';
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

    try {
      await statusReply.delete();
    } catch (error) {}

    return showMainMenu(client, message);
  } catch (error) {
    console.error('Erreur lors de la récupération du statut:', error);
    const errorMessage = await message.reply('❌ Une erreur est survenue lors de la récupération du statut.');

    setTimeout(async () => {
      try {
        await errorMessage.delete();
      } catch (error) {}
      return showMainMenu(client, message);
    }, 3000);
  }
}

/**
 * Affiche le menu principal de configuration
 * @param {Object} client - Le client Discord
 * @param {Object} message - Le message Discord contenant la commande
 */
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

  try {
    await menuMessage.delete();
  } catch (error) {}

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

/**
 * Gère la commande de configuration du bot
 * @param {Object} client - Le client Discord
 * @param {Object} message - Le message Discord contenant la commande
 * @param {Array} args - Les arguments de la commande (non utilisés dans cette version)
 */
export async function config(client, message, args) {
  try {
    await showMainMenu(client, message);
  } catch (error) {
    console.error('Erreur lors du traitement de la commande de configuration:', error);
    await message.reply('❌ Une erreur est survenue lors du traitement de la commande. Veuillez réessayer plus tard.');
  }
}
