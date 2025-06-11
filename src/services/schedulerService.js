import { ToadScheduler, SimpleIntervalJob, AsyncTask } from 'toad-scheduler'
import { OpenAI } from 'openai/client.mjs'
import { format, addMinutes, getHours } from 'date-fns'
import dotenv from 'dotenv'
import { randomUUID } from 'crypto'
import { isGuildEnabled, isChannelTypeEnabled, isSchedulerEnabled, isAnalysisEnabled, isAutoRespondEnabled } from '../utils/configService.js'
import { analysisService } from './analysisService.js'
import { taskService } from './taskService.js'
import { messageTaskService } from './messageTaskService.js'
const { prisma } = await import('./prisma.js');

dotenv.config()

const scheduler = new ToadScheduler()
const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
})

const TIMEZONE = process.env.TIMEZONE || 'Europe/Paris'

export const CHANNEL_TYPES = {
  GUILD: 'guild',
  DM: 'dm',
  GROUP: 'group'
}

let previewedNextChannel = null

const MIN_DELAY = parseInt(process.env.MIN_DELAY_MINUTES || '10') * 60 * 1000
const MAX_DELAY = parseInt(process.env.MAX_DELAY_MINUTES || '120') * 60 * 1000

const activeTasks = new Map()

function formatDate (date, formatStr = 'HH:mm:ss dd/MM/yyyy') {
  try {
    // Vérifier que date est un objet Date valide
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) {
      console.warn(`formatDate: Date invalide fournie: ${date}`);
      return 'Date invalide';
    }
    return format(dateObj, formatStr);
  } catch (error) {
    console.error(`Erreur lors du formatage de la date ${date}:`, error);
    return 'Erreur de date';
  }
}

function getCurrentHour () {
  return getHours(new Date())
}

function generateRandomDelay () {
  return Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY
}

export function formatDelay (ms) {
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}


function selectRandomChannel(client, channelType = null) {
  const enabledTypes = [];

  if (isChannelTypeEnabled(CHANNEL_TYPES.GUILD)) enabledTypes.push(CHANNEL_TYPES.GUILD);
  if (isChannelTypeEnabled(CHANNEL_TYPES.DM)) enabledTypes.push(CHANNEL_TYPES.DM);
  if (isChannelTypeEnabled(CHANNEL_TYPES.GROUP)) enabledTypes.push(CHANNEL_TYPES.GROUP);

  if (enabledTypes.length === 0) {
    console.log('Aucun type de canal n\'est activé dans la configuration');
    return null;
  }

  if (channelType) {
    if (!isChannelTypeEnabled(channelType)) {
      console.log(`Le type de canal ${channelType} est désactivé dans la configuration`);
      return null;
    }
  } else {
    channelType = enabledTypes[Math.floor(Math.random() * enabledTypes.length)];
  }

  switch (channelType) {
    case CHANNEL_TYPES.GUILD:
      return selectRandomGuildChannel(client);
    case CHANNEL_TYPES.DM:
      return selectRandomDMChannel(client);
    case CHANNEL_TYPES.GROUP:
      return selectRandomGroupChannel(client);
    default:
      console.log(`Type de canal non reconnu: ${channelType}`);
      return null;
  }
}

/**
 * Sélectionne un canal aléatoire dans un serveur
 * @param {Object} client - Client Discord
 * @returns {Object|null} - Canal sélectionné ou null
 */
