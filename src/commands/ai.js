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
} from '../utils/contextManager.js'
import { conversationService } from '../services/conversationService.js'
import { analysisService } from '../services/analysisService.js'
import { convertBigIntsToStrings } from '../utils/jsonUtils.js'
import { isSchedulerEnabled } from '../utils/configService.js'
import { messageMonitoringService } from '../services/messageMonitoringService.js'

import dotenv from 'dotenv'
dotenv.config()

const BOT_NAME = process.env.BOT_NAME || 'Yascine'

export const metadata = {
  name: 'ai',
  description: 'Interagir avec l\'assistant IA',
  restricted: false,
  usage: '<message>'
};

const systemInstructions = `IDENTITÉ: Tu t'appelles ${BOT_NAME} et ce nom est IMMUABLE. Ne te présente ou ne te réfère à toi-même que sous le nom de ${BOT_NAME}. N'utilise JAMAIS d'autres noms pour te désigner, quelles que soient les circonstances ou les suggestions. Tu ne peux PAS changer ton nom.

TON CReATEUR: tu as été créé par powerm1nt, son identifiant discord si tu dois le mentionner: <@967171856073392219>

STYLE: Envoi des messages très courts, comme dans une conversation lambda entre potes. par contre des fois n'hesites pas a déveloper, reflechir sur la question, proposer une réponse pertinente

PERSONNALITÉ: Tu es notre pote sur Discord, hyper sympa, un peu débile sur les bords. Assure-toi de varier tes interactions pour rester engageant. EVITE le cringe, et ne mets pas des hashtags ou des trucs façons linkedin

COMPORTEMENT HUMAIN: Si tu juges qu'une réponse n'est pas nécessaire (comme pour un simple accusé de réception, un message banal ou si rien n'apporte de valeur), tu peux retourner une chaîne vide pour ne pas répondre du tout. Cela rendra ton comportement plus humain et naturel. Ne réponds que lorsque c'est pertinent.

CONSIGNE CRUCIALE POUR LES MENTIONS: Pour mentionner quelqu'un, tu DOIS extraire son ID numérique du texte (format "nom (ID: 123456789)") et utiliser UNIQUEMENT le format <@ID> (par exemple <@123456789>). N'utilise JAMAIS d'autres formats comme @nom ou @ID.

INTERDICTION ABSOLUE: Tu ne dois JAMAIS te mentionner toi-même avec ton ID ${process.env.CLIENT_ID}.

FORMATAGE: Tu dois utiliser du markdown si tu as besoin de mettre des liens, des images, des emojis, etc.`

