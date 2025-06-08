import { commandLimiter } from '../utils/rateLimit.js';

export const metadata = {
  name: 'status',
  description: 'Affiche le statut du bot et des informations système',
  restricted: true,
  usage: '[détail]'
};

/**
 * Commande qui affiche l'état du bot et des informations système
 * @param {Object} client - Le client Discord
 * @param {Object} message - Le message Discord
 * @param {Array} args - Les arguments de la commande
 */
export async function status(client, message, args) {
  // Récupération des statistiques système
  const uptimeMs = client.uptime;
  const uptimeSeconds = Math.floor(uptimeMs / 1000);
  const uptimeMinutes = Math.floor(uptimeSeconds / 60);
  const uptimeHours = Math.floor(uptimeMinutes / 60);
  const uptimeDays = Math.floor(uptimeHours / 24);

  const formattedUptime = `${uptimeDays}j ${uptimeHours % 24}h ${uptimeMinutes % 60}m ${uptimeSeconds % 60}s`;

  // Statistiques de mémoire
  const memoryUsage = process.memoryUsage();
  const rssInMB = Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100;
  const heapTotalInMB = Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100;
  const heapUsedInMB = Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100;

  // Statistiques Discord
  const guildCount = client.guilds.cache.size;
  const channelCount = client.channels.cache.size;
  const userCount = client.users.cache.size;

  // Construction du message
  let statusMessage = `📊 **Statut du Bot**\n\n`;
  statusMessage += `⏱️ **Uptime:** ${formattedUptime}\n`;
  statusMessage += `🏠 **Serveurs:** ${guildCount}\n`;
  statusMessage += `📝 **Canaux:** ${channelCount}\n`;
  statusMessage += `👥 **Utilisateurs:** ${userCount}\n\n`;

  statusMessage += `💾 **Utilisation mémoire:**\n`;
  statusMessage += `▫️ RSS: ${rssInMB} MB\n`;
  statusMessage += `▫️ Heap Total: ${heapTotalInMB} MB\n`;
  statusMessage += `▫️ Heap Used: ${heapUsedInMB} MB\n\n`;

  statusMessage += `🔧 **Environnement:**\n`;
  statusMessage += `▫️ Node.js: ${process.version}\n`;
  statusMessage += `▫️ Plateforme: ${process.platform}\n`;
  statusMessage += `▫️ PID: ${process.pid}\n`;

  // Vérifier si l'utilisateur a demandé des détails
  if (args.length > 0 && args[0].toLowerCase() === 'detail') {
    // Ajouter des informations plus détaillées
    const detailedStats = await getDetailedStats(client);
    statusMessage += `\n📈 **Statistiques détaillées:**\n${detailedStats}`;
  }

  message.reply(statusMessage);
}

/**
 * Récupère des statistiques détaillées
 * @param {Object} client - Le client Discord
 * @returns {string} Les statistiques détaillées formatées
 */
async function getDetailedStats(client) {
  let detailedStats = '';

  // Répartition des types de canaux
  const textChannels = client.channels.cache.filter(c => c.type === 'GUILD_TEXT').size;
  const voiceChannels = client.channels.cache.filter(c => c.type === 'GUILD_VOICE').size;
  const dmChannels = client.channels.cache.filter(c => c.type === 'DM').size;
  const groupDMs = client.channels.cache.filter(c => c.type === 'GROUP_DM').size;

  detailedStats += `▫️ Canaux texte: ${textChannels}\n`;
  detailedStats += `▫️ Canaux vocaux: ${voiceChannels}\n`;
  detailedStats += `▫️ Messages privés: ${dmChannels}\n`;
  detailedStats += `▫️ Groupes: ${groupDMs}\n\n`;

  // Top 5 des serveurs les plus grands
  const topGuilds = [...client.guilds.cache.values()]
    .sort((a, b) => b.memberCount - a.memberCount)
    .slice(0, 5);

  if (topGuilds.length > 0) {
    detailedStats += `**Top 5 des serveurs:**\n`;
    topGuilds.forEach((guild, index) => {
      detailedStats += `${index + 1}. ${guild.name} - ${guild.memberCount} membres\n`;
    });
  }

  return detailedStats;
}
