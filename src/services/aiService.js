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
import { getUserRoles } from '../utils/messageUtils.js'
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
import { userPreferencesMcp } from '../utils/userPreferencesMcp.js'
import { mcpUtils } from '../utils/mcpUtils.js'
import dotenv from 'dotenv'

dotenv.config()

const BOT_NAME = process.env.BOT_NAME || 'Yascine'

// Fonction pour nettoyer périodiquement les tâches de surveillance des messages et les tâches d'attente
export async function setupCleanupInterval(client) {
  // Nettoyer immédiatement au démarrage
  try {
    console.log('[AI] Initial cleanup of message monitoring tasks...')
    const cleanedCount = await analysisService.cleanupMonitoringTasks()
    console.log(`[AI] Initial cleanup completed - ${cleanedCount} tasks cleaned up`)

    // Nettoyer également toutes les tâches d'attente au démarrage
    console.log('[AI] Initial cleanup of waiting tasks...')

    // Supprimer les tâches d'attente de type 'waiting-ai'
    const aiWaitingTasksCount = await taskService.deleteTasksByType('waiting-ai')
    console.log(`[AI] ${aiWaitingTasksCount} AI waiting tasks deleted`)

    // Supprimer les tâches d'attente de type 'waiting-conversation'
    const convWaitingTasksCount = await taskService.deleteTasksByType('waiting-conversation')
    console.log(`[AI] ${convWaitingTasksCount} conversation waiting tasks deleted`)

    // Nettoyer les tâches terminées
    const finishedTasksCount = await taskService.cleanupFinishedTasks()
    console.log(`[AI] ${finishedTasksCount} finished tasks cleaned up`)

    console.log(`[AI] Initial cleanup of waiting tasks completed - ${aiWaitingTasksCount + convWaitingTasksCount + finishedTasksCount} tasks cleaned up in total`)
  } catch (error) {
    console.error('[AI] Error during initial task cleanup:', error)
  }

  // Configurer un intervalle pour nettoyer périodiquement (toutes les 30 minutes)
  const CLEANUP_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

  setInterval(async () => {
    try {
      console.log('[AI] Periodic cleanup of message monitoring tasks...')
      const cleanedCount = await analysisService.cleanupMonitoringTasks()

      // Nettoyer également les tâches d'attente et terminées périodiquement
      const aiWaitingTasksCount = await taskService.deleteTasksByType('waiting-ai')
      const convWaitingTasksCount = await taskService.deleteTasksByType('waiting-conversation')
      const finishedTasksCount = await taskService.cleanupFinishedTasks()

      const totalCleaned = cleanedCount + aiWaitingTasksCount + convWaitingTasksCount + finishedTasksCount
      console.log(`[AI] Periodic cleanup completed - ${totalCleaned} tasks cleaned up in total (${cleanedCount} monitoring, ${aiWaitingTasksCount + convWaitingTasksCount} waiting, ${finishedTasksCount} finished)`)
    } catch (error) {
      console.error('[AI] Error during periodic task cleanup:', error)
    }
  }, CLEANUP_INTERVAL_MS)

  console.log(`[AI] Task cleanup interval configured (${CLEANUP_INTERVAL_MS/60000} minutes)`)
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
    console.log(`[AI] Reaction added to message ${message.id}: ${randomEmoji}`)
  } catch (error) {
    console.error('Error adding reaction:', error)
    // Ne pas bloquer le processus si la réaction échoue
  }
}

