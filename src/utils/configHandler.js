import { loadConfig, saveConfig, getSchedulerConfig, setChannelTypeEnabled, isChannelTypeEnabled } from './configManager.js';

/**
 * Gère les commandes de configuration
 * @param {Object} client - Le client Discord
 * @param {Object} message - Le message Discord
 * @param {Array} args - Les arguments de la commande
 */
async function handleConfigCommand(client, message, args) {
  if (!args.length) {
    return message.reply('❌ Veuillez spécifier une action de configuration. Exemple: `config list` ou `config set [clé] [valeur]`');
  }

  const action = args[0].toLowerCase();

  switch (action) {
    case 'list':
      // Afficher la configuration actuelle
      const config = loadConfig();
      let configMessage = '📝 **Configuration actuelle:**\n\n';

      // Afficher la configuration du scheduler
      if (config.scheduler) {
        configMessage += '⏰ **Scheduler:**\n';
        configMessage += `▫️ Serveurs: ${config.scheduler.channelTypes?.guild ? '✅ activés' : '❌ désactivés'}\n`;
        configMessage += `▫️ Messages privés: ${config.scheduler.channelTypes?.dm ? '✅ activés' : '❌ désactivés'}\n`;
        configMessage += `▫️ Groupes: ${config.scheduler.channelTypes?.group ? '✅ activés' : '❌ désactivés'}\n\n`;
      }

      // Afficher d'autres configurations
      configMessage += '💾 Pour voir toutes les configurations détaillées, utilisez `config list full`';

      message.reply(configMessage);
      break;

    case 'set':
      if (args.length < 3) {
        return message.reply('❌ Format incorrect. Utilisez: `config set [clé] [valeur]`');
      }
      const key = args[1].toLowerCase();
      const value = args.slice(2).join(' ').toLowerCase();

      // Traitement des différentes clés de configuration
      switch (key) {
        case 'scheduler.guild':
        case 'scheduler.serveurs':
          const guildEnabled = value === 'true' || value === 'on' || value === 'oui' || value === '1';
          setChannelTypeEnabled('guild', guildEnabled);
          message.reply(`✅ Les serveurs sont maintenant ${guildEnabled ? 'activés' : 'désactivés'} pour le scheduler.`);
          break;

        case 'scheduler.dm':
        case 'scheduler.mp':
          const dmEnabled = value === 'true' || value === 'on' || value === 'oui' || value === '1';
          setChannelTypeEnabled('dm', dmEnabled);
          message.reply(`✅ Les messages privés sont maintenant ${dmEnabled ? 'activés' : 'désactivés'} pour le scheduler.`);
          break;

        case 'scheduler.group':
        case 'scheduler.groupes':
          const groupEnabled = value === 'true' || value === 'on' || value === 'oui' || value === '1';
          setChannelTypeEnabled('group', groupEnabled);
          message.reply(`✅ Les groupes sont maintenant ${groupEnabled ? 'activés' : 'désactivés'} pour le scheduler.`);
          break;

        default:
          // Enregistrement générique dans la configuration
          const config = loadConfig();

          // Sauvegarde structurée par points (ex: scheduler.delay.min)
          const keyParts = key.split('.');
          let current = config;

          for (let i = 0; i < keyParts.length - 1; i++) {
            if (!current[keyParts[i]]) current[keyParts[i]] = {};
            current = current[keyParts[i]];
          }

          // Convertir value en nombre si c'est un nombre
          const numValue = Number(value);
          current[keyParts[keyParts.length - 1]] = !isNaN(numValue) ? numValue : value;

          saveConfig(config);
          message.reply(`✅ Configuration mise à jour: ${key} = ${value}`);
      }
      break;

    case 'reset':
      if (!args[1]) {
        return message.reply('❌ Veuillez spécifier la clé de configuration à réinitialiser.');
      }

      const resetKey = args[1].toLowerCase();

      if (resetKey === 'all') {
        // Réinitialiser toute la configuration
        const defaultConfig = {
          scheduler: {
            channelTypes: {
              guild: true,
              dm: true,
              group: true
            }
          }
        };
        saveConfig(defaultConfig);
        message.reply('✅ Toutes les configurations ont été réinitialisées aux valeurs par défaut.');
      } else {
        message.reply('❌ Clé de réinitialisation non reconnue. Utilisez `reset all` pour tout réinitialiser.');
      }
      break;

    default:
      message.reply('❌ Action de configuration non reconnue. Utilisez list, set ou reset.');
  }
}

export { handleConfigCommand };
