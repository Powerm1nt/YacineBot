/**
 * Service de surveillance des messages pour analyser la pertinence et répondre plus tard si nécessaire
 */
import { messageEvaluator } from '../utils/messageEvaluator.js';
import { ToadScheduler, SimpleIntervalJob, AsyncTask } from 'toad-scheduler';
import { format } from 'date-fns';
import { taskService } from './taskService.js';
import { randomUUID } from 'crypto';
import { prisma } from './prisma.js';

const scheduler = new ToadScheduler();
const pendingResponses = new Map();

/**
 * Enregistre un message pour analyse ultérieure
 * @param {Object} message - Message Discord
 * @param {Object} client - Client Discord
 * @param {Function} buildResponseFn - Fonction pour construire une réponse
 */
export async function monitorMessage(message, client, buildResponseFn) {
  const messageId = message.id;
  const channelId = message.channel.id;
  const userId = message.author.id;
  const guildId = message.guild?.id || null;

  console.log(`[MessageMonitoring] Nouveau message reçu - ID: ${messageId}, Canal: ${channelId}, Utilisateur: ${userId}, Serveur: ${guildId || 'DM'}, Contenu: "${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}"`); 
  console.log(`[MessageMonitoring] Message ${messageId} ajouté pour analyse différée`);

  // Vérifier si le message est déjà en attente d'analyse
  if (pendingResponses.has(messageId)) {
    console.log(`[MessageMonitoring] Message ${messageId} déjà en attente d'analyse - ignoré`);
    return;
  }

  // Planifier l'analyse du message pour dans exactement 1 minute
  const delayInMinutes = 1; // Délai fixe de 1 minute
  const delayInMs = delayInMinutes * 60 * 1000;
  const scheduledTime = new Date(Date.now() + delayInMs);

  // Enregistrer l'information sur le message en attente
  pendingResponses.set(messageId, {
    message,
    channelId,
    userId,
    guildId,
    scheduledTime,
    content: message.content
  });

  console.log(`Message ${messageId} planifié pour analyse dans 1 minute à ${format(scheduledTime, 'HH:mm:ss')}`);

  // Créer une tâche pour analyser et potentiellement répondre plus tard
  const task = new AsyncTask(
    `analyze-message-${messageId}`,
    async () => {
      try {
        // Vérifier si le message est toujours pertinent
        if (!pendingResponses.has(messageId)) return;

        const messageInfo = pendingResponses.get(messageId);

        console.log(`[MessageMonitoring] Début de l'évaluation du message ${messageId} dans le canal ${channelId}`);
        console.log(`[MessageMonitoring] Analyse du message de ${messageInfo.userId} - "${messageInfo.content.substring(0, 30)}..."`);

        // Marquer le message comme analysé dans la base de données
        try {
          // Trouver le message dans la base de données
          const conversation = await prisma.conversation.findUnique({
            where: {
              channelId_guildId: {
                channelId: channelId,
                guildId: guildId || ""
              }
            },
            include: {
              messages: {
                where: {
                  userId: messageInfo.userId,
                  isAnalyzed: false
                },
                orderBy: {
                  createdAt: 'desc'
                },
                take: 1
              }
            }
          });

          if (conversation?.messages && conversation.messages.length > 0) {
            const dbMessage = conversation.messages[0];
            console.log(`[MessageMonitoring] Message trouvé en BDD - ID: ${dbMessage.id}`);

            // Mettre à jour le message pour le marquer comme analysé
            await prisma.message.update({
              where: { id: dbMessage.id },
              data: { isAnalyzed: true }
            });

            console.log(`[MessageMonitoring] Message ${dbMessage.id} marqué comme analysé`);
          } else {
            console.log(`[MessageMonitoring] Message non trouvé en BDD pour l'utilisateur ${messageInfo.userId}`);
          }
        } catch (dbError) {
          console.error(`[MessageMonitoring] Erreur lors de la mise à jour du statut d'analyse du message:`, dbError);
        }

        // Évaluer si le message mérite une réponse maintenant
        const evaluationResult = await messageEvaluator.evaluateMessageRelevance(
          channelId,
          guildId,
          messageInfo.content
        );

        console.log(`[MessageMonitoring] Résultat d'évaluation - ID: ${messageId}, Score: ${evaluationResult.relevanceScore.toFixed(2)}, InfoClé: ${evaluationResult.hasKeyInfo}, Répondre: ${evaluationResult.shouldRespond}`);

        // Si le message est suffisamment pertinent, y répondre
        if (evaluationResult.shouldRespond) {
          console.log(`[MessageMonitoring] Réponse différée au message ${messageId} (score: ${evaluationResult.relevanceScore.toFixed(2)}) - Canal: ${channelId}, Serveur: ${guildId || 'DM'}`);

          // Marquer le canal comme étant en train d'écrire
          await message.channel.sendTyping().catch(console.error);

          // Construire et envoyer la réponse
          const response = await buildResponseFn(messageInfo.content, message);
          if (response && response.trim() !== '') {
            await message.reply(response);
          }
        } else {
          console.log(`Message ${messageId} ignoré après analyse différée (score: ${evaluationResult.relevanceScore})`);
        }

        // Supprimer le message de la liste des messages en attente
        pendingResponses.delete(messageId);
      } catch (error) {
        console.error(`Erreur lors de l'analyse différée du message ${messageId}:`, error);
        pendingResponses.delete(messageId);
      }
    },
    (err) => {
      console.error(`Erreur lors de l'analyse planifiée du message ${messageId}:`, err);
      pendingResponses.delete(messageId);
    }
  );

  // Exécuter la tâche une seule fois après le délai fixe de 1 minute
  const jobId = `job-message-${messageId}`;
  const job = new SimpleIntervalJob({ minutes: 1, runImmediately: false }, task, jobId);

  scheduler.addSimpleIntervalJob(job);

  // Ajouter une fonction pour supprimer le job quand il est terminé
  setTimeout(() => {
    try {
      console.log(`[MessageMonitoring] Suppression planifiée du job ${jobId} après exécution`);
      scheduler.removeById(jobId);
      console.log(`[MessageMonitoring] Job ${jobId} supprimé avec succès`);
    } catch (error) {
      // Le job a peut-être déjà été supprimé, pas de problème
      console.log(`[MessageMonitoring] Le job ${jobId} a déjà été supprimé ou n'existe pas`);
    }
  }, delayInMs + 5000); // +5 secondes pour s'assurer que le job a eu le temps de s'exécuter
}