function selectRandomGuildChannel(client) {
  // Récupérer tous les serveurs avec lesquels le bot est présent
  const guilds = Array.from(client.guilds.cache.values())
    // Filtrer pour ne garder que les serveurs activés dans la configuration
    .filter(guild => isGuildEnabled(guild.id));

  if (guilds.length === 0) {
    console.log('Aucun serveur disponible ou activé dans la configuration');
    return null;
  }

  // Choisir un serveur aléatoire
  const randomGuild = guilds[Math.floor(Math.random() * guilds.length)];

  // Récupérer tous les canaux textuels du serveur
  const textChannels = Array.from(randomGuild.channels.cache.values())
    .filter(channel => channel.type === 'GUILD_TEXT' && channel.permissionsFor(client.user).has('SEND_MESSAGES'));

  if (textChannels.length === 0) {
    console.log(`Aucun canal textuel accessible dans ${randomGuild.name}`);
    return null;
  }

  // Choisir un canal aléatoire
  const selectedChannel = textChannels[Math.floor(Math.random() * textChannels.length)];
  // Ajouter des métadonnées au canal pour les statistiques
  selectedChannel.channelInfo = {
    type: CHANNEL_TYPES.GUILD,
    name: selectedChannel.name,
    guildName: randomGuild.name,
    guildId: randomGuild.id
  };

  return selectedChannel;
}

/**
 * Sélectionne un canal de message privé aléatoire
 * @param {Object} client - Client Discord
 * @returns {Object|null} - Canal MP sélectionné ou null
 */
function selectRandomDMChannel(client) {
  // Récupérer tous les canaux de MPs
  const dmChannels = Array.from(client.channels.cache.values())
    .filter(channel => channel.type === 'DM' && !channel.recipient.bot);

  if (dmChannels.length === 0) {
    console.log('Aucun canal de message privé disponible');
    return null;
  }

  // Choisir un canal MP aléatoire
  const selectedChannel = dmChannels[Math.floor(Math.random() * dmChannels.length)];
  // Ajouter des métadonnées au canal pour les statistiques
  selectedChannel.channelInfo = {
    type: CHANNEL_TYPES.DM,
    name: `Message privé avec ${selectedChannel.recipient.username}`,
    userId: selectedChannel.recipient.id,
    username: selectedChannel.recipient.username
  };

  return selectedChannel;
}

/**
 * Sélectionne un canal de groupe aléatoire
 * @param {Object} client - Client Discord
 * @returns {Object|null} - Canal de groupe sélectionné ou null
 */
function selectRandomGroupChannel(client) {
  // Récupérer tous les canaux de groupe
  const groupChannels = Array.from(client.channels.cache.values())
    .filter(channel => channel.type === 'GROUP_DM');

  if (groupChannels.length === 0) {
    console.log('Aucun canal de groupe disponible');
    return null;
  }

  // Choisir un canal de groupe aléatoire
  const selectedChannel = groupChannels[Math.floor(Math.random() * groupChannels.length)];
  // Ajouter des métadonnées au canal pour les statistiques
  selectedChannel.channelInfo = {
    type: CHANNEL_TYPES.GROUP,
    name: selectedChannel.name || 'Groupe privé',
    memberCount: selectedChannel.recipients?.length || 0
  };

  return selectedChannel;
}

/**
 * Sélectionne un utilisateur aléatoire dans un canal
 * @param {Object} channel - Canal Discord
 * @param {Object} client - Client Discord
 * @returns {Object|null} - Utilisateur sélectionné ou null
 */
async function selectRandomUser (channel, client) {
  try {
    // Récupérer les membres du canal
    const members = Array.from((await channel.guild.members.fetch()).values())
      .filter(member => !member.user.bot && member.id !== client.user.id)

    if (members.length === 0) {
      console.log(`Aucun utilisateur disponible dans ${channel.name}`)
      return null
    }

    // Choisir un membre aléatoire
    return members[Math.floor(Math.random() * members.length)]
  } catch (error) {
    console.error('Erreur lors de la sélection d\'un utilisateur:', error)
    return null
  }
}

/**
 * Vérifie si l'heure actuelle est dans la plage horaire active (8h-23h par défaut)
 * @param {number} startHour - Heure de début (défaut: 8)
 * @param {number} endHour - Heure de fin (défaut: 23)
 * @returns {boolean} - true si dans la plage active
 */
function isActiveHour (startHour = 8, endHour = 23) {
  const currentHour = getCurrentHour()
  return currentHour >= startHour && currentHour < endHour
}

