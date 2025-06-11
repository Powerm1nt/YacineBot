import { randomUUID } from 'crypto'
import { prisma } from './prisma.js'
import { analysisService } from './analysisService.js'

/**
 * Service de gestion des tâches liées aux messages
 * Permet de stocker les messages entrants et de les traiter comme des tâches
 */
export const messageTaskService = {
  /**
   * Capture un message entrant et le stocke comme tâche intermédiaire
   * @param {Object} message - Message Discord
   * @param {Object} conversation - Conversation associée
   * @returns {Promise<Object>} - Tâche créée
   */
  async captureIncomingMessage(message, conversation) {
    try {
      // Éviter de traiter les messages de bot
      if (message.author.bot) return null;

      // Créer une tâche intermédiaire pour analyser la pertinence du message
      const taskId = `message-analysis-${randomUUID().substring(0, 8)}`;

      const task = await prisma.task.create({
        data: {
          type: 'intermediate',
          status: 'pending',
          priority: 1, // Priorité normale
          data: {
            messageId: message.id,
            userId: message.author.id,
            userName: message.author.username,
            channelId: message.channel.id,
            guildId: message.guild?.id || null,
            conversationId: conversation.id,
            content: message.content,
            timestamp: message.createdAt.toISOString()
          },
          schedulerId: taskId
        }
      });

      console.log(`Tâche intermédiaire créée pour le message ${message.id}: ${taskId}`);
      return task;
    } catch (error) {
      console.error('Erreur lors de la capture du message entrant:', error);
      return null;
    }
  },

  /**
   * Récupère et traite les tâches intermédiaires en attente
   * Analyse la pertinence des messages et crée des tâches exécutives si nécessaire
   * @returns {Promise<number>} - Nombre de tâches traitées
   */
  async processIntermediateTasks() {
    try {
      // Récupérer les tâches intermédiaires en attente
      const pendingTasks = await prisma.task.findMany({
        where: {
          type: 'intermediate',
          status: 'pending'
        },
        orderBy: {
          createdAt: 'asc'
        },
        take: 20 // Traiter un nombre limité de tâches à la fois
      });

      if (pendingTasks.length === 0) return 0;

      console.log(`Traitement de ${pendingTasks.length} tâches intermédiaires...`);

      let executiveTasksCreated = 0;

      for (const task of pendingTasks) {
        // Analyser la pertinence du message
        const messageData = task.data;

        // Analyser la pertinence du message via le service d'analyse
        const analysis = await analysisService.analyzeMessageRelevance(messageData.content);

        // Mettre à jour le message dans la base de données avec le score de pertinence
        await prisma.message.update({
          where: {
            id: BigInt(messageData.messageId)
          },
          data: {
            relevanceScore: analysis.relevanceScore,
            hasKeyInfo: analysis.hasKeyInfo
          }
        });

        // Si le message est pertinent, créer une tâche exécutive pour y répondre
        if (analysis.relevanceScore >= 0.7 || analysis.hasKeyInfo) {
          const executiveTaskId = `message-response-${randomUUID().substring(0, 8)}`;

          await prisma.task.create({
            data: {
              type: 'executive',
              status: 'pending',
              priority: analysis.hasKeyInfo ? 2 : 1, // Priorité plus élevée pour les infos clés
              data: {
                messageId: messageData.messageId,
                userId: messageData.userId,
                channelId: messageData.channelId,
                guildId: messageData.guildId,
                conversationId: messageData.conversationId,
                content: messageData.content,
                relevanceScore: analysis.relevanceScore,
                hasKeyInfo: analysis.hasKeyInfo,
                responsePlan: analysis.responsePlan || 'Répondre de manière appropriée',
                timestamp: messageData.timestamp
              },
              schedulerId: executiveTaskId
            }
          });

          console.log(`Tâche exécutive créée pour le message ${messageData.messageId}: ${executiveTaskId}`);
          executiveTasksCreated++;
        }

        // Marquer la tâche intermédiaire comme terminée
        await prisma.task.update({
          where: { id: task.id },
          data: { 
            status: 'completed',
            completedAt: new Date()
          }
        });
      }

      console.log(`Traitement terminé: ${pendingTasks.length} tâches intermédiaires traitées, ${executiveTasksCreated} tâches exécutives créées`);
      return pendingTasks.length;
    } catch (error) {
      console.error('Erreur lors du traitement des tâches intermédiaires:', error);
      return 0;
    }
  },

  /**
   * Exécute les tâches exécutives en attente (envoi de messages)
   * @param {Object} client - Client Discord
   * @returns {Promise<number>} - Nombre de tâches exécutées
   */
  async executeResponseTasks(client) {
    try {
      // Récupérer les tâches exécutives en attente
      const pendingTasks = await prisma.task.findMany({
        where: {
          type: 'executive',
          status: 'pending'
        },
        orderBy: [
          { priority: 'desc' }, // Priorité plus élevée d'abord
          { createdAt: 'asc' } // Plus anciennes d'abord
        ],
        take: 5 // Limiter le nombre de réponses à la fois
      });

      if (pendingTasks.length === 0) return 0;

      console.log(`Exécution de ${pendingTasks.length} tâches de réponse...`);

      let messagesSucceeded = 0;

      for (const task of pendingTasks) {
        try {
          // Récupérer les données du message
          const messageData = task.data;

          // Récupérer le canal
          const channel = await client.channels.fetch(messageData.channelId).catch(() => null);

          if (!channel) {
            console.log(`Canal ${messageData.channelId} non trouvé, marquage de la tâche comme échouée`);
            await prisma.task.update({
              where: { id: task.id },
              data: { 
                status: 'failed',
                failedAt: new Date(),
                error: 'Canal non trouvé'
              }
            });
            continue;
          }

          // Générer une réponse au message via OpenAI ou autre service
          const response = await analysisService.generateMessageResponse(messageData.content, messageData.hasKeyInfo);

          // Simuler l'écriture
          await channel.sendTyping().catch(console.error);

          // Délai calculé en fonction de la longueur du message
          const typingDelay = response.length * 30 + Math.floor(Math.random() * 2000);
          await new Promise(resolve => setTimeout(resolve, typingDelay));

          // Envoyer le message
          const sentMessage = await channel.send(response);

          // Marquer la tâche comme terminée
          await prisma.task.update({
            where: { id: task.id },
            data: { 
              status: 'completed',
              completedAt: new Date(),
              data: {
                ...messageData,
                responseId: sentMessage.id,
                responseContent: response
              }
            }
          });

          console.log(`Réponse envoyée pour la tâche ${task.schedulerId} dans le canal ${messageData.channelId}`);
          messagesSucceeded++;

          // Ajouter un délai entre les messages pour éviter de spammer
          await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

        } catch (error) {
          console.error(`Erreur lors de l'exécution de la tâche ${task.schedulerId}:`, error);

          // Marquer la tâche comme échouée
          await prisma.task.update({
            where: { id: task.id },
            data: { 
              status: 'failed',
              failedAt: new Date(),
              error: error.message || 'Erreur inconnue',
              retryCount: task.retryCount + 1,
              nextRetryAt: task.retryCount < 3 ? new Date(Date.now() + 10 * 60 * 1000) : null // Réessayer dans 10 minutes si moins de 3 tentatives
            }
          });
        }
      }

      console.log(`Exécution terminée: ${messagesSucceeded}/${pendingTasks.length} tâches exécutées avec succès`);
      return messagesSucceeded;
    } catch (error) {
      console.error('Erreur lors de l\'exécution des tâches de réponse:', error);
      return 0;
    }
  },

  /**
   * Récupère les statistiques des tâches
   * @returns {Promise<Object>} - Statistiques des tâches
   */
  async getTaskStats() {
    try {
      // Compter les tâches par type et statut
      const stats = await prisma.$queryRaw`
        SELECT 
          type, 
          status, 
          COUNT(*) as count 
        FROM tasks 
        GROUP BY type, status
      `;

      // Agréger les résultats
      const result = {
        intermediate: {
          pending: 0,
          completed: 0,
          failed: 0,
          total: 0
        },
        executive: {
          pending: 0,
          completed: 0,
          failed: 0,
          total: 0
        },
        total: 0
      };

      for (const stat of stats) {
        if (result[stat.type]) {
          result[stat.type][stat.status] = Number(stat.count);
          result[stat.type].total += Number(stat.count);
          result.total += Number(stat.count);
        }
      }

      return result;
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques des tâches:', error);
      return {
        intermediate: { pending: 0, completed: 0, failed: 0, total: 0 },
        executive: { pending: 0, completed: 0, failed: 0, total: 0 },
        total: 0,
        error: error.message
      };
    }
  }
};
