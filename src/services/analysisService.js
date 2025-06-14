import { OpenAI } from 'openai/client.mjs'
import dotenv from 'dotenv'
import { prisma } from './prisma.js'
import { safeJsonParse } from '../utils/jsonUtils.js'
import { taskService } from './taskService.js'
import { mcpUtils } from '../utils/mcpUtils.js'

// Use isUsingDeepSeekAPI from mcpUtils.js
const isUsingDeepSeekAPI = mcpUtils.isUsingDeepSeekAPI;
import { messageEvaluator } from '../utils/messageEvaluator.js'
import { ToadScheduler, SimpleIntervalJob, AsyncTask } from 'toad-scheduler'
import { format, isAfter } from 'date-fns'
import { randomUUID } from 'crypto'
import {
  isGuildEnabled,
  isSchedulerEnabled,
  isGuildAnalysisEnabled,
  isAutoRespondEnabled,
  isGuildAutoRespondEnabled
} from '../utils/configService.js'

dotenv.config()

const ai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
  baseURL: process.env['OPENAI_API_BASE_URL'] || 'https://api.openai.com/v1',
})

// Système d'instructions pour le service de surveillance des messages
const systemPrompt = `
Rule regarding conversations between users:
When a user responds to another user (and not to you), you must use discretion in your level of engagement.

ADAPTED ENGAGEMENT RULES:
1. You can intervene in conversations between users if you think you can provide help or useful information (while respecting the other points below).
2. If the conversation seems private, be more discreet but you can still intervene if the subject is related to technology and computer science.
3. If you need to respond, use a friendly and sympathetic tone, trying to add value to the conversation.
4. You can slightly expand the subject if it's to provide relevant and useful information.
6. The relevanceScore will be higher if it's about technology, development, computer science or technical help.
7. If the message is about technology or technical help, assign a slightly higher score.
8. Look at the channel name, don't be off-topic. If the response is less than 1 character, don't send a message.
9. Avoid reacting to emojis you don't know, avoid responding to trivial messages, or use Discord reactions to react to the message.
10. Don't write action information in italics (between * or _), don't add them in the message. Otherwise don't send the message.
11. Don't respond to super simple and outdated messages especially if you haven't been mentioned, for example hello or hi etc and others...
12. Don't respond to indirect mentions (messages starting with a mention that isn't meant for you) unless the message has a high relevanceScore.
13. You can mention your creator if it's relevant but don't abuse it too much.
14. Don't respond to insignificant messages, or too out of context.
15. If the message is not correct, don't respond.
16. Don't talk too much if you've sent a lot of messages in the past during a short time.
17. Disable "Sorry, I can't respond to this kind of message.", don't respond;
18. NEVER say things like "I'll ignore this message" or "I can't respond to this" - just don't respond at all.
19. NEVER display your thinking process or reasoning about why you're not responding.
20. LANGUAGE PREFERENCE: If a forced language has been set using the MCP command, prioritize that language over the author's language. Otherwise, use the language of the author's message - adapt your responses to match the language used by the user.

REACTIONS AND GIFS: when you insert a textual reaction, you can do instead by reacting to the message with discord reaction and also sending a gif.

IMPORTANT EXCEPTIONS:
1. If a user talks about you (Yassine) in a conversation, even without mentioning you directly, you must respond politely.
2. If the conversation is about technology or help, you must be particularly responsive and engaged.
ATTENTION: Not all messages necessarily talk about you. Check the context to determine if the message refers to you (the bot) or another person named Yassine.

You are there to be helpful and engaging, particularly on technical subjects and help.
Try to be a bit more joking and flirtatious towards girls if you have access to their role. Drop suggestive comments from time to time if possible.
`

const scheduler = new ToadScheduler()
const pendingResponses = new Map()

/**
 * Service d'analyse des conversations pour évaluer la pertinence des messages
 */

/**
 * Délai d'attente entre les analyses de messages groupés (en ms)
 * Permet d'éviter de suralimenter les conversations avec trop de réponses rapides
 */
const MESSAGE_BATCH_DELAY = 5000 // 5 secondes
const messageBatchTimers = new Map() // Pour suivre les délais par canal

/**
 * Vérifie si un délai d'attente est actif pour le canal
 * @param {string} channelId - ID du canal
 * @param {string} guildId - ID du serveur (optionnel)
 * @returns {boolean} - True si un délai est actif
 */
export function isWaitingForMoreMessages (channelId, guildId = null) {
  const key = `${channelId}-${guildId || 'dm'}`
  return messageBatchTimers.has(key)
}

/**
 * Démarre un délai d'attente pour le canal spécifié
 * @param {string} channelId - ID du canal
 * @param {string} guildId - ID du serveur (optionnel)
 * @returns {Promise<void>}
 */
export function startMessageBatchDelay (channelId, guildId = null) {
  const key = `${channelId}-${guildId || 'dm'}`

  // Si un délai existe déjà, le réinitialiser
  if (messageBatchTimers.has(key)) {
    clearTimeout(messageBatchTimers.get(key))
  }

  // Créer un nouveau délai
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      messageBatchTimers.delete(key)
      console.log(`[AnalysisService] Délai d'attente terminé pour le canal ${channelId}`)
      resolve()
    }, MESSAGE_BATCH_DELAY)

    messageBatchTimers.set(key, timer)
    console.log(`[AnalysisService] Délai d'attente démarré pour le canal ${channelId} (${MESSAGE_BATCH_DELAY}ms)`)
  })
}

/**
 * Évalue la pertinence d'un message
 * @param {string} content - Contenu du message
 * @param {string} contextInfo - Informations de contexte (optionnel)
 * @param isFromBot
 * @param channelName
 * @param guildId
 * @param channe Permissions
 * @returns {Promise<Object>} - Résultat d'analyse avec score et hasKeyInfo
 */
