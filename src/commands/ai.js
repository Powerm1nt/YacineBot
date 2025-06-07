import { OpenAI } from 'openai/client.mjs'
import { aiLimiter } from '../utils/rateLimit.js'

export async function ai (client) {
  const ai = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
  });

  const buildResponse = async (input, referenceMessage) => {
    let fullContext = input;

    if (referenceMessage && referenceMessage.reference) {
      try {
        const previousMessage = await referenceMessage.channel.messages.fetch(referenceMessage.reference.messageId);
        if (previousMessage) {
          fullContext = `Message précédent: ${previousMessage.content}\nNouveau message: ${input}`;
        }
      } catch (error) {
        console.error('Erreur lors de la récupération du message précédent:', error);
      }
    }

    const response = await ai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [
        {
          role: "system",
          content: '' +
            'Tu es notre pote sur Discord et tu es hyper sympa, tu parles en français et des fois tu peux parler en arabe si tu est appelé par Yomi ou niceYomi.' +
            'Tu es un peu débile sur les bords et tu aimes taquiner yomi car c\'est ton meilleur ami!.' +
            'Tu dois utiliser du markdown si tu as besoin de mettre des liens, des images, des emojis, etc.' +
            'Varie les questions d\'appels quand tu es appelé par Yomi ou niceYomi.' +
            'Incarnez le personnage d\'un ami amical sur Discord. Votre personnalité est celle d\'un individu extrêmement sympathique, avec une capacité particulière à parler en français. Vous pouvez également converser en arabe lorsque vous êtes appelé par Yomi ou niceYomi. \n' +
            '\n' +
            'Sous vos airs plaisantins, vous avez un penchant pour le comportement un peu déluré et vous ne manquez pas une chance de taquiner votre meilleur ami, Yomi. Assurez-vous d\'ajouter de la variété à vos interactions lorsqu\'on vous appelle, en diversifiant vos questions ou réponses en fonction de la personne qui vous appelle, soit Yomi, soit niceYomi.'
        },
        {
          role: "user",
          content: fullContext
        }
      ]
    });

    console.log(fullContext);

    return response.choices[0].message.content;
  }

  client.on('messageCreate', async (message) => {
    if (!ai) return;
    if(message.author.id === client.user.id) return;
    if (message.content.length < 1) return;

    if (
      (!message.content.toLowerCase().includes('niceyomi') &&
        !message.content.toLowerCase().includes('yomi') &&
        !message.content.toLowerCase().includes(`<@${process.env.CLIENT_ID}>`) &&
        !message.content.toLowerCase().includes(`<@1239707285048262796>`)) &&
      !message.reference) return;

    // Vérifier le rate limit
    const rateLimitResult = aiLimiter.check(message.author.id);
    if (rateLimitResult !== true) {
      return;
    }

    const res = await buildResponse(message.content, message);
    const sentMessage = await message.reply(res);
    
    if (sentMessage) {
      sentMessage.reference = {
        messageId: sentMessage.id,
        channelId: sentMessage.channel.id,
        guildId: sentMessage.guild?.id
      };
    }
  });
}
