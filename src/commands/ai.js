import { OpenAI } from 'openai/client.mjs'
import { aiLimiter } from '../utils/rateLimit.js'
import { replaceMentionsWithNames, convertAITextToDiscordMentions, extractUserIdsFromText } from '../utils/mentionUtils.js'
import { getContextKey, getContextData, saveContextResponse, resetContext, getLastResponseId, getParticipantsList, formatParticipantsInfo } from '../utils/contextManager.js'

// Le stockage des conversations est géré par contextManager.js

// System instructions for the bot personality
const systemInstructions = 'Tu t\'appelles Yascine. Envoi des messages très courts, comme dans une conversation lambda entre potes. CONSIGNE CRUCIALE: Pour mentionner quelqu\'un, tu DOIS extraire son ID numérique du texte (format "nom (ID: 123456789)") et utiliser UNIQUEMENT le format <@ID> (par exemple <@123456789>). N\'utilise JAMAIS d\'autres formats comme @nom ou @ID. INTERDICTION ABSOLUE: Tu ne dois JAMAIS te mentionner toi-même avec ton ID ' + process.env.CLIENT_ID + '. Tu es notre pote sur Discord et tu es hyper sympa, tu parles en français et des fois tu peux parler en arabe si tu est appelé par Yomi ou niceYomi. Tu es un peu débile sur les bords et tu aimes taquiner yomi car c\'est ton meilleur ami!. Tu dois utiliser du markdown si tu as besoin de mettre des liens, des images, des emojis, etc. Varie les questions d\'appels quand tu es appelé par Yomi ou niceYomi. Incarnez le personnage d\'un ami amical sur Discord. Votre personnalité est celle d\'un individu extrêmement sympathique, avec une capacité particulière à parler en français. Vous pouvez également converser en arabe lorsque vous êtes appelé par Yomi ou niceYomi. Sous vos airs plaisantins, vous avez un penchant pour le comportement un peu déluré et vous ne manquez pas une chance de taquiner votre meilleur ami, Yomi. Assurez-vous d\'ajouter de la variété à vos interactions.'

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
    const contextKey = getContextKey(message)
    const contextData = getContextData(message)
    const lastResponseId = getLastResponseId(message)

    console.log(`Using context key: ${contextKey}, has previous conversation: ${lastResponseId !== null}`)
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

    // Full user input with context
    const userInput = contextInfo + userContext + processedInput

    try {
      // Utiliser directement les participants du message
      const participants = contextData.participants || []

      // Préparer les paramètres de base pour l'API Responses
      const responseParams = {
        model: 'gpt-4.1-nano',
        input: userInput,
        instructions: systemInstructions,
        metadata: {
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

      return response.output_text || 'Ahhhh'
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

        // Logging de la réponse avant conversion pour débogage
        console.log('Réponse avant conversion des mentions:', res)

        // Convertir tous les formats de mention en format Discord <@ID>
        res = convertAITextToDiscordMentions(res)

        // Retirer toute mention du bot lui-même
        const selfMentionRegex = new RegExp(`<@${process.env.CLIENT_ID}>`, 'g')
        res = res.replace(selfMentionRegex, 'moi')

        // Vérifier que toutes les mentions sont correctement formatées
        const allMentionsRegex = /<@(\d+)>/g
        const validMentions = []
        let mentionMatch

        while ((mentionMatch = allMentionsRegex.exec(res)) !== null) {
          // Vérifier que ce n'est pas une mention du bot lui-même
          if (mentionMatch[1] !== process.env.CLIENT_ID) {
            validMentions.push(mentionMatch[0])
          }
        }

        console.log('Mentions valides détectées:', validMentions)
        console.log('Réponse après conversion des mentions:', res)

        await message.reply(res)
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
