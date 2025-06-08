import { ToadScheduler, SimpleIntervalJob, AsyncTask } from 'toad-scheduler'
import { OpenAI } from 'openai/client.mjs'
import { convertAITextToDiscordMentions } from '../utils/mentionUtils.js'
import { format, addMinutes, getHours } from 'date-fns'
import dotenv from 'dotenv'
import { randomUUID } from 'crypto'
import { isGuildEnabled, isChannelTypeEnabled, getSchedulerConfig } from '../utils/configManager.js'

dotenv.config()

const scheduler = new ToadScheduler()
const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
})

// Fuseau horaire par défaut: Europe/Paris
const TIMEZONE = process.env.TIMEZONE || 'Europe/Paris'

// Types de canaux disponibles pour les tâches planifiées
export const CHANNEL_TYPES = {
  GUILD: 'guild',        // Salons de serveur
  DM: 'dm',              // Messages privés
  GROUP: 'group'         // Groupes privés
}

// Stockage du canal prévisualisé pour la prochaine exécution
let previewedNextChannel = null

// Configuration des tâches planifiées
const MIN_DELAY = parseInt(process.env.MIN_DELAY_MINUTES || '10') * 60 * 1000 // 10 minutes par défaut
const MAX_DELAY = parseInt(process.env.MAX_DELAY_MINUTES || '120') * 60 * 1000 // 2 heures par défaut
const MIN_TASKS = parseInt(process.env.MIN_TASKS || '1') // Au moins 1 tâche par défaut
const MAX_TASKS = parseInt(process.env.MAX_TASKS || '3') // Maximum 3 tâches par défaut

// Registre des tâches actives
const activeTasks = new Map()

/**
 * Formate une date avec le format spécifié
 * @param {Date} date - Date à formater
 * @param {string} formatStr - Format de date souhaité
 * @returns {string} - Date formatée
 */
function formatDate (date, formatStr = 'HH:mm:ss dd/MM/yyyy') {
  return format(date, formatStr)
}

/**
 * Obtient l'heure locale actuelle
 * @returns {number} - Heure locale (0-23)
 */
function getCurrentHour () {
  return getHours(new Date())
}

/**
 * Génère un délai aléatoire entre min et max
 * @returns {number} - Délai en millisecondes
 */
function generateRandomDelay () {
  return Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY
}

/**
 * Génère un nombre aléatoire de tâches entre MIN_TASKS et MAX_TASKS
 * @returns {number} - Nombre de tâches à créer
 */
function getRandomTaskCount () {
  return Math.floor(Math.random() * (MAX_TASKS - MIN_TASKS + 1)) + MIN_TASKS
}

/**
 * Convertit les millisecondes en format lisible
 * @param {number} ms - Millisecondes
 * @returns {string} - Format lisible (ex: "1h 30m")
 */
export function formatDelay (ms) {
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

// Système d'instructions pour générer des questions
const questionSystemInstructions = `Génère une seule question intéressante, originale, amusante ou provocante (mais jamais offensive) pour animer une conversation entre amis sur Discord. 
La question doit être courte (maximum 50 mots) et facilement compréhensible.
Ne pas utiliser de formules d'introduction comme "Voici une question:" ou "Question du jour:", donne simplement la question directement.`

/**
 * Génère une question aléatoire en utilisant l'API OpenAI
 * @returns {Promise<string>} La question générée
 */
async function generateRandomQuestion () {
  try {
    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: 'Génère une question pour animer une conversation',
      instructions: questionSystemInstructions,
    })

    return response.output_text || 'Qu\'est-ce que vous pensez de cette journée ?'
  } catch (error) {
    console.error('Erreur lors de la génération de question:', error)
    return 'Comment allez-vous aujourd\'hui ?'
  }
}

/**
 * Sélectionne un canal aléatoire parmi les canaux accessibles
 * @param {Object} client - Client Discord
 * @param {string} channelType - Type de canal (GUILD, DM, GROUP ou null pour aléatoire)
 * @returns {Object|null} - Canal sélectionné ou null
 */
