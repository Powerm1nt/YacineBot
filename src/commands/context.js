import { getContextKey } from '../utils/commandUtils.js'
import { 
  getContextData, 
  getLastResponseId,
  getContextStats,
  cleanupOldContexts,
  resetContext,
  getAllContexts
} from '../utils/contextManager.js'
import { conversationService } from '../services/conversationService.js'
import { sendLongMessage } from '../utils/messageUtils.js'
import { format } from 'date-fns'

const EMOJIS = {
  CLEAN: '🧹',
  REFRESH: '🔄',
  DETAILS: '🔍',
  RESET: '⚠️',
  BACK: '⬅️',
  CONFIRM: '✅',
  CANCEL: '❌',
  GUILD: '🏠',
  DM: '💬',
  GROUP: '👥'
};

export const metadata = {
  name: 'context',
  description: 'Affiche les informations sur le contexte actuel et les statistiques',
  restricted: true,
  usage: 'context [action]'
};

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

  async function safeDeleteMessage(message) {
  try {
    await message.delete();
  } catch (error) {}
  }

export async function context(client, message, args) {
  const action = args[0]?.toLowerCase();

  switch (action) {
    case 'stats':
      await showContextStats(client, message);
      break;
    case 'list':
      await listAllContexts(client, message);
      break;
    case 'db':
      await readConversationsFromDB(client, message, args[1]);
      break;
    case 'memory':
      await readConversationsFromMemory(client, message, args[1]);
      break;
    default:
      await showCurrentContext(client, message);
      break;
  }
}