/**
 * Initialise le planificateur de tâches
 * @param {Object} client - Client Discord
 */
export async function initScheduler (client) {
  console.log('[Scheduler] Initialisation du planificateur de tâches...')
  // Vérifier si les messages automatiques sont activés
  if (!(await isSchedulerEnabled()) || process.env.ENABLE_AUTO_MESSAGES !== 'true') {
    console.log('[Scheduler] Les messages automatiques sont désactivés - Planificateur non initialisé')
    return
  }

  // Nettoyer les tâches existantes
  stopScheduler()

  const currentTime = formatDate(new Date(), 'HH:mm:ss')
  console.log(`Planificateur initialisé à ${currentTime} avec le fuseau horaire système (${TIMEZONE} configuré)`)
  console.log(`Configuration: délai: ${formatDelay(MIN_DELAY)}-${formatDelay(MAX_DELAY)}`)

  try {
    let dbAccessible;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbAccessible = true;
    } catch (dbError) {
      console.error('Erreur d\'accès à la base de données:', dbError.message);
      dbAccessible = false;
    }

    if (!dbAccessible) {
      console.warn('Impossible de créer des tâches planifiées - pas d\'accès à la base de données');
      return;
    }

    // Supprimer les tâches expirées dans la base de données
    await cleanupExpiredTasks();

    // Supprimer les anciennes tâches de type random-question-task qui n'existent plus
    try {
      const deletedCount = await taskService.deleteTasksByType('random-question-task');
      if (deletedCount > 0) {
        console.log(`[Scheduler] ${deletedCount} anciennes tâches de questions aléatoires supprimées`);
      }
    } catch (deleteError) {
      console.error('[Scheduler] Erreur lors de la suppression des anciennes tâches:', deleteError);
    }

    // Restaurer les tâches non expirées
    await restorePendingTasks(client);

    // Créer uniquement une tâche d'analyse
    console.log('Ajout d\'une tâche d\'analyse de conversation...');
    await createAnalysisTask(client, 1);

    console.log('Initialisation du planificateur terminée. Les tâches de message seront créées par le service d\'analyse si nécessaire.');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du planificateur:', error);
  }
}

/**
 * Crée une tâche planifiée avec un délai aléatoire
 * @param {Object} client - Client Discord
 * @param {number} taskNumber - Numéro de la tâche (pour identification)
 */
/**
 * Crée une tâche d'analyse et de réponse aux conversations récentes
 * @param {Object} client - Client Discord
 * @param {number} taskNumber - Numéro de la tâche
 */
