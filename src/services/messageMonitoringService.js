/**
 * Service de surveillance des messages pour analyser la pertinence et répondre plus tard si nécessaire
 */
import { messageEvaluator } from '../utils/messageEvaluator.js';
import { ToadScheduler, SimpleIntervalJob, AsyncTask } from 'toad-scheduler';
import { format } from 'date-fns';
import { taskService } from './taskService.js';
import { randomUUID } from 'crypto';
import { prisma } from './prisma.js';

// Système d'instructions pour le service de surveillance des messages
const systemPrompt = `
Règle CRUCIALE concernant les conversations entre utilisateurs :
Quand un utilisateur répond à un autre utilisateur (et non à toi), tu dois être EXTRÊMEMENT prudent dans ton niveau d'engagement.

RÈGLES D'ENGAGEMENT STRICTES:
1. N'interviens PAS dans les conversations entre utilisateurs sauf si tu es explicitement mentionné ou si une aide est clairement demandée.
2. Si la conversation semble privée ou si ton intervention n'est pas explicitement sollicitée, reste totalement en retrait.
3. Si tu dois répondre, utilise un ton neutre et concis, en te limitant strictement au sujet de la question posée.
4. Évite absolument de détourner le sujet de leur conversation ou de proposer des informations non demandées.
5. Privilégie l'absence de réponse en cas de doute sur la nécessité de ton intervention.

EXCEPTION IMPORTANTE:
Si un utilisateur parle de toi (Yassine) dans une conversation, même sans te mentionner directement, tu peux répondre poliment. C'est une exception à la règle générale de non-intervention.
ATTENTION: Tous les messages ne parlent pas nécessairement de toi. Vérifie le contexte pour déterminer si le message fait référence à toi (le bot) ou à une autre personne qui s'appellerait Yassine.

Tu es là pour assister uniquement quand on te le demande explicitement, pas pour t'insérer dans toutes les conversations.
`;

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

  // Vérifier si le bot a les permissions d'écriture dans ce canal
  if (message.channel && message.guild) {
    const botPermissions = message.channel.permissionsFor(client.user.id);
    if (!botPermissions || !botPermissions.has('SEND_MESSAGES')) {
      console.log(`[MessageMonitoring] Pas de permission d'écriture dans le canal ${channelId} - Surveillance annulée`);
      return;
    }
  }

  // Importer configService pour vérifier si le guild est activé
  const { isGuildEnabled, isSchedulerEnabled } = await import('../utils/configService.js');

  // Vérifier si le service de planification est activé
  if (!(await isSchedulerEnabled())) {
    console.log(`[MessageMonitoring] Le service de planification est désactivé - Message ${messageId} ignoré`);
    return;
  }

  // Vérifier si le guild est activé (pour les messages de serveur)
  if (guildId && !(await isGuildEnabled(guildId))) {
    console.log(`[MessageMonitoring] Le serveur ${guildId} est désactivé - Message ${messageId} ignoré`);
    return;
  }

  console.log(`[MessageMonitoring] Message ${messageId} ajouté pour analyse différée`);

  // Vérifier si le message est déjà en attente d'analyse
  if (pendingResponses.has(messageId)) {
    console.log(`[MessageMonitoring] Message ${messageId} déjà en attente d'analyse - ignoré`);
    return;
  }

  // Importer analysisService pour vérifier si un délai d'attente est actif
  const { analysisService } = await import('./analysisService.js');

  // Planifier l'analyse du message avec un délai entre 30 secondes et 3 minutes
  // ou plus si un délai d'attente est actif sur ce canal
  const MIN_DELAY_MS = 10 * 1000;  // 30 secondes en ms
  const MAX_DELAY_MS = 2 * 60 * 1000;  // 3 minutes en ms
  let delayInMs = Math.floor(MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));

  // Si un délai d'attente est actif, ajouter un délai supplémentaire
  if (analysisService.isWaitingForMoreMessages(channelId, guildId)) {
    console.log(`[MessageMonitoring] Un délai d'attente est déjà actif pour le canal ${channelId} - Ajout de délai supplémentaire`);
    delayInMs += 5000; // Ajouter 5 secondes pour s'assurer que les messages sont groupés
  } else {
    // Démarrer un nouveau délai d'attente pour ce canal
    analysisService.startMessageBatchDelay(channelId, guildId);
  }

  const scheduledTime = new Date(Date.now() + delayInMs);

  // Vérifier si la limite de tâches actives est atteinte
  const MAX_ACTIVE_TASKS = parseInt(process.env.MAX_ACTIVE_TASKS || '100', 10);
  if (pendingResponses.size >= MAX_ACTIVE_TASKS) {
    console.log(`[MessageMonitoring] Limite de tâches atteinte (${MAX_ACTIVE_TASKS}) - Message ${messageId} ignoré`);
    return;
  }

  // Vérifier si le message est une réponse entre utilisateurs
  let isReplyBetweenUsers = false;
  if (message.reference) {
    try {
      const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
      if (repliedMessage && repliedMessage.author.id !== client.user.id && repliedMessage.author.id !== message.author.id) {
        isReplyBetweenUsers = true;
        console.log(`[MessageMonitoring] Message ${messageId} identifié comme réponse entre utilisateurs`);
      }
    } catch (replyError) {
      console.error(`[MessageMonitoring] Erreur lors de la vérification du message référencé:`, replyError);
    }
  }

  // Enregistrer l'information sur le message en attente
  pendingResponses.set(messageId, {
    message,
    channelId,
    userId,
    guildId,
    scheduledTime,
    content: message.content,
    isReplyBetweenUsers
  });

  console.log(`Message ${messageId} planifié pour analyse dans ${(delayInMs / 60000).toFixed(1)} minutes à ${format(scheduledTime, 'HH:mm:ss')}`);

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

        // Initialiser le flag pour les réponses entre utilisateurs
        let isReplyBetweenUsers = false;

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

        // Vérifier si le service est toujours activé avant d'évaluer le message
        const { isGuildEnabled, isSchedulerEnabled, isAutoRespondEnabled } = await import('../utils/configService.js');

        // Vérifier si les services sont activés
        if (!(await isSchedulerEnabled())) {
          console.log(`[MessageMonitoring] Le service de planification est désactivé - Analyse annulée pour le message ${messageId}`);
          pendingResponses.delete(messageId);
          return;
        }

        if (guildId && !(await isGuildEnabled(guildId))) {
          console.log(`[MessageMonitoring] Le serveur ${guildId} est désactivé - Analyse annulée pour le message ${messageId}`);
          pendingResponses.delete(messageId);
          return;
        }

        if (!(await isAutoRespondEnabled())) {
          console.log(`[MessageMonitoring] La réponse automatique est désactivée - Analyse annulée pour le message ${messageId}`);
          pendingResponses.delete(messageId);
          return;
        }

        // Évaluer si le message mérite une réponse maintenant
        const evaluationResult = await messageEvaluator.evaluateMessageRelevance(
          channelId,
          guildId,
          messageInfo.content,
          isReplyBetweenUsers || false // Passer le flag pour indiquer si c'est une réponse entre utilisateurs
        );

        console.log(`[MessageMonitoring] Résultat d'évaluation - ID: ${messageId}, Score: ${evaluationResult.relevanceScore.toFixed(2)}, InfoClé: ${evaluationResult.hasKeyInfo}, Répondre: ${evaluationResult.shouldRespond}`);

        // Si le message est suffisamment pertinent, y répondre
        if (evaluationResult.shouldRespond) {
          console.log(`[MessageMonitoring] Réponse différée au message ${messageId} (score: ${evaluationResult.relevanceScore.toFixed(2)}) - Canal: ${channelId}, Serveur: ${guildId || 'DM'}`);

          // Marquer le canal comme étant en train d'écrire
          await message.channel.sendTyping().catch(console.error);

          // Vérifier si le message est une réponse à un autre utilisateur
          let additionalContext = '';
          isReplyBetweenUsers = messageInfo.isReplyBetweenUsers || false;
          if (message.reference) {
            try {
              const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
              if (repliedMessage) {
                // Vérifier si c'est une réponse entre utilisateurs (pas au bot)
                if (repliedMessage.author.id !== client.user.id && repliedMessage.author.id !== message.author.id) {
                  console.log(`[MessageMonitoring] Message ${messageId} est une réponse à un autre utilisateur - Utilisation des instructions spéciales`);
                  additionalContext = systemPrompt;
                  isReplyBetweenUsers = true;

                  // Pour les conversations entre utilisateurs, on vérifie quand même la pertinence
                  // mais on favorise la réponse si le score est suffisant
                  const { messageEvaluator } = await import('../utils/messageEvaluator.js');

                  // On vérifie d'abord avec shouldRespondImmediately pour les cas évidents
                  const shouldRespondImmediate = await messageEvaluator.shouldRespondImmediately(
                    messageInfo.content, false, false, false, true
                  );

                  // Si c'est un cas évident de non-réponse et que le score de pertinence est très faible, on annule
                  // Seuil abaissé pour permettre plus de réponses
                  if (!shouldRespondImmediate && evaluationResult.relevanceScore < 0.4) {
                    console.log(`[MessageMonitoring] Conversation entre utilisateurs avec score très faible (${evaluationResult.relevanceScore.toFixed(2)}) - Analyse annulée`);
                    pendingResponses.delete(messageId);
                    return;
                  }

                  console.log(`[MessageMonitoring] Conversation entre utilisateurs avec score pertinent (${evaluationResult.relevanceScore.toFixed(2)}) - Intervention jugée appropriée`);
                }
              }
            } catch (replyError) {
              console.error(`[MessageMonitoring] Erreur lors de la récupération du message référencé:`, replyError);
            }
          }

          // Construire et envoyer la réponse avec contexte additionnel si nécessaire
          const response = await buildResponseFn(messageInfo.content, message, additionalContext);
          if (response && response.trim() !== '' && response !== "' '' '") {
            await message.reply(response);
          } else {
            console.log(`[MessageMonitoring] Réponse vide ou invalide détectée, aucun message envoyé`);
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

  // Exécuter la tâche une seule fois après le délai calculé
  const jobId = `job-message-${messageId}`;
  // Convertir en millisecondes pour SimpleIntervalJob
  const job = new SimpleIntervalJob({ milliseconds: delayInMs, runImmediately: false }, task, jobId);

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

    // Vérifier si les services sont activés avant de créer une tâche
    const { isGuildEnabled, isSchedulerEnabled, isAutoRespondEnabled } = await import('../utils/configService.js');

    if (!(await isSchedulerEnabled())) {
      console.log(`[MessageMonitoring] Le service de planification est désactivé - Création de tâche annulée pour le canal ${channelId}`);
      return false;
    }

        // Vérifier le nombre de tâches actives et en attente
        const MAX_ACTIVE_TASKS = parseInt(process.env.MAX_ACTIVE_TASKS || '100', 10);
        const activeTasks = await prisma.task.count({
          where: {
            status: { in: ['active', 'pending'] }
          }
        });

        if (activeTasks >= MAX_ACTIVE_TASKS) {
          console.log(`[MessageMonitoring] Limite de tâches atteinte (${activeTasks}/${MAX_ACTIVE_TASKS}). La tâche pour le canal ${channelId} ne sera pas créée.`);
          return false;
        }

    if (guildId && !(await isGuildEnabled(guildId))) {
      console.log(`[MessageMonitoring] Le serveur ${guildId} est désactivé - Création de tâche annulée pour le canal ${channelId}`);
      return false;
    }

    if (!(await isAutoRespondEnabled())) {
      console.log(`[MessageMonitoring] La réponse automatique est désactivée - Création de tâche annulée pour le canal ${channelId}`);
      return false;
    }

    // Ne créer une tâche que si le score de pertinence est suffisant (seuil abaissé)
    if (relevanceScore < 0.4) {
      console.log(`[MessageMonitoring] Score de pertinence insuffisant (${relevanceScore.toFixed(2)}) pour créer une tâche planifiée pour la conversation dans ${channelId}`);
      return false;
    }

    // Générer un identifiant unique pour cette tâche
    const taskId = `conversation-task-${randomUUID().substring(0, 8)}`;
    console.log(`[MessageMonitoring] Création d'une nouvelle tâche: ${taskId}`);

    // Utiliser un délai aléatoire plus court (5 à 120 secondes)
    const MIN_DELAY_MS = 5 * 1000;  // 5 secondes en ms
    const MAX_DELAY_MS = 60 * 1000;  // 2 minutes en ms
    const delayInMs = Math.floor(MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
    const scheduledTime = new Date(Date.now() + delayInMs);

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

    console.log(`[MessageMonitoring] Nouvelle tâche de conversation (${taskId}) créée pour le canal ${channelId} dans ${(delayInMs / 60000).toFixed(1)} minutes - Heure prévue: ${scheduledTime.toISOString()}`);
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
