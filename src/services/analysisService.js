import { OpenAI } from 'openai/client.mjs'
import dotenv from 'dotenv'
import { prisma } from './prisma.js'
import { safeJsonParse } from '../utils/jsonUtils.js'

dotenv.config();

const ai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
});

/**
 * Service d'analyse des conversations pour évaluer la pertinence des messages
 */

/**
 * Évalue la pertinence d'un message
 * @param {string} content - Contenu du message
 * @param {string} contextInfo - Informations de contexte (optionnel)
 * @returns {Promise<Object>} - Résultat d'analyse avec score et hasKeyInfo
 */
  export async function analyzeMessageRelevance(content, contextInfo = '', isFromBot = false) {
  try {
    console.log(`[AnalysisService] Analyse de pertinence demandée - Contenu: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}", Contexte: ${contextInfo ? 'Fourni' : 'Non fourni'}, Bot: ${isFromBot}`);

    if (!content || content.trim() === '') {
      console.log('[AnalysisService] Contenu vide, retour score zéro');
      return { relevanceScore: 0, hasKeyInfo: false };
    }

    // Si le message provient d'un bot, ne pas analyser pour économiser des appels API
    if (isFromBot) {
      console.log('[AnalysisService] Message provenant d\'un bot, analyse ignorée');
      return { relevanceScore: 0.3, hasKeyInfo: false }; // Score par défaut pour les bots
    }

    const systemInstructions = `Tu es un système d'analyse de pertinence de messages. 

Évalue la pertinence du message fourni selon les critères suivants:
1. Pertinence dans la conversation
2. Informations utiles ou importantes contenues dans le message
3. Potentiel d'apporter de la valeur à la conversation

Réponds UNIQUEMENT au format JSON brut (sans formatage markdown, sans bloc de code) avec deux propriétés:
- relevanceScore: un nombre entre 0 et 1 (0 = non pertinent, 1 = très pertinent)
- hasKeyInfo: booléen indiquant si le message contient des informations clés importantes (true/false)

IMPORTANT: N'utilise PAS de bloc de code markdown (\`\`\`) dans ta réponse, renvoie uniquement l'objet JSON brut.`;

    console.log('[AnalysisService] Envoi de la demande d\'analyse à l\'API OpenAI');

    const response = await ai.responses.create({
      model: 'gpt-4.1-mini',
      input: `${contextInfo ? 'Contexte: ' + contextInfo + '\n\n' : ''}Message à analyser: ${content}`,
      instructions: systemInstructions,
    });

    console.log('[AnalysisService] Réponse reçue de l\'API OpenAI');

    // Extraire le JSON de la réponse
    const result = safeJsonParse(response.output_text, null);

    // Valider le format
    if (!result || typeof result.relevanceScore !== 'number' || typeof result.hasKeyInfo !== 'boolean') {
      console.error('[AnalysisService] Format de réponse invalide:', response.output_text);
      return { relevanceScore: 0.5, hasKeyInfo: false };
    }

    console.log(`[AnalysisService] Analyse complétée - Score: ${result.relevanceScore.toFixed(2)}, InfoClé: ${result.hasKeyInfo}`);
    return result;
  } catch (error) {
    console.error('Erreur lors de l\'analyse de pertinence:', error);
    return { relevanceScore: 0.5, hasKeyInfo: false }; // Valeur par défaut en cas d'erreur
  }
}

/**
 * Évalue la pertinence globale d'une conversation et génère un résumé
 * @param {Array} messages - Liste des messages de la conversation
 * @returns {Promise<Object>} - Résultat avec score global et résumé
 */
export async function analyzeConversationRelevance(messages) {
  try {
    console.log(`[AnalysisService] Analyse de conversation demandée - ${messages?.length || 0} messages`);

    if (!messages || messages.length === 0) {
      console.log('[AnalysisService] Aucun message à analyser, retour score zéro');
      return { relevanceScore: 0, topicSummary: null };
    }

    // Limiter le nombre de messages pour l'analyse
    const messagesToAnalyze = messages.slice(-20);
    console.log(`[AnalysisService] Analyse limitée à ${messagesToAnalyze.length} messages récents`);

    const messageContent = messagesToAnalyze.map(msg => {
      return `${msg.userName}: ${msg.content}`;
    }).join('\n');

    const systemInstructions = `Tu es un système d'analyse de pertinence de conversations.

Analyse la conversation fournie et réponds UNIQUEMENT au format JSON brut (sans formatage markdown, sans bloc de code) avec deux propriétés:
- relevanceScore: un nombre entre 0 et 1 indiquant la pertinence globale de la conversation
- topicSummary: un résumé concis (max 100 caractères) des principaux sujets abordés

IMPORTANT: N'utilise PAS de bloc de code markdown (\`\`\`) dans ta réponse, renvoie uniquement l'objet JSON brut.`;

    const response = await ai.responses.create({
      model: 'gpt-4.1-mini',
      input: `Conversation à analyser:\n${messageContent}`,
      instructions: systemInstructions,
    });

    // Extraire le JSON de la réponse
    const result = safeJsonParse(response.output_text, null);

    // Valider le format
    if (!result || typeof result.relevanceScore !== 'number' || typeof result.topicSummary !== 'string') {
      console.error('Format de réponse invalide pour la conversation:', response.output_text);
      return { relevanceScore: 0.5, topicSummary: 'Analyse impossible' };
    }

    return result;
  } catch (error) {
    console.error('Erreur lors de l\'analyse de la conversation:', error);
    return { relevanceScore: 0.5, topicSummary: 'Erreur d\'analyse' };
  }
}