async function createAnalysisTask(client, taskNumber) {
  // Générer un identifiant unique pour cette tâche
  const taskId = `analysis-task-${taskNumber}-${randomUUID().substring(0, 8)}`;

  // Créer la tâche asynchrone
  const task = new AsyncTask(
    taskId,
    async () => {
      try {
        console.log('[Scheduler] Exécution de la tâche d\'analyse de conversation');

        // Traiter les tâches intermédiaires (analyse des messages capturés)
        const processedTasks = await messageTaskService.processIntermediateTasks();
        console.log(`[Scheduler] ${processedTasks} tâches intermédiaires traitées`);

        // Exécuter les tâches de réponse
        const executedTasks = await messageTaskService.executeResponseTasks(client);
        console.log(`[Scheduler] ${executedTasks} tâches de réponse exécutées`);
        // Vérifier si l'analyse est activée
        const analysisEnabled = await isAnalysisEnabled();
        const autoRespondEnabled = await isAutoRespondEnabled();

        console.log(`[Scheduler] Configuration - Analyse: ${analysisEnabled ? 'activée' : 'désactivée'}, Réponse auto: ${autoRespondEnabled ? 'activée' : 'désactivée'}`);

        if (!analysisEnabled) {
          console.log('[Scheduler] Tâche d\'analyse ignorée - L\'analyse est désactivée');
          return;
        }

        // Vérifier si nous sommes dans les heures actives
        if (!isActiveHour()) {
          const currentTime = formatDate(new Date(), 'HH:mm');
          console.log(`[Scheduler] Tâche d'analyse ignorée - Hors des heures actives (${currentTime})`);
          return;
        }

        console.log('[Scheduler] Tâche d\'analyse en cours d\'exécution - Dans les heures actives');

        // Récupérer aussi les tâches de conversation planifiées
        const pendingTasks = await taskService.getTasksByType('conversation');
        if (pendingTasks && pendingTasks.length > 0) {
          console.log(`Traitement de ${pendingTasks.length} tâches de conversation planifiées...`);

          for (const task of pendingTasks) {
            if (task.data && task.data.channelId) {
              try {
                const channel = await client.channels.fetch(task.data.channelId).catch(() => null);

                if (channel) {
                  // Générer une réponse ou une question basée sur le sujet stocké
                  const topicSummary = task.data.topicSummary || 'conversation en cours';
                  const shouldAskQuestion = Math.random() > 0.5; // 50% de chance de poser une question

                  let messageContent;
                  if (shouldAskQuestion) {
                    // Récupérer les messages récents pour le contexte
                    const recentMessages = await conversationService.getRecentMessages(
                      task.data.channelId, 
                      task.data.guildId || null,
                      10
                    );

                    // Générer une question sur le sujet
                    messageContent = await generateFollowUpQuestion(recentMessages, topicSummary);
                  } else {
                    // Générer un commentaire sur le sujet
                    messageContent = await generateTopicComment([], topicSummary);
                  }

                  // Vérifier si le message a du contenu
                  if (messageContent && messageContent.trim() !== '') {
                    // Simuler l'écriture
                    await channel.sendTyping().catch(console.error);

                    // Délai calculé en fonction de la longueur du message
                    const typingDelay = messageContent.length * 30 + Math.floor(Math.random() * 2000);
                    await new Promise(resolve => setTimeout(resolve, typingDelay));

                    // Envoyer le message
                    await channel.send(messageContent);

                    console.log(`Message de suivi envoyé dans ${task.data.channelId} sur le sujet: ${topicSummary}`);
                  }
                }

                // Supprimer la tâche une fois traitée
                await taskService.deleteTask(task.schedulerId);

              } catch (taskError) {
                console.error(`Erreur lors du traitement de la tâche de conversation ${task.schedulerId}:`, taskError);
                // Supprimer la tâche en cas d'erreur pour éviter les tentatives répétées
                await taskService.deleteTask(task.schedulerId);
              }
            }
          }
        }

        // Récupérer les conversations récemment actives
        const recentConversations = await prisma.conversation.findMany({
          where: {
            updatedAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Dernières 24 heures
            }
          },
          orderBy: {
            updatedAt: 'desc'
          },
          take: 5,
          include: {
            messages: {
              orderBy: {
                createdAt: 'desc'
              },
              take: 20
            }
          }
        });

        if (recentConversations.length === 0) {
          console.log('Aucune conversation récente à analyser');
          return;
        }

        // Sélectionner une conversation au hasard parmi les récentes
        const randomIndex = Math.floor(Math.random() * recentConversations.length);
        const selectedConversation = recentConversations[randomIndex];

        // Analyser la pertinence de la conversation
        const analysis = await analysisService.analyzeConversationRelevance(selectedConversation.messages);

        // Mettre à jour le score de pertinence de la conversation
        await prisma.conversation.update({
          where: { id: selectedConversation.id },
          data: {
            relevanceScore: analysis.relevanceScore,
            topicSummary: analysis.topicSummary,
            updatedAt: new Date()
          }
        });

        // Si la réponse automatique est activée et que la conversation est pertinente
        if (autoRespondEnabled && analysis.relevanceScore >= 0.6) {
          // Trouver le canal correspondant
          const channel = await client.channels.fetch(selectedConversation.channelId).catch(() => null);

          if (channel) {
            // Générer une réponse ou une question basée sur le sujet
            const shouldAskQuestion = Math.random() > 0.5; // 50% de chance de poser une question

            let messageContent;
            if (shouldAskQuestion) {
              // Générer une question sur le sujet
              const question = await generateFollowUpQuestion(selectedConversation.messages, analysis.topicSummary);
              messageContent = question;
            } else {
              // Générer un commentaire sur le sujet
              const comment = await generateTopicComment(selectedConversation.messages, analysis.topicSummary);
              messageContent = comment;
            }

            // Vérifier si le message a du contenu
            if (messageContent && messageContent.trim() !== '') {
              // Délai aléatoire pour sembler plus naturel
              await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 3000) + 1000));

              // Simuler l'écriture
              await channel.sendTyping().catch(console.error);

              // Délai calculé en fonction de la longueur du message
              const typingDelay = messageContent.length * 30 + Math.floor(Math.random() * 2000);
              await new Promise(resolve => setTimeout(resolve, typingDelay));

              // Envoyer le message
              await channel.send(messageContent);

              console.log(`Message automatique envoyé dans ${selectedConversation.channelId} sur le sujet: ${analysis.topicSummary}`);
            }
          }
        }

        console.log(`Conversation ${selectedConversation.id} analysée, score: ${analysis.relevanceScore}, sujet: ${analysis.topicSummary}`);
      } catch (error) {
        console.error('Erreur lors de l\'exécution de la tâche d\'analyse:', error);
      }
    },
    (err) => {
      console.error('Erreur dans la tâche d\'analyse:', err);
    }
  );

  // Générer un délai aléatoire plus long pour l'analyse (30-60 minutes)
  const analysisDelay = 30 * 60 * 1000 + Math.floor(Math.random() * 30 * 60 * 1000);
  const nextExecutionTime = addMinutes(new Date(), Math.floor(analysisDelay / 60000));

  console.log(`[Tâche d'analyse ${taskNumber}] Planifiée pour ${formatDate(nextExecutionTime, 'HH:mm:ss')}`);

  // Créer un job pour l'analyse
  const job = new SimpleIntervalJob(
    { milliseconds: analysisDelay, runImmediately: false },
    task,
    taskId
  );

  // Ajouter le job au planificateur
  scheduler.addSimpleIntervalJob(job);

  // Enregistrer la tâche dans la base de données
  try {
    await taskService.saveTask(taskId, taskNumber, nextExecutionTime, null, 'analysis');
  } catch (error) {
    console.warn(`Erreur lors de l'enregistrement de la tâche d'analyse ${taskId}:`, error.message);
  }
}