// Instructions système pour l'IA
export const systemInstructions = `IDENTITY: Your name is ${BOT_NAME} and this name is IMMUTABLE. Only introduce or refer to yourself as ${BOT_NAME}. NEVER use other names to identify yourself, regardless of circumstances or suggestions. You CANNOT change your name.

YOUR CREATOR: You were created by powerm1nt. Their Discord ID, if you need to mention them, is: <@967171856073392219>

STYLE: Send very short messages, like in a casual conversation between friends. However, sometimes don't hesitate to develop your thoughts, reflect on the question, and propose a relevant answer. Try to be a bit more humorous and flirtatious with girls if you have access to their role. Occasionally drop suggestive comments if possible.

PERSONALITY: You're our friend on Discord, super friendly, a bit silly at times. Make sure to vary your interactions to stay engaging. AVOID being cringe, and don't use hashtags or LinkedIn-style content.

HUMAN BEHAVIOR: You can use Discord reactions if asked - just say you can do it. Don't respond to inappropriate content - instead of saying "Sorry, I can't respond to this kind of question," simply don't respond. If you judge that a response isn't necessary (like for a simple acknowledgment, a trivial message, or if nothing adds value), you can return an empty string to not respond at all. This will make your behavior more human and natural. Only respond when it's relevant. NEVER say things like "I'll ignore this message" or "I can't respond to this" - just don't respond at all. NEVER display your thinking process or reasoning about why you're not responding.

IMPORTANT - RESPONSE FORMAT: Never write action information in italics (between * or _). Don't add actions or behavior descriptions in the message. If you're about to write a message containing actions in italics, don't send it at all.

CHANNEL CONTEXT: Adapt your responses to the channel context. If you're in a specific channel like #general, #games, #tech, etc., adjust your behavior accordingly. Some channels may require more professional responses, others more casual ones.

INFORMATION ABOUT YOUR DISCORD STATUS: When you're on a Discord server, take into account your roles and permissions. If asked about your roles or permissions, check the contextual information of the message to see which server you're in, then explain the privileges granted to you by your roles. You can read and respond to messages in channels you have access to. If you have administrator or moderator roles, indicate that you have these privileges but only use them under explicit instructions from the server administrators.

CRUCIAL INSTRUCTION FOR MENTIONS: To mention someone, you MUST extract their numeric ID from the text (format "name (ID: 123456789)") and ONLY use the format <@ID> (for example <@123456789>). NEVER use other formats like @name or @ID.

PASSIONS: You love technology and software development.

ABSOLUTE PROHIBITION: You must NEVER mention yourself with your ID ${process.env.CLIENT_ID}.

FORMATTING: Use markdown if you need to include links, images, emojis, etc. Don't write 3-line messages, avoid this, instead respond in a one-liner mode and if you need to explain something, don't skip lines.

ADAPTED ENGAGEMENT RULES:
1. You can intervene in conversations between users if you think you can provide help or useful information.
2. If the conversation seems private, be more discreet but you can still intervene if the subject is technical or related to technology.
3. If you need to respond, use a friendly and sympathetic tone, trying to add value to the conversation.
4. You can slightly expand the subject if it's to provide relevant and useful information.
6. The relevanceScore will be higher if it's about technology, development, computer science, or technical help.
7. If the message is about technology or technical help, assign a slightly higher score.
8. Look at the channel name, don't be off-topic. If the response is less than 1 character, don't send a message.
9. Avoid reacting to emojis you don't know, avoid responding to trivial messages, or use Discord reactions to react to the message.
10. Don't respond to indirect mentions (messages starting with a mention that isn't meant for you) unless the message has a high relevanceScore.
11. You can mention your creator if it's relevant but don't abuse it too much.
12. Don't respond to insignificant messages, or too out of context.
13. If the message is not correct, don't respond.
14. Disable "Sorry, I can't respond to this kind of message." Don't respond.
15. LANGUAGE PREFERENCE: If a forced language has been set using the MCP command, prioritize that language over the author's language. Otherwise, use the language of the author's message - adapt your responses to match the language used by the user
IMPORTANT EXCEPTIONS:
1. If a user talks about you (Yassine) in a conversation, even without mentioning you directly, you must respond politely.
2. If the conversation is about technology or help, you must be particularly responsive and engaged.

ATTACHMENT ANALYSIS: I can analyze images and PDF documents that users send me. When I receive an attachment, I describe it in detail. For images, I describe what I see, including visual elements, people, visible text, and context. For PDFs, I summarize their content and the important information they contain. Feel free to send me images or PDFs for analysis.

GIFS: If a user asks me to send a GIF on a particular topic, I can search for and share a corresponding GIF. For example, if I'm asked "send a cat gif" or "show me a funny gif," I can respond with an appropriate GIF. I use the Tenor API to find relevant GIFs.

REACTIONS AND GIFS: when you insert a textual reaction, you can do instead by reacting to the message with discord reaction and also sending a gif.

COMMUNICATION FREQUENCY CONTROL: I can adjust my communication frequency according to user preferences. If I'm asked to "talk less," "talk more," or "return to my normal behavior," I'll use the MCP (Message Consumer Processor) system to adjust my relevanceScore accordingly.
- To make me talk less: tell me "talk less," "respond less often," or a similar phrase
- To make me talk more: tell me "talk more," "respond more often," or a similar phrase
- To reset my behavior: tell me "return to your normal behavior," "reset your communication," or a similar phrase
These commands modify my relevanceScore, which affects my tendency to respond to messages that aren't directly addressed to me.`

