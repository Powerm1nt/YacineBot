import { stopScheduler, initScheduler, getSchedulerStatus, getNextChannel, getTaskByNumber, setDefaultChannelType, CHANNEL_TYPES, getTargetingStats, setTaskChannelType } from '../services/schedulerService.js';

import { formatDelay } from '../services/schedulerService.js';
import { sendLongMessage, checkAndRegenerateTasks } from '../utils/messageUtils.js';
import { isValueTrue } from '../commands/config.js';
export const metadata = {
  name: 'scheduler',
  description: 'Gère le planificateur de tâches automatiques',
  restricted: true,
  usage: '<start|stop|status|stats|restart|config>'
};

export async function scheduler(client, message, args) {
  if (!args.length) {
    message.reply('❌ Utilisation : scheduler <start|stop|status|stats|restart|config>');
    return;
  }

  const action = args[0].toLowerCase();

  switch (action) {
    case 'start':
      initScheduler(client);
      message.reply(`✅ Planificateur de tâches démarré ! Les messages aléatoires seront envoyés entre ${process.env.MIN_DELAY_MINUTES || '10'} et ${process.env.MAX_DELAY_MINUTES || '120'} minutes, pendant les heures actives (8h-23h).`);
      break;

    case 'restart':
      initScheduler(client);
      message.reply(`🔄 Planificateur redémarré avec de nouvelles tâches aléatoires.`);
      break;

          case 'stats':
      const statsStatus = getSchedulerStatus();

      if (!statsStatus.active) {
        message.reply('ℹ️ Aucune statistique disponible. Le planificateur est arrêté.');
        return;
      }

      if (statsStatus.tasks.length === 0) {
        const regenerated = checkAndRegenerateTasks(client);
        if (regenerated) {
          message.reply('⚠️ Aucune tâche active détectée. Le planificateur a été automatiquement redémarré avec de nouvelles tâches.');
          const refreshedStatus = getSchedulerStatus();
          statsStatus.tasks = refreshedStatus.tasks;
          statsStatus.taskCount = refreshedStatus.taskCount;
          statsStatus.nextTask = refreshedStatus.nextTask;
        } else {
          message.reply('⚠️ Aucune tâche active et impossible de régénérer. Essayez de redémarrer manuellement avec `f!scheduler restart`');
          return;
        }
      }

      let statsMessage = `📈 **Statistiques du planificateur**\n\n`;

      const delays = statsStatus.tasks.map(t => t.timeLeftMs);
      const minTaskDelay = Math.min(...delays);
      const maxTaskDelay = Math.max(...delays);
      const avgDelay = delays.reduce((sum, val) => sum + val, 0) / delays.length;

      statsMessage += `⏱️ **Délais actuels:**\n`;
      statsMessage += `▫️ Minimum: **${formatDelay(minTaskDelay)}**\n`;
      statsMessage += `▫️ Maximum: **${formatDelay(maxTaskDelay)}**\n`;
      statsMessage += `▫️ Moyenne: **${formatDelay(avgDelay)}**\n\n`;

      statsMessage += `⚙️ **Configuration:**\n`;
      statsMessage += `▫️ Plage de délai: **${statsStatus.config.minDelay}** à **${statsStatus.config.maxDelay}**\n`;
      statsMessage += `▫️ Tâches configurées: **${statsStatus.config.minTasks}** à **${statsStatus.config.maxTasks}**\n`;
      statsMessage += `▫️ Tâches actives: **${statsStatus.taskCount}**\n\n`;

      const targetingStats = getTargetingStats();

      statsMessage += `📊 **Distribution des canaux:**\n`;
      statsMessage += `▫️ Serveurs: **${targetingStats.channels.guild.count}** tâches\n`;
      statsMessage += `▫️ Messages privés: **${targetingStats.channels.dm.count}** tâches\n`;
      statsMessage += `▫️ Groupes: **${targetingStats.channels.group.count}** tâches\n`;
      statsMessage += `▫️ En attente d'attribution: **${targetingStats.channels.pending}** tâches\n\n`;

      if (targetingStats.guilds.count > 0) {
        const guildEntries = Object.entries(targetingStats.guilds.names);
        if (guildEntries.length > 0) {
          statsMessage += `🏠 **Serveurs ciblés:**\n`;
          guildEntries.sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([name, count]) => {
            statsMessage += `▫️ ${name}: **${count}** tâche(s)\n`;
          });
          statsMessage += `\n`;
        }
      }

      if (targetingStats.users.count > 0) {
        const userEntries = Object.entries(targetingStats.users.names);
        if (userEntries.length > 0) {
          statsMessage += `👤 **Utilisateurs ciblés:**\n`;
          userEntries.sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([name, count]) => {
            statsMessage += `▫️ ${name}: **${count}** mention(s)\n`;
          });
          statsMessage += `\n`;
        }
      }

      if (statsStatus.nextTask) {
        statsMessage += `⏰ **Prochaine exécution dans:** ${statsStatus.nextTask.timeLeft}\n`;
      }

      await sendLongMessage(message.channel, statsMessage, { reply: message.reply.bind(message) });
      break;

    case 'stop':
      stopScheduler();
      message.reply('✅ Planificateur de tâches arrêté. Plus aucun message automatique ne sera envoyé.');
      break;

    case 'status':
      const status = getSchedulerStatus();

      if (!status.nextChannel) {
        getNextChannel(client);
      }

      if (!status.active) {
        message.reply('ℹ️ Le planificateur est actuellement arrêté. Utilisez `f!scheduler start` pour le démarrer.');
        return;
      }

      if (status.tasks.length === 0) {
        const regenerated = checkAndRegenerateTasks(client);
        if (regenerated) {
          message.reply('⚠️ Aucune tâche active détectée. Le planificateur a été automatiquement redémarré avec de nouvelles tâches.');
          const refreshedStatus = getSchedulerStatus();
          status.tasks = refreshedStatus.tasks;
          status.taskCount = refreshedStatus.taskCount;
          status.nextTask = refreshedStatus.nextTask;
        }
      }

      let statusMessage = `📊 **État du planificateur**\n\n`;
      statusMessage += `⏰ Heure actuelle: **${status.currentTime}** (${status.timezone})\n`;
      statusMessage += `🔄 **${status.taskCount}** tâche(s) active(s)\n`;
      statusMessage += `🕒 Plage horaire active: **${status.config.activeHours}** (${status.inActiveHours ? '✅ actif' : '❌ inactif'})\n`;
      statusMessage += `⏱️ Délai configuré: **${status.config.minDelay}** - **${status.config.maxDelay}**\n`;
      statusMessage += `🔢 Tâches configurées: **${status.config.minTasks}** - **${status.config.maxTasks}**\n\n`;

      if (status.nextTask) {
        statusMessage += `⏰ **Prochaine exécution**: Tâche #${status.nextTask.number} dans **${status.nextTask.timeLeft}** (${status.nextTask.nextExecution})\n`;

        if (status.nextChannel) {
          let channelInfo = '';

          switch (status.nextChannel.type) {
            case 'guild':
              channelInfo = `🏠 **Prochain canal**: Serveur **${status.nextChannel.guildName}** (salon: ${status.nextChannel.name})`;
              break;
            case 'dm':
              channelInfo = `👤 **Prochain canal**: MP avec **${status.nextChannel.username}**`;
              break;
            case 'group':
              channelInfo = `👥 **Prochain canal**: Groupe **${status.nextChannel.name}** (${status.nextChannel.memberCount} membres)`;
              break;
          }

          statusMessage += `${channelInfo}\n`;
          statusMessage += `ℹ️ Cette prévisualisation peut changer si le canal devient indisponible\n\n`;
        } else {
          statusMessage += `\n`;
        }
      }

      if (status.tasks.length > 0) {
        statusMessage += `**Toutes les tâches planifiées:**\n`;
        status.tasks.forEach(task => {
          let targetInfo = "";

          if (task.targetChannel) {
            switch (task.targetChannel.type) {
              case 'guild':
                targetInfo = ` → 🏠 Serveur: **${task.targetChannel.guildName}** (salon: ${task.targetChannel.name})`;
                break;
              case 'dm':
                targetInfo = ` → 👤 MP: **${task.targetChannel.username}**`;
                break;
              case 'group':
                targetInfo = ` → 👥 Groupe: **${task.targetChannel.name}** (${task.targetChannel.memberCount} membres)`;
                break;
            }

            if (task.targetUser) {
              targetInfo += ` → @${task.targetUser.username}`;
            }
          }

          statusMessage += `• Tâche #${task.number} (${task.id}): **${task.nextExecution}** (dans ${task.timeLeft})${targetInfo}\n`;
        });
      }

      try {
        await sendLongMessage(message.channel, statusMessage, { reply: message.reply.bind(message) });
      } catch (error) {
        console.error('Erreur lors de l\'envoi des messages de statut:', error);
        message.channel.send('❌ Une erreur est survenue lors de l\'affichage du statut complet.');
      }
      break;

    case 'config':
      try {
        const { config } = await import('../commands/config.js');
        await config(client, message, args.slice(1));
      } catch (error) {
        console.error('Erreur lors de la redirection vers la configuration:', error);
        message.channel.send('❌ Une erreur est survenue lors de la configuration.');
      }
      break;

    default:
      message.reply('❌ Action non reconnue. Utilisez start, stop, restart, status, stats ou config.');
  }
}