async function showCurrentContext(client, message) {
  try {
    const contextKey = getContextKey(message);
    const contextData = await getContextData(message);
    const lastResponseId = await getLastResponseId(message);

    const participants = contextData.participants || [];
    const participantsInfo = participants.map(p => 
      `- ${p.name} (ID: ${p.id}): ${p.messageCount || 0} messages`
    ).join('\n');

    const totalMessages = participants.reduce((sum, p) => sum + (p.messageCount || 0), 0);

    let response = '## 📊 Informations sur le contexte actuel\n\n';
    response += `**Type de contexte:** \`${contextKey.type}\`\n`;
    response += `**Clé de contexte:** \`${contextKey.key}\`\n`;
    response += `**Dernier ID de réponse:** ${lastResponseId ? `\`${lastResponseId}\`` : 'Aucun'}\n`;
    response += `**Dernier auteur:** ${contextData.lastAuthorName ? `${contextData.lastAuthorName} (ID: ${contextData.lastAuthorId})` : 'Aucun'}\n`;
    response += `**Nombre de participants:** ${participants.length}\n`;
    response += `**Total de messages:** ${totalMessages}\n\n`;

    if (participants.length > 0) {
      response += '**Participants:**\n' + participantsInfo;
    } else {
      response += 'Aucun participant dans ce contexte.';
    }

    return message.reply(response);
  } catch (error) {
    console.error('Erreur lors de l\'affichage du contexte:', error);
    return message.reply('Une erreur est survenue lors de la récupération des informations de contexte.');
  }
}

async function showContextStats(client, message) {
  try {
    const stats = getContextStats();
    const memoryUsage = stats.memoryUsage;
    const configInfo = stats.config;

    let response = '## 📈 Statistiques globales des contextes\n\n';
    response += 'Statistiques sur l\'utilisation de la mémoire et des contextes de conversation.\n\n';

    response += '**Nombre total de contextes:** ' + (stats.contextCounts.total || 0) + '\n';
    response += '**Contextes DM:** ' + (stats.contextCounts.dm || 0) + '\n';
    response += '**Contextes de serveur:** ' + (stats.contextCounts.guild || 0) + '\n';
    response += '**Contextes de groupe:** ' + (stats.contextCounts.group || 0) + '\n';
    response += '**Total de contextes créés:** ' + (stats.totalContextsCreated || 0) + '\n';
    response += '**Total nettoyés:** ' + (stats.totalContextsCleanedUp || 0) + '\n';
    response += '**Dernier nettoyage:** ' + (stats.lastCleanupTime ? 
      format(new Date(stats.lastCleanupTime), 'dd/MM/yyyy HH:mm:ss') : 
      'Jamais') + '\n\n';

    response += '### 💾 Utilisation de la mémoire\n';
    response += `RSS: ${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB\n`;
    response += `Heap: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB / ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB\n\n`;

    response += '### ⚙️ Configuration\n';
    response += `Inactivité: ${configInfo.inactivityThreshold}h\n`;
    response += `Nettoyage: toutes les ${configInfo.cleanupInterval}h\n`;
    response += `Max serveurs: ${configInfo.maxContexts.guild}\n`;
    response += `Max DMs: ${configInfo.maxContexts.dm}\n`;
    response += `Max groupes: ${configInfo.maxContexts.group}`;

    await sendLongMessage(message.channel, response, { reply: message.reply.bind(message) });
  } catch (error) {
    console.error('Erreur lors de l\'affichage des statistiques:', error);
    return message.reply('Une erreur est survenue lors de la récupération des statistiques.');
  }
}

async function listAllContexts(client, message) {
  try {
    // Utiliser la fonction getAllContexts pour obtenir tous les contextes en mémoire
    const allContexts = getAllContexts();
    const stats = getContextStats();

    let response = '## 📋 Liste des contextes en mémoire\n\n';
    response += 'Vue d\'ensemble de tous les contextes actuellement en mémoire\n\n';

    response += `**Contextes de serveur:** ${stats.contextCounts.guild || 0} contextes\n`;
    response += `**Contextes DM:** ${stats.contextCounts.dm || 0} contextes\n`;
    response += `**Contextes de groupe:** ${stats.contextCounts.group || 0} contextes\n\n`;

    // Regrouper les contextes par type
    const byType = {
      guild: allContexts.filter(c => c.type === 'guild'),
      dm: allContexts.filter(c => c.type === 'dm'),
      group: allContexts.filter(c => c.type === 'group')
    };

    // Afficher les contextes de serveur récents (max 5)
    if (byType.guild.length > 0) {
      response += '### 🏠 Contextes de serveur récents\n';
      const recentGuildContexts = byType.guild
        .sort((a, b) => new Date(b.data.lastMessageTimestamp || 0) - new Date(a.data.lastMessageTimestamp || 0))
        .slice(0, 5);

      recentGuildContexts.forEach(ctx => {
        const participantsCount = ctx.data.participants?.length || 0;
        const lastActive = ctx.data.lastMessageTimestamp ? 
          format(new Date(ctx.data.lastMessageTimestamp), 'dd/MM/yyyy HH:mm:ss') : 'Inconnu';

        response += `• **Canal:** ${ctx.key} - **Participants:** ${participantsCount} - **Dernier message:** ${lastActive}\n`;
      });
      response += '\n';
    }

    // Afficher les contextes DM récents (max 5)
    if (byType.dm.length > 0) {
      response += '### 💬 Contextes de messages privés récents\n';
      const recentDmContexts = byType.dm
        .sort((a, b) => new Date(b.data.lastMessageTimestamp || 0) - new Date(a.data.lastMessageTimestamp || 0))
        .slice(0, 5);

      recentDmContexts.forEach(ctx => {
        const lastAuthor = ctx.data.lastAuthorName || 'Inconnu';
        const lastActive = ctx.data.lastMessageTimestamp ? 
          format(new Date(ctx.data.lastMessageTimestamp), 'dd/MM/yyyy HH:mm:ss') : 'Inconnu';

        response += `• **Utilisateur:** ${lastAuthor} - **Canal:** ${ctx.key} - **Dernier message:** ${lastActive}\n`;
      });
      response += '\n';
    }

    response += `*Total: ${stats.contextCounts.total || 0} contextes en mémoire*\n\n`;
    response += `Actions disponibles:\n\n`;
    response += `${EMOJIS.CLEAN} - Nettoyer les contextes inactifs\n`;
    response += `${EMOJIS.REFRESH} - Rafraîchir la liste\n`;
    response += `${EMOJIS.DETAILS} - Voir plus de détails\n`;

    const sentMessage = await message.reply(response);

    // Ajouter les réactions pour les actions
    await addReactions(sentMessage, [EMOJIS.CLEAN, EMOJIS.REFRESH, EMOJIS.DETAILS]);

    // Configurer un collecteur pour les réactions
    const filter = (reaction, user) => {
      return [EMOJIS.CLEAN, EMOJIS.REFRESH, EMOJIS.DETAILS].includes(reaction.emoji.name) &&
             user.id === message.author.id;
    };

    const collected = await createReactionCollector(sentMessage, filter);

    if (collected.size > 0) {
      const reaction = collected.first();
      await safeDeleteMessage(sentMessage);

      switch(reaction.emoji.name) {
        case EMOJIS.CLEAN:
          const cleanedCount = await cleanupOldContexts();
          const cleanMessage = await message.reply(`✅ ${cleanedCount} contextes inactifs ont été nettoyés.`);
          setTimeout(() => safeDeleteMessage(cleanMessage), 3000);
          return listAllContexts(client, message); // Rafraîchir la liste après nettoyage

        case EMOJIS.REFRESH:
          return listAllContexts(client, message); // Rafraîchir simplement la liste

        case EMOJIS.DETAILS:
          return showDetailedContextList(client, message, allContexts);
      }
    } else {
      await safeDeleteMessage(sentMessage);
      return message.reply('⏱️ Action annulée - temps écoulé.');
    }

  } catch (error) {
    console.error('Erreur lors de l\'affichage de la liste des contextes:', error);
    return message.reply('Une erreur est survenue lors de la récupération de la liste des contextes.');
  }
}

async function showDetailedContextList(client, message, allContexts) {
  try {
    // Créer une liste plus détaillée des contextes
    let response = '## 🔍 Détails des contextes en mémoire\n\n';

    // Grouper par type
    const byType = {
      guild: allContexts.filter(c => c.type === 'guild'),
      dm: allContexts.filter(c => c.type === 'dm'),
      group: allContexts.filter(c => c.type === 'group')
    };

    // Afficher les détails pour les contextes de serveur
    if (byType.guild.length > 0) {
      response += `### ${EMOJIS.GUILD} Contextes de serveur (${byType.guild.length})\n`;
      byType.guild
        .sort((a, b) => new Date(b.data.lastMessageTimestamp || 0) - new Date(a.data.lastMessageTimestamp || 0))
        .forEach(ctx => {
          const participantsCount = ctx.data.participants?.length || 0;
          const messageCount = ctx.data.participants?.reduce((sum, p) => sum + (p.messageCount || 0), 0) || 0;
          const lastActive = ctx.data.lastMessageTimestamp ? 
            format(new Date(ctx.data.lastMessageTimestamp), 'dd/MM/yyyy HH:mm:ss') : 'Inconnu';

          response += `• **Canal:** ${ctx.key}\n`;
          response += `  - **Participants:** ${participantsCount} (${messageCount} messages)\n`;
          response += `  - **Dernier message:** ${lastActive}\n`;
          response += `  - **Dernier auteur:** ${ctx.data.lastAuthorName || 'Inconnu'}\n\n`;
        });
    }

    // Afficher les détails pour les contextes DM
    if (byType.dm.length > 0) {
      response += `### ${EMOJIS.DM} Contextes de messages privés (${byType.dm.length})\n`;
      byType.dm
        .sort((a, b) => new Date(b.data.lastMessageTimestamp || 0) - new Date(a.data.lastMessageTimestamp || 0))
        .forEach(ctx => {
          const messageCount = ctx.data.participants?.reduce((sum, p) => sum + (p.messageCount || 0), 0) || 0;
          const lastActive = ctx.data.lastMessageTimestamp ? 
            format(new Date(ctx.data.lastMessageTimestamp), 'dd/MM/yyyy HH:mm:ss') : 'Inconnu';

          response += `• **Canal:** ${ctx.key}\n`;
          response += `  - **Utilisateur:** ${ctx.data.lastAuthorName || 'Inconnu'}\n`;
          response += `  - **Messages:** ${messageCount}\n`;
          response += `  - **Dernier message:** ${lastActive}\n\n`;
        });
    }

    // Afficher les détails pour les contextes de groupe
    if (byType.group.length > 0) {
      response += `### ${EMOJIS.GROUP} Contextes de groupe (${byType.group.length})\n`;
      byType.group
        .sort((a, b) => new Date(b.data.lastMessageTimestamp || 0) - new Date(a.data.lastMessageTimestamp || 0))
        .forEach(ctx => {
          const participantsCount = ctx.data.participants?.length || 0;
          const messageCount = ctx.data.participants?.reduce((sum, p) => sum + (p.messageCount || 0), 0) || 0;
          const lastActive = ctx.data.lastMessageTimestamp ? 
            format(new Date(ctx.data.lastMessageTimestamp), 'dd/MM/yyyy HH:mm:ss') : 'Inconnu';

          response += `• **Groupe:** ${ctx.key}\n`;
          response += `  - **Participants:** ${participantsCount} (${messageCount} messages)\n`;
          response += `  - **Dernier message:** ${lastActive}\n`;
          response += `  - **Dernier auteur:** ${ctx.data.lastAuthorName || 'Inconnu'}\n\n`;
        });
    }

    response += `\n${EMOJIS.BACK} - Retourner à la liste principale\n${EMOJIS.CLEAN} - Nettoyer les contextes inactifs`;

    const detailsMessage = await message.reply(response);

    // Ajouter les réactions pour les actions
    await addReactions(detailsMessage, [EMOJIS.BACK, EMOJIS.CLEAN]);

    // Configurer un collecteur pour les réactions
    const filter = (reaction, user) => {
      return [EMOJIS.BACK, EMOJIS.CLEAN].includes(reaction.emoji.name) &&
             user.id === message.author.id;
    };

    const collected = await createReactionCollector(detailsMessage, filter);

    await safeDeleteMessage(detailsMessage);

    if (collected.size > 0) {
      const reaction = collected.first();

      switch(reaction.emoji.name) {
        case EMOJIS.CLEAN:
          const cleanedCount = await cleanupOldContexts();
          const cleanMessage = await message.reply(`✅ ${cleanedCount} contextes inactifs ont été nettoyés.`);
          setTimeout(() => safeDeleteMessage(cleanMessage), 3000);
          return listAllContexts(client, message);

        case EMOJIS.BACK:
          return listAllContexts(client, message);
      }
    } else {
      return message.reply('⏱️ Action annulée - temps écoulé.');
    }
  } catch (error) {
    console.error('Erreur lors de l\'affichage des détails des contextes:', error);
    return message.reply('Une erreur est survenue lors de la récupération des détails des contextes.');
  }
}

