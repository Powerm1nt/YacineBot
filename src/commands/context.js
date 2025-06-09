import { getContextKey } from '../utils/commandUtils.js'
import { 
  getContextData, 
  getLastResponseId,
  getContextStats,
  cleanupOldContexts,
  resetContext
} from '../utils/contextManager.js'
import { conversationService } from '../services/conversationService.js'
import { sendLongMessage } from '../utils/messageUtils.js'
import { format } from 'date-fns'

export const metadata = {
  name: 'context',
  description: 'Affiche les informations sur le contexte actuel et les statistiques',
  restricted: true,
  usage: 'context [action]'
};

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
    // Dans cette version simplifiée, nous allons juste afficher un résumé
    // car nous n'avons pas accès à getAllContexts() sans la modifier
    const stats = getContextStats();

    let response = '## 📋 Résumé des contextes en mémoire\n\n';
    response += 'Pour voir plus de détails sur un contexte spécifique, utilisez `context memory <channelId>`\n\n';

    response += `**Contextes de serveur:** ${stats.contextCounts.guild || 0} contextes\n`;
    response += `**Contextes DM:** ${stats.contextCounts.dm || 0} contextes\n`;
    response += `**Contextes de groupe:** ${stats.contextCounts.group || 0} contextes\n\n`;

    response += `*Total: ${stats.contextCounts.total || 0} contextes en mémoire*\n\n`;
    response += `Vous pouvez répondre avec **nettoyer** pour supprimer les contextes inactifs.`;

    const sentMessage = await message.reply(response);

    // Configurer un collecteur pour le message de réponse
    const filter = m => m.author.id === message.author.id && 
                        m.content.toLowerCase().includes('nettoyer');
    const collector = message.channel.createMessageCollector({ filter, time: 60000, max: 1 });

    collector.on('collect', async m => {
      const cleanedCount = await cleanupOldContexts();
      await message.channel.send(`✅ ${cleanedCount} contextes inactifs ont été nettoyés.`);
    });

  } catch (error) {
    console.error('Erreur lors de l\'affichage de la liste des contextes:', error);
    return message.reply('Une erreur est survenue lors de la récupération de la liste des contextes.');
  }
}

async function readConversationsFromDB(client, message, channelId) {
  try {
    if (!channelId) {
      // Si aucun ID de canal n'est spécifié, utiliser le canal actuel
      channelId = message.channel.id;
    }

    const conversations = await conversationService.getConversationHistory(channelId);

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
    const confirmation = await message.reply('Voulez-vous voir les 20 derniers messages détaillés ? (oui/non)');

    const filter = m => m.author.id === message.author.id && ['oui', 'non', 'yes', 'no'].includes(m.content.toLowerCase());
    const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });

    if (collected.size > 0 && ['oui', 'yes'].includes(collected.first().content.toLowerCase())) {
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

    response += 'Pour réinitialiser ce contexte, répondez avec **reset** à ce message.'

    const sentMessage = await message.reply(response);

    // Configurer un collecteur pour le message de réponse au lieu d'utiliser un bouton
    const filter = m => m.author.id === message.author.id && 
                      (m.content.toLowerCase() === 'reset' || 
                       m.content.toLowerCase() === 'réinitialiser' ||
                       m.content.toLowerCase().includes('reset') ||
                       m.content.toLowerCase().includes('réinitialiser'));

    const collector = message.channel.createMessageCollector({ filter, time: 60000, max: 1 });

    collector.on('collect', async m => {
      const success = await resetContext(message);
      await message.channel.send(success ? 
        '✅ Contexte réinitialisé avec succès !' : 
        '❌ Erreur lors de la réinitialisation du contexte.');
    });

  } catch (error) {
    console.error('Erreur lors de la lecture des conversations depuis la mémoire:', error);
    return message.reply('Une erreur est survenue lors de la récupération des conversations depuis la mémoire.');
  }
}
