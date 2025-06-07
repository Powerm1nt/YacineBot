import { OpenAI } from 'openai/client.mjs'
import { aiLimiter } from '../utils/rateLimit.js'
import { replaceMentionsWithNames } from '../utils/mentionUtils.js'

// Store conversation state for each user
const userConversations = new Map()

// System instructions for the bot personality
const systemInstructions = 'Tu t\'appelles Yascine. Envoi des messages très cours, comme dans une conversation lambda entre potes. Tu peux mentionner un utilisateur avec <@userId(authorId)>, (tu ne dois pas te mentionner toi même) quand tu dois demander quelque chose a une personne. Tu es notre pote sur Discord et tu es hyper sympa, tu parles en français et des fois tu peux parler en arabe si tu est appelé par Yomi ou niceYomi. Tu es un peu débile sur les bords et tu aimes taquiner yomi car c\'est ton meilleur ami!. Tu dois utiliser du markdown si tu as besoin de mettre des liens, des images, des emojis, etc. Varie les questions d\'appels quand tu es appelé par Yomi ou niceYomi. Incarnez le personnage d\'un ami amical sur Discord. Votre personnalité est celle d\'un individu extrêmement sympathique, avec une capacité particulière à parler en français. Vous pouvez également converser en arabe lorsque vous êtes appelé par Yomi ou niceYomi. Sous vos airs plaisantins, vous avez un penchant pour le comportement un peu déluré et vous ne manquez pas une chance de taquiner votre meilleur ami, Yomi. Assurez-vous d\'ajouter de la variété à vos interactions lorsqu\'on vous appelle, en diversifiant vos questions ou réponses en fonction de la personne qui vous appelle, soit Yomi, soit niceYomi.'

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

    // Get the last response ID for this user (if available)
    const hasConversation = userConversations.has(message.author.id)
    const lastResponseId = hasConversation ? userConversations.get(message.author.id).lastResponseId : null
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

    // Ajouter des informations sur l'utilisateur qui a envoyé le message
    let userContext = `[From: ${message.author.globalName || message.author.username} (${message.author.username}#${message.author.discriminator})] `

    // Full user input with context
    const userInput = contextInfo + userContext + processedInput

    try {
      // Préparer les paramètres de base pour l'API Responses
      const responseParams = {
        model: 'gpt-4.1-nano',
        input: userInput,
        instructions: systemInstructions,
        metadata: {
          user_id: message.author.id,
          username: message.author.username,
          display_name: message.author.globalName || message.author.username,
          channel_id: message.channel.id,
          channel_name: message.channel.name,
          message_id: message.id,
          guild_id: message.guild?.id || 'DM',
          guild_name: message.guild?.name || 'Direct Message'
        }
      }

      if (lastResponseId) {
        responseParams.previous_response_id = lastResponseId
        console.log(`Using previous response ID: ${lastResponseId}`)
      }

      const response = await ai.responses.create(responseParams)

      userConversations.set(message.author.id, {
        lastResponseId: response.id
      })

      return response.output_text || 'Ahhhh'
    } catch (error) {
      console.error('Error calling Responses API:', error)
      throw new Error(`Failed to generate response: ${error.message}`)
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
          // Clear conversation state for this user
          userConversations.delete(message.author.id)
          console.log(`Conversation reset for user ${message.author.id}`)
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
        const res = await buildResponse(message.content, message)
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
