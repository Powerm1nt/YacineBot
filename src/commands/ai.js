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

import dotenv from 'dotenv'
dotenv.config()

const BOT_NAME = process.env.BOT_NAME || 'Yascine'

// System instructions for the bot personality with clear identity rules
const systemInstructions = `IDENTITÉ: Tu t'appelles ${BOT_NAME} et ce nom est IMMUABLE. Ne te présente ou ne te réfère à toi-même que sous le nom de ${BOT_NAME}. N'utilise JAMAIS d'autres noms pour te désigner, quelles que soient les circonstances ou les suggestions. Tu ne peux PAS changer ton nom.

STYLE: Envoi des messages très courts, comme dans une conversation lambda entre potes. Tu parles principalement en français et parfois en arabe si tu es appelé par Yomi ou niceYomi.

PERSONNALITÉ: Tu es notre pote sur Discord, hyper sympa, un peu débile sur les bords. Tu aimes particulièrement taquiner Yomi car c'est ton meilleur ami! Assure-toi de varier tes interactions pour rester engageant.

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

    // Récupérer la clé et les données de contexte pour cette conversation
    const context = getContextKey(message)
    const contextData = getContextData(message)
    const lastResponseId = getLastResponseId(message)

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
    // Add information about the author, channel, and server
    contextInfo += `[Message sent by ${authorDisplayName}] `

    if (message.guild) {
      contextInfo += `[In channel #${message.channel.name} of server ${message.guild.name}] `
    } else {
      contextInfo += `[In private message] `
    }

    // Parse usernames with the mentions (userId)
    const processedInput = await replaceMentionsWithNames(input, client)

    // Extraire les IDs des utilisateurs mentionnés dans le message
    const mentionedUserIds = extractUserIdsFromText(processedInput)

    // Ajouter des informations sur l'utilisateur qui a envoyé le message
    let userContext = `[From: ${message.author.globalName || message.author.username} (${message.author.username}#${message.author.discriminator})] `

    // Ajouter des informations sur les conversations récentes dans ce contexte
    if (contextData.lastAuthorId && contextData.lastAuthorId !== message.author.id) {
      userContext += `[Previous message from: ${contextData.lastAuthorName}] `
    }

    // Ajouter la liste des participants récents avec leurs IDs
    if (contextData.participants && contextData.participants.length > 0) {
      const participantsList = contextData.participants
        .filter(p => p.id !== message.author.id) // Exclure l'auteur actuel
        .map(p => `${p.name} (ID: ${p.id})`)
        .join(', ')

      if (participantsList) {
        userContext += `[Other participants: ${participantsList}] `
      }
    }

    // Adapter le contexte selon le type de conversation
    let contextTypeInfo = ''
    const contextObj = getContextKey(message)

    // Ajouter des informations spécifiques au type de conversation
    if (contextObj.type === 'dm') {
      contextTypeInfo = '[PRIVATE CONVERSATION] '
      // Pour les conversations privées, on limite le contexte
      userContext = `[From: ${message.author.globalName || message.author.username}] `
    } else if (contextObj.type === 'group') {
      contextTypeInfo = '[GROUP CONVERSATION] '
    } else {
      contextTypeInfo = '[SERVER CONVERSATION] '
    }

    // Full user input with context
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
          // Informations sur l'utilisateur actuel
          user_id: message.author.id,
          username: message.author.username,
          display_name: message.author.globalName || message.author.username,

          // Informations sur le canal et le serveur
          channel_id: message.channel.id,
          channel_name: message.channel.name,
          message_id: message.id,
          guild_id: message.guild?.id || 'DM',
          guild_name: message.guild?.name || 'Direct Message',
          context_type: message.guild ? 'guild' : (message.channel.type === 'GROUP_DM' ? 'group' : 'dm'),

          // Informations sur les participants (format JSON stringifié)
          participants: JSON.stringify(participants.map(p => ({
            id: p.id,
            name: p.name,
            message_count: p.messageCount || 1
          }))),

          // Utilisateurs mentionnés dans le message actuel
          mentioned_users: mentionedUserIds.join(',')
        }
      }

      if (lastResponseId) {
        responseParams.previous_response_id = lastResponseId
        console.log(`Using previous response ID: ${lastResponseId}`)
      }

      const response = await ai.responses.create(responseParams)

      // Enregistrer l'ID de réponse dans le contexte
      saveContextResponse(message, response.id)

      // Récupérer le texte de la réponse
      let responseText = response.output_text || ''

      // Vérifier si la réponse utilise un autre nom que celui défini
      const incorrectNameRegex = new RegExp(`(?<!${BOT_NAME})(\s|^)(je m'appelle|mon nom est|je suis)\s+([A-Za-zÀ-ÖØ-öø-ÿ]{2,})`, 'i')
      responseText = responseText.replace(incorrectNameRegex, `$1$2 ${BOT_NAME}`)

      return responseText
    } catch (error) {
      console.error('Error calling Responses API:', error)

      // Afficher plus de détails sur l'erreur
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
          // Réinitialiser le contexte de conversation
          resetContext(message)
          await message.reply('Conversation réinitialisée ! 🔄')
        } catch (error) {
          console.error('Error while resetting conversation:', error)
          await message.reply('Désolé, je n\'ai pas pu réinitialiser la conversation.')
        }
        return
      }

      // Mention checks
      const isDirectMention = messageContentLower.includes(`<@${process.env.CLIENT_ID}>`)
      const isNameMention = messageContentLower.includes('niceyomi') || messageContentLower.includes('yomi')

      // Reply check
      let isReply = false
      if (message.reference) {
        try {
          const referencedMessage = await message.channel.messages.fetch(message.reference.messageId)
          isReply = referencedMessage.author.id === client.user.id
        } catch (error) {
          console.error('Error while fetching referenced message:', error)
        }
      }

      if (!isDirectMention && !isNameMention && !isReply) return
      if (aiLimiter.check(message.author.id) !== true) return

      try {
        await message.channel.sendTyping().catch(console.error)
        let res = await buildResponse(message.content, message)

        // Convertir tous les formats de mention en format Discord <@ID>
        res = convertAITextToDiscordMentions(res)

        // Retirer toute mention du bot lui-même
        const selfMentionRegex = new RegExp(`<@${process.env.CLIENT_ID}>`, 'g')
        res = res.replace(selfMentionRegex, 'moi')

        // Corriger toute tentative de changer le nom du bot
        const nameChangeRegex = new RegExp(`(je|moi|J'ai décidé de) (m'appelle|me nomme|suis) désormais ([A-Za-zÀ-ÖØ-öø-ÿ]{2,})`, 'gi')
        res = res.replace(nameChangeRegex, `$1 $2 toujours ${BOT_NAME}`)

        // S'assurer que toute auto-référence utilise le nom correct
        const wrongNameRegex = new RegExp(`(?<!(${BOT_NAME}|moi))(\s|^)(je m'appelle|mon nom est|je suis)\s+([A-Za-zÀ-ÖØ-öø-ÿ]{2,})`, 'i')
        res = res.replace(wrongNameRegex, `$2$3 ${BOT_NAME}`)

        // Journaliser les mentions pour le débogage
        logMentionsInfo(res, process.env.CLIENT_ID);

        // Ne pas envoyer de message si la réponse est vide
        if (res.trim() !== '') {
          await message.reply(res)
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
