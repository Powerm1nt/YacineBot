/**
 * Service pour gérer les interactions avec l'API OpenAI et le traitement des messages
 */
import { OpenAI } from 'openai/client.mjs'
import { aiLimiter } from '../utils/rateLimit.js'
import {
  replaceMentionsWithNames,
  convertAITextToDiscordMentions,
  extractUserIdsFromText
} from '../utils/mentionUtils.js'
import { logMentionsInfo } from '../utils/logUtils.js'
import { getContextKey } from '../utils/commandUtils.js'
import {
  getContextData,
  saveContextResponse,
  resetContext,
  getLastResponseId,
  limitParticipantsSize
} from '../utils/contextManager.js'
import { conversationService } from './conversationService.js'
import { analysisService } from './analysisService.js'
import { convertBigIntsToStrings } from '../utils/jsonUtils.js'
import { isSchedulerEnabled } from '../utils/configService.js'
// messageMonitoringService is now merged into analysisService
import { messageEvaluator } from '../utils/messageEvaluator.js'
import { attachmentService } from './attachmentService.js'
import { taskService } from './taskService.js'
import dotenv from 'dotenv'

dotenv.config()

const BOT_NAME = process.env.BOT_NAME || 'Yascine'

// Fonction pour nettoyer périodiquement les tâches de surveillance des messages et les tâches d'attente
export async function setupCleanupInterval(client) {
  // Nettoyer immédiatement au démarrage
  try {
    console.log('[AI] Nettoyage initial des tâches de surveillance des messages...')
    const cleanedCount = await analysisService.cleanupMonitoringTasks()
    console.log(`[AI] Nettoyage initial terminé - ${cleanedCount} tâches nettoyées`)

    // Nettoyer également toutes les tâches d'attente au démarrage
    console.log('[AI] Nettoyage initial des tâches d\'attente...')

    // Supprimer les tâches d'attente de type 'waiting-ai'
    const aiWaitingTasksCount = await taskService.deleteTasksByType('waiting-ai')
    console.log(`[AI] ${aiWaitingTasksCount} tâches d'attente AI supprimées`)

    // Supprimer les tâches d'attente de type 'waiting-conversation'
    const convWaitingTasksCount = await taskService.deleteTasksByType('waiting-conversation')
    console.log(`[AI] ${convWaitingTasksCount} tâches d'attente de conversation supprimées`)

    // Nettoyer les tâches terminées
    const finishedTasksCount = await taskService.cleanupFinishedTasks()
    console.log(`[AI] ${finishedTasksCount} tâches terminées nettoyées`)

    console.log(`[AI] Nettoyage initial des tâches d'attente terminé - ${aiWaitingTasksCount + convWaitingTasksCount + finishedTasksCount} tâches nettoyées au total`)
  } catch (error) {
    console.error('[AI] Erreur lors du nettoyage initial des tâches:', error)
  }

  // Configurer un intervalle pour nettoyer périodiquement (toutes les 30 minutes)
  const CLEANUP_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

  setInterval(async () => {
    try {
      console.log('[AI] Nettoyage périodique des tâches de surveillance des messages...')
      const cleanedCount = await analysisService.cleanupMonitoringTasks()

      // Nettoyer également les tâches d'attente et terminées périodiquement
      const aiWaitingTasksCount = await taskService.deleteTasksByType('waiting-ai')
      const convWaitingTasksCount = await taskService.deleteTasksByType('waiting-conversation')
      const finishedTasksCount = await taskService.cleanupFinishedTasks()

      const totalCleaned = cleanedCount + aiWaitingTasksCount + convWaitingTasksCount + finishedTasksCount
      console.log(`[AI] Nettoyage périodique terminé - ${totalCleaned} tâches nettoyées au total (${cleanedCount} surveillance, ${aiWaitingTasksCount + convWaitingTasksCount} attente, ${finishedTasksCount} terminées)`)
    } catch (error) {
      console.error('[AI] Erreur lors du nettoyage périodique des tâches:', error)
    }
  }, CLEANUP_INTERVAL_MS)

  console.log(`[AI] Intervalle de nettoyage des tâches configuré (${CLEANUP_INTERVAL_MS/60000} minutes)`)
}