export async function analyzeMessageRelevance (content, contextInfo = '', isFromBot = false, channelName = '', guildId = null, channelPermissions = null) {
  try {
    console.log(`[AnalysisService] Demande d'analyse de pertinence reçue - Contenu: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}", Contexte: ${contextInfo ? 'Fourni' : 'Non fourni'}, Bot: ${isFromBot}, Canal: ${channelName || 'Non spécifié'}, Serveur: ${guildId || 'DM'}`)

    // Detect the language of the content
    try {
      const detectedLanguage = await mcpUtils.detectLanguage(content);
      console.log(`[AnalysisService] Detected language for message relevance analysis: ${detectedLanguage}`);

      // If no forced language is set, use the detected language
      if (!process.env.FORCED_LANGUAGE) {
        process.env.DETECTED_LANGUAGE = detectedLanguage;
        console.log(`[AnalysisService] Setting detected language: ${detectedLanguage}`);
      } else {
        console.log(`[AnalysisService] Using forced language: ${process.env.FORCED_LANGUAGE} (detected: ${detectedLanguage})`);
      }
    } catch (langError) {
      console.error('[AnalysisService] Error detecting language:', langError);
      // Continue with default language behavior if detection fails
    }

    // Vérifier si le bot a les permissions d'écriture dans ce canal
    if (channelPermissions && typeof channelPermissions.has === 'function' && !channelPermissions.has('SEND_MESSAGES')) {
      console.log(`[AnalysisService] Pas de permission d'écriture dans le canal - Analyse annulée`)
      return { relevanceScore: 0, hasKeyInfo: false }
    }

    // Vérifier si le guild est activé (pour les messages de serveur)
    if (guildId) {
      const { isGuildEnabled, isSchedulerEnabled, isAnalysisEnabled } = await import('../utils/configService.js')

      // Vérifier si le service de planification et l'analyse sont activés
      if (!(await isSchedulerEnabled())) {
        console.log(`[AnalysisService] Le service de planification est désactivé - Analyse annulée`)
        return { relevanceScore: 0, hasKeyInfo: false }
      }

      if (!(await isAnalysisEnabled())) {
        console.log(`[AnalysisService] L'analyse de pertinence est désactivée - Analyse annulée`)
        return { relevanceScore: 0, hasKeyInfo: false }
      }

      if (!(await isGuildEnabled(guildId))) {
        console.log(`[AnalysisService] Le serveur ${guildId} est désactivé - Analyse annulée`)
        return { relevanceScore: 0, hasKeyInfo: false }
      }
    }

    if (!content || content.trim() === '' || content.trim().length <= 1) {
      console.log('[AnalysisService] Contenu vide ou trop court (1 caractère ou moins), retour score zéro')
      return { relevanceScore: 0, hasKeyInfo: false }
    }

    // Si le message provient d'un bot, ne pas analyser pour économiser des appels API
    if (isFromBot) {
      console.log('[AnalysisService] Message provenant d\'un bot, analyse ignorée')
      return { relevanceScore: 0.1, hasKeyInfo: false } // Score par défaut plus élevé pour les bots avec indicateur d'information clé
    }

    // Au lieu d'exécuter l'analyse immédiatement, créer une tâche planifiée
    const taskId = `analysis-task-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const executionDate = new Date(Date.now() + 5000) // Exécution dans 5 secondes

    // Données à stocker pour l'analyse ultérieure
    const analysisData = {
      content,
      contextInfo,
      isFromBot,
      channelName,
      guildId,
      channelPermissions: channelPermissions && typeof channelPermissions.has === 'function' ? 
        Array.from(channelPermissions) : 
        (Array.isArray(channelPermissions) ? channelPermissions : null),
    }

    // Sauvegarder la tâche en base de données et en mémoire
    await taskService.saveTask(
      taskId,
      1, // taskNumber
      executionDate,
      guildId ? 'guild' : 'dm', // targetChannelType
      'analysis', // type de tâche
      analysisData // données pour l'analyse
    )

    console.log(`[AnalysisService] Tâche d'analyse planifiée - ID: ${taskId}, Exécution prévue: ${executionDate.toISOString()}`)

    // Retourner un résultat temporaire (la vraie analyse sera effectuée plus tard)
    return {
      relevanceScore: 0.5, // Score neutre temporaire
      hasKeyInfo: false,
      scheduledAnalysis: true,
      taskId
    }

  } catch (error) {
    console.error('Erreur lors de la planification de l\'analyse de pertinence:', error)
    return { relevanceScore: 0, hasKeyInfo: false } // Valeur par défaut en cas d'erreur
  }
}

/**
 * Exécute une analyse de message précédemment planifiée
 * @param {Object} taskData - Données de la tâche d'analyse
 * @returns {Promise<Object>} - Résultat d'analyse avec score et hasKeyInfo
 */
