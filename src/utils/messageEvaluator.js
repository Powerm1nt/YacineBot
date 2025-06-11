/**
 * Utilitaire pour évaluer si un message mérite une réponse
 */
import { analysisService } from '../services/analysisService.js';
import { conversationService } from '../services/conversationService.js';
import { prisma } from '../services/prisma.js';
/**
 * Évalue si un message mérite une réponse immédiate
 * @param {string} content - Contenu du message
 * @param {boolean} isDirectMention - Si le message est une mention directe du bot
 * @param {boolean} isDM - Si le message est un DM
 * @param {boolean} isReply - Si le message est une réponse à un message du bot
 * @param {boolean} isReplyBetweenUsers - Si le message est une réponse entre utilisateurs
 * @returns {Promise<boolean>} - Si le message mérite une réponse immédiate
 */
  export async function shouldRespondImmediately(content, isDirectMention, isDM, isReply, isReplyBetweenUsers = false) {
  console.log(`[MessageEvaluator] Évaluation immédiate - Mention: ${isDirectMention}, DM: ${isDM}, Réponse: ${isReply}, Réponse entre utilisateurs: ${isReplyBetweenUsers}, Contenu: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`); 

  // Si c'est une réponse entre utilisateurs et que ce n'est pas une mention directe ou un DM, être beaucoup plus discret
  if (isReplyBetweenUsers && !isDirectMention && !isDM) {
    console.log('[MessageEvaluator] Réponse entre utilisateurs détectée - Le bot reste en retrait');

    // Vérifier si le message parle du bot (Yassine)
    const botNameVariants = ['yassine', 'yascine', 'yasine', 'yacine', 'le bot'];
    const contentLower = content.toLowerCase();
    const botMentioned = botNameVariants.some(variant => contentLower.includes(variant));

    if (botMentioned) {
      console.log('[MessageEvaluator] Mention du bot détectée dans une conversation entre utilisateurs');
      return true;
    }

    // Ne répondre que dans des cas très spécifiques où l'intervention est clairement demandée
    if (content.includes('?') && (content.toLowerCase().includes('help') || content.toLowerCase().includes('aide') || 
        content.toLowerCase().includes('question') || content.toLowerCase().includes('besoin'))) {
      console.log('[MessageEvaluator] Question d\'aide explicite détectée dans une conversation entre utilisateurs');
      return true;
    }
    return false;
  }

  // Répondre aux mentions directes, DMs et réponses à nos messages
  if (isDirectMention || isDM || isReply) {
    console.log('[MessageEvaluator] Réponse immédiate requise - Mention directe, DM ou réponse détectée');
    return true;
  }

  // Répondre aux questions
  if (content.includes('?')) {
    console.log('[MessageEvaluator] Réponse immédiate requise - Question détectée');
    return true;
  }

  // Répondre aux messages urgents ou importants (mots clés)
  const urgentWords = ['urgent', 'important', 'help', 'aide', 'sos', 'problème', 'problem'];
  if (urgentWords.some(word => content.toLowerCase().includes(word))) {
    console.log(`[MessageEvaluator] Réponse immédiate requise - Mot urgent détecté: ${urgentWords.find(word => content.toLowerCase().includes(word))}`);
    return true;
  }

  console.log('[MessageEvaluator] Message ne nécessitant pas de réponse immédiate');
  return false;
}