/**
 * Arrête la surveillance d'un message spécifique
 * @param {string} messageId - ID du message à arrêter de surveiller
 */
export function stopMonitoring(messageId) {
  if (pendingResponses.has(messageId)) {
    console.log(`[MessageMonitoring] Arrêt de la surveillance du message ${messageId}`);
    pendingResponses.delete(messageId);
    try {
      const jobId = `job-message-${messageId}`;
      scheduler.removeById(jobId);
      console.log(`[MessageMonitoring] Job ${jobId} supprimé avec succès`);
    } catch (error) {
      // Le job a peut-être déjà été supprimé, pas de problème
      console.log(`[MessageMonitoring] Le job pour le message ${messageId} a déjà été supprimé ou n'existe pas`);
    }
  } else {
    console.log(`[MessageMonitoring] Aucune surveillance en cours pour le message ${messageId}`);
  }
}

/**
 * Arrête tous les jobs de surveillance
 */
export function shutdown() {
  console.log(`[MessageMonitoring] Arrêt du service de surveillance - ${pendingResponses.size} messages en attente seront abandonnés`);
  scheduler.stop();
  pendingResponses.clear();
  console.log('[MessageMonitoring] Service de surveillance arrêté avec succès');
}

/**
 * Crée une tâche planifiée pour une conversation pertinente
 * @param {Object} client - Client Discord
 * @param {string} channelId - ID du canal
 * @param {string} guildId - ID de la guilde (optionnel)
 * @param {number} relevanceScore - Score de pertinence de la conversation
 * @param {string} topicSummary - Résumé du sujet de conversation
 * @returns {Promise<boolean>} - Succès de la création de tâche
 */
async function createScheduledTask(client, channelId, guildId, relevanceScore, topicSummary) {
  try {
    console.log(`[MessageMonitoring] Tentative de création de tâche planifiée - Canal: ${channelId}, Serveur: ${guildId || 'DM'}, Score: ${relevanceScore.toFixed(2)}, Sujet: "${topicSummary}"`); 

    // Ne créer une tâche que si le score de pertinence est suffisant
    if (relevanceScore < 0.7) {
      console.log(`[MessageMonitoring] Score de pertinence insuffisant (${relevanceScore.toFixed(2)}) pour créer une tâche planifiée pour la conversation dans ${channelId}`);
      return false;
    }

    // Générer un identifiant unique pour cette tâche
    const taskId = `conversation-task-${randomUUID().substring(0, 8)}`;
    console.log(`[MessageMonitoring] Création d'une nouvelle tâche: ${taskId}`);

    // Utiliser un délai fixe de 1 minute pour être cohérent avec les autres analyses
    const delayInMinutes = 1;
    const scheduledTime = new Date(Date.now() + delayInMinutes * 60 * 1000);

    // Enregistrer la tâche dans la base de données
    const savedTask = await taskService.saveTask(
      taskId, 
      0, 
      scheduledTime, 
      null, 
      'conversation', 
      {
        channelId,
        guildId: guildId || "",
        topicSummary
      }
    );

    console.log(`[MessageMonitoring] Nouvelle tâche de conversation (${taskId}) créée pour le canal ${channelId} dans 1 minute - Heure prévue: ${scheduledTime.toISOString()}`);
    console.log(`[MessageMonitoring] Détails de la tâche: ID BDD=${savedTask.id}, Sujet="${topicSummary}"`); 
    return true;
  } catch (error) {
    console.error('Erreur lors de la création d\'une tâche planifiée:', error);
    return false;
  }
}

export const messageMonitoringService = {
  monitorMessage,
  stopMonitoring,
  shutdown,
  createScheduledTask
};