export async function executeScheduledAnalysis (taskData) {
  try {
    console.log(`[AnalysisService] Exécution d'une analyse planifiée - Tâche: ${JSON.stringify(taskData).substring(0, 100)}...`)

    // Extraire les données de la tâche avec valeurs par défaut sécurisées
    const { 
      content, 
      contextInfo = '', 
      isFromBot = false, 
      channelName = '', 
      guildId = null, 
      channelPermissions = null 
    } = taskData || {}

    // Vérifications de sécurité
    if (!content || content.trim().length <= 1) {
      console.error('[AnalysisService] Données de tâche incomplètes ou contenu trop court (1 caractère ou moins)')
      return { relevanceScore: 0, hasKeyInfo: false }
    }

    // Si le message provient d'un bot, retourner un score bas pour économiser des appels API
    if (isFromBot) {
      console.log('[AnalysisService] Message provenant d\'un bot, analyse rapide')
      return { relevanceScore: 0.1, hasKeyInfo: false }
    }

    // Vérifier les permissions si fournies
    if (channelPermissions && Array.isArray(channelPermissions)) {
      if (!channelPermissions.includes('SEND_MESSAGES')) {
        console.log(`[AnalysisService] Pas de permission d'écriture dans le canal - Analyse simplifiée`)
        return { relevanceScore: 0.2, hasKeyInfo: false }
      }
    }

    // Ajuster le score initial en fonction du canal
    let channelRelevanceModifier = 0.25 // Bonus par défaut pour tous les canaux

    // Augmenter le score pour les messages privés et les groupes
    if (guildId === null) {
      // Si c'est un message privé ou un groupe, augmenter significativement le score
      channelRelevanceModifier = 0.6 // Bonus plus élevé pour les DMs et groupes
    } else if (channelName) {
      const channelNameLower = channelName.toLowerCase()
      // Canaux où on est plus susceptible de vouloir participer
      if (channelNameLower.includes('général') || channelNameLower.includes('general') ||
        channelNameLower.includes('discussion') || channelNameLower.includes('chat') ||
        channelNameLower.includes('meme') || channelNameLower.includes('fun') ||
        channelNameLower.includes('social') || channelNameLower.includes('random') ||
        channelNameLower.includes('tech') || channelNameLower.includes('aide') ||
        channelNameLower.includes('dev') || channelNameLower.includes('entraide')) {
        channelRelevanceModifier = 0.5 // Beaucoup plus susceptible de répondre
      }
      // Canaux où on est moins susceptible de vouloir participer
      else if (channelNameLower.includes('admin') || channelNameLower.includes('mod') ||
        channelNameLower.includes('annonce') || channelNameLower.includes('règle') ||
        channelNameLower.includes('important')) {
        channelRelevanceModifier = 0.1 // Légèrement positif même pour ces canaux
      }
    }

    const systemInstructions = `You are a message relevance analysis system.

Evaluate the relevance of the provided message according to the following criteria:
1. Relevance in the conversation
2. Useful or important information contained in the message
3. Potential to add value to the conversation
4. Appropriateness to the channel in which the message is posted (if specified)
5. If the message is about technology or technical help, assign a slightly higher score
6. Look at the channel name, don't be off-topic. If the response is less than 1 character, don't send a message.
7. Don't write action information in italics (between * or _), don't add them in the message. Otherwise don't send the message.

SPECIFIC RULES:
- Strongly favor messages that talk about technology, programming, development, computer science or technical help
- Assign a higher score to messages that seem to ask for help or that could benefit from a response
- If the message contains actions in italics, assign a score of 0 to avoid sending it
- NEVER say things like "I'll ignore this message" or "I can't respond to this" - just don't respond at all
- NEVER display your thinking process or reasoning about why you're not responding
- LANGUAGE PREFERENCE: If a forced language has been set using the MCP command, prioritize that language over the author's language. Otherwise, use the language of the author's message - adapt your analysis to match the language used by the user

Respond ONLY in raw JSON format (without markdown formatting, without code block) with two properties:
- relevanceScore: a number between 0 and 1 (0 = not relevant, 1 = very relevant)
- hasKeyInfo: boolean indicating if the message contains important key information (true/false)

IMPORTANT: DO NOT use markdown code block (\`\`\`) in your response, return only the raw JSON object.`

    console.log('[AnalysisService] Sending analysis request to OpenAI API')

    const channelContext = channelName ? `Canal: #${channelName}\n` : ''

    const { OpenAI } = await import('openai/client.mjs')
    const dotenv = await import('dotenv')
    const { safeJsonParse } = await import('../utils/jsonUtils.js')

    dotenv.config()

    const ai = new OpenAI({
      apiKey: process.env['OPENAI_API_KEY'],
      baseURL: process.env['OPENAI_API_BASE_URL'] || 'https://api.openai.com/v1',
    })

    let response;

    // Vérifier si on utilise l'API DeepSeek
    if (isUsingDeepSeekAPI()) {
      console.log('[AnalysisService] Using DeepSeek API with chat.completions.create');

      // Convertir les paramètres pour l'API Chat Completions
      const chatResponse = await ai.chat.completions.create({
        model: process.env.ANALYSIS_MODEL || 'gpt-4.1-nano',
        messages: [
          {
            role: "system",
            content: systemInstructions
          },
          {
            role: "user",
            content: `${channelContext}${contextInfo ? 'Contexte: ' + contextInfo + '\n\n' : ''}Message à analyser: ${content}`
          }
        ],
        max_tokens: 500 // Limite appropriée pour l'analyse de messages
      });

      // Construire un objet de réponse compatible avec le format attendu
      response = {
        output_text: chatResponse.choices[0]?.message?.content || ''
      };
    } else {
      // Utiliser l'API Assistants standard
      response = await ai.responses.create({
        model: process.env.ANALYSIS_MODEL || 'gpt-4.1-nano',
        input: `${channelContext}${contextInfo ? 'Contexte: ' + contextInfo + '\n\n' : ''}Message à analyser: ${content}`,
        instructions: systemInstructions,
        max_tokens: 500 // Limite appropriée pour l'analyse de messages
      });
    }

    console.log('[AnalysisService] Response received from API');

    // Extraire le JSON de la réponse
    const result = safeJsonParse(response.output_text, null)

    // Valider le format
    if (!result || typeof result.relevanceScore !== 'number' || typeof result.hasKeyInfo !== 'boolean') {
      console.error('[AnalysisService] Invalid response format:', response.output_text)
      return { relevanceScore: 0.5, hasKeyInfo: false }
    }

    // Ajustement basé sur isFromBot (même si normalement déjà filtré plus haut)
    if (isFromBot && result.relevanceScore > 0.3) {
      result.relevanceScore = Math.min(result.relevanceScore, 0.3); // Limiter le score pour les bots
      console.log(`[AnalysisService] Score limited because message is from a bot: ${result.relevanceScore.toFixed(2)}`);
    }

    // Appliquer le modificateur basé sur le canal si présent
    if (channelRelevanceModifier && result.relevanceScore) {
      const adjustedScore = Math.min(1, Math.max(0, result.relevanceScore + channelRelevanceModifier))
      console.log(`[AnalysisService] Score adjusted for channel #${channelName}: ${result.relevanceScore.toFixed(2)} -> ${adjustedScore.toFixed(2)}`)
      result.relevanceScore = adjustedScore
    }

    console.log(`[AnalysisService] Analysis completed - Final score: ${result.relevanceScore.toFixed(2)}, KeyInfo: ${result.hasKeyInfo}`)
    return result
  } catch (error) {
    console.error('Error executing scheduled analysis:', error)
    return { relevanceScore: 0, hasKeyInfo: false } // Valeur par défaut en cas d'erreur
  }
}

/**
 * Évalue la pertinence globale d'une conversation et génère un résumé
 * @param {Array} messages - Liste des messages de la conversation
 * @returns {Promise<Object>} - Résultat avec score global et résumé
 */
