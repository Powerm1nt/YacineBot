import { commandLimiter } from '../utils/rateLimit.js';

export const metadata = {
  name: 'ban',
  description: 'Bannir un utilisateur du serveur',
  restricted: true,
  usage: '<@utilisateur> [raison]'
};

export async function ban(client, message, args) {
  // Vérifier les permissions de l'utilisateur
  if (!message.member.permissions.has('BAN_MEMBERS')) {
    return message.reply('❌ Vous n\'avez pas la permission de bannir des membres.');
  }

  // Vérifier si un utilisateur est mentionné
  if (!message.mentions.users.size) {
    return message.reply('❌ Vous devez mentionner un utilisateur à bannir.');
  }

  const target = message.mentions.members.first();
  if (!target) {
    return message.reply('❌ Cet utilisateur n\'existe pas ou n\'est pas dans ce serveur.');
  }

  // Vérifier si l'utilisateur peut être banni
  if (!target.bannable) {
    return message.reply('❌ Je ne peux pas bannir cet utilisateur. Mes permissions sont-elles suffisantes ?');
  }

  // Extraire la raison (tous les arguments après la mention)
  const reason = args.slice(1).join(' ') || 'Aucune raison fournie';

  try {
    await target.ban({ reason });
    message.reply(`✅ **${target.user.tag}** a été banni du serveur. Raison: ${reason}`);
  } catch (error) {
    console.error('Erreur lors du bannissement:', error);
    message.reply('❌ Une erreur est survenue lors du bannissement.');
  }
}