/**
 * Génère une question de suivi basée sur la conversation
 * @param {Array} messages - Messages de la conversation
 * @param {string} topicSummary - Résumé du sujet
 * @returns {Promise<string>} - Question générée
 */
async function generateFollowUpQuestion(messages, topicSummary) {
  try {
    const systemInstructions = `Tu es un assistant Discord amical et curieux. Génère une question de suivi naturelle et engageante basée sur la conversation récente.

La question doit:
- Être liée au sujet principal: "${topicSummary}"
- Sembler naturelle dans le flux de la conversation
- Encourager plus de discussion
- Être courte et directe (max 1-2 phrases)
- Éviter d'être trop formelle ou académique

Ne pas inclure d'introduction comme "Alors," ou "Au fait,". Donne simplement la question.`;

    // Préparer les derniers messages comme contexte
    const recentMessages = messages.slice(-10).map(msg => `${msg.userName}: ${msg.content}`).join('\n');

    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: `Conversation récente:\n${recentMessages}\n\nSujet principal: ${topicSummary}`,
      instructions: systemInstructions,
    });

    return response.output_text || 'Qu\'en pensez-vous?';
  } catch (error) {
    console.error('Erreur lors de la génération de question de suivi:', error);
    return 'Des réflexions sur ce sujet?';
  }
}