async function readConversationsFromDB(client, message, channelId) {
  try {
    if (!channelId) {
      // Si aucun ID de canal n'est spécifié, utiliser le canal actuel
      channelId = message.channel.id;
    }

    // Obtenir l'ID de la guilde si le message provient d'un serveur
    const guildId = message.guild?.id || null;

    // Utiliser conversationService pour récupérer l'historique avec l'ID de guilde approprié
    const conversations = await conversationService.getConversationHistory(channelId, guildId);

    if (!conversations || conversations.length === 0) {
      return message.reply(`Aucune conversation trouvée dans la base de données pour le canal ${channelId}.`);
    }

    // Regrouper les messages par date
    const messagesByDate = {};
    conversations.forEach(msg => {
      try {
        // Vérifier si la date est valide avant de la formater
        const dateObj = new Date(msg.createdAt || msg.timestamp);
        if (isNaN(dateObj.getTime())) {
          console.warn(`Date invalide détectée: ${msg.createdAt || msg.timestamp}`);
          return; // Ignorer ce message
        }
        const date = format(dateObj, 'yyyy-MM-dd');
        if (!messagesByDate[date]) messagesByDate[date] = [];
        messagesByDate[date].push(msg);
      } catch (dateError) {
        console.error('Erreur lors du formatage de la date:', dateError);
      }
    });

    // Créer un résumé textuel
    let summary = `## 💬 Conversations de la base de données (Canal: ${channelId})\n\n`;
    summary += 'Résumé des conversations stockées dans la base de données.\n\n';

    summary += `**Nombre total de messages:** ${conversations.length}\n`;

    if (conversations.length > 0) {
      const firstMsgDate = new Date(conversations[0].createdAt || conversations[0].timestamp);
      const lastMsgDate = new Date(conversations[conversations.length - 1].createdAt || conversations[conversations.length - 1].timestamp);

      if (!isNaN(firstMsgDate.getTime())) {
        summary += `**Premier message:** ${format(firstMsgDate, 'yyyy-MM-dd HH:mm:ss')}\n`;
      }

      if (!isNaN(lastMsgDate.getTime())) {
        summary += `**Dernier message:** ${format(lastMsgDate, 'yyyy-MM-dd HH:mm:ss')}\n\n`;
      }
    }

    // Ajouter un résumé par date
    if (Object.keys(messagesByDate).length > 0) {
      summary += '### 📅 Messages par date\n';
      Object.entries(messagesByDate).forEach(([date, msgs]) => {
        summary += `• **${date}**: ${msgs.length} messages\n`;
      });
    }

    // Envoyer le résumé
    await sendLongMessage(message.channel, summary, { reply: message.reply.bind(message) });

    // Demander si l'utilisateur souhaite voir les messages détaillés
    const confirmation = await message.reply(`Voulez-vous voir les 20 derniers messages détaillés ?\n\n${EMOJIS.CONFIRM} - Oui\n${EMOJIS.CANCEL} - Non`);

    await addReactions(confirmation, [EMOJIS.CONFIRM, EMOJIS.CANCEL]);

    const filter = (reaction, user) => {
      return [EMOJIS.CONFIRM, EMOJIS.CANCEL].includes(reaction.emoji.name) &&
             user.id === message.author.id;
    };

    const collected = await createReactionCollector(confirmation, filter, 30000);

    await safeDeleteMessage(confirmation);

    if (collected.size > 0 && collected.first().emoji.name === EMOJIS.CONFIRM) {
      // Afficher les 20 derniers messages
      const lastMessages = conversations.slice(-20);

      let messagesText = `## 🔍 20 derniers messages (Canal: ${channelId})\n\n`;

      lastMessages.forEach(msg => {
        try {
          const msgDate = new Date(msg.createdAt || msg.timestamp);
          let dateStr = 'Date inconnue';

          if (!isNaN(msgDate.getTime())) {
            dateStr = format(msgDate, 'yyyy-MM-dd HH:mm:ss');
          }

          messagesText += `**${msg.userName}** (${dateStr}):\n${msg.content ? msg.content.substring(0, 100) : ''}${msg.content && msg.content.length > 100 ? '...' : ''}\n\n`;
        } catch (dateError) {
          console.error('Erreur lors du formatage de la date pour l\'affichage:', dateError);
          messagesText += `**${msg.userName}** (Date invalide):\n${msg.content ? msg.content.substring(0, 100) : ''}${msg.content && msg.content.length > 100 ? '...' : ''}\n\n`;
        }
      });

      messagesText += '*Affichage des 20 derniers messages*';

      await sendLongMessage(message.channel, messagesText);
    }

  } catch (error) {
    console.error('Erreur lors de la lecture des conversations depuis la DB:', error);
    return message.reply('Une erreur est survenue lors de la récupération des conversations depuis la base de données.');
  }
}

