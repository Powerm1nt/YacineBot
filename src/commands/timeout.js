import { commandLimiter } from '../utils/rateLimit.js';

export const metadata = {
  name: 'timeout',
  description: 'Mettre un utilisateur en sourdine temporaire',
  restricted: true,
  usage: '<@utilisateur> <durée en minutes> [raison]'
};

export async function timeout(client, message, args) {
  // Vérifier les permissions de l'utilisateur
  if (!message.member.permissions.has('MODERATE_MEMBERS')) {
    return message.reply('❌ Vous n\'avez pas la permission de mettre des membres en sourdine.');
  }

  // Vérifier si un utilisateur est mentionné
  if (!message.mentions.users.size) {
    return message.reply('❌ Vous devez mentionner un utilisateur à mettre en sourdine.');
  }

  const target = message.mentions.members.first();
  if (!target) {
    return message.reply('❌ Cet utilisateur n\'existe pas ou n\'est pas dans ce serveur.');
  }

  // Vérifier si la durée est spécifiée
  if (!args[1] || isNaN(args[1])) {
    return message.reply('❌ Vous devez spécifier une durée valide en minutes.');
  }

  const durationMinutes = parseInt(args[1]);
  if (durationMinutes <= 0 || durationMinutes > 10080) { // Max 7 jours (10080 minutes)
    return message.reply('❌ La durée doit être comprise entre 1 minute et 7 jours (10080 minutes).');
  }

  // Calculer la durée en millisecondes
  const durationMs = durationMinutes * 60 * 1000;

  // Extraire la raison (tous les arguments après la durée)
  const reason = args.slice(2).join(' ') || 'Aucune raison fournie';

  try {
    await target.timeout(durationMs, reason);
    message.reply(`✅ **${target.user.tag}** a été mis en sourdine pendant ${durationMinutes} minute(s). Raison: ${reason}`);
  } catch (error) {
    console.error('Erreur lors de la mise en sourdine:', error);
    message.reply('❌ Une erreur est survenue lors de la mise en sourdine.');
  }
}