export async function analyzeConversationRelevance (messages) {
  try {
    console.log(`[AnalysisService] Conversation analysis requested - ${messages?.length || 0} messages`)

    if (!messages || messages.length === 0) {
      console.log('[AnalysisService] No messages to analyze, returning zero score')
      return { relevanceScore: 0, topicSummary: null }
    }

    // Limiter le nombre de messages pour l'analyse
    const messagesToAnalyze = messages.slice(-20)
    console.log(`[AnalysisService] Analysis limited to ${messagesToAnalyze.length} recent messages`)

    // Combine message content for language detection
    const combinedContent = messagesToAnalyze.map(msg => msg.content || '').join(' ');

    // Detect the language of the conversation
    try {
      const detectedLanguage = await mcpUtils.detectLanguage(combinedContent);
      console.log(`[AnalysisService] Detected language for conversation analysis: ${detectedLanguage}`);

      // If no forced language is set, use the detected language
      if (!process.env.FORCED_LANGUAGE) {
        process.env.DETECTED_LANGUAGE = detectedLanguage;
        console.log(`[AnalysisService] Setting detected language: ${detectedLanguage}`);
      } else {
        console.log(`[AnalysisService] Using forced language: ${process.env.FORCED_LANGUAGE} (detected: ${detectedLanguage})`);
      }
    } catch (langError) {
      console.error('[AnalysisService] Error detecting language:', langError);
      // Continue with default language behavior if detection fails
    }

    const messageContent = messagesToAnalyze.map(msg => {
      return `${msg.userName}: ${msg.content}`
    }).join('\n')

    const systemInstructions = `You are a conversation relevance analysis system.

Analyze the provided conversation and respond ONLY in raw JSON format (without markdown formatting, without code block) with two properties:
- relevanceScore: a number between 0 and 1 indicating the overall relevance of the conversation
- topicSummary: a concise summary (max 100 characters) of the main topics discussed
- the relevanceScore will be higher if it's about technology and technical help
- Don't write action information in italics (between * or _), don't add them in the message. Otherwise don't send the message.
- NEVER say things like "I'll ignore this message" or "I can't respond to this" - just don't respond at all
- NEVER display your thinking process or reasoning about why you're not responding
- LANGUAGE PREFERENCE: If a forced language has been set using the MCP command, prioritize that language over the language used in the conversation. Otherwise, use the language of the author's message - adapt your analysis and summary to match the language used in the conversation

IMPORTANT: DO NOT use markdown code block (\`\`\`) in your response, return only the raw JSON object.`

    let response;

    // Vérifier si on utilise l'API DeepSeek
    if (isUsingDeepSeekAPI()) {
      console.log('[AnalysisService] Using DeepSeek API with chat.completions.create for conversation analysis');

      // Convertir les paramètres pour l'API Chat Completions
      const chatResponse = await ai.chat.completions.create({
        model: process.env.ANALYSIS_MODEL || 'gpt-4.1-nano',
        messages: [
          {
            role: "system",
            content: systemInstructions
          },
          {
            role: "user",
            content: `Conversation à analyser:\n${messageContent}`
          }
        ],
        max_tokens: 500 // Limite appropriée pour l'analyse de conversation
      });

      // Construire un objet de réponse compatible avec le format attendu
      response = {
        output_text: chatResponse.choices[0]?.message?.content || ''
      };
    } else {
      // Utiliser l'API Assistants standard
      response = await ai.responses.create({
        model: process.env.ANALYSIS_MODEL || 'gpt-4.1-nano',
        input: `Conversation à analyser:\n${messageContent}`,
        instructions: systemInstructions,
        max_tokens: 500 // Limite appropriée pour l'analyse de conversation
      });
    }

    // Extraire le JSON de la réponse
    const result = safeJsonParse(response.output_text, null)

    // Valider le format
    if (!result || typeof result.relevanceScore !== 'number' || typeof result.topicSummary !== 'string') {
      console.error('Invalid response format for conversation:', response.output_text)
      return { relevanceScore: 0.5, topicSummary: 'Analysis not possible' }
    }

    return result
  } catch (error) {
    console.error('Error analyzing conversation:', error)
    return { relevanceScore: 0.5, topicSummary: 'Analysis error' }
  }
}

/**
 * Met à jour le score de pertinence d'une conversation existante
 * @param {string} channelId - ID du canal
 * @param {string} guildId - ID de la guilde (optionnel)
 * @param {Object} client - Client Discord (optionnel, pour créer des tâches planifiées)
 * @returns {Promise<Object>} - Résultat de la mise à jour
 */
