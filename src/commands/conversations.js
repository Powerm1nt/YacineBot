import { analysisService } from '../services/analysisService.js'
import { conversationService } from '../services/conversationService.js'
import { getContextKey } from '../utils/commandUtils.js'

export const metadata = {
  name: 'conversations',
  description: 'Gérer vos conversations et partages',
  restricted: false,
  usage: 'conversations'
};

// Définition des émojis pour les actions
const EMOJIS = {
  SHARE: '🔄',
  LIST: '📋',
  BACK: '⬅️',
  CONFIRM: '✅',
  CANCEL: '❌'
};

/**
 * Gère les commandes liées aux conversations (partage, accès, etc.)
 */
// Fonctions utilitaires pour les réactions
async function safeDeleteMessage(message) {
  try {
    await message.delete();
  } catch (error) {}
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

export async function conversations(client, message, args) {
  try {
    await showMainMenu(client, message);
  } catch (error) {
    console.error('Erreur lors du traitement de la commande conversations:', error);
    await message.reply('❌ Une erreur est survenue lors du traitement de la commande. Veuillez réessayer plus tard.');
  }
}

/**
 * Gère le partage d'une conversation avec un autre utilisateur
 */
async function handleShareConversation(client, message) {
  const shareMessage = await message.reply('Pour partager cette conversation, mentionnez un utilisateur dans votre réponse.');

  const filter = m => m.author.id === message.author.id && m.mentions.users.size > 0;
  const collected = await message.channel.awaitMessages({ filter, max: 1, time: 60000 });

  // Supprimer le message d'instruction
  await safeDeleteMessage(shareMessage);

  if (collected.size === 0) {
    return message.reply('⏱️ Action annulée - temps écoulé.');
  }

  const responseMsg = collected.first();
  const mentionedUser = responseMsg.mentions.users.first();

  if (!mentionedUser) {
    await safeDeleteMessage(responseMsg);
    return message.reply('❌ Aucun utilisateur mentionné. Action annulée.');
  }

  try {
    // Obtenir le contexte de la conversation actuelle
    const context = getContextKey(message);
    const result = await analysisService.shareConversation(
      context.key,
      context.type === 'guild' ? message.guild.id : null,
      mentionedUser.id
    );

    // Supprimer le message de mention
    await safeDeleteMessage(responseMsg);

    if (result) {
      const confirmMessage = await message.reply(`✅ Conversation partagée avec ${mentionedUser.username} ! Ils peuvent la consulter avec la commande conversations.`);
      setTimeout(() => safeDeleteMessage(confirmMessage), 5000);
      return showMainMenu(client, message);
    } else {
      const errorMsg = await message.reply('❌ Impossible de partager cette conversation. Essayez à nouveau plus tard.');
      setTimeout(() => safeDeleteMessage(errorMsg), 5000);
      return showMainMenu(client, message);
    }
  } catch (error) {
    console.error('Erreur lors du partage de la conversation:', error);
    const errorMsg = await message.reply('❌ Une erreur est survenue lors du partage de la conversation.');
    setTimeout(() => safeDeleteMessage(errorMsg), 5000);
    return showMainMenu(client, message);
  }
}

/**
 * Affiche le menu principal pour la gestion des conversations
 */
async function showMainMenu(client, message) {
  const menuMessage = await message.reply(
    '**📝 Gestion des Conversations**\n\n' +
    `${EMOJIS.SHARE} - Partager la conversation actuelle\n` +
    `${EMOJIS.LIST} - Voir les conversations partagées\n\n` +
    'Cliquez sur une réaction pour continuer...'
  );

  await addReactions(menuMessage, [EMOJIS.SHARE, EMOJIS.LIST]);

  const filter = (reaction, user) => {
    return [EMOJIS.SHARE, EMOJIS.LIST].includes(reaction.emoji.name)
      && user.id === message.author.id;
  };

  const collected = await createReactionCollector(menuMessage, filter);

  if (collected.size === 0) {
    return menuMessage.edit('⏱️ Commande annulée - temps écoulé.');
  }

  const reaction = collected.first();

  await safeDeleteMessage(menuMessage);

  switch (reaction.emoji.name) {
    case EMOJIS.SHARE:
      return handleShareConversation(client, message);
    case EMOJIS.LIST:
      return handleListSharedConversations(client, message);
  }
}

/**
 * Affiche les conversations partagées avec l'utilisateur
 */
async function handleListSharedConversations(client, message) {
  try {
    const userId = message.author.id;
    const sharedConversations = await analysisService.getSharedConversations(userId);

    if (!sharedConversations || sharedConversations.length === 0) {
      const noConvsMsg = await message.reply('Aucune conversation n\'a été partagée avec vous.');
      setTimeout(() => safeDeleteMessage(noConvsMsg), 5000);
      return showMainMenu(client, message);
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

    response += `Cliquez sur ${EMOJIS.BACK} pour revenir au menu principal.`;

    const listMessage = await message.reply(response);
    await listMessage.react(EMOJIS.BACK);

    const filter = (reaction, user) => {
      return reaction.emoji.name === EMOJIS.BACK && user.id === message.author.id;
    };

    await createReactionCollector(listMessage, filter);
    await safeDeleteMessage(listMessage);

    return showMainMenu(client, message);
  } catch (error) {
    console.error('Erreur lors de la récupération des conversations partagées:', error);
    const errorMsg = await message.reply('❌ Une erreur est survenue lors de la récupération des conversations partagées.');
    setTimeout(() => safeDeleteMessage(errorMsg), 5000);
    return showMainMenu(client, message);
  }
}