/**
 * Met à jour le score de pertinence d'une conversation existante
 * @param {string} channelId - ID du canal
 * @param {string} guildId - ID de la guilde (optionnel)
 * @param {Object} client - Client Discord (optionnel, pour créer des tâches planifiées)
 * @returns {Promise<Object>} - Résultat de la mise à jour
 */
export async function updateConversationRelevance(channelId, guildId = null, client = null) {
  try {
    console.log(`[AnalysisService] Mise à jour de la pertinence de conversation - Canal: ${channelId}, Serveur: ${guildId || 'DM'}`);

    // Récupérer la conversation et ses messages
    const conversation = await prisma.conversation.findUnique({
      where: {
        channelId_guildId: {
          channelId,
          guildId: guildId || ""
        }
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!conversation) {
      console.log(`[AnalysisService] Aucune conversation trouvée pour Canal: ${channelId}, Serveur: ${guildId || 'DM'}`);
      return null;
    }

    console.log(`[AnalysisService] Conversation trouvée - ID: ${conversation.id}, ${conversation.messages.length} messages`);

    if (!conversation) {
      return null;
    }

    // Analyser la conversation
    const analysis = await analyzeConversationRelevance(conversation.messages);

    // Mettre à jour la conversation dans la base de données
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        relevanceScore: analysis.relevanceScore,
        topicSummary: analysis.topicSummary,
        updatedAt: new Date()
      }
    });

    // Si le client est fourni et que le service de surveillance des messages est disponible,
    // créer une tâche planifiée si la conversation est pertinente
    if (client && analysis.relevanceScore >= 0.7) {
      console.log(`[AnalysisService] Score de pertinence élevé (${analysis.relevanceScore.toFixed(2)}) - Tentative de création de tâche planifiée`);
      try {
        const { messageMonitoringService } = await import('./messageMonitoringService.js');
        const taskCreated = await messageMonitoringService.createScheduledTask(
          client,
          channelId,
          guildId,
          analysis.relevanceScore,
          analysis.topicSummary
        );

        if (taskCreated) {
          console.log(`[AnalysisService] Tâche planifiée créée avec succès pour le canal ${channelId} - Sujet: "${analysis.topicSummary}"`);
        } else {
          console.log(`[AnalysisService] Création de tâche planifiée échouée ou ignorée pour le canal ${channelId}`);
        }
      } catch (taskError) {
        console.error('[AnalysisService] Erreur lors de la création d\'une tâche planifiée pour la conversation:', taskError);
      }
    } else if (client) {
      console.log(`[AnalysisService] Score de pertinence trop faible (${analysis.relevanceScore.toFixed(2)}) - Pas de tâche planifiée`);
    }

    return updatedConversation;
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la pertinence de la conversation:', error);
    return null;
  }
}

/**
 * Partage une conversation avec un utilisateur spécifié
 * @param {string} channelId - ID du canal de la conversation
 * @param {string} guildId - ID de la guilde (optionnel)
 * @param {string} shareWithUserId - ID de l'utilisateur avec qui partager
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export async function shareConversation(channelId, guildId = null, shareWithUserId) {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: {
        channelId_guildId: {
          channelId,
          guildId: guildId || ""
        }
      }
    });

    if (!conversation) {
      return false;
    }

    // Récupérer la liste actuelle des partages
    let sharedWith = conversation.sharedWith || [];

    // Ajouter l'utilisateur s'il n'est pas déjà dans la liste
    if (!sharedWith.includes(shareWithUserId)) {
      sharedWith.push(shareWithUserId);
    }

    // Mettre à jour la conversation
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        isShared: true,
        sharedWith: sharedWith,
        updatedAt: new Date()
      }
    });

    return true;
  } catch (error) {
    console.error('Erreur lors du partage de la conversation:', error);
    return false;
  }
}

/**
 * Récupère les conversations partagées avec un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Array>} - Liste des conversations partagées
 */
export async function getSharedConversations(userId) {
  try {
    // Trouver toutes les conversations partagées avec cet utilisateur
    return await prisma.conversation.findMany({
      where: {
        isShared: true,
        sharedWith: { has: userId }
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc'
          },
          // Récupérer uniquement les messages pertinents pour un aperçu
          where: {
            OR: [
              { hasKeyInfo: true },
              { relevanceScore: { gte: 0.7 } }
            ]
          }
        }
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des conversations partagées:', error);
    return [];
  }
}

export const analysisService = {
  analyzeMessageRelevance,
  analyzeConversationRelevance,
  updateConversationRelevance,
  shareConversation,
  getSharedConversations
};