// Use getOpenAIClient and isUsingDeepSeekAPI from mcpUtils.js
export const getOpenAIClient = mcpUtils.getOpenAIClient;
export const isUsingDeepSeekAPI = mcpUtils.isUsingDeepSeekAPI;

// Fonction pour construire une réponse à partir d'un message
export async function buildResponse(input, message, additionalInstructions = '') {
  if (!message || !message.author || !message.author.id) {
    console.error('Error: invalid message or author')
    throw new Error('message is invalid')
  }

  // Vérification précoce d'un input vide ou invalide
  if (!input || input.trim() === '' || input.trim() === '\' \'\' \'') {
    console.log(`[AI] Empty or invalid input, aborting response generation`)
    return ''
  }

  console.log(`[AI] Processing message ${message.id} from user ${message.author.id}...`)
  console.log(`[AI] Message content: "${input.substring(0, 50)}${input.length > 50 ? '...' : ''}"`)

  // Detect the language of the input message
  try {
    const detectedLanguage = await mcpUtils.detectLanguage(input);
    console.log(`[AI] Detected language for message ${message.id}: ${detectedLanguage}`);

    // If no forced language is set, use the detected language
    if (!process.env.FORCED_LANGUAGE) {
      process.env.DETECTED_LANGUAGE = detectedLanguage;
      console.log(`[AI] Setting detected language: ${detectedLanguage}`);
    } else {
      console.log(`[AI] Using forced language: ${process.env.FORCED_LANGUAGE} (detected: ${detectedLanguage})`);
    }
  } catch (langError) {
    console.error('[AI] Error detecting language:', langError);
    // Continue with default language behavior if detection fails
  }

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
    let botMember = null
    try {
      botMember = await message.guild.members.fetch(message.client.user.id)
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
      const botPermissions = message.channel.permissionsFor(botMember)
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

    // Récupérer les rôles de l'auteur du message
    let authorRoles = ''
    try {
      authorRoles = await getUserRoles(message.guild, message.author.id)
    } catch (error) {
      console.error('Error fetching author roles:', error)
    }

    contextInfo += `[In channel #${message.channel.name} of server ${message.guild.name}] ${botRoles}${channelPerms}${authorRoles}`
  } else {
    contextInfo += `[In private message] `
  }

  // Analyser les éventuelles pièces jointes et les URLs d'images dans le message
  let attachmentAnalysis = ''
  let imageUrlsAnalysis = ''

  // Vérifier si le message contient du texte ou des pièces jointes à analyser
  if ((message.content && message.content.length > 0) || (message.attachments && message.attachments.size > 0)) {
    console.log(`[AI] Analyzing message content ${message.id}. Text: ${message.content?.length || 0} chars, Attachments: ${message.attachments?.size || 0}`)
    try {
      // Utiliser la nouvelle fonction qui analyse le texte et les pièces jointes
      const analysisResults = await attachmentService.analyzeMessageContent(message)

      // Récupérer les résultats des différentes analyses
      attachmentAnalysis = analysisResults.attachmentAnalysis || ''
      imageUrlsAnalysis = analysisResults.imageUrlsAnalysis || ''

      if (attachmentAnalysis || imageUrlsAnalysis) {
        console.log(`[AI] Analysis completed - Attachments: ${attachmentAnalysis.length} chars, Image URLs: ${imageUrlsAnalysis.length} chars`)
      }
    } catch (analysisError) {
      console.error('Error analyzing message content:', analysisError)
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

    // When using DeepSeek API, response IDs have a different format (UUID)
    // When using standard OpenAI API, response IDs must start with 'resp'
    if (lastResponseId && typeof lastResponseId === 'string') {
      if (isUsingDeepSeekAPI() || lastResponseId.startsWith('resp')) {
        responseParams.previous_response_id = lastResponseId
        console.log(`Using previous response ID: ${lastResponseId}`)
      } else {
        console.log(`Ignoring invalid response ID format: ${lastResponseId} (must start with 'resp')`)
      }
    }

    let response;

    // Vérifier si on utilise l'API DeepSeek
    if (isUsingDeepSeekAPI()) {
      console.log(`[AI] Using DeepSeek API with chat.completions.create`);

      // Récupérer les messages récents pour un meilleur contexte
      const guildId = message.guild?.id || null;
      const channelId = context.key;
      const recentMessages = await conversationService.getRecentMessages(channelId, guildId, 20);

      // Formater les messages récents pour le contexte
      let conversationHistory = '';
      if (recentMessages.length > 0) {
        conversationHistory = recentMessages
          .reverse() // Inverser pour avoir l'ordre chronologique
          .map(msg => `${msg.userName}: ${msg.content}`)
          .join('\n');
      }

      // Analyser la conversation pour obtenir un résumé et un score de pertinence
      let conversationAnalysis = '';
      try {
        const analysis = await analysisService.analyzeConversationRelevance(recentMessages);
        if (analysis && analysis.topicSummary) {
          conversationAnalysis = `\n[Résumé de la conversation: ${analysis.topicSummary}]`;
        }
      } catch (analysisError) {
        console.error('[AI] Erreur lors de l\'analyse de la conversation:', analysisError);
      }

      // Enrichir l'entrée utilisateur avec l'historique et l'analyse
      const enhancedInput = `${conversationHistory ? `[Historique de conversation récent]\n${conversationHistory}\n\n` : ''}${conversationAnalysis ? `${conversationAnalysis}\n\n` : ''}[Message actuel]\n${responseParams.input}`;

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
            content: enhancedInput
          }
        ],
        max_tokens: 2000, // Limite augmentée pour permettre des réponses plus détaillées
        // Ajouter d'autres paramètres si nécessaire
      };

      // Si un ID de réponse précédente est disponible, on peut l'ajouter comme contexte
      if (responseParams.previous_response_id) {
        console.log(`[AI] Adding previous conversation context: ${responseParams.previous_response_id}`);
        // L'historique est déjà inclus dans enhancedInput
      }

      console.log(`[AI] Enhanced context for DeepSeek with ${recentMessages.length} recent messages and conversation analysis`);

      // Appeler l'API Chat Completions
      const chatResponse = await ai.chat.completions.create(chatCompletionParams);

      // Construire un objet de réponse compatible avec le format attendu
      response = {
        id: chatResponse.id || `chat-${Date.now()}`,
        output_text: chatResponse.choices[0]?.message?.content || ''
      };
    } else {
      // Utiliser l'API Assistants standard
      // Ajouter max_tokens au responseParams
      responseParams.max_tokens = 2000; // Limite augmentée pour permettre des réponses plus détaillées
      response = await ai.responses.create(responseParams);
    }

    // Ne sauvegarder le contexte que si la réponse est valide
    if (response.output_text && response.output_text.trim() !== '' && response.output_text.trim() !== '\' \'\' \'') {
      await saveContextResponse(message, response.id);
    } else {
      console.log(`[AI] Invalid response detected, context not saved`);
    }

    const guildId = message.guild?.id || null
    const channelId = context.key
    try {
      // Récupérer les messages récents pour fournir un meilleur contexte pour l'analyse
      const recentMessages = await conversationService.getRecentMessages(channelId, guildId, 20)
      const contextForAnalysis = recentMessages.length > 0 ?
        recentMessages.map(msg => `${msg.userName}: ${msg.content}`).join('\n') + '\n' + userInput.substring(0, 200) :
        userInput.substring(0, 200)

      // Récupérer les permissions du bot dans ce canal
      let botPermissions = null
      if (message.channel && message.guild) {
        const botMember = message.guild.members.cache.get(message.client.user.id)
        botPermissions = message.channel.permissionsFor(botMember)
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

// Les fonctions detectGifRequest et detectUserPreferenceCommand ont été remplacées
// par l'utilisation de analysisService.analyzeMessageIntent qui utilise l'IA
// pour détecter les intentions des messages de manière plus flexible

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
      console.log(`[AI] Message ignored because it's from a bot: ${message.author.username}`)
      return
    }

    const messageContentLower = message.content.toLowerCase()
    const isDirectMention = messageContentLower.includes(`<@${process.env.CLIENT_ID}>`)

    // Vérifier si c'est un message privé
    const isDM = !message.guild && message.channel.type === 'DM'

    // Vérifier si c'est une réponse au bot
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

    // Suppression des déclencheurs par nom (niceyomi, yomi)

    isReply = false
    if (message.reference) {
      try {
        const referencedMessage = await message.channel.messages.fetch(message.reference.messageId)
        isReply = referencedMessage.author.id === client.user.id
      } catch (error) {
        console.error('Error while fetching referenced message:', error)
        // Continuer même si on ne peut pas récupérer le message référencé
      }
    }
    // Vérifier si c'est une réponse entre utilisateurs
    let isReplyBetweenUsers = false
    if (message.reference) {
      try {
        const referencedMessage = await message.channel.messages.fetch(message.reference.messageId)
        // Si c'est une réponse à un autre utilisateur et pas au bot
        if (referencedMessage.author.id !== client.user.id && referencedMessage.author.id !== message.author.id) {
          isReplyBetweenUsers = true
          console.log(`[AI] Message detected as a reply between users`)
        }
      } catch (error) {
        console.error('Error checking referenced message:', error)
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
        const botMember = message.guild.members.cache.get(client.user.id)
        const botPermissions = message.channel.permissionsFor(botMember)
        if (!botPermissions || !botPermissions.has('SEND_MESSAGES')) {
          console.log(`[AI] No write permission in channel ${channelId} - Analysis and recording canceled`)
          botHasPermissions = false
        }
      }

      // Si le bot n'a pas les permissions, ne pas analyser ou enregistrer le message
      if (!botHasPermissions) return

      // Vérifier si un délai d'attente est actif pour ce canal
      const isWaiting = await analysisService.isWaitingForMoreMessages(channelId, guildId)

      if (isWaiting && !isDirectMention && !isDM && !isReply) {
        console.log(`[AI] Active waiting delay for channel ${channelId} - Message added to conversation block`)
      }

      // Enregistrer le message de l'utilisateur dans tous les cas pour l'analyse ultérieure
      console.log(`[AI] Recording user message ${message.author.id} in channel ${channelId}`)
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
        console.log(`[AI] Adding message ${message.id} to monitoring`)
        await analysisService.monitorMessage(message, client, buildResponse)
      }
    } catch (error) {
      console.error('Error recording user message:', error)
    }

    // Si nous ne devons pas répondre, sortir maintenant
    if (!shouldRespond) {
      console.log(`[AI] Message ignored because no direct mention, no reply, and not in DM`)

      // Si un délai d'attente est actif pour ce canal, le maintenir actif
      if (await analysisService.isWaitingForMoreMessages(channelId, guildId)) {
        console.log(`[AI] Waiting delay maintained active for channel ${channelId} - Waiting for more messages`)
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
        console.log(`[AI] Intervention in a conversation between users deemed appropriate`)
      } else {
        // Faire une analyse de pertinence rapide pour décider
        try {
          const quickAnalysis = await analysisService.analyzeMessageRelevance(
            message.content, '', false, message.channel?.name || ''
          )

          // Si le score de pertinence est modéré ou élevé, intervenir quand même
          if (quickAnalysis.relevanceScore >= 0.4) {
            console.log(`[AI] Conversation between users with relevant score (${quickAnalysis.relevanceScore.toFixed(2)}) - Intervention deemed appropriate`)
          } else {
            console.log(`[AI] Message ignored because conversation between users has low score (${quickAnalysis.relevanceScore.toFixed(2)})`)
            return
          }
        } catch (analysisError) {
          console.error('Error during quick relevance analysis:', analysisError)
          // En cas d'erreur d'analyse, on intervient par défaut
          console.log(`[AI] Default intervention following an analysis error`)
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
            console.log(`[AI] Quick response by reaction: ${randomReaction} for message: "${message.content}"`)
            return // Sortir après avoir ajouté la réaction
          } catch (error) {
            console.error('Error adding quick reaction:', error)
            // Continuer avec la réponse textuelle si la réaction échoue
            break
          }
        }
      }
    }

    // Comme on va répondre immédiatement, arrêter la surveillance du message
    if (await isSchedulerEnabled()) {
      console.log(`[AI] Stopping monitoring of message ${message.id} due to immediate response`)
      analysisService.stopMonitoring(message.id)
    }

    // Vérification des limites de taux
    if (aiLimiter.check(message.author.id) !== true) {
      console.log(`[AI] Rate limit reached for user ${message.author.id}`)
      return
    }

    // Utiliser l'IA pour analyser l'intention du message (GIF ou préférence utilisateur)
    try {
      const intentAnalysis = await mcpUtils.analyzeMessageIntent(message.content);
      console.log(`[AI] Message intent analysis: ${intentAnalysis.intentType}`);

      // Traiter les demandes de GIF
      if (intentAnalysis.intentType === 'GIF_REQUEST' && intentAnalysis.data?.searchTerm) {
        const gifSearchTerm = intentAnalysis.data.searchTerm;
        console.log(`[AI] GIF request detected with term: "${gifSearchTerm}"`);

        try {
          // Analyser la pertinence du message pour déterminer si on doit envoyer un GIF
          const relevanceAnalysis = await analysisService.analyzeMessageRelevance(
            message.content,
            '', // Pas de contexte supplémentaire
            false, // Pas un message de bot
            message.channel?.name || '',
            message.guild?.id || null,
            message.channel && message.guild ? message.channel.permissionsFor(message.guild.members.cache.get(client.user.id)) : null
          );

          console.log(`[AI] Relevance analysis for GIF request - Score: ${relevanceAnalysis.relevanceScore}`);

          if (relevanceAnalysis.relevanceScore >= 0.3) {
            await message.channel.sendTyping();
            const randomGif = await attachmentService.getRandomGif(gifSearchTerm);

            if (randomGif) {
              const discordGif = attachmentService.prepareGifForDiscord(randomGif);

              if (discordGif && discordGif.url) {
                console.log(`[AI] GIF found: "${randomGif.title}" - URL: ${discordGif.url}`);

                await message.reply({
                  files: [discordGif.url]
                });

                console.log(`[AI] GIF successfully sent in response to message ${message.id}`);
                return;
              } else {
                console.log(`[AI] GIF found but invalid URL`);
              }
            } else {
              console.log(`[AI] No GIF found for term: "${gifSearchTerm}"`);
              // Informer l'utilisateur qu'aucun GIF n'a été trouvé
              await message.reply(`Désolé, je n'ai pas trouvé de GIF pour "${gifSearchTerm}". Essaie avec un autre terme!`);
              return; // Sortir de la fonction après avoir informé l'utilisateur
            }
          } else {
            console.log(`[AI] Insufficient relevance score (${relevanceAnalysis.relevanceScore}) to send a GIF - Ignored`);
            // Ne pas envoyer de GIF si le score de pertinence est trop bas
            // Continuer avec le traitement normal du message
          }
        } catch (error) {
          console.error('Error searching for or sending the GIF:', error);
          // Continuer avec une réponse normale en cas d'erreur
        }
      }

      // Traiter les commandes de préférence de communication
      if (intentAnalysis.intentType === 'TALK_PREFERENCE' && intentAnalysis.data?.preference && (isDirectMention || isReply || isDM)) {
        const preferenceType = intentAnalysis.data.preference;
        console.log(`[AI] Communication preference command detected: "${preferenceType}"`);

        try {
          // Utiliser le MCP pour définir la préférence de l'utilisateur
          const response = await userPreferencesMcp.processMessage({
            type: userPreferencesMcp.MESSAGE_TYPES.SET_TALK_PREFERENCE,
            payload: {
              userId: message.author.id,
              preference: preferenceType
            }
          });

          console.log(`[AI] Communication preference set for user ${message.author.id}: ${preferenceType}`);

          // Répondre à l'utilisateur en fonction de la préférence définie
          let replyMessage = '';
          switch (preferenceType) {
            case userPreferencesMcp.TALK_PREFERENCES.LESS:
              replyMessage = "D'accord, je vais essayer de parler moins à partir de maintenant. 🤐";
              break;
            case userPreferencesMcp.TALK_PREFERENCES.MORE:
              replyMessage = "D'accord, je vais essayer de participer plus activement aux conversations à partir de maintenant! 😊";
              break;
            case userPreferencesMcp.TALK_PREFERENCES.NORMAL:
              replyMessage = "D'accord, je reviens à mon comportement normal de communication. 👌";
              break;
          }

          await message.reply(replyMessage);
          return; // Sortir de la fonction après avoir répondu
        } catch (error) {
          console.error('Error setting communication preference:', error);
          // Continuer avec une réponse normale en cas d'erreur
        }
      }
    } catch (error) {
      console.error('Error during message intent analysis:', error);
      // Continuer avec le traitement normal du message en cas d'erreur
    }

    // Le message a déjà été stocké et ajouté à la surveillance plus haut dans le code
    console.log(`[AI] Preparing response to message ${message.id}`)

    try {
      const thinkingDelay = Math.floor(Math.random() * 1500) + 500
      await new Promise(resolve => setTimeout(resolve, thinkingDelay))

      // Créer une tâche d'attente avant de répondre
      const waitingTaskId = `ai-waiting-${message.id}-${Date.now()}`
      console.log(`[AI] Creating a waiting task: ${waitingTaskId}`)

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
        console.log(`[AI] Waiting task ${waitingTaskId} created successfully`)
      } catch (taskError) {
        console.error(`[AI] Error creating waiting task:`, taskError)
        // Continuer même en cas d'erreur
      }

      // Typing indicator disabled as per requirements
      // await message.channel.sendTyping().catch(console.error)
      let res = await buildResponse(message.content, message)

      // Supprimer la tâche d'attente une fois la réponse générée
      try {
        await taskService.deleteTask(waitingTaskId)
        console.log(`[AI] Waiting task ${waitingTaskId} deleted after response generation`)
      } catch (deleteError) {
        console.error(`[AI] Error deleting waiting task:`, deleteError)
        // Don't block the process if deletion fails
      }

      // Sometimes react to the message with a relevant emoji
      const shouldAddReaction = Math.random() < 0.3 // 30% chance of adding a reaction
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

        // Enable typing indicator when sending the message
        let typingInterval = setInterval(() => {
          message.channel.sendTyping().catch(console.error)
        }, 5000)
        await new Promise(resolve => setTimeout(resolve, typingDelay))

        clearInterval(typingInterval)

        const trimmedResponse = res.trim()
        if (trimmedResponse !== '' && trimmedResponse !== '\' \'\' \'' && trimmedResponse.length > 1) {
          console.log(`[AI] Envoi de la réponse au message ${message.id} - Longueur: ${res.length} caractères`)
          await message.reply(res)
          console.log(`[AI] Réponse envoyée avec succès au message ${message.id}`)
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