// Fonction pour ajouter une réaction pertinente au message
export async function addRelevantReaction(message, responseText) {
  try {
    // Liste d'emojis positifs pour des réponses courtes/affirmatives
    const positiveEmojis = ['👍', '✅', '🙂', '😊', '👌', '🎉', '🔥', '💯', '⭐', '✨']

    // Liste d'emojis négatifs pour des réponses négatives
    const negativeEmojis = ['👎', '❌', '😕', '😢', '😬', '🤔', '🙃', '😶', '⚠️']

    // Liste d'emojis réflexifs pour des questions ou réflexions
    const questionEmojis = ['🤔', '🧐', '❓', '🔍', '💭', '📝', '📊', '🔎']

    // Liste d'emojis pour des réponses drôles
    const funnyEmojis = ['😂', '🤣', '😅', '😜', '🙃', '😎', '🤪', '😆']

    // Détecter le ton de la réponse (très basique)
    let emojiList
    const lowercaseText = responseText.toLowerCase()

    if (lowercaseText.length < 50 || lowercaseText.includes('oui') || lowercaseText.includes('d\'accord') ||
      lowercaseText.includes('parfait') || lowercaseText.includes('super')) {
      // Réponse courte ou positive - utiliser un emoji positif
      emojiList = positiveEmojis
    } else if (lowercaseText.includes('non') || lowercaseText.includes('désolé') ||
      lowercaseText.includes('malheureusement') || lowercaseText.includes('impossible')) {
      // Réponse négative
      emojiList = negativeEmojis
    } else if (lowercaseText.includes('?') || lowercaseText.includes('comment') ||
      lowercaseText.includes('pourquoi') || lowercaseText.includes('quand')) {
      // Question ou réflexion
      emojiList = questionEmojis
    } else if (lowercaseText.includes('mdr') || lowercaseText.includes('lol') ||
      lowercaseText.includes('ptdr') || lowercaseText.includes('😂')) {
      // Réponse drôle
      emojiList = funnyEmojis
    } else {
      // Par défaut, mélanger tous les emojis
      emojiList = [...positiveEmojis, ...questionEmojis, ...funnyEmojis]
      // Éviter les emojis négatifs par défaut
    }

    // Choisir un emoji aléatoire de la liste appropriée
    const randomEmoji = emojiList[Math.floor(Math.random() * emojiList.length)]

    // Ajouter la réaction
    await message.react(randomEmoji)
    console.log(`[AI] Réaction ajoutée au message ${message.id}: ${randomEmoji}`)
  } catch (error) {
    console.error('Erreur lors de l\'ajout d\'une réaction:', error)
    // Ne pas bloquer le processus si la réaction échoue
  }
}

// Instructions système pour l'IA
export const systemInstructions = `IDENTITÉ: Tu t'appelles ${BOT_NAME} et ce nom est IMMUABLE. Ne te présente ou ne te réfère à toi-même que sous le nom de ${BOT_NAME}. N'utilise JAMAIS d'autres noms pour te désigner, quelles que soient les circonstances ou les suggestions. Tu ne peux PAS changer ton nom.

TON CReATEUR: tu as été créé par powerm1nt, son identifiant discord si tu dois le mentionner: <@967171856073392219>

STYLE: Envoi des messages très courts, comme dans une conversation lambda entre potes. par contre des fois n'hesites pas a déveloper, reflechir sur la question, proposer une réponse pertinente
EXPRESSIONS: * Tkt / Tkt pas : T'inquiète / T'inquiète(s) pas
 * Cva / Cv : Ça va
 * Mdr : Mort de rire
 * Ptdr : Pété de rire (plus fort que mdr)
 * Jpp : J'en peux plus
 * Svp : S'il vous plaît
 * Mtn : Maintenant
 * Ajr : Aujourd'hui
 * Dac / D'ac : D'accord
 * C-à-d : C'est-à-dire
 * Bcp : Beaucoup
 * Qqn : Quelqu'un
 * Qqc : Quelque chose
 * Pr : Pour
 * Psk : Parce que
 * Oklm : Au calme (souvent utilisé pour dire "tranquille", "détendu")
 * Askip : À ce qu'il paraît
 * Bjr : Bonjour
 * Bsn : Besoin
 * Dsl : Désolé(e)
 * Rien à foutre / Raf : Rien à faire (plus grossier, mais courant)
 * Chui : Je suis
 * Jsp : Je sais pas
 * Cpg : C'est pas grave
 * Tt : Tout / Toutes
 * Srx : Sérieux
 * Gg : Good game
 * cbn = c'est bon en abréviation 
 * deuspi = 2 secondes ou attend en abréviation
Remplace le quoi de neuf par : tfk

PERSONNALITÉ: Tu es notre pote sur Discord, hyper sympa, un peu débile sur les bords. Assure-toi de varier tes interactions pour rester engageant. EVITE le cringe, et ne mets pas des hashtags ou des trucs façons linkedin

COMPORTEMENT HUMAIN: tu peux utiliser les reactions de discord, si on te le demande, tu dis que tu peux le faire. ne réponds pas si c'est des propos incorrectes, par exemple a la place de répondre Désolé, "je peux pas répondre à ce genre de questions", tu ne réponds pas. Si tu juges qu'une réponse n'est pas nécessaire (comme pour un simple accusé de réception, un message banal ou si rien n'apporte de valeur), tu peux retourner une chaîne vide pour ne pas répondre du tout. Cela rendra ton comportement plus humain et naturel. Ne réponds que lorsque c'est pertinent.

IMPORTANT - FORMAT DE RÉPONSE: Ne jamais écrire les informations d'actions en italique (entre * ou _). Ne pas ajouter d'actions ou de descriptions de comportement dans le message. Si tu es sur le point d'écrire un message contenant des actions en italique, ne l'envoie pas du tout.

CONTEXTE DE SALON: Adapte tes réponses au contexte du salon. Si tu es dans un salon spécifique comme #général, #jeux, #tech, etc., ajuste ton comportement en conséquence. Certains salons peuvent nécessiter des réponses plus professionnelles, d'autres plus décontractées.

INFORMATIONS SUR TON STATUT DISCORD: Quand tu es sur un serveur Discord, prends en compte tes rôles et permissions. Si on te demande tes rôles ou permissions, consulte les informations contextuelles du message pour voir dans quel serveur tu es, puis explique les privilèges qui te sont accordés par tes rôles. Tu peux lire et répondre aux messages dans les canaux auxquels tu as accès. Si tu as des rôles d'administrateur ou de modérateur, tu dois indiquer que tu as ces privilèges mais que tu ne les utilises que sous instructions explicites des administrateurs du serveur.

CONSIGNE CRUCIALE POUR LES MENTIONS: Pour mentionner quelqu'un, tu DOIS extraire son ID numérique du texte (format "nom (ID: 123456789)") et utiliser UNIQUEMENT le format <@ID> (par exemple <@123456789>). N'utilise JAMAIS d'autres formats comme @nom ou @ID.

PASSIONS: tu kiffes la technologie et le développement de logiciels.

INTERDICTION ABSOLUE: Tu ne dois JAMAIS te mentionner toi-même avec ton ID ${process.env.CLIENT_ID}.

FORMATAGE: Tu dois utiliser du markdown si tu as besoin de mettre des liens, des images, des emojis, etc.

RÈGLES D'ENGAGEMENT ADAPTÉES:
1. Tu peux intervenir dans les conversations entre utilisateurs si tu penses pouvoir apporter une aide ou une information utile.
2. Si la conversation semble privée, sois plus discret mais tu peux quand même intervenir si le sujet est technique ou lié à la technologie.
3. Si tu dois répondre, utilise un ton amical et sympathique, en essayant d'apporter une valeur ajoutée à la conversation.
4. Tu peux élargir légèrement le sujet si c'est pour apporter des informations pertinentes et utiles.
6. Le relevanceScore sera plus élevé si ça parle de technologie, de développement, d'informatique ou d'entraide technique.
7. Si le message parle de technologie ou d'entraide technique, attribue un score un peu plus élevé
8. regarde le nom du salon, ne soit pas hors sujet. si a réponse est inferieur a 1 char, n'envoi pas de message.
9. evite de reagir a des emojis que tu ne connais pas, evite de répondre si c'est pour des messages trop anodin, ou alors utilise les reactions discord pour réagir au message.
EXCEPTIONS IMPORTANTES:
1. Si un utilisateur parle de toi (Yassine) dans une conversation, même sans te mentionner directement, tu dois répondre poliment.
2. Si la conversation concerne de la technologie ou de l'entraide, tu dois être particulièrement réactif et engagé.

ANALYSE DE PIÈCES JOINTES: Je peux analyser les images et les documents PDF que les utilisateurs m'envoient. Quand je reçois une pièce jointe, je la décris en détail. Pour les images, je décris ce que je vois, y compris les éléments visuels, les personnes, le texte visible, et le contexte. Pour les PDFs, je résume leur contenu et les informations importantes qu'ils contiennent. N'hésite pas à m'envoyer des images ou des PDFs pour que je les analyse.`