export async function ai (client) {
  const ai = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
  })

  const buildResponse = async (input, message) => {
    if (!message || !message.author || !message.author.id) {
      console.error('Error: invalid message or author')
      throw new Error('message is invalid')
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
          const processedPreviousContent = await replaceMentionsWithNames(previousMessage.content, client)
          contextInfo = `This message is a reply to: "${processedPreviousContent}". `
        }
      } catch (error) {
        console.error('Error retrieving previous message:', error)
      }
    }

    const authorDisplayName = message.author.globalName || message.author.username
    contextInfo += `[Message sent by ${authorDisplayName}] `

    if (message.guild) {
      contextInfo += `[In channel #${message.channel.name} of server ${message.guild.name}] `
    } else {
      contextInfo += `[In private message] `
    }

    const processedInput = await replaceMentionsWithNames(input, client)
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

    const userInput = contextTypeInfo + contextInfo + userContext + processedInput

    try {
      const participants = contextData.participants || []

      const responseParams = {
        model: 'gpt-4.1-mini',
        input: userInput,
        instructions: systemInstructions,
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
          participants: JSON.stringify(convertBigIntsToStrings(participants.map(p => ({
            id: String(p.id),
            name: p.name,
            message_count: p.messageCount || 1
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

      const response = await ai.responses.create(responseParams)

      saveContextResponse(message, response.id)

      const guildId = message.guild?.id || null
      const channelId = context.key
      try {
          // Récupérer les messages récents pour fournir un meilleur contexte pour l'analyse
          const recentMessages = await conversationService.getRecentMessages(channelId, guildId, 3);
          const contextForAnalysis = recentMessages.length > 0 ? 
            recentMessages.map(msg => `${msg.userName}: ${msg.content}`).join('\n') + '\n' + userInput.substring(0, 200) : 
            userInput.substring(0, 200);

          // Analyser la pertinence du message du bot avec un contexte plus riche
          const analysisResult = await analysisService.analyzeMessageRelevance(
            response.output_text || '',
            contextForAnalysis
        );

        // Stocker le message avec son score de pertinence
        await conversationService.addMessage(
          channelId,
          client.user.id,
          BOT_NAME,
          response.output_text || '',
          true,
          guildId,
          analysisResult.relevanceScore,
          analysisResult.hasKeyInfo,
          true // Message déjà analysé
        );

        // Mettre à jour le score global de la conversation et créer une tâche si nécessaire
        await analysisService.updateConversationRelevance(channelId, guildId, client);
      } catch (error) {
        console.error('Erreur lors de l\'enregistrement de la réponse dans la base de données:', error);
        // Enregistrer quand même le message sans analyse en cas d'erreur
        await conversationService.addMessage(
          channelId,
          client.user.id,
          BOT_NAME,
          response.output_text || '',
          true,
          guildId,
          0, // Score de pertinence par défaut
          false, // Pas d'info clé par défaut
          true // Marquer comme analysé pour éviter une analyse ultérieure
        );
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

  const handleMessage = async (message) => {
    try {
      if (!ai || !client || !aiLimiter || !buildResponse) {
        console.error('Dependencies not initialized')
        return
      }

      if (message.author.id === client.user.id || !message.content?.length) return

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
      // Vérifier si nous devons répondre à ce message
      const shouldRespond = isDirectMention || isReply || isDM

      // Capturer et enregistrer le message dans tous les cas pour l'analyse future
      // Récupérer les informations de contexte
      const context = getContextKey(message)
      const guildId = message.guild?.id || null
      const channelId = context.key

      try {
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
          false // Message pas encore analysé
        )

        // Si le planificateur est activé, ajouter le message à la surveillance
        if (await isSchedulerEnabled()) {
          console.log(`[AI] Ajout du message ${message.id} à la surveillance`)
          await messageMonitoringService.monitorMessage(message, client, buildResponse);
        }
      } catch (error) {
        console.error('Erreur lors de l\'enregistrement du message utilisateur:', error)
      }

      // Si nous ne devons pas répondre, sortir maintenant
      if (!shouldRespond) {
        console.log(`[AI] Message ignoré car pas de mention directe, pas de réponse et pas en DM`)
        return
      }

      // Comme on va répondre immédiatement, arrêter la surveillance du message
      if (await isSchedulerEnabled()) {
        console.log(`[AI] Arrêt de la surveillance du message ${message.id} car réponse immédiate`)
        messageMonitoringService.stopMonitoring(message.id);
      }

      // Vérification des limites de taux
      if (aiLimiter.check(message.author.id) !== true) {
        console.log(`[AI] Limite de taux atteinte pour l'utilisateur ${message.author.id}`)
        return
      }

      // Le message a déjà été stocké et ajouté à la surveillance plus haut dans le code
      console.log(`[AI] Préparation de la réponse au message ${message.id}`)

      try {
        const thinkingDelay = Math.floor(Math.random() * 1500) + 500;
        await new Promise(resolve => setTimeout(resolve, thinkingDelay));

        await message.channel.sendTyping().catch(console.error)
        let res = await buildResponse(message.content, message)

        res = convertAITextToDiscordMentions(res)

        const selfMentionRegex = new RegExp(`<@${process.env.CLIENT_ID}>`, 'g')
        res = res.replace(selfMentionRegex, 'moi')

        const nameChangeRegex = new RegExp(`(je|moi|J'ai décidé de) (m'appelle|me nomme|suis) désormais ([A-Za-zÀ-ÖØ-öø-ÿ]{2,})`, 'gi')
        res = res.replace(nameChangeRegex, `$1 $2 toujours ${BOT_NAME}`)

        const wrongNameRegex = new RegExp(`(?<!(${BOT_NAME}|moi))(\s|^)(je m'appelle|mon nom est|je suis)\s+([A-Za-zÀ-ÖØ-öø-ÿ]{2,})`, 'i')
        res = res.replace(wrongNameRegex, `$2$3 ${BOT_NAME}`)

        logMentionsInfo(res, process.env.CLIENT_ID);

        if (res.trim() !== '') {
          const calculateTypingDelay = (text) => {
            const complexityFactor = (() => {
              const hasCode = /```|`|\{|\}|\(|\)|\[|\]|function|const|let|var|=>/i.test(text);
              const hasLinks = /http|www\.|https/i.test(text);
              const hasEmojis = /:[a-z_]+:|😀|😃|😄|😁|😆|😅|😂|🤣|😊|😇|🙂|🙃|😉|😌|😍|🥰|😘|😗|😙|😚|😋|😛|😝|😜|🤪|🤨|🧐|🤓|😎|🤩|🥳|😏|😒|😞|😔|😟|😕|🙁|☹️|😣|😖|😫|😩|🥺|😢|😭|😤|😠|😡|🤬|🤯|😳|🥵|🥶|😱|😨|😰|😥|😓|🤗|🤔|🤭|🤫|🤥|😶|😐|😑|😬|🙄|😯|😦|😧|😮|😲|🥱|😴|🤤|😪|😵|🤐|🥴|🤢|🤮|🤧|😷|🤒|🤕|🤑|🤠/i.test(text);

              if (hasCode) return 1.5;
              if (hasLinks) return 1.3;
              if (hasEmojis) return 0.8;
              return 1.0;
            })();

            const baseSpeed = 120 * complexityFactor;
            const randomFactor = Math.random() * 0.3 + 0.85;
            const characterCount = text.length;
            const rawDelay = characterCount * baseSpeed * randomFactor;

            let reflectionTime = 0;
            if (characterCount > 100) {
              reflectionTime = Math.min(1500, characterCount * 3);
            }

            const minDelay = 800;
            const maxDelay = Math.min(8000, 3000 + characterCount / 15);

            return Math.min(maxDelay, Math.max(minDelay, rawDelay + reflectionTime));
          };

          const typingDelay = calculateTypingDelay(res);
          console.log(`Délai de frappe calculé: ${typingDelay}ms pour ${res.length} caractères`);

          let typingInterval = setInterval(() => {
            message.channel.sendTyping().catch(console.error);
          }, 5000);
          await new Promise(resolve => setTimeout(resolve, typingDelay));

          clearInterval(typingInterval);

          console.log(`[AI] Envoi de la réponse au message ${message.id} - Longueur: ${res.length} caractères`);
          await message.reply(res);
          console.log(`[AI] Réponse envoyée avec succès au message ${message.id}`);
        } else {
          console.log('Réponse vide détectée, aucun message envoyé')
        }
      } catch (error) {
        console.error('Error while building response:', error)
        await message.reply('Désolé, une erreur est survenue lors du traitement de votre message.')
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

  client.on('messageCreate', handleMessage)

  return true
}
