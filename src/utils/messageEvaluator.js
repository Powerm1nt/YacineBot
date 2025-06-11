/**
 * Utilitaire pour évaluer si un message mérite une réponse
 */
import { analysisService } from '../services/analysisService.js';
import { conversationService } from '../services/conversationService.js';

/**
 * Évalue si un message mérite une réponse immédiate
 * @param {string} content - Contenu du message
 * @param {boolean} isDirectMention - Si le message est une mention directe du bot
 * @param {boolean} isDM - Si le message est un DM
 * @param {boolean} isReply - Si le message est une réponse à un message du bot
 * @returns {Promise<boolean>} - Si le message mérite une réponse immédiate
 */
  export async function shouldRespondImmediately(content, isDirectMention, isDM, isReply, isReplyBetweenUsers = false) {
  console.log(`[MessageEvaluator] Évaluation immédiate - Mention: ${isDirectMention}, DM: ${isDM}, Réponse: ${isReply}, Réponse entre utilisateurs: ${isReplyBetweenUsers}, Contenu: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`); 

  // Répondre toujours aux mentions directes, DMs et réponses à nos messages
  if (isDirectMention || isDM || isReply) {
    // Si c'est une réponse entre utilisateurs, être plus prudent
    if (isReplyBetweenUsers && !isDirectMention && !isDM) {
      console.log('[MessageEvaluator] Réponse entre utilisateurs détectée - Évaluation plus stricte requise');
      // Dans ce cas, vérifier si le contenu semble nécessiter une intervention
      if (!content.includes('?') && !content.toLowerCase().includes('help') && !content.toLowerCase().includes('aide')) {
        console.log('[MessageEvaluator] Réponse entre utilisateurs ne nécessitant pas d\'intervention immédiate');
        return false;
      }
    }
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
export async function evaluateMessageRelevance(channelId, guildId, content) {
  try {
    // Vérification du contenu vide ou invalide
    if (!content || content.trim() === '' || content.trim() === "' '' '") {
      console.log(`[MessageEvaluator] Contenu vide ou invalide, message ignoré`);
      return { relevanceScore: 0, hasKeyInfo: false, shouldRespond: false };
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
      conversationContext
    );

    // Décider si on répond en fonction du score, de la présence d'info clé et de l'activité de la conversation
    let shouldRespond = relevanceAnalysis.relevanceScore >= 0.6 || relevanceAnalysis.hasKeyInfo;

    // Si la conversation est active, augmenter le seuil de pertinence requis
    if (conversationService.isActiveConversation(channelId, guildId)) {
      const higherThreshold = 0.75;
      shouldRespond = relevanceAnalysis.relevanceScore >= higherThreshold || relevanceAnalysis.hasKeyInfo;
      console.log(`[MessageEvaluator] Conversation active - Seuil de pertinence augmenté à ${higherThreshold}`);

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
    return { relevanceScore: 0.5, hasKeyInfo: false, shouldRespond: true }; // Par défaut, répondre en cas d'erreur
  }
}

export const messageEvaluator = {
  shouldRespondImmediately,
  evaluateMessageRelevance
};
