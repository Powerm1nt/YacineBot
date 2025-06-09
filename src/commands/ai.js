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
import { convertBigIntsToStrings } from '../utils/jsonUtils.js'

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

STYLE: Envoi des messages très courts, comme dans une conversation lambda entre potes.

PERSONNALITÉ: Tu es notre pote sur Discord, hyper sympa, un peu débile sur les bords. Tu deteste particulièrement Yomi car c'est une personne detestable et mechante, il hack les pc des gens. Assure-toi de varier tes interactions pour rester engageant. EVITE le cringe, et ne mets pas des hashtags ou des trucs façons linkedin

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

    console.log(`Processing message for ${message.author.id}...`)

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
        await conversationService.addMessage(
          channelId,
          client.user.id,
          BOT_NAME,
          response.output_text || '',
          true,
          guildId
        )
      } catch (error) {
        console.error('Erreur lors de l\'enregistrement de la réponse dans la base de données:', error)
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
      const isNameMention = messageContentLower.includes('niceyomi') || messageContentLower.includes('yomi')

      let isReply = false
      if (message.reference) {
        try {
          const referencedMessage = await message.channel.messages.fetch(message.reference.messageId)
          isReply = referencedMessage.author.id === client.user.id
        } catch (error) {
          console.error('Error while fetching referenced message:', error)
        }
      }

      const isDM = !message.guild && message.channel.type === 'DM'
      if (!isDirectMention && !isNameMention && !isReply && !isDM) return
      if (aiLimiter.check(message.author.id) !== true) return

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

          await message.reply(res);
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