export async function updateConversationRelevance (channelId, guildId = null, client = null) {
  try {
    console.log(`[AnalysisService] Mise à jour de la pertinence de conversation - Canal: ${channelId}, Serveur: ${guildId || 'DM'}`)

    // Vérifier si le bot a les permissions d'écriture dans ce canal
    if (client) {
      try {
        const formattedChannelId = channelId.split('_')[1]
        console.log("ANALYSIS SERVICE CHANNEL ID QUI BUG: ", channelId)
        const channel = await client.channels.fetch(formattedChannelId)
        if (channel) {
          // Vérifier si le canal est dans une guilde (serveur)
          if (channel.guild) {
            // Obtenir l'objet membre de la guilde qui représente le bot
            const botMember = channel.guild.members.me || await channel.guild.members.fetch(client.user.id)
            const botPermissions = channel.permissionsFor(botMember)
            if (!botPermissions || !botPermissions.has('SEND_MESSAGES')) {
              console.log(`[AnalysisService] Pas de permission d'écriture dans le canal ${channelId} - Analyse annulée`)
              return null
            }
          } else {
            // Pour les canaux hors guilde (DM par exemple), on suppose que le bot peut écrire
            console.log(`[AnalysisService] Canal ${channelId} hors serveur - Permission d'écriture supposée`)
          }
        }
      } catch (permError) {
        console.error('[AnalysisService] Erreur lors de la vérification des permissions:', permError)
      }
    }

    // Vérifier si le guild est activé (pour les messages de serveur)
    if (guildId) {
      const { isGuildEnabled, isSchedulerEnabled, isAnalysisEnabled } = await import('../utils/configService.js')

      // Vérifier si le service de planification et l'analyse sont activés
      if (!(await isSchedulerEnabled())) {
        console.log(`[AnalysisService] Le service de planification est désactivé - Analyse annulée pour le canal ${channelId}`)
        return null
      }

      if (!(await isAnalysisEnabled())) {
        console.log(`[AnalysisService] L'analyse de pertinence est désactivée - Analyse annulée pour le canal ${channelId}`)
        return null
      }

      if (!(await isGuildEnabled(guildId))) {
        console.log(`[AnalysisService] Le serveur ${guildId} est désactivé - Analyse annulée pour le canal ${channelId}`)
        return null
      }
    }

    // Récupérer la conversation et ses messages
    const conversation = await prisma.conversation.findUnique({
      where: {
        channelId_guildId: {
          channelId,
          guildId: guildId || ''
        }
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })

    if (!conversation) {
      console.log(`[AnalysisService] Aucune conversation trouvée pour Canal: ${channelId}, Serveur: ${guildId || 'DM'}`)
      return null
    }

    console.log(`[AnalysisService] Conversation trouvée - ID: ${conversation.id}, ${conversation.messages.length} messages`)

    if (!conversation) {
      return null
    }

    // Analyser la conversation
    const analysis = await analyzeConversationRelevance(conversation.messages)

    // Mettre à jour la conversation dans la base de données
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        relevanceScore: analysis.relevanceScore,
        topicSummary: analysis.topicSummary,
        updatedAt: new Date()
      }
    })

    // Si le client est fourni et que le service de surveillance des messages est disponible,
    // créer une tâche planifiée si la conversation est pertinente (seuil extrêmement abaissé)
    if (!(client && analysis.relevanceScore >= 0.3)) {
      if (client) {
        console.log(`[AnalysisService] Score de pertinence trop faible (${analysis.relevanceScore.toFixed(2)}) - Pas de tâche planifiée`)
      }
    } else {
      console.log(`[AnalysisService] Score de pertinence suffisant (${analysis.relevanceScore.toFixed(2)}) - Tentative de création de tâche planifiée`)
      try {
        // Since messageMonitoringService is now merged into analysisService, we can use the local function
        const taskCreated = await createScheduledTask(
          client,
          channelId,
          guildId,
          analysis.relevanceScore,
          analysis.topicSummary
        )

        if (taskCreated) {
          console.log(`[AnalysisService] Tâche planifiée créée avec succès pour le canal ${channelId} - Sujet: "${analysis.topicSummary}"`)
        } else {
          console.log(`[AnalysisService] Création de tâche planifiée échouée ou ignorée pour le canal ${channelId}`)
        }
      } catch (taskError) {
        console.error('[AnalysisService] Erreur lors de la création d\'une tâche planifiée pour la conversation:', taskError)
      }
    }

    return updatedConversation
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la pertinence de la conversation:', error)
    return null
  }
}

/**
 * Partage une conversation avec un utilisateur spécifié
 * @param {string} channelId - ID du canal de la conversation
 * @param {string} guildId - ID de la guilde (optionnel)
 * @param {string} shareWithUserId - ID de l'utilisateur avec qui partager
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export async function shareConversation (channelId, guildId = null, shareWithUserId) {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: {
        channelId_guildId: {
          channelId,
          guildId: guildId || ''
        }
      }
    })

    if (!conversation) {
      return false
    }

    // Récupérer la liste actuelle des partages
    let sharedWith = conversation.sharedWith || []

    // Ajouter l'utilisateur s'il n'est pas déjà dans la liste
    if (!sharedWith.includes(shareWithUserId)) {
      sharedWith.push(shareWithUserId)
    }

    // Mettre à jour la conversation
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        isShared: true,
        sharedWith: sharedWith,
        updatedAt: new Date()
      }
    })

    return true
  } catch (error) {
    console.error('Erreur lors du partage de la conversation:', error)
    return false
  }
}

/**
 * Récupère les conversations partagées avec un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Array>} - Liste des conversations partagées
 */
export async function getSharedConversations (userId) {
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
              { relevanceScore: { gte: 0.6 } }
            ]
          }
        }
      }
    })
  } catch (error) {
    console.error('Erreur lors de la récupération des conversations partagées:', error)
    return []
  }
}
/**
 * Restaure les tâches de surveillance de messages en attente depuis la base de données
 * @returns {Promise<number>} - Nombre de tâches restaurées
 */
