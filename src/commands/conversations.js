import { analysisService } from '../services/analysisService.js'
import { conversationService } from '../services/conversationService.js'
import { getContextKey } from '../utils/commandUtils.js'

export const metadata = {
  name: 'conversations',
  description: 'Gérer vos conversations et partages',
  restricted: false,
  usage: '<action> [utilisateur]'
};

/**
 * Gère les commandes liées aux conversations (partage, accès, etc.)
 */
export async function conversations(client) {
  return async function(message, args) {
    if (!args || args.length === 0) {
      return message.reply('Usage: /conversations <share|list> [utilisateur]');
    }

    const action = args[0].toLowerCase();

    switch (action) {
      case 'share':
        await handleShareConversation(message, args.slice(1), client);
        break;
      case 'list':
        await handleListSharedConversations(message);
        break;
      default:
        await message.reply('Action non reconnue. Utilisez share ou list.');
    }
  }
}

/**
 * Gère le partage d'une conversation avec un autre utilisateur
 */
async function handleShareConversation(message, args, client) {
  if (!args || args.length === 0) {
    return message.reply('Vous devez mentionner un utilisateur avec qui partager la conversation.');
  }

  // Extraire l'ID utilisateur de la mention
  let userId = null;
  const mentionMatch = args[0].match(/<@!?(\d+)>/);
  if (mentionMatch) {
    userId = mentionMatch[1];
  }

  if (!userId) {
    return message.reply('Veuillez mentionner un utilisateur valide avec @nom.');
  }

  try {
    // Vérifier que l'utilisateur existe
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) {
      return message.reply('Utilisateur non trouvé.');
    }

    // Obtenir le contexte de la conversation actuelle
    const context = getContextKey(message);
    const result = await analysisService.shareConversation(
      context.key,
      context.type === 'guild' ? message.guild.id : null,
      userId
    );

    if (result) {
      return message.reply(`Conversation partagée avec ${user.username} ! Ils peuvent la consulter avec /conversations list`);
    } else {
      return message.reply('Impossible de partager cette conversation. Essayez à nouveau plus tard.');
    }
  } catch (error) {
    console.error('Erreur lors du partage de la conversation:', error);
    return message.reply('Une erreur est survenue lors du partage de la conversation.');
  }
}

/**
 * Affiche les conversations partagées avec l'utilisateur
 */
async function handleListSharedConversations(message) {
  try {
    const userId = message.author.id;
    const sharedConversations = await analysisService.getSharedConversations(userId);

    if (!sharedConversations || sharedConversations.length === 0) {
      return message.reply('Aucune conversation n\'a été partagée avec vous.');
    }

    // Créer un aperçu des conversations partagées
    let response = '**Conversations partagées avec vous:**\n\n';

    for (const conv of sharedConversations) {
      // Ajouter les informations de la conversation
      response += `**${conv.topicSummary || 'Conversation sans titre'}**\n`;
      response += `*Canal: ${conv.channelId}*\n`;
      response += `*Score de pertinence: ${(conv.relevanceScore * 100).toFixed(0)}%*\n\n`;

      // Ajouter quelques messages clés si disponibles (limité à 3 pour éviter des réponses trop longues)
      if (conv.messages && conv.messages.length > 0) {
        response += '**Aperçu des messages clés:**\n';
        const previewMessages = conv.messages.slice(0, 3);

        for (const msg of previewMessages) {
          response += `**${msg.userName}**: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}\n`;
        }

        if (conv.messages.length > 3) {
          response += `*Et ${conv.messages.length - 3} autres messages...*\n`;
        }
      }

      response += '\n---\n\n';
    }

    return message.reply(response);
  } catch (error) {
    console.error('Erreur lors de la récupération des conversations partagées:', error);
    return message.reply('Une erreur est survenue lors de la récupération des conversations partagées.');
  }
}
