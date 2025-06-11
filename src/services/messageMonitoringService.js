/**
 * Service de surveillance des messages pour analyser la pertinence et répondre plus tard si nécessaire
 */
import { messageEvaluator } from '../utils/messageEvaluator.js';
import { ToadScheduler, SimpleIntervalJob, AsyncTask } from 'toad-scheduler';
import { format } from 'date-fns';

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

  // Vérifier si le message est déjà en attente d'analyse
  if (pendingResponses.has(messageId)) return;

  // Planifier l'analyse du message pour dans 1-2 minutes
  const delayInMinutes = Math.random() * 1 + 1; // Entre 1 et 2 minutes
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

  console.log(`Message ${messageId} planifié pour analyse à ${format(scheduledTime, 'HH:mm:ss')}`);

  // Créer une tâche pour analyser et potentiellement répondre plus tard
  const task = new AsyncTask(
    `analyze-message-${messageId}`,
    async () => {
      try {
        // Vérifier si le message est toujours pertinent
        if (!pendingResponses.has(messageId)) return;

        const messageInfo = pendingResponses.get(messageId);

        // Évaluer si le message mérite une réponse maintenant
        const evaluationResult = await messageEvaluator.evaluateMessageRelevance(
          channelId,
          guildId,
          messageInfo.content
        );

        // Si le message est suffisamment pertinent, y répondre
        if (evaluationResult.shouldRespond) {
          console.log(`Réponse différée au message ${messageId} (score: ${evaluationResult.relevanceScore})`);

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

  // Exécuter la tâche une seule fois après le délai
  const jobId = `job-message-${messageId}`;
  const job = new SimpleIntervalJob({ minutes: delayInMinutes, runImmediately: false }, task, jobId);

  scheduler.addSimpleIntervalJob(job);

  // Ajouter une fonction pour supprimer le job quand il est terminé
  setTimeout(() => {
    try {
      scheduler.removeById(jobId);
    } catch (error) {
      // Le job a peut-être déjà été supprimé, pas de problème
    }
  }, delayInMs + 5000); // +5 secondes pour s'assurer que le job a eu le temps de s'exécuter
}

/**
 * Arrête la surveillance d'un message spécifique
 * @param {string} messageId - ID du message à arrêter de surveiller
 */
export function stopMonitoring(messageId) {
  if (pendingResponses.has(messageId)) {
    pendingResponses.delete(messageId);
    try {
      scheduler.removeById(`job-message-${messageId}`);
    } catch (error) {
      // Le job a peut-être déjà été supprimé, pas de problème
    }
  }
}

/**
 * Arrête tous les jobs de surveillance
 */
export function shutdown() {
  scheduler.stop();
  pendingResponses.clear();
}

export const messageMonitoringService = {
  monitorMessage,
  stopMonitoring,
  shutdown
};
