import { loadConfig, saveConfig, setChannelTypeEnabled } from '../utils/configService.js';

export const metadata = {
  name: 'config',
  description: 'Gère la configuration du bot',
  restricted: true,
  usage: 'config [list|set|reset|status] [options]'
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

/**
 * Gère la commande de configuration du bot
 * @param {Object} client - Le client Discord
 * @param {Object} message - Le message Discord contenant la commande
 * @param {Array} args - Les arguments de la commande
 */
export async function config(client, message, args) {
  try {
    if (!args.length) {
      return message.reply('❌ Veuillez spécifier une action de configuration. Exemple: `config list` ou `config set [clé] [valeur]`');
    }

    const action = args[0].toLowerCase();

    switch (action) {
      case 'list':
        const showFull = args[1]?.toLowerCase() === 'full';
        const config = await loadConfig();
        let configMessage = '📝 **Configuration actuelle:**\n\n';

        if (config.scheduler) {
          configMessage += '⏰ **Scheduler:**\n';
          configMessage += `▫️ Serveurs: ${config.scheduler.channelTypes?.guild ? '✅ activés' : '❌ désactivés'}\n`;
          configMessage += `▫️ Messages privés: ${config.scheduler.channelTypes?.dm ? '✅ activés' : '❌ désactivés'}\n`;
          configMessage += `▫️ Groupes: ${config.scheduler.channelTypes?.group ? '✅ activés' : '❌ désactivés'}\n\n`;

          if (showFull) {
            if (config.scheduler.guilds && Object.keys(config.scheduler.guilds).length > 0) {
              configMessage += '📋 **Serveurs configurés:**\n';
              for (const [guildId, guildConfig] of Object.entries(config.scheduler.guilds)) {
                configMessage += `▫️ Serveur ${guildId}: ${guildConfig.enabled !== false ? '✅ activé' : '❌ désactivé'}\n`;
              }
              configMessage += '\n';
            }

            if (config.scheduler.users && Object.keys(config.scheduler.users).length > 0) {
              configMessage += '👤 **Utilisateurs configurés:**\n';
              for (const [userId, userConfig] of Object.entries(config.scheduler.users)) {
                configMessage += `▫️ Utilisateur ${userId}: ${userConfig.enabled !== false ? '✅ activé' : '❌ désactivé'}\n`;
              }
              configMessage += '\n';
            }
          }
        }

        if (!showFull) {
          configMessage += '💾 Pour voir toutes les configurations détaillées, utilisez `config list full`';
        }

        await message.reply(configMessage);
        break;

      case 'set':
        if (args.length < 3) {
          return message.reply('❌ Format incorrect. Utilisez: `config set [clé] [valeur]`');
        }
        const key = args[1].toLowerCase();
        const value = args.slice(2).join(' ').toLowerCase();

        switch (key) {
          case 'scheduler.guild':
          case 'scheduler.serveurs':
            const guildEnabled = isValueTrue(value);
            await setChannelTypeEnabled('guild', guildEnabled);
            await message.reply(`✅ Les serveurs sont maintenant ${guildEnabled ? 'activés' : 'désactivés'} pour le scheduler.`);
            break;

          case 'scheduler.dm':
          case 'scheduler.mp':
            const dmEnabled = isValueTrue(value);
            await setChannelTypeEnabled('dm', dmEnabled);
            await message.reply(`✅ Les messages privés sont maintenant ${dmEnabled ? 'activés' : 'désactivés'} pour le scheduler.`);
            break;

          case 'scheduler.group':
          case 'scheduler.groupes':
            const groupEnabled = isValueTrue(value);
            await setChannelTypeEnabled('group', groupEnabled);
            await message.reply(`✅ Les groupes sont maintenant ${groupEnabled ? 'activés' : 'désactivés'} pour le scheduler.`);
            break;

          default:
            const config = await loadConfig();
            const keyParts = key.split('.');
            let current = config;

            for (let i = 0; i < keyParts.length - 1; i++) {
              if (!current[keyParts[i]]) current[keyParts[i]] = {};
              current = current[keyParts[i]];
            }

            const numValue = Number(value);
            current[keyParts[keyParts.length - 1]] = !isNaN(numValue) ? numValue : value;

            await saveConfig(config);
            await message.reply(`✅ Configuration mise à jour: ${key} = ${value}`);
        }
        break;

      case 'reset':
        if (!args[1]) {
          return message.reply('❌ Veuillez spécifier la clé de configuration à réinitialiser.');
        }

        const resetKey = args[1].toLowerCase();

        if (resetKey === 'all') {
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
          await message.reply('✅ Toutes les configurations ont été réinitialisées aux valeurs par défaut.');
        } else {
          await message.reply('❌ Clé de réinitialisation non reconnue. Utilisez `reset all` pour tout réinitialiser.');
        }
        break;

      case 'status':
        try {
          const config = await loadConfig();
          const { getSchedulerStatus } = await import('../services/schedulerService.js');

          let statusMessage = '🤖 **État du bot:**\n\n';

          statusMessage += '⚙️ **Configuration:**\n';
          statusMessage += `▫️ Serveurs: ${config.scheduler?.channelTypes?.guild ? '✅ activés' : '❌ désactivés'}\n`;
          statusMessage += `▫️ Messages privés: ${config.scheduler?.channelTypes?.dm ? '✅ activés' : '❌ désactivés'}\n`;
          statusMessage += `▫️ Groupes: ${config.scheduler?.channelTypes?.group ? '✅ activés' : '❌ désactivés'}\n\n`;

          const schedulerStatus = getSchedulerStatus();
          if (schedulerStatus) {
            statusMessage += '⏰ **Scheduler:**\n';
            statusMessage += `▫️ État: ${schedulerStatus.active ? '✅ actif' : '❌ inactif'}\n`;
            statusMessage += `▫️ Tâches: ${schedulerStatus.taskCount}\n`;
            statusMessage += `▫️ Heure actuelle: ${schedulerStatus.currentTime} (${schedulerStatus.timezone})\n`;
            statusMessage += `▫️ Heures actives: ${schedulerStatus.inActiveHours ? '✅ oui' : '❌ non'} (${schedulerStatus.config.activeHours})\n\n`;

            if (schedulerStatus.nextTask) {
              statusMessage += '⏱️ **Prochaine tâche:**\n';
              statusMessage += `▫️ Tâche #${schedulerStatus.nextTask.number}\n`;
              statusMessage += `▫️ Exécution: ${schedulerStatus.nextTask.nextExecution}\n`;
              statusMessage += `▫️ Temps restant: ${schedulerStatus.nextTask.timeLeft}\n`;
            }
          }

          await message.reply(statusMessage);
        } catch (error) {
          console.error('Erreur lors de la récupération du statut:', error);
          await message.reply('❌ Une erreur est survenue lors de la récupération du statut.');
        }
        break;

      default:
        await message.reply('❌ Action de configuration non reconnue. Utilisez list, set, reset ou status.');
    }
  } catch (error) {
    console.error('Erreur lors du traitement de la commande de configuration:', error);
    await message.reply('❌ Une erreur est survenue lors du traitement de la commande. Veuillez réessayer plus tard.');
  }
}