function selectRandomChannel(client, channelType = null) {
  // Obtenir les types de canaux activés
  const enabledTypes = [];

  if (isChannelTypeEnabled(CHANNEL_TYPES.GUILD)) enabledTypes.push(CHANNEL_TYPES.GUILD);
  if (isChannelTypeEnabled(CHANNEL_TYPES.DM)) enabledTypes.push(CHANNEL_TYPES.DM);
  if (isChannelTypeEnabled(CHANNEL_TYPES.GROUP)) enabledTypes.push(CHANNEL_TYPES.GROUP);

  // Si aucun type n'est activé, retourner null
  if (enabledTypes.length === 0) {
    console.log('Aucun type de canal n\'est activé dans la configuration');
    return null;
  }

  // Si un type spécifique est demandé, vérifier s'il est activé
  if (channelType) {
    if (!isChannelTypeEnabled(channelType)) {
      console.log(`Le type de canal ${channelType} est désactivé dans la configuration`);
      return null;
    }
  } else {
    // Si aucun type spécifié, choisir aléatoirement parmi les types activés
    channelType = enabledTypes[Math.floor(Math.random() * enabledTypes.length)];
  }

  // En fonction du type de canal
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
  // Récupérer tous les serveurs où le bot est présent
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
export function initScheduler (client) {
  // Vérifier si les messages automatiques sont activés
  if (process.env.ENABLE_AUTO_MESSAGES !== 'true') {
    console.log('Les messages automatiques sont désactivés dans les variables d\'environnement')
    return
  }

  // Nettoyer les tâches existantes
  stopScheduler()

  const currentTime = formatDate(new Date(), 'HH:mm:ss')
  console.log(`Planificateur initialisé à ${currentTime} avec le fuseau horaire système (${TIMEZONE} configuré)`)
  console.log(`Configuration: ${MIN_TASKS}-${MAX_TASKS} tâches, délai: ${formatDelay(MIN_DELAY)}-${formatDelay(MAX_DELAY)}`)

  // Créer un nombre aléatoire de tâches
  const taskCount = getRandomTaskCount()
  console.log(`Création de ${taskCount} tâches aléatoires...`)

  for (let i = 0; i < taskCount; i++) {
    createRandomTask(client, i + 1)
  }
}

/**
 * Crée une tâche planifiée avec un délai aléatoire
 * @param {Object} client - Client Discord
 * @param {number} taskNumber - Numéro de la tâche (pour identification)
 */
function createRandomTask (client, taskNumber) {
  // Générer un identifiant unique pour cette tâche
  const taskId = `random-question-task-${taskNumber}-${randomUUID().substring(0, 8)}`

  // Déterminer le type de canal ciblé pour cette tâche
  const targetChannelType = process.env.TARGET_CHANNEL_TYPE || null

  // Créer la tâche asynchrone
  const task = new AsyncTask(
    taskId,
    async () => {
      try {
        // Vérifier si nous sommes dans les heures actives (8h-23h par défaut)
        if (!isActiveHour()) {
          console.log(`Message non envoyé - Hors des heures actives (${formatDate(new Date(), 'HH:mm')}) - Fuseau horaire: ${TIMEZONE}`)

          // Recréer la tâche avec un nouveau délai
          if (activeTasks.has(taskId)) {
            scheduler.removeById(taskId)
            activeTasks.delete(taskId)
          }
          createRandomTask(client, taskNumber)
          return
        }

        // Sélectionner un canal aléatoire du type spécifié
        const channel = selectRandomChannel(client, targetChannelType)
        if (!channel) return

        // Sélectionner un utilisateur aléatoire
        const user = await selectRandomUser(channel, client)
        if (!user) return

        // Générer une question aléatoire
        const question = await generateRandomQuestion()

        // Stocker les informations pour les statistiques
        if (activeTasks.has(taskId)) {
          const taskInfo = activeTasks.get(taskId);
          taskInfo.targetChannel = channel.channelInfo;
          taskInfo.targetUser = {
            id: user.id,
            username: user.user.username
          };
          activeTasks.set(taskId, taskInfo);
        }

        // Envoyer le message avec mention
        await channel.send(`<@${user.id}> ${question}`)

        const currentTime = formatDate(new Date(), 'HH:mm:ss')
        console.log(`[${currentTime}] Message envoyé à ${user.user.username} dans ${channel.channelInfo.name} - Fuseau horaire: ${TIMEZONE}`)

        // Recréer la tâche avec un nouveau délai
        if (activeTasks.has(taskId)) {
          scheduler.removeById(taskId)
          activeTasks.delete(taskId)
        }
        createRandomTask(client, taskNumber)
      } catch (error) {
        console.error(`[Tâche ${taskNumber}] Erreur lors de l'exécution:`, error)

        // Recréer la tâche même en cas d'erreur
        if (activeTasks.has(taskId)) {
          scheduler.removeById(taskId)
          activeTasks.delete(taskId)
        }
        createRandomTask(client, taskNumber)
      }
    },
    (err) => {
      console.error(`[Tâche ${taskNumber}] Erreur dans la tâche:`, err)

      // Recréer la tâche même en cas d'erreur
      if (activeTasks.has(taskId)) {
        scheduler.removeById(taskId)
        activeTasks.delete(taskId)
      }
      createRandomTask(client, taskNumber)
    }
  )

  // Générer un délai aléatoire pour cette tâche
  const randomDelay = generateRandomDelay()
  const minutesDelay = Math.floor(randomDelay / 60000)

  // Calculer l'heure prévue
  const now = new Date()
  const nextExecutionTime = addMinutes(now, minutesDelay)
  const formattedTime = formatDate(nextExecutionTime, 'HH:mm:ss')
  const formattedDate = formatDate(nextExecutionTime, 'dd/MM/yyyy')

  console.log(`[Tâche ${taskNumber}] Planifiée dans ${formatDelay(randomDelay)} (${formattedTime} le ${formattedDate})`)

  // Créer un nouveau job avec le délai aléatoire
  const job = new SimpleIntervalJob(
    { milliseconds: randomDelay, runImmediately: false },
    task,
    taskId // ID unique pour le job
  )

  // Ajouter le job au planificateur et à notre registre
  scheduler.addSimpleIntervalJob(job)
  activeTasks.set(taskId, { 
    job, 
    taskNumber, 
    nextExecution: nextExecutionTime,
    targetChannelType,
    // Informations qui seront remplies lors de l'exécution
    targetChannel: null,
    targetUser: null
  })
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
      minTasks: MIN_TASKS,
      maxTasks: MAX_TASKS,
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
