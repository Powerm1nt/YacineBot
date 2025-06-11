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
export async function analyzeMessageRelevance(content, contextInfo = '') {
  try {
    if (!content || content.trim() === '') {
      return { relevanceScore: 0, hasKeyInfo: false };
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

    const response = await ai.responses.create({
      model: 'gpt-4.1-mini',
      input: `${contextInfo ? 'Contexte: ' + contextInfo + '\n\n' : ''}Message à analyser: ${content}`,
      instructions: systemInstructions,
    });

    // Extraire le JSON de la réponse
    const result = safeJsonParse(response.output_text, null);

    // Valider le format
    if (!result || typeof result.relevanceScore !== 'number' || typeof result.hasKeyInfo !== 'boolean') {
      console.error('Format de réponse invalide:', response.output_text);
      return { relevanceScore: 0.5, hasKeyInfo: false };
    }

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
    if (!messages || messages.length === 0) {
      return { relevanceScore: 0, topicSummary: null };
    }

    // Limiter le nombre de messages pour l'analyse
    const messagesToAnalyze = messages.slice(-20);

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
      try {
        const { messageMonitoringService } = await import('./messageMonitoringService.js');
        await messageMonitoringService.createScheduledTask(
          client,
          channelId,
          guildId,
          analysis.relevanceScore,
          analysis.topicSummary
        );
      } catch (taskError) {
        console.error('Erreur lors de la création d\'une tâche planifiée pour la conversation:', taskError);
      }
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
