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

STYLE: Envoi des messages très courts, comme dans une conversation lambda entre potes. Tu parles principalement en français et parfois en arabe si tu es appelé par Yomi ou niceYomi.

PERSONNALITÉ: Tu es notre pote sur Discord, hyper sympa, un peu débile sur les bords. Tu aimes particulièrement taquiner Yomi car c'est ton meilleur ami! Assure-toi de varier tes interactions pour rester engageant. EVITE le cringe, et ne mets pas des hashtags ou des trucs façons linkedin

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
      await saveContextResponse(message, response.id)

      // Enregistrer également la réponse du bot dans la base de données
      const guildId = message.guild?.id || null
      const channelId = context.key
      try {
        await conversationService.addMessage(
          channelId,
          client.user.id,
          BOT_NAME,
          response.output_text || '',
          true, // isBot=true car c'est la réponse du bot
          guildId
        )
      } catch (error) {
        console.error('Erreur lors de l\'enregistrement de la réponse dans la base de données:', error)
      }

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
        // Ajout d'un délai aléatoire avant d'afficher l'indicateur de frappe pour plus de naturel
        const thinkingDelay = Math.floor(Math.random() * 1500) + 500; // Entre 500ms et 2000ms
        await new Promise(resolve => setTimeout(resolve, thinkingDelay));

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
          // Calculer un délai en fonction de la longueur du message pour simuler la frappe humaine
          const calculateTypingDelay = (text) => {
            // Calculer la vitesse de frappe en fonction de la complexité du texte
            const complexityFactor = (() => {
              // Détecter la présence de code ou de termes techniques qui ralentiraient la frappe
              const hasCode = /```|`|\{|\}|\(|\)|\[|\]|function|const|let|var|=>/i.test(text);
              const hasLinks = /http|www\.|https/i.test(text);
              const hasEmojis = /:[a-z_]+:|😀|😃|😄|😁|😆|😅|😂|🤣|😊|😇|🙂|🙃|😉|😌|😍|🥰|😘|😗|😙|😚|😋|😛|😝|😜|🤪|🤨|🧐|🤓|😎|🤩|🥳|😏|😒|😞|😔|😟|😕|🙁|☹️|😣|😖|😫|😩|🥺|😢|😭|😤|😠|😡|🤬|🤯|😳|🥵|🥶|😱|😨|😰|😥|😓|🤗|🤔|🤭|🤫|🤥|😶|😐|😑|😬|🙄|😯|😦|😧|😮|😲|🥱|😴|🤤|😪|😵|🤐|🥴|🤢|🤮|🤧|😷|🤒|🤕|🤑|🤠/i.test(text);

              // Texte plus complexe = frappe plus lente
              if (hasCode) return 1.5; // Frappe plus lente pour le code
              if (hasLinks) return 1.3; // Frappe plus lente pour les liens
              if (hasEmojis) return 0.8; // Frappe plus rapide pour les messages émotionnels
              return 1.0; // Vitesse normale
            })();

            // Vitesse moyenne de frappe (varie selon la complexité détectée)
            const baseSpeed = 120 * complexityFactor;

            // Variation aléatoire pour rendre le comportement plus naturel
            const randomFactor = Math.random() * 0.3 + 0.85; // Entre 0.85 et 1.15

            // Délai proportionnel à la longueur du texte
            const characterCount = text.length;
            const rawDelay = characterCount * baseSpeed * randomFactor;

            // Gestion des pauses pour la réflexion dans les messages longs
            let reflectionTime = 0;
            if (characterCount > 100) {
              // Ajouter du temps de réflexion pour les messages longs
              reflectionTime = Math.min(1500, characterCount * 3);
            }

            // Délais minimum et maximum
            const minDelay = 800; // Minimum pour éviter les réponses instantanées
            const maxDelay = Math.min(8000, 3000 + characterCount / 15); // Plafonner les délais extrêmes

            // Délai final avec toutes les variables
            return Math.min(maxDelay, Math.max(minDelay, rawDelay + reflectionTime));
          };

          // Simuler le temps de frappe
          const typingDelay = calculateTypingDelay(res);
          console.log(`Délai de frappe calculé: ${typingDelay}ms pour ${res.length} caractères`);

          // Maintenir l'indicateur de frappe pendant le délai calculé
          let typingInterval = setInterval(() => {
            message.channel.sendTyping().catch(console.error);
          }, 5000); // Discord typing lasts ~10 seconds, refresh every 5s

          // Attendre le délai calculé
          await new Promise(resolve => setTimeout(resolve, typingDelay));

          // Arrêter l'indicateur de frappe
          clearInterval(typingInterval);

          // Envoyer la réponse
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