/**
 * Évalue si un message est pertinent pour une réponse différée
 * @param {string} channelId - ID du canal
 * @param {string} guildId - ID de la guilde (optionnel)
 * @param {string} content - Contenu du message
 * @returns {Promise<Object>} - Résultat d'analyse avec décision
 */
  export async function evaluateMessageRelevance(channelId, guildId, content, isReplyBetweenUsers = false) {
  try {
    // Vérification du contenu vide ou invalide
    if (!content || content.trim() === '' || content.trim() === "' '' '") {
      console.log(`[MessageEvaluator] Contenu vide ou invalide, message ignoré`);
      return { relevanceScore: 0, hasKeyInfo: false, shouldRespond: false };
    }

    // Vérifier si le message parle du bot (Yassine)
    const botNameVariants = ['yassine', 'yascine', 'yasine', 'yacine', 'le bot'];
    const contentLower = content.toLowerCase();
    const botMentioned = botNameVariants.some(variant => contentLower.includes(variant));

    if (botMentioned) {
      console.log(`[MessageEvaluator] Mention du bot détectée dans le message - Augmentation du score de pertinence`);
      return { relevanceScore: 0.85, hasKeyInfo: true, shouldRespond: true };
    }

    // Si c'est une réponse entre utilisateurs, appliquer des règles moins strictes pour permettre plus de réponses
    if (isReplyBetweenUsers) {
      console.log(`[MessageEvaluator] Analyse de pertinence pour une réponse entre utilisateurs - Application de règles moins strictes`);
      // Ne considérer que les messages contenant des questions directes d'aide
      if (content.includes('?') && (content.toLowerCase().includes('help') || content.toLowerCase().includes('aide') || 
          content.toLowerCase().includes('question') || content.toLowerCase().includes('besoin'))) {
        console.log(`[MessageEvaluator] Question d'aide explicite détectée dans une conversation entre utilisateurs`);
        return { relevanceScore: 0.8, hasKeyInfo: true, shouldRespond: true };
      }
      // Pour tous les autres cas de conversations entre utilisateurs, score beaucoup plus élevé qu'avant
      return { relevanceScore: 0.6, hasKeyInfo: true, shouldRespond: true };
    }

    // Récupérer des informations sur le canal si disponibles
    let channelName = '';
    try {
      const channel = await prisma.conversation.findUnique({
        where: {
          channelId_guildId: {
            channelId,
            guildId: guildId || ""
          }
        },
        select: {
          channelName: true
        }
      });

      if (channel && channel.channelName) {
        channelName = channel.channelName;
        console.log(`[MessageEvaluator] Nom du canal récupéré: #${channelName}`);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du nom du canal:', error);
    }

    // Vérifier si une conversation est active dans ce canal
    const isActive = conversationService.isActiveConversation(channelId, guildId);
    console.log(`[MessageEvaluator] État de la conversation dans le canal ${channelId}: ${isActive ? 'Active' : 'Inactive'}`);

    // Si une conversation est active, vérifier si un délai d'attente est en cours
    if (isActive && analysisService.isWaitingForMoreMessages(channelId, guildId)) {
      console.log(`[MessageEvaluator] Un délai d'attente est actif dans le canal ${channelId} - Réduire le score de pertinence`);
      // Réduire la probabilité de réponse pendant un bloc de messages actif
      return { relevanceScore: 0.3, hasKeyInfo: false, shouldRespond: false };
    }

    console.log(`[MessageEvaluator] Début d'évaluation de pertinence - Canal: ${channelId}, Serveur: ${guildId || 'DM'}, Contenu: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`); 

    const recentMessages = await conversationService.getRecentMessages(channelId, guildId, 5);
    console.log(`[MessageEvaluator] ${recentMessages.length} messages récents récupérés pour contexte`);

    const conversationContext = recentMessages.length > 0 ? 
      recentMessages.map(msg => `${msg.userName}: ${msg.content}`).join('\n') : '';

    console.log(`[MessageEvaluator] Envoi à l'analyse de pertinence avec ${conversationContext.length > 0 ? 'contexte' : 'sans contexte'}`);
    const relevanceAnalysis = await analysisService.analyzeMessageRelevance(
      content,
      conversationContext,
      false, // Pas un message de bot
      channelName
    );

    // Décider si on répond en fonction du score, de la présence d'info clé et de l'activité de la conversation
    // Si le score est modéré ou élevé (>=0.5), répondre systématiquement
    let shouldRespond = relevanceAnalysis.relevanceScore >= 0.5 || relevanceAnalysis.hasKeyInfo;

    // Si la conversation est active, répondre avec un seuil très bas pour maximiser les interactions
    if (conversationService.isActiveConversation(channelId, guildId)) {
      // On garde un seuil mais moins élevé qu'avant pour privilégier la réponse
      const moderateThreshold = 0.5;
      shouldRespond = relevanceAnalysis.relevanceScore >= moderateThreshold || relevanceAnalysis.hasKeyInfo;
      console.log(`[MessageEvaluator] Conversation active - Seuil de pertinence modéré à ${moderateThreshold}`);

      // Si on décide de répondre, activer le délai d'attente pour ce canal
      if (shouldRespond) {
        analysisService.startMessageBatchDelay(channelId, guildId);
      }
    }

    console.log(`[MessageEvaluator] Résultat d'analyse - Score: ${relevanceAnalysis.relevanceScore.toFixed(2)}, InfoClé: ${relevanceAnalysis.hasKeyInfo}, Décision: ${shouldRespond ? 'Répondre' : 'Ignorer'}`);

    return {
      ...relevanceAnalysis,
      shouldRespond
    };
  } catch (error) {
    console.error('Erreur lors de l\'évaluation de la pertinence:', error);
    return { relevanceScore: 0.6, hasKeyInfo: true, shouldRespond: true }; // Par défaut, toujours répondre en cas d'erreur
  }
}

export const messageEvaluator = {
  shouldRespondImmediately,
  evaluateMessageRelevance
};