async function readConversationsFromMemory(client, message, contextKeyParam) {
  try {
    // Pour cette commande, nous pouvons uniquement accéder au contexte actuel
    // puisque nous n'avons pas getAllContexts()
    const contextKeyObj = getContextKey(message);
    const contextData = await getContextData(message);

    // Utiliser conversationService pour obtenir les messages récents en complément des données en mémoire
    const guildId = message.guild?.id || null;
    const recentMessages = await conversationService.getRecentMessages(contextKeyObj.key, guildId, 5);

    const participants = contextData.participants || [];
    const totalMessages = participants.reduce((sum, p) => sum + (p.messageCount || 0), 0);

    // Créer un résumé textuel du contexte
    let response = `## 🧠 Conversations en mémoire (${contextKeyObj.type}:${contextKeyObj.key})\n\n`;
    response += 'Informations sur les conversations stockées en mémoire.\n\n';

    response += `**Nombre de participants:** ${participants.length}\n`;
    response += `**Total de messages:** ${totalMessages}\n`;
    response += `**Dernier auteur:** ${contextData.lastAuthorName ? 
      `${contextData.lastAuthorName} (ID: ${contextData.lastAuthorId})` : 
      'Aucun'}\n`;
    response += `**ID de dernière réponse:** ${contextData.lastResponseId ? 
      `\`${contextData.lastResponseId}\`` : 
      'Aucun'}\n`;

    let lastMessageDate = 'Aucun';
    if (contextData.lastMessageTimestamp) {
      try {
        const timestampDate = new Date(contextData.lastMessageTimestamp);
        if (!isNaN(timestampDate.getTime())) {
          lastMessageDate = format(timestampDate, 'yyyy-MM-dd HH:mm:ss');
        } else {
          lastMessageDate = 'Date invalide';
          console.warn(`Format de date invalide: ${contextData.lastMessageTimestamp}`);
        }
      } catch (dateError) {
        console.error('Erreur lors du formatage de la date du dernier message:', dateError);
        lastMessageDate = 'Erreur de date';
      }
    }

    response += `**Dernier message:** ${lastMessageDate}\n\n`;

    // Ajouter les messages récents si disponibles
    if (recentMessages && recentMessages.length > 0) {
      response += '### 📝 Messages récents en base de données\n';
      recentMessages.forEach((msg, index) => {
        try {
          const msgDate = new Date(msg.createdAt);
          let dateStr = 'Date inconnue';

          if (!isNaN(msgDate.getTime())) {
            dateStr = format(msgDate, 'yyyy-MM-dd HH:mm:ss');
          }

          response += `**${index + 1}.** ${msg.userName} (${dateStr}): ${msg.content ? msg.content.substring(0, 50) : ''}${msg.content && msg.content.length > 50 ? '...' : ''}\n`;
        } catch (error) {
          console.error('Erreur lors du formatage du message récent:', error);
        }
      });
      response += '\n';
    }

    // Ajouter les détails des participants
    if (participants.length > 0) {
      response += '### 👥 Participants (triés par activité)\n';

      const participantsInfo = participants
        .sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0))
        .map(p => {
          let participantInfo = `• **${p.name}** (ID: ${p.id}): ${p.messageCount || 0} messages`;

          // Ajouter des informations sur les dates si disponibles
          if (p.firstSeen || p.lastActive) {
            try {
              let dateInfo = [];

              if (p.firstSeen) {
                const firstSeenDate = new Date(p.firstSeen);
                if (!isNaN(firstSeenDate.getTime())) {
                  dateInfo.push(`première activité: ${format(firstSeenDate, 'dd/MM/yyyy')}`);
                }
              }

              if (p.lastActive) {
                const lastActiveDate = new Date(p.lastActive);
                if (!isNaN(lastActiveDate.getTime())) {
                  dateInfo.push(`dernière activité: ${format(lastActiveDate, 'dd/MM/yyyy')}`);
                }
              }

              if (dateInfo.length > 0) {
                participantInfo += ` (${dateInfo.join(', ')})`;
              }
            } catch (dateError) {
              console.error('Erreur lors du formatage des dates du participant:', dateError);
            }
          }

          return participantInfo;
        })
        .join('\n');

      response += participantsInfo + '\n\n';
    }

    response += `\n\n${EMOJIS.RESET} - Réinitialiser ce contexte`;

    const sentMessage = await message.reply(response);

    // Ajouter les réactions pour les actions
    await addReactions(sentMessage, [EMOJIS.RESET]);

    // Configurer un collecteur pour les réactions
    const filter = (reaction, user) => {
      return reaction.emoji.name === EMOJIS.RESET && user.id === message.author.id;
    };

    const collected = await createReactionCollector(sentMessage, filter);

    if (collected.size > 0) {
      // Demander confirmation avant de réinitialiser
      await safeDeleteMessage(sentMessage);

      const confirmMessage = await message.reply(
        `**⚠️ Confirmation de réinitialisation**\n\n` +
        `Êtes-vous sûr de vouloir réinitialiser ce contexte ? Cette action ne peut pas être annulée.\n\n` +
        `${EMOJIS.CONFIRM} - Confirmer la réinitialisation\n` +
        `${EMOJIS.CANCEL} - Annuler`
      );

      await addReactions(confirmMessage, [EMOJIS.CONFIRM, EMOJIS.CANCEL]);

      const confirmFilter = (reaction, user) => {
        return [EMOJIS.CONFIRM, EMOJIS.CANCEL].includes(reaction.emoji.name) &&
               user.id === message.author.id;
      };

      const confirmCollected = await createReactionCollector(confirmMessage, confirmFilter);

      await safeDeleteMessage(confirmMessage);

      if (confirmCollected.size > 0 && confirmCollected.first().emoji.name === EMOJIS.CONFIRM) {
        const success = await resetContext(message);
        const resultMessage = await message.reply(success ? 
          '✅ Contexte réinitialisé avec succès !' : 
          '❌ Erreur lors de la réinitialisation du contexte.');

        setTimeout(() => safeDeleteMessage(resultMessage), 3000);
      }
    } else {
      await safeDeleteMessage(sentMessage);
    }

  } catch (error) {
    console.error('Erreur lors de la lecture des conversations depuis la mémoire:', error);
    return message.reply('Une erreur est survenue lors de la récupération des conversations depuis la mémoire.');
  }
}
