import { commandLimiter } from '../utils/rateLimit.js';

export const metadata = {
  name: 'kick',
  description: 'Expulser un utilisateur du serveur',
  restricted: true,
  usage: '<@utilisateur> [raison]'
};

export async function kick(client, message, args) {
  // Vérifier les permissions de l'utilisateur
  if (!message.member.permissions.has('KICK_MEMBERS')) {
    return message.reply('❌ Vous n\'avez pas la permission d\'expulser des membres.');
  }

  // Vérifier si un utilisateur est mentionné
  if (!message.mentions.users.size) {
    return message.reply('❌ Vous devez mentionner un utilisateur à expulser.');
  }

  const target = message.mentions.members.first();
  if (!target) {
    return message.reply('❌ Cet utilisateur n\'existe pas ou n\'est pas dans ce serveur.');
  }

  // Vérifier si l'utilisateur peut être expulsé
  if (!target.kickable) {
    return message.reply('❌ Je ne peux pas expulser cet utilisateur. Mes permissions sont-elles suffisantes ?');
  }

  // Extraire la raison (tous les arguments après la mention)
  const reason = args.slice(1).join(' ') || 'Aucune raison fournie';

  try {
    await target.kick(reason);
    message.reply(`✅ **${target.user.tag}** a été expulsé du serveur. Raison: ${reason}`);
  } catch (error) {
    console.error('Erreur lors de l\'expulsion:', error);
    message.reply('❌ Une erreur est survenue lors de l\'expulsion.');
  }
}