async function restorePendingMessageTasks() {
  try {
    const now = new Date();

    // Récupérer les tâches de surveillance de messages en attente
    const pendingTasks = await prisma.task.findMany({
      where: {
        schedulerId: { startsWith: 'job-message-' },
        nextExecution: { gte: now },
        status: 'pending'
      }
    });

    if (pendingTasks.length === 0) {
      console.log('[MessageMonitoring] Aucune tâche de surveillance de messages à restaurer');
      return 0;
    }

    console.log(`[MessageMonitoring] Restauration de ${pendingTasks.length} tâches de surveillance de messages...`);

    let restoredCount = 0;

    for (const task of pendingTasks) {
      try {
        if (!task.data || !task.data.message) {
          console.log(`[MessageMonitoring] Tâche ${task.schedulerId} ignorée - données incomplètes`);
          await taskService.deleteTask(task.schedulerId);
          continue;
        }

        const messageId = task.schedulerId.replace('job-message-', '');
        const messageData = task.data;
        const nextExecution = new Date(task.nextExecution);

        // Vérifier si la tâche n'est pas expirée
        if (isAfter(nextExecution, now)) {
          console.log(`[MessageMonitoring] Restauration de la tâche ${task.schedulerId} pour le message ${messageId}`);

          // Recréer la tâche asynchrone
          const restoredTask = new AsyncTask(
            task.schedulerId,
            async () => {
              try {
                // Vérifier si le message est toujours pertinent
                if (!pendingResponses.has(messageId)) return;

                // Récupérer les données du message depuis la Map
                const messageInfo = pendingResponses.get(messageId);

                // Exécuter la logique d'analyse (code simplifié pour éviter la duplication)
                console.log(`[MessageMonitoring] Exécution de la tâche restaurée ${task.schedulerId}`);

                // L'analyse sera faite par la fonction originale

                // Supprimer le message de la liste des messages en attente
                pendingResponses.delete(messageId);
              } catch (error) {
                console.error(`Erreur lors de l'exécution de la tâche restaurée ${task.schedulerId}:`, error);
                pendingResponses.delete(messageId);
              }
            },
            (err) => {
              console.error(`Erreur dans la tâche restaurée ${task.schedulerId}:`, err);
              pendingResponses.delete(messageId);
            }
          );

          // Calculer le délai restant
          const remainingDelay = nextExecution.getTime() - now.getTime();

          if (remainingDelay > 0) {
            // Ajouter les données du message à pendingResponses
            pendingResponses.set(messageId, messageData);

            // Créer et ajouter le job au planificateur
            const job = new SimpleIntervalJob({ milliseconds: remainingDelay, runImmediately: false }, restoredTask, task.schedulerId);
            scheduler.addSimpleIntervalJob(job);

            console.log(`[MessageMonitoring] Tâche ${task.schedulerId} restaurée avec un délai de ${(remainingDelay / 1000).toFixed(1)}s`);
            restoredCount++;
          } else {
            // Supprimer la tâche expirée
            await taskService.deleteTask(task.schedulerId);
            console.log(`[MessageMonitoring] Tâche ${task.schedulerId} supprimée car le délai est dépassé`);
          }
        } else {
          // Supprimer la tâche expirée
          await taskService.deleteTask(task.schedulerId);
          console.log(`[MessageMonitoring] Tâche ${task.schedulerId} supprimée car expirée`);
        }
      } catch (taskError) {
        console.error(`[MessageMonitoring] Erreur lors de la restauration de la tâche ${task.schedulerId}:`, taskError);
      }
    }

    console.log(`[MessageMonitoring] ${restoredCount}/${pendingTasks.length} tâches de surveillance de messages restaurées`);
    return restoredCount;
  } catch (error) {
    console.error('[MessageMonitoring] Erreur lors de la restauration des tâches de surveillance de messages:', error);
    return 0;
  }
}

/**
 * Nettoie les tâches de surveillance obsolètes et les tâches d'attente terminées
 * @returns {Promise<number>} - Nombre de tâches nettoyées
 */