/**
 * Génère un commentaire sur le sujet de la conversation
 * @param {Array} messages - Messages de la conversation
 * @param {string} topicSummary - Résumé du sujet
 * @returns {Promise<string>} - Commentaire généré
 */
async function generateTopicComment(messages, topicSummary) {
  try {
    const systemInstructions = `Tu es un assistant Discord amical et attentionné. Génère un commentaire naturel et pertinent basé sur la conversation récente.

Le commentaire doit:
- Être lié au sujet principal: "${topicSummary}"
- Ajouter de la valeur à la conversation
- Sembler naturel et conversationnel
- Être court et direct (1-2 phrases)
- Éviter d'être trop formel ou académique

Ne pas inclure d'introduction comme "Je pense que" ou "À mon avis". Donne simplement le commentaire direct.`;

    // Préparer les derniers messages comme contexte
    const recentMessages = messages.slice(-10).map(msg => `${msg.userName}: ${msg.content}`).join('\n');

    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: `Conversation récente:\n${recentMessages}\n\nSujet principal: ${topicSummary}`,
      instructions: systemInstructions,
    });

    return response.output_text || 'Intéressant.';
  } catch (error) {
    console.error('Erreur lors de la génération de commentaire:', error);
    return 'Très intéressant.';
  }
}


/**
 * Prévisualise le prochain canal qui sera utilisé pour envoyer un message
 * @param {Object} client - Client Discord
 * @returns {Object|null} - Information sur le canal prévisualisé
 */
export function getNextChannel(client) {
  try {
    // Si nous avons déjà une prévisualisation et qu'elle est récente (< 5 minutes), la réutiliser
    if (previewedNextChannel && (new Date() - previewedNextChannel.timestamp) < 300000) {
      return previewedNextChannel.info;
    }

    // Sinon, sélectionner un nouveau canal aléatoire
    const channelType = process.env.TARGET_CHANNEL_TYPE || null;
    const channel = selectRandomChannel(client, channelType);

    if (!channel) {
      return null;
    }

    // Stocker l'information et l'horodatage
    previewedNextChannel = {
      timestamp: new Date(),
      info: {
        ...channel.channelInfo,
        preview: true
      }
    };

    return previewedNextChannel.info;
  } catch (error) {
    console.error('Erreur lors de la prévisualisation du canal:', error);
    return null;
  }
}

/**
 * Récupère la configuration complète des canaux
 * @returns {Object} - Configuration des canaux
 */
export function getChannelConfig() {
  return {
    channelTypes: {
      guild: isChannelTypeEnabled(CHANNEL_TYPES.GUILD),
      dm: isChannelTypeEnabled(CHANNEL_TYPES.DM),
      group: isChannelTypeEnabled(CHANNEL_TYPES.GROUP)
    }
  };
}

/**
 * Récupère l'état actuel du planificateur
 * @returns {Object} - État du planificateur
 */