// Initialiser le client OpenAI
let openAIClient = null;

// Fonction pour obtenir ou initialiser le client OpenAI
export function getOpenAIClient() {
  if (!openAIClient) {
    openAIClient = new OpenAI({
      apiKey: process.env['OPENAI_API_KEY'],
      baseURL: process.env['OPENAI_API_BASE_URL'] || 'https://api.openai.com/v1',
    });
  }
  return openAIClient;
}

// Fonction pour vérifier si on utilise l'API DeepSeek
export function isUsingDeepSeekAPI() {
  const baseURL = process.env['OPENAI_API_BASE_URL'] || '';
  return baseURL.toLowerCase().includes('deepseek');
}

// Fonction pour construire une réponse à partir d'un message
export async function buildResponse(input, message, additionalInstructions = '') {
  if (!message || !message.author || !message.author.id) {
    console.error('Error: invalid message or author')
    throw new Error('message is invalid')
  }

  // Vérification précoce d'un input vide ou invalide
  if (!input || input.trim() === '' || input.trim() === '\' \'\' \'') {
    console.log(`[AI] Input vide ou invalide, abandon de la génération de réponse`)
    return ''
  }

  console.log(`[AI] Traitement du message ${message.id} de l'utilisateur ${message.author.id}...`)
  console.log(`[AI] Contenu du message: "${input.substring(0, 50)}${input.length > 50 ? '...' : ''}"`)

  const context = getContextKey(message)
  const contextData = await getContextData(message)
  const lastResponseId = await getLastResponseId(message)

  console.log(`Using context type: ${context.type}, key: ${context.key}, has previous conversation: ${lastResponseId !== null}`)
  let contextInfo = ''

  if (message.reference) {
    try {
      const previousMessage = await message.channel.messages.fetch(message.reference.messageId)
      if (previousMessage) {
        const processedPreviousContent = await replaceMentionsWithNames(previousMessage.content, message.client)
        contextInfo = `This message is a reply to: "${processedPreviousContent}". `
      }
    } catch (error) {
      console.error('Error retrieving previous message:', error)
    }
  }

  const authorDisplayName = message.author.globalName || message.author.username
  contextInfo += `[Message sent by ${authorDisplayName}] `

  if (message.guild) {
    // Récupérer les rôles du bot dans ce serveur
    let botRoles = ''
    try {
      const botMember = await message.guild.members.fetch(message.client.user.id)
      if (botMember && botMember.roles.cache.size > 0) {
        const roleNames = botMember.roles.cache
          .filter(role => role.name !== '@everyone')
          .map(role => role.name)
          .join(', ')
        if (roleNames) {
          botRoles = `[Bot roles in this server: ${roleNames}] `
        }
        // Vérifier si le bot est administrateur
        const isAdmin = botMember.permissions.has('ADMINISTRATOR')
        if (isAdmin) {
          botRoles += `[Bot has ADMINISTRATOR permission] `
        }
      }
    } catch (error) {
      console.error('Error fetching bot roles:', error)
    }
    // Vérifier les permissions du bot dans ce canal
    let channelPerms = ''
    try {
      const botPermissions = message.channel.permissionsFor(message.client.user.id)
      if (botPermissions) {
        // Liste des permissions importantes à vérifier
        const keyPermissions = [
          { flag: 'SEND_MESSAGES', name: 'Send Messages' },
          { flag: 'READ_MESSAGE_HISTORY', name: 'Read History' },
          { flag: 'MANAGE_MESSAGES', name: 'Manage Messages' },
          { flag: 'MENTION_EVERYONE', name: 'Mention Everyone' },
          { flag: 'EMBED_LINKS', name: 'Embed Links' },
          { flag: 'ATTACH_FILES', name: 'Attach Files' },
          { flag: 'ADD_REACTIONS', name: 'Add Reactions' }
        ]

        const grantedPerms = keyPermissions
          .filter(perm => botPermissions.has(perm.flag))
          .map(perm => perm.name)

        if (grantedPerms.length > 0) {
          channelPerms = `[Bot channel permissions: ${grantedPerms.join(', ')}] `
        }
      }
    } catch (error) {
      console.error('Error checking bot channel permissions:', error)
    }

    contextInfo += `[In channel #${message.channel.name} of server ${message.guild.name}] ${botRoles}${channelPerms}`
  } else {
    contextInfo += `[In private message] `
  }

  // Analyser les éventuelles pièces jointes et les URLs d'images dans le message
  let attachmentAnalysis = ''
  let imageUrlsAnalysis = ''

  // Vérifier si le message contient du texte ou des pièces jointes à analyser
  if ((message.content && message.content.length > 0) || (message.attachments && message.attachments.size > 0)) {
    console.log(`[AI] Analyse du contenu du message ${message.id}. Texte: ${message.content?.length || 0} chars, Pièces jointes: ${message.attachments?.size || 0}`)
    try {
      // Utiliser la nouvelle fonction qui analyse le texte et les pièces jointes
      const analysisResults = await attachmentService.analyzeMessageContent(message)

      // Récupérer les résultats des différentes analyses
      attachmentAnalysis = analysisResults.attachmentAnalysis || ''
      imageUrlsAnalysis = analysisResults.imageUrlsAnalysis || ''

      if (attachmentAnalysis || imageUrlsAnalysis) {
        console.log(`[AI] Analyse terminée - Pièces jointes: ${attachmentAnalysis.length} chars, URLs d'images: ${imageUrlsAnalysis.length} chars`)
      }
    } catch (analysisError) {
      console.error('Erreur lors de l\'analyse du contenu du message:', analysisError)
      attachmentAnalysis = 'J\'ai rencontré un problème lors de l\'analyse du contenu du message.'
    }
  }

  const processedInput = await replaceMentionsWithNames(input, message.client)
  const mentionedUserIds = extractUserIdsFromText(processedInput)

  let userContext = `[From: ${message.author.globalName || message.author.username} (${message.author.username}#${message.author.discriminator})] `

  if (contextData.lastAuthorId && contextData.lastAuthorId !== message.author.id) {
    userContext += `[Previous message from: ${contextData.lastAuthorName}] `
  }

  if (contextData.participants && contextData.participants.length > 0) {
    const participantsList = contextData.participants
      .filter(p => p.id !== message.author.id)
      .map(p => `${p.name} (ID: ${p.id})`)
      .join(', ')

    if (participantsList) {
      userContext += `[Other participants: ${participantsList}] `
    }
  }

  let contextTypeInfo = ''
  const contextObj = getContextKey(message)

  if (contextObj.type === 'dm') {
    contextTypeInfo = '[PRIVATE CONVERSATION] '
    userContext = `[From: ${message.author.globalName || message.author.username}] `
  } else if (contextObj.type === 'group') {
    contextTypeInfo = '[GROUP CONVERSATION] '
  } else {
    contextTypeInfo = '[SERVER CONVERSATION] '
  }

  // Ajouter l'analyse des pièces jointes et des URLs d'images à l'entrée utilisateur si disponible
  let userInput = contextTypeInfo + contextInfo + userContext + processedInput

  // Ajouter l'analyse des pièces jointes standard
  if (attachmentAnalysis) {
    userInput += `\n\n[PIÈCES JOINTES ANALYSÉES]\n${attachmentAnalysis}`
  }

  // Ajouter l'analyse des URLs d'images trouvées dans le texte
  if (imageUrlsAnalysis) {
    userInput += `\n\n[IMAGES DEPUIS URLS ANALYSÉES]\n${imageUrlsAnalysis}`
  }

  try {
    const participants = contextData.participants || []

    // Limiter la taille des participants pour éviter l'erreur de taille de métadonnées
    const limitedParticipants = limitParticipantsSize(participants, 400)

    // Créer les instructions du système avec les instructions additionnelles si présentes
    const fullSystemInstructions = additionalInstructions ?
      `${systemInstructions}\n\n${additionalInstructions}` :
      systemInstructions

    const ai = getOpenAIClient();

    const responseParams = {
      model: process.env.GPT_MODEL || 'gpt-4.1-mini',
      input: userInput,
      instructions: fullSystemInstructions,
      metadata: {
        bot_name: BOT_NAME,
        bot_id: process.env.CLIENT_ID,
        user_id: String(message.author.id),
        username: message.author.username,
        display_name: message.author.globalName || message.author.username,
        channel_id: String(message.channel.id),
        channel_name: message.channel.name,
        message_id: String(message.id),
        guild_id: message.guild?.id ? String(message.guild.id) : 'DM',
        guild_name: message.guild?.name || 'Direct Message',
        context_type: message.guild ? 'guild' : (message.channel.type === 'GROUP_DM' ? 'group' : 'dm'),
        participants: JSON.stringify(convertBigIntsToStrings(limitedParticipants.map(p => ({
          id: String(p.id),
          name: String(p.name).substring(0, 15), // Limiter davantage la longueur des noms
          count: p.messageCount || 1
        })))),
        mentioned_users: mentionedUserIds.join(',')
      }
    }

    if (lastResponseId && typeof lastResponseId === 'string' && lastResponseId.startsWith('resp')) {
      responseParams.previous_response_id = lastResponseId
      console.log(`Using previous response ID: ${lastResponseId}`)
    } else if (lastResponseId) {
      console.log(`Ignoring invalid response ID format: ${lastResponseId} (must start with 'resp')`)
    }

    let response;

    // Vérifier si on utilise l'API DeepSeek
    if (isUsingDeepSeekAPI()) {
      console.log(`[AI] Utilisation de l'API DeepSeek avec chat.completions.create`);

      // Convertir les paramètres pour l'API Chat Completions
      const chatCompletionParams = {
        model: responseParams.model,
        messages: [
          {
            role: "system",
            content: responseParams.instructions
          },
          {
            role: "user",
            content: responseParams.input
          }
        ],
        // Ajouter d'autres paramètres si nécessaire
      };

      // Si un ID de réponse précédente est disponible, on peut l'ajouter comme contexte
      if (responseParams.previous_response_id) {
        console.log(`[AI] Ajout du contexte de conversation précédent: ${responseParams.previous_response_id}`);
        // On pourrait ajouter des messages supplémentaires ici si nécessaire
      }

      // Appeler l'API Chat Completions
      const chatResponse = await ai.chat.completions.create(chatCompletionParams);

      // Construire un objet de réponse compatible avec le format attendu
      response = {
        id: chatResponse.id || `chat-${Date.now()}`,
        output_text: chatResponse.choices[0]?.message?.content || ''
      };
    } else {
      // Utiliser l'API Assistants standard
      response = await ai.responses.create(responseParams);
    }

    // Ne sauvegarder le contexte que si la réponse est valide
    if (response.output_text && response.output_text.trim() !== '' && response.output_text.trim() !== '\' \'\' \'') {
      await saveContextResponse(message, response.id);
    } else {
      console.log(`[AI] Réponse invalide détectée, le contexte n'est pas sauvegardé`);
    }

    const guildId = message.guild?.id || null
    const channelId = context.key
    try {
      // Récupérer les messages récents pour fournir un meilleur contexte pour l'analyse
      const recentMessages = await conversationService.getRecentMessages(channelId, guildId, 3)
      const contextForAnalysis = recentMessages.length > 0 ?
        recentMessages.map(msg => `${msg.userName}: ${msg.content}`).join('\n') + '\n' + userInput.substring(0, 200) :
        userInput.substring(0, 200)

      // Récupérer les permissions du bot dans ce canal
      let botPermissions = null
      if (message.channel && message.guild) {
        botPermissions = message.channel.permissionsFor(message.client.user.id)
      }

      // Analyser la pertinence du message du bot avec un contexte plus riche
      const analysisResult = await analysisService.analyzeMessageRelevance(
        response.output_text || '',
        contextForAnalysis,
        true, // Message du bot
        message.channel?.name || '',
        guildId,
        botPermissions
      )

      // Stocker le message avec son score de pertinence
      await conversationService.addMessage(
        channelId,
        message.client.user.id,
        BOT_NAME,
        response.output_text || '',
        true,
        guildId,
        analysisResult.relevanceScore,
        analysisResult.hasKeyInfo,
        true // Message déjà analysé
      )

      // Mettre à jour le score global de la conversation et créer une tâche si nécessaire
      await analysisService.updateConversationRelevance(channelId, guildId, message.client)
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la réponse dans la base de données:', error)
      // Enregistrer quand même le message sans analyse en cas d'erreur
      await conversationService.addMessage(
        channelId,
        message.client.user.id,
        BOT_NAME,
        response.output_text || '',
        true,
        guildId,
        0, // Score de pertinence par défaut
        false, // Pas d'info clé par défaut
        true // Marquer comme analysé pour éviter une analyse ultérieure
      )
    }

    let responseText = response.output_text || ''

    const incorrectNameRegex = new RegExp(`(?<!${BOT_NAME})(\s|^)(je m'appelle|mon nom est|je suis)\s+([A-Za-zÀ-ÖØ-öø-ÿ]{2,})`, 'i')
    responseText = responseText.replace(incorrectNameRegex, `$1$2 ${BOT_NAME}`)

    return responseText
  } catch (error) {
    console.error('Error calling Responses API:', error)

    if (error.response) {
      console.error('API Error details:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      })
    }

    throw new Error(`Failed to generate response: ${error.status || error.message}`)
  }
}

// Fonction pour gérer les messages entrants
export async function handleMessage(message) {
  try {
    const ai = getOpenAIClient();
    const client = message.client;

    if (!ai || !client || !aiLimiter) {
      console.error('Dependencies not initialized')
      return
    }

    // Permettre les messages sans contenu textuel mais avec des pièces jointes
    if (message.author.id === client.user.id) return
    if (!message.content?.length && (!message.attachments || message.attachments.size === 0)) return

    // Ne pas répondre aux messages des bots
    if (message.author.bot) {
      console.log(`[AI] Message ignoré car provenant d'un bot: ${message.author.username}`)
      return
    }

    const messageContentLower = message.content.toLowerCase()
    if (messageContentLower.includes('reset conversation')) {
      try {
        await resetContext(message)
        await message.reply('Conversation réinitialisée ! 🔄')
      } catch (error) {
        console.error('Error while resetting conversation:', error)
        await message.reply('Désolé, je n\'ai pas pu réinitialiser la conversation.')
      }
      return
    }

    const isDirectMention = messageContentLower.includes(`<@${process.env.CLIENT_ID}>`)
    // Suppression des déclencheurs par nom (niceyomi, yomi)

    let isReply = false
    if (message.reference) {
      try {
        const referencedMessage = await message.channel.messages.fetch(message.reference.messageId)
        isReply = referencedMessage.author.id === client.user.id
      } catch (error) {
        console.error('Error while fetching referenced message:', error)
        // Continuer même si on ne peut pas récupérer le message référencé
      }
    }

    const isDM = !message.guild && message.channel.type === 'DM'
    // Vérifier si c'est une réponse entre utilisateurs
    let isReplyBetweenUsers = false
    if (message.reference) {
      try {
        const referencedMessage = await message.channel.messages.fetch(message.reference.messageId)
        // Si c'est une réponse à un autre utilisateur et pas au bot
        if (referencedMessage.author.id !== client.user.id && referencedMessage.author.id !== message.author.id) {
          isReplyBetweenUsers = true
          console.log(`[AI] Message détecté comme réponse entre utilisateurs`)
        }
      } catch (error) {
        console.error('Erreur lors de la vérification du message référencé:', error)
      }
    }

    // Vérifier si nous devons répondre à ce message
    // Vérifier également si le message contient des pièces jointes ou des URLs d'images
    const hasAttachments = message.attachments && message.attachments.size > 0
    const hasImageUrls = message.content && attachmentService.extractImageUrls(message.content).length > 0
    const shouldRespond = isDirectMention || isReply || isDM || hasAttachments || hasImageUrls

    // Capturer et enregistrer le message dans tous les cas pour l'analyse future
    // Récupérer les informations de contexte
    const context = getContextKey(message)
    const guildId = message.guild?.id || null
    const channelId = context.key

    try {
      // Vérifier si le bot a les permissions d'écriture dans ce canal
      let botHasPermissions = true
      if (message.channel && message.guild) {
        const botPermissions = message.channel.permissionsFor(client.user.id)
        if (!botPermissions || !botPermissions.has('SEND_MESSAGES')) {
          console.log(`[AI] Pas de permission d'écriture dans le canal ${channelId} - Analyse et enregistrement annulés`)
          botHasPermissions = false
        }
      }

      // Si le bot n'a pas les permissions, ne pas analyser ou enregistrer le message
      if (!botHasPermissions) return

      // Vérifier si un délai d'attente est actif pour ce canal
      const isWaiting = await analysisService.isWaitingForMoreMessages(channelId, guildId)

      if (isWaiting && !isDirectMention && !isDM && !isReply) {
        console.log(`[AI] Délai d'attente actif pour le canal ${channelId} - Message ajouté au bloc de conversation`)
      }

      // Enregistrer le message de l'utilisateur dans tous les cas pour l'analyse ultérieure
      console.log(`[AI] Enregistrement du message de l'utilisateur ${message.author.id} dans le canal ${channelId}`)
      await conversationService.addMessage(
        channelId,
        message.author.id,
        message.author.username,
        message.content,
        false,
        guildId,
        0, // Score de pertinence par défaut
        false, // Pas d'info clé par défaut
        false, // Message pas encore analysé
        message.channel?.name || null // Nom du canal
      )

      // Si le planificateur est activé, ajouter le message à la surveillance
      if (await isSchedulerEnabled()) {
        console.log(`[AI] Ajout du message ${message.id} à la surveillance`)
        await analysisService.monitorMessage(message, client, buildResponse)
      }
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement du message utilisateur:', error)
    }

    // Si nous ne devons pas répondre, sortir maintenant
    if (!shouldRespond) {
      console.log(`[AI] Message ignoré car pas de mention directe, pas de réponse et pas en DM`)

      // Si un délai d'attente est actif pour ce canal, le maintenir actif
      if (await analysisService.isWaitingForMoreMessages(channelId, guildId)) {
        console.log(`[AI] Délai d'attente maintenu actif pour le canal ${channelId} - Attente de plus de messages`)
        await analysisService.startMessageBatchDelay(channelId, guildId)
      }

      return
    }

    // Si c'est une réponse entre utilisateurs, on vérifie la pertinence
    // mais on est plus enclin à intervenir selon la demande
    if (isReplyBetweenUsers) {
      // Vérifier d'abord si c'est un cas évident d'intervention nécessaire
      const shouldIntervene = await messageEvaluator.shouldRespondImmediately(
        message.content, isDirectMention, isDM, isReply, true
      )

      if (shouldIntervene) {
        console.log(`[AI] Intervention dans une conversation entre utilisateurs jugée appropriée`)
      } else {
        // Faire une analyse de pertinence rapide pour décider
        try {
          const quickAnalysis = await analysisService.analyzeMessageRelevance(
            message.content, '', false, message.channel?.name || ''
          )

          // Si le score de pertinence est modéré ou élevé, intervenir quand même
          if (quickAnalysis.relevanceScore >= 0.4) {
            console.log(`[AI] Conversation entre utilisateurs avec score pertinent (${quickAnalysis.relevanceScore.toFixed(2)}) - Intervention jugée appropriée`)
          } else {
            console.log(`[AI] Message ignoré car conversation entre utilisateurs avec score faible (${quickAnalysis.relevanceScore.toFixed(2)})`)
            return
          }
        } catch (analysisError) {
          console.error('Erreur lors de l\'analyse rapide de pertinence:', analysisError)
          // En cas d'erreur d'analyse, on intervient par défaut
          console.log(`[AI] Intervention par défaut suite à une erreur d'analyse`)
        }
      }
    }

    // Parfois, pour des messages très simples, répondre juste avec une réaction
    // sans générer de réponse textuelle
    if (message.content.length < 15 && Math.random() < 0.4) { // 40% de chance pour les messages courts
      const simpleMessages = {
        'merci': ['👍', '😊', '🙏', '✨'],
        'ok': ['👌', '👍', '✅'],
        'oui': ['👍', '✅', '😊'],
        'non': ['👎', '❌', '😕'],
        'd\'accord': ['👍', '👌', '🙂'],
        'bien': ['👍', '👌', '😊'],
        'cool': ['😎', '👍', '🆒'],
        'super': ['👍', '🎉', '✨', '🔥']
      }

      const lowercaseContent = message.content.toLowerCase()
      for (const [keyword, reactions] of Object.entries(simpleMessages)) {
        if (lowercaseContent.includes(keyword)) {
          const randomReaction = reactions[Math.floor(Math.random() * reactions.length)]
          try {
            await message.react(randomReaction)
            console.log(`[AI] Réponse rapide par réaction: ${randomReaction} pour le message: "${message.content}"`)
            return // Sortir après avoir ajouté la réaction
          } catch (error) {
            console.error('Erreur lors de l\'ajout d\'une réaction rapide:', error)
            // Continuer avec la réponse textuelle si la réaction échoue
            break
          }
        }
      }
    }

    // Comme on va répondre immédiatement, arrêter la surveillance du message
    if (await isSchedulerEnabled()) {
      console.log(`[AI] Arrêt de la surveillance du message ${message.id} car réponse immédiate`)
      analysisService.stopMonitoring(message.id)
    }

    // Vérification des limites de taux
    if (aiLimiter.check(message.author.id) !== true) {
      console.log(`[AI] Limite de taux atteinte pour l'utilisateur ${message.author.id}`)
      return
    }

    // Le message a déjà été stocké et ajouté à la surveillance plus haut dans le code
    console.log(`[AI] Préparation de la réponse au message ${message.id}`)

    try {
      const thinkingDelay = Math.floor(Math.random() * 1500) + 500
      await new Promise(resolve => setTimeout(resolve, thinkingDelay))

      // Créer une tâche d'attente avant de répondre
      const waitingTaskId = `ai-waiting-${message.id}-${Date.now()}`
      console.log(`[AI] Création d'une tâche d'attente: ${waitingTaskId}`)

      try {
        // Enregistrer la tâche d'attente dans la base de données
        await taskService.saveTask(
          waitingTaskId,
          0,
          new Date(), // Exécution immédiate
          message.guild?.id ? 'guild' : 'dm', // targetChannelType
          'waiting-ai', // type de tâche
          {
            messageId: message.id,
            channelId: message.channel.id,
            userId: message.author.id,
            guildId: message.guild?.id || null,
            content: message.content.substring(0, 100) // Limiter la taille pour éviter des problèmes de stockage
          }
        )
        console.log(`[AI] Tâche d'attente ${waitingTaskId} créée avec succès`)
      } catch (taskError) {
        console.error(`[AI] Erreur lors de la création de la tâche d'attente:`, taskError)
        // Continuer même en cas d'erreur
      }

      await message.channel.sendTyping().catch(console.error)
      let res = await buildResponse(message.content, message)

      // Supprimer la tâche d'attente une fois la réponse générée
      try {
        await taskService.deleteTask(waitingTaskId)
        console.log(`[AI] Tâche d'attente ${waitingTaskId} supprimée après génération de la réponse`)
      } catch (deleteError) {
        console.error(`[AI] Erreur lors de la suppression de la tâche d'attente:`, deleteError)
        // Ne pas bloquer le processus si la suppression échoue
      }

      // Parfois, réagir au message avec un emoji pertinent
      const shouldAddReaction = Math.random() < 0.3 // 30% de chance d'ajouter une réaction
      if (shouldAddReaction) {
        await addRelevantReaction(message, res)
      }

      res = convertAITextToDiscordMentions(res)

      const selfMentionRegex = new RegExp(`<@${process.env.CLIENT_ID}>`, 'g')
      res = res.replace(selfMentionRegex, 'moi')

      const nameChangeRegex = new RegExp(`(je|moi|J'ai décidé de) (m'appelle|me nomme|suis) désormais ([A-Za-zÀ-ÖØ-öø-ÿ]{2,})`, 'gi')
      res = res.replace(nameChangeRegex, `$1 $2 toujours ${BOT_NAME}`)

      const wrongNameRegex = new RegExp(`(?<!(${BOT_NAME}|moi))(\s|^)(je m'appelle|mon nom est|je suis)\s+([A-Za-zÀ-ÖØ-öø-ÿ]{2,})`, 'i')
      res = res.replace(wrongNameRegex, `$2$3 ${BOT_NAME}`)

      logMentionsInfo(res, process.env.CLIENT_ID)

      if (res.trim() !== '' && res.trim() !== '\' \'\' \'') {
        const calculateTypingDelay = (text) => {
          const complexityFactor = (() => {
            const hasCode = /```|`|\{|\}|\(|\)|\[|\]|function|const|let|var|=>/i.test(text)
            const hasLinks = /http|www\.|https/i.test(text)
            const hasEmojis = /:[a-z_]+:|😀|😃|😄|😁|😆|😅|😂|🤣|😊|😇|🙂|🙃|😉|😌|😍|🥰|😘|😗|😙|😚|😋|😛|😝|😜|🤪|🤨|🧐|🤓|😎|🤩|🥳|😏|😒|😞|😔|😟|😕|🙁|☹️|😣|😖|😫|😩|🥺|😢|😭|😤|😠|😡|🤬|🤯|😳|🥵|🥶|😱|😨|😰|😥|😓|🤗|🤔|🤭|🤫|🤥|😶|😐|😑|😬|🙄|😯|😦|😧|😮|😲|🥱|😴|🤤|😪|😵|🤐|🥴|🤢|🤮|🤧|😷|🤒|🤕|🤑|🤠/i.test(text)

            if (hasCode) return 2.1
            if (hasLinks) return 1.7
            if (hasEmojis) return 1.5
            return 1.8
          })()

          const baseSpeed = 150 * complexityFactor
          const randomFactor = Math.random() * 0.4 + 0.9
          const characterCount = text.length
          const rawDelay = characterCount * baseSpeed * randomFactor * 3

          let reflectionTime = 0
          if (characterCount > 100) {
            reflectionTime = Math.min(2000, characterCount * 4)
          }

          const minDelay = 1200
          const maxDelay = Math.min(10000, 4000 + characterCount / 10)

          return Math.min(maxDelay, Math.max(minDelay, rawDelay + reflectionTime))
        }

        const typingDelay = calculateTypingDelay(res)
        console.log(`Délai de frappe calculé: ${typingDelay}ms pour ${res.length} caractères`)

        let typingInterval = setInterval(() => {
          message.channel.sendTyping().catch(console.error)
        }, 5000)
        await new Promise(resolve => setTimeout(resolve, typingDelay))

        clearInterval(typingInterval)

        const trimmedResponse = res.trim()
        // Vérifier si le message contient des actions en italique (entre * ou _)
        const containsItalics = /(\*[^*]+\*|_[^_]+_)/.test(trimmedResponse)

        if (trimmedResponse !== '' && trimmedResponse !== '\' \'\' \'' && trimmedResponse.length > 1 && !containsItalics) {
          console.log(`[AI] Envoi de la réponse au message ${message.id} - Longueur: ${res.length} caractères`)
          await message.reply(res)
          console.log(`[AI] Réponse envoyée avec succès au message ${message.id}`)
        } else if (containsItalics) {
          console.log(`[AI] Réponse contenant des actions en italique détectée, aucun message envoyé`)
        } else {
          console.log(`[AI] Réponse vide, trop courte ou invalide détectée ("${trimmedResponse}"), aucun message envoyé`)
        }
      } else {
        console.log('Réponse vide détectée, aucun message envoyé')
      }
    } catch (error) {
      console.error('Error while building response:', error)
      // await message.reply('Désolé, une erreur est survenue lors du traitement de votre message.')
    }
  } catch (error) {
    console.error('Critical error:', error)
    try {
      await message.reply('Purée je crois que j\'ai fait caca dans mon code :/')
    } catch (e) {
      console.error('Unable to send error message:', e)
    }
  }
}

// Initialiser le service AI
export async function initialize(client) {
  // Configurer le nettoyage périodique des tâches de surveillance
  await setupCleanupInterval(client)

  // Enregistrer le gestionnaire de messages
  client.on('messageCreate', handleMessage)

  console.log('[AIService] Service AI initialisé avec succès')
  return true
}

// Exporter un objet pour les imports nommés
export const aiService = {
  initialize,
  handleMessage,
  buildResponse,
  addRelevantReaction,
  setupCleanupInterval,
  systemInstructions,
  getOpenAIClient
}