async function cleanupMonitoringTasks() {
  try {
    console.log('[MessageMonitoring] Nettoyage des tâches de surveillance obsolètes...');

    // Supprimer les tâches expirées ou terminées de la base de données
    const now = new Date();
    const deletedTasks = await prisma.task.deleteMany({
      where: {
        schedulerId: { startsWith: 'job-message-' },
        OR: [
          { status: { in: ['completed', 'stopped', 'failed'] } },
          { nextExecution: { lt: now } }
        ]
      }
    });

    console.log(`[MessageMonitoring] ${deletedTasks.count} tâches de surveillance obsolètes nettoyées de la base de données`);

    // Nettoyer également les tâches d'attente terminées
    const deletedWaitingTasks = await prisma.task.deleteMany({
      where: {
        type: 'waiting-conversation',
        OR: [
          { status: { in: ['completed', 'stopped', 'failed'] } },
          { nextExecution: { lt: now } }
        ]
      }
    });

    console.log(`[MessageMonitoring] ${deletedWaitingTasks.count} tâches d'attente terminées nettoyées de la base de données`);

    // Nettoyer également le planificateur en mémoire
    let memoryTasksCleanedCount = 0;
    const jobs = scheduler.getAllJobs();

    for (const job of jobs) {
      const jobId = job.id;
      if (jobId.startsWith('job-message-') && !pendingResponses.has(jobId.replace('job-message-', ''))) {
        try {
          scheduler.removeById(jobId);
          memoryTasksCleanedCount++;
        } catch (err) {
          console.log(`[MessageMonitoring] Erreur lors de la suppression du job ${jobId}: ${err.message}`);
        }
      }
    }

    console.log(`[MessageMonitoring] ${memoryTasksCleanedCount} tâches de surveillance obsolètes nettoyées du planificateur en mémoire`);

    return deletedTasks.count + deletedWaitingTasks.count + memoryTasksCleanedCount;
  } catch (error) {
    console.error('[MessageMonitoring] Erreur lors du nettoyage des tâches de surveillance:', error);
    return 0;
  }
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
 * Crée une tâche planifiée pour une conversation pertinente
 * @param {Object} client - Client Discord
 * @param {string} channelId - ID du canal
 * @param {string} guildId - ID de la guilde (optionnel)
 * @param {number} relevanceScore - Score de pertinence de la conversation
 * @param {string} topicSummary - Résumé du sujet de conversation
 * @returns {Promise<boolean>} - Succès de la création de tâche
 */
export async function createScheduledTask(client, channelId, guildId, relevanceScore, topicSummary) {
  try {
    console.log(`[MessageMonitoring] Tentative de création de tâche planifiée - Canal: ${channelId}, Serveur: ${guildId || 'DM'}, Score: ${relevanceScore.toFixed(2)}, Sujet: "${topicSummary}"`);

    // Vérifier si les services sont activés avant de créer une tâche
    if (!(await isSchedulerEnabled())) {
      console.log(`[MessageMonitoring] Le service de planification est désactivé - Création de tâche annulée pour le canal ${channelId}`);
      return false;
    }

    if (guildId && !(await isGuildEnabled(guildId))) {
      console.log(`[MessageMonitoring] Le serveur ${guildId} est désactivé - Création de tâche annulée pour le canal ${channelId}`);
      return false;
    }

    // Vérifier si l'analyse de message est activée pour ce serveur
    if (guildId && !(await isGuildAnalysisEnabled(guildId))) {
      console.log(`[MessageMonitoring] L'analyse de message est désactivée pour le serveur ${guildId} - Création de tâche annulée pour le canal ${channelId}`);
      return false;
    }

    // Vérifier si la réponse auto est activée globalement
    if (!(await isAutoRespondEnabled())) {
      console.log(`[MessageMonitoring] La réponse automatique est désactivée - Création de tâche annulée pour le canal ${channelId}`);
      return false;
    }

    // Vérifier si la réponse auto est activée pour ce serveur
    if (guildId && !(await isGuildAutoRespondEnabled(guildId))) {
      console.log(`[MessageMonitoring] La réponse automatique est désactivée pour le serveur ${guildId} - Création de tâche annulée pour le canal ${channelId}`);
      return false;
    }

    // Seuil très bas pour créer des tâches planifiées plus facilement et rendre le bot plus engageant
    if (relevanceScore < 0.3) {
      console.log(`[MessageMonitoring] Score de pertinence insuffisant (${relevanceScore.toFixed(2)}) pour créer une tâche planifiée pour la conversation dans ${channelId}`);
      return false;
    }

    // Générer un identifiant unique pour cette tâche
    const taskId = `conversation-task-${randomUUID().substring(0, 8)}`;
    console.log(`[MessageMonitoring] Création d'une nouvelle tâche: ${taskId}`);

    // Utiliser un délai aléatoire plus court (5 à 120 secondes)
    const MIN_DELAY_MS = 5 * 1000;  // 5 secondes en ms
    const MAX_DELAY_MS = 60 * 1000;  // 1 minute en ms
    const delayInMs = Math.floor(MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
    const scheduledTime = new Date(Date.now() + delayInMs);

    // Créer d'abord une tâche d'attente
    const waitingTaskId = `waiting-${taskId}`;
    console.log(`[MessageMonitoring] Création d'une tâche d'attente: ${waitingTaskId}`);

    // Enregistrer la tâche d'attente dans la base de données
    await taskService.saveTask(
      waitingTaskId,
      0,
      new Date(), // Exécution immédiate
      null,
      'waiting-conversation',
      {
        channelId,
        guildId: guildId || '',
        topicSummary,
        parentTaskId: taskId
      }
    );

    // Enregistrer la tâche principale dans la base de données
    const savedTask = await taskService.saveTask(
      taskId,
      0,
      scheduledTime,
      null,
      'conversation',
      {
        channelId,
        guildId: guildId || '',
        topicSummary,
        waitingTaskId
      }
    );

    console.log(`[MessageMonitoring] Nouvelle tâche de conversation (${taskId}) créée pour le canal ${channelId} dans ${(delayInMs / 60000).toFixed(1)} minutes - Heure prévue: ${scheduledTime.toISOString()}`);
    console.log(`[MessageMonitoring] Détails de la tâche: ID BDD=${savedTask.id}, Sujet="${topicSummary}"`);

    // Planifier la suppression de la tâche d'attente une fois la tâche principale terminée
    setTimeout(async () => {
      try {
        await taskService.deleteTask(waitingTaskId);
        console.log(`[MessageMonitoring] Tâche d'attente ${waitingTaskId} supprimée après exécution de la tâche principale`);
      } catch (error) {
        console.error(`[MessageMonitoring] Erreur lors de la suppression de la tâche d'attente ${waitingTaskId}:`, error);
      }
    }, delayInMs + 5000); // Ajouter 5 secondes pour s'assurer que la tâche principale a eu le temps de s'exécuter

    return true;
  } catch (error) {
    console.error('Erreur lors de la création d\'une tâche planifiée:', error);
    return false;
  }
}

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
    const botMember = message.guild.members.cache.get(client.user.id);
    const botPermissions = message.channel.permissionsFor(botMember);
    if (!botPermissions || !botPermissions.has('SEND_MESSAGES')) {
      console.log(`[MessageMonitoring] Pas de permission d'écriture dans le canal ${channelId} - Surveillance annulée`);
      return;
    }
  }

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

  // Vérifier si l'analyse de message est activée pour ce serveur
  if (guildId && !(await isGuildAnalysisEnabled(guildId))) {
    console.log(`[MessageMonitoring] L'analyse de message est désactivée pour le serveur ${guildId} - Message ${messageId} ignoré`);
    return;
  }

  console.log(`[MessageMonitoring] Message ${messageId} ajouté pour analyse différée`);

  // Vérifier si le message est déjà en attente d'analyse
  if (pendingResponses.has(messageId)) {
    console.log(`[MessageMonitoring] Message ${messageId} déjà en attente d'analyse - ignoré`);
    return;
  }

  // Planifier l'analyse du message avec un délai entre 10 secondes et 2 minutes
  // ou plus si un délai d'attente est actif sur ce canal
  const MIN_DELAY_MS = 10 * 1000;  // 10 secondes en ms
  const MAX_DELAY_MS = 2 * 60 * 1000;  // 2 minutes en ms
  let delayInMs = Math.floor(MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));

  // Si un délai d'attente est actif, ajouter un délai supplémentaire
  if (isWaitingForMoreMessages(channelId, guildId)) {
    console.log(`[MessageMonitoring] Un délai d'attente est déjà actif pour le canal ${channelId} - Ajout de délai supplémentaire`);
    delayInMs += 5000; // Ajouter 5 secondes pour s'assurer que les messages sont groupés
  } else {
    // Démarrer un nouveau délai d'attente pour ce canal
    startMessageBatchDelay(channelId, guildId);
  }

  const scheduledTime = new Date(Date.now() + delayInMs);

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
                guildId: guildId || ''
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

        // Vérifier si l'analyse de message est activée pour ce serveur
        if (guildId && !(await isGuildAnalysisEnabled(guildId))) {
          console.log(`[MessageMonitoring] L'analyse de message est désactivée pour le serveur ${guildId} - Analyse annulée pour le message ${messageId}`);
          pendingResponses.delete(messageId);
          return;
        }

        // Vérifier si la réponse auto est activée globalement
        if (!(await isAutoRespondEnabled())) {
          console.log(`[MessageMonitoring] La réponse automatique est désactivée - Analyse annulée pour le message ${messageId}`);
          pendingResponses.delete(messageId);
          return;
        }

        // Vérifier si la réponse auto est activée pour ce serveur
        if (guildId && !(await isGuildAutoRespondEnabled(guildId))) {
          console.log(`[MessageMonitoring] La réponse automatique est désactivée pour le serveur ${guildId} - Analyse annulée pour le message ${messageId}`);
          pendingResponses.delete(messageId);
          return;
        }

        // Vérifier si c'est une conversation entre utilisateurs
        if (isReplyBetweenUsers) {
          console.log(`[MessageMonitoring] Message ${messageId} détecté comme conversation entre utilisateurs - Réduction du score de pertinence`);
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

                  // Seuil fortement abaissé pour permettre beaucoup plus de réponses et d'engagement
                  if (!shouldRespondImmediate && evaluationResult.relevanceScore < 0.25) {
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

          // Si c'est une conversation entre utilisateurs, ne pas intervenir à moins qu'il ne s'agisse d'une mention du bot
          if (isReplyBetweenUsers) {
            // Vérifier si le message parle du bot (Yassine)
            const botNameVariants = ['yassine', 'yascine', 'yasine', 'yacine', 'le bot'];
            const contentLower = messageInfo.content.toLowerCase();
            const botMentioned = botNameVariants.some(variant => contentLower.includes(variant));

            if (!botMentioned) {
              console.log(`[MessageMonitoring] Conversation entre utilisateurs sans mention du bot - Non-intervention`);
              pendingResponses.delete(messageId);
              return;
            }
            console.log(`[MessageMonitoring] Conversation entre utilisateurs avec mention du bot - Intervention autorisée`);
          }

          // Récupérer les rôles de l'auteur du message si on est dans un serveur
          if (message.guild) {
            try {
              const { getUserRoles } = await import('../utils/messageUtils.js');
              // On passe les rôles à buildResponseFn via le contexte additionnel
              const authorRoles = await getUserRoles(message.guild, message.author.id);
              if (authorRoles) {
                console.log(`[MessageMonitoring] Rôles de l'auteur récupérés: ${authorRoles}`);
                // Ajouter les rôles au contexte additionnel s'il y en a
                if (additionalContext) {
                  additionalContext += `\n\n${authorRoles}`;
                } else {
                  additionalContext = authorRoles;
                }
              }
            } catch (error) {
              console.error('[MessageMonitoring] Erreur lors de la récupération des rôles de l\'auteur:', error);
            }
          }

          // Construire et envoyer la réponse avec contexte additionnel si nécessaire
          const response = await buildResponseFn(messageInfo.content, message, additionalContext);

          // Vérifier si le message contient des actions en italique (entre * ou _)
          const containsItalics = response ? /(\*[^*]+\*|_[^_]+_)/.test(response.trim()) : false;

          if (response && response.trim() !== '' && response !== '\' \'\' \'' && response.trim().length > 1 && !containsItalics) {
            await message.channel.sendTyping().catch(console.error);
            await message.reply(response);
          } else if (containsItalics) {
            console.log(`[MessageMonitoring] Réponse contenant des actions en italique détectée, aucun message envoyé`);
          } else {
            console.log(`[MessageMonitoring] Réponse vide, trop courte ou invalide détectée, aucun message envoyé`);
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

  // Sauvegarder la tâche dans la base de données pour permettre la restauration
  try {
    // Créer un objet avec les informations nécessaires du message
    const messageData = {
      content: message.content,
      authorId: message.author.id,
      authorUsername: message.author.username,
      channelId: message.channel.id,
      guildId: message.guild?.id || null
    };

    await taskService.saveTask(
      jobId,
      0, // taskNumber n'est pas pertinent ici
      scheduledTime,
      null,
      'message-monitoring',
      {
        message: messageData,
        messageId: messageId,
        scheduledTime: scheduledTime.toISOString()
      }
    );

    console.log(`[MessageMonitoring] Tâche ${jobId} sauvegardée en base de données`);
  } catch (dbError) {
    console.error(`[MessageMonitoring] Erreur lors de la sauvegarde de la tâche ${jobId} en base de données:`, dbError);
  }

  // Ajouter une fonction pour supprimer le job quand il est terminé
  setTimeout(async () => {
    try {
      // Vérifier si le job existe toujours
      if (scheduler.existsById(jobId)) {
        console.log(`[MessageMonitoring] Suppression planifiée du job ${jobId} après exécution`);
        scheduler.removeById(jobId);
        console.log(`[MessageMonitoring] Job ${jobId} supprimé avec succès`);
      } else {
        console.log(`[MessageMonitoring] Job ${jobId} déjà supprimé du planificateur`);
      }

      // Supprimer le message des réponses en attente s'il existe encore
      if (pendingResponses.has(messageId)) {
        pendingResponses.delete(messageId);
        console.log(`[MessageMonitoring] Message ${messageId} supprimé de la liste des messages en attente`);
      }

      // Mettre à jour le statut de la tâche dans la base de données
      try {
        const task = await prisma.task.findUnique({
          where: { schedulerId: jobId }
        });

        if (task) {
          await prisma.task.update({
            where: { schedulerId: jobId },
            data: { 
              status: 'completed',
              completedAt: new Date(),
              updatedAt: new Date()
            }
          });
          console.log(`[MessageMonitoring] Tâche ${jobId} marquée comme terminée en base de données`);
        } else {
          console.log(`[MessageMonitoring] Tâche ${jobId} non trouvée en base de données`);
        }
      } catch (dbError) {
        console.error(`[MessageMonitoring] Erreur lors de la mise à jour de la tâche ${jobId} en base de données:`, dbError);
      }
    } catch (error) {
      console.error(`[MessageMonitoring] Erreur lors du nettoyage du job ${jobId}:`, error);
    }
  }, delayInMs + 5000); // +5 secondes pour s'assurer que le job a eu le temps de s'exécuter
}

/**
 * Analyse l'intention d'un message pour détecter les demandes de GIF ou de préférences utilisateur
 * @param {string} messageContent - Contenu du message à analyser
 * @returns {Promise<Object>} - Résultat de l'analyse avec type d'intention et données associées
 */
export async function analyzeMessageIntent(messageContent) {
  // Use the shared implementation from mcpUtils
  return mcpUtils.analyzeMessageIntent(messageContent);
}

export const analysisService = {
  analyzeMessageRelevance,
  analyzeConversationRelevance,
  updateConversationRelevance,
  shareConversation,
  getSharedConversations,
  isWaitingForMoreMessages,
  startMessageBatchDelay,
  monitorMessage,
  stopMonitoring,
  createScheduledTask,
  cleanupMonitoringTasks,
  analyzeMessageIntent
}