export function getSchedulerStatus () {
  const now = new Date()
  const tasks = []
  let nextTask = null
  let minTimeLeft = Infinity

  for (const [taskId, taskInfo] of activeTasks.entries()) {
    const timeUntilExecution = taskInfo.nextExecution - now
    const formattedTimeLeft = formatDelay(timeUntilExecution > 0 ? timeUntilExecution : 0)
    const shortId = taskId.split('-').pop() // Prendre juste la dernière partie de l'ID

    const taskData = {
      id: shortId,
      taskId: taskId,
      number: taskInfo.taskNumber,
      nextExecution: formatDate(taskInfo.nextExecution, 'HH:mm:ss'),
      nextExecutionFull: formatDate(taskInfo.nextExecution, 'HH:mm:ss dd/MM/yyyy'),
      timeLeft: formattedTimeLeft,
      timeLeftMs: timeUntilExecution > 0 ? timeUntilExecution : 0,
      targetChannelType: taskInfo.targetChannelType || 'aléatoire',
      targetChannel: taskInfo.targetChannel || null,
      targetUser: taskInfo.targetUser || null
    }

    tasks.push(taskData)

    // Trouver la tâche qui s'exécutera en premier
    if (timeUntilExecution > 0 && timeUntilExecution < minTimeLeft) {
      minTimeLeft = timeUntilExecution
      nextTask = taskData
    }
  }

  // Trier les tâches par temps restant
  tasks.sort((a, b) => a.timeLeftMs - b.timeLeftMs)

  const isInActiveHours = isActiveHour()
  const currentHour = getCurrentHour()

  return {
    active: activeTasks.size > 0,
    taskCount: activeTasks.size,
    currentTime: formatDate(now, 'HH:mm:ss'),
    timezone: TIMEZONE,
    inActiveHours: isInActiveHours,
    currentHour: currentHour,
    nextTask: nextTask,
    nextChannel: previewedNextChannel ? previewedNextChannel.info : null,
    config: {
      minDelay: formatDelay(MIN_DELAY),
      maxDelay: formatDelay(MAX_DELAY),
      activeHours: '8h-23h' // À personnaliser si vous changez isActiveHour
    },
    tasks: tasks
  }
}

/**
 * Arrête le planificateur de tâches
 */
/**
  * Modifie le type de canal cible d'une tâche spécifique
  * @param {number} taskNumber - Numéro de la tâche à modifier
  * @param {string} channelType - Nouveau type de canal
  * @returns {boolean} - true si la modification a réussi
  */
 export function setTaskChannelType(taskNumber, channelType) {
   // Vérifier si le type de canal est valide ou null (aléatoire)
   if (channelType !== null && !Object.values(CHANNEL_TYPES).includes(channelType)) {
     return false;
   }

   // Rechercher la tâche
   for (const [taskId, taskInfo] of activeTasks.entries()) {
     if (taskInfo.taskNumber === taskNumber) {
       // Mettre à jour le type de canal
       taskInfo.targetChannelType = channelType;
       activeTasks.set(taskId, taskInfo);
       return true;
     }
   }

   return false;
 }

 /**
 * Récupère une tâche spécifique par son numéro
 * @param {number} taskNumber - Numéro de la tâche à récupérer
 * @returns {Object|null} - La tâche ou null si non trouvée
 */
/**
 * Obtient les statistiques de ciblage pour les canaux et utilisateurs
 * @returns {Object} Statistiques détaillées
 */
export function getTargetingStats() {
  // Initialiser les compteurs
  const stats = {
    channels: {
      guild: { count: 0, names: {} },
      dm: { count: 0, names: {} },
      group: { count: 0, names: {} },
      pending: 0
    },
    users: {
      count: 0,
      names: {}
    },
    guilds: {
      count: 0,
      names: {}
    }
  };

  // Parcourir toutes les tâches actives
  for (const [taskId, taskInfo] of activeTasks.entries()) {
    if (taskInfo.targetChannel) {
      const channelType = taskInfo.targetChannel.type;

      // Compter par type de canal
      if (stats.channels[channelType]) {
        stats.channels[channelType].count++;

        // Compter les occurrences de chaque nom de canal
        const channelName = taskInfo.targetChannel.name || 'Sans nom';
        stats.channels[channelType].names[channelName] =
          (stats.channels[channelType].names[channelName] || 0) + 1;

        // Pour les canaux de serveur, compter aussi les serveurs
        if (channelType === 'guild' && taskInfo.targetChannel.guildName) {
          stats.guilds.count++;
          stats.guilds.names[taskInfo.targetChannel.guildName] =
            (stats.guilds.names[taskInfo.targetChannel.guildName] || 0) + 1;
        }
      }

      // Compter les utilisateurs ciblés
      if (taskInfo.targetUser) {
        stats.users.count++;
        const username = taskInfo.targetUser.username || 'Inconnu';
        stats.users.names[username] = (stats.users.names[username] || 0) + 1;
      }
    } else {
      stats.channels.pending++;
    }
  }

  return stats;
}

export function getTaskByNumber (taskNumber) {
  for (const [taskId, taskInfo] of activeTasks.entries()) {
    if (taskInfo.taskNumber === taskNumber) {
      const now = new Date()
      const timeUntilExecution = taskInfo.nextExecution - now

      return {
        id: taskId,
        number: taskInfo.taskNumber,
        nextExecution: formatDate(taskInfo.nextExecution, 'HH:mm:ss'),
        nextExecutionFull: formatDate(taskInfo.nextExecution, 'HH:mm:ss dd/MM/yyyy'),
        timeLeft: formatDelay(timeUntilExecution > 0 ? timeUntilExecution : 0),
        timeLeftMs: timeUntilExecution > 0 ? timeUntilExecution : 0
      }
    }
  }

  return null
}

/**
 * Définit le type de canal cible par défaut pour les nouvelles tâches
 * @param {string} channelType - Type de canal (guild, dm, group)
 */
export function setDefaultChannelType(channelType) {
  // Vérifier si le type de canal est valide
  if (!Object.values(CHANNEL_TYPES).includes(channelType)) {
    throw new Error(`Type de canal non valide: ${channelType}. Utilisez: ${Object.values(CHANNEL_TYPES).join(', ')}`);
  }

  process.env.TARGET_CHANNEL_TYPE = channelType;
  console.log(`Type de canal cible par défaut défini sur: ${channelType}`);
}

export function stopScheduler () {
  // Supprimer chaque tâche individuellement
  for (const [taskId, taskInfo] of activeTasks.entries()) {
    try {
      scheduler.removeById(taskId)
    } catch (e) {
      // Ignorer si la tâche n'existe pas
    }
  }

  // Vider le registre des tâches
  activeTasks.clear()

  // Arrêter complètement le planificateur pour être sûr
  scheduler.stop()
  console.log('Planificateur de tâches arrêté - toutes les tâches ont été supprimées')
}

/**
 * Nettoie les tâches expirées dans la base de données
 * @returns {Promise<void>}
 */
async function cleanupExpiredTasks() {
  try {
    const now = new Date();
    const result = await prisma.task.deleteMany({
      where: {
        type: 'scheduler',
        nextExecution: {
          lt: now // Supprime les tâches dont la date d'exécution est passée
        }
      }
    });

    console.log(`${result.count} tâches expirées supprimées de la base de données`);
  } catch (error) {
    console.error('Erreur lors du nettoyage des tâches expirées:', error);
  }
}

/**
 * Restaure les tâches non expirées depuis la base de données
 * @param {Object} client - Client Discord
 * @returns {Promise<void>}
 */
async function restorePendingTasks(client) {
  try {
    const now = new Date();

    // Récupérer toutes les tâches non expirées
    const pendingTasks = await prisma.task.findMany({
      where: {
        type: 'scheduler',
        nextExecution: {
          gte: now // Seulement les tâches dont la date d'exécution est future
        }
      }
    });

    if (pendingTasks.length === 0) {
      console.log('Aucune tâche en attente à restaurer');
      return;
    }

    console.log(`Restauration de ${pendingTasks.length} tâches en attente...`);

    for (const task of pendingTasks) {
      try {
        // Recréer la tâche dans le planificateur en fonction de son type
        if (task.schedulerId.includes('analysis-task')) {
          // Recréer la tâche d'analyse
          await createAnalysisTask(client, task.taskNumber || 1);
        } else if (task.schedulerId.includes('conversation-task')) {
          // Les tâches de conversation sont gérées par messageMonitoringService
          console.log(`Tâche de conversation ${task.schedulerId} restaurée, sera traitée par l'analyseur`);
        }
      } catch (taskError) {
        console.error(`Erreur lors de la restauration de la tâche ${task.schedulerId}:`, taskError);
      }
    }

    console.log('Restauration des tâches terminée');
  } catch (error) {
    console.error('Erreur lors de la restauration des tâches en attente:', error);
  }
}

