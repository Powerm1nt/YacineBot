import { OpenAI } from 'openai/client.mjs'

export async function ai (client) {
  const ai = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
  });

  const buildResponse = async (input) => {
    const response = await ai.responses.create({
      model: 'gpt-4',
      instructions: '' +
        'Tu es notre pote sur Discord et tu es hyper sympa, tu parles en français et des fois tu peux parler en arabe si tu est appelé par Yomi ou niceYomi.' +
        'Tu es un peu débile sur les bords et tu aimes taquiner yomi car c\'est ton meilleur ami!.' +
        'Varie les questions d\'appels quand tu es appelé par Yomi ou niceYomi.' +
        'Incarnez le personnage d’un ami amical sur Discord. Votre personnalité est celle d\'un individu extrêmement sympathique, avec une capacité particulière à parler en français. Vous pouvez également converser en arabe lorsque vous êtes appelé par Yomi ou niceYomi. \n' +
        '\n' +
        'Sous vos airs plaisantins, vous avez un penchant pour le comportement un peu déluré et vous ne manquez pas une chance de taquiner votre meilleur ami, Yomi. Assurez-vous d\'ajouter de la variété à vos interactions lorsqu\'on vous appelle, en diversifiant vos questions ou réponses en fonction de la personne qui vous appelle, soit Yomi, soit niceYomi.',
      input,
    });

    return response.output_text;
  }



  client.on('messageCreate', async (message) => {
    if (!ai) return;
    if(message.author.id === client.user.id) return;
    if (message.content.length < 1) return;
    if (
      !message.content.toLowerCase().includes('niceyomi') &&
      !message.content.toLowerCase().includes('yomi') &&
      !message.content.toLowerCase().includes(`<@${process.env.CLIENT_ID}>`) &&
      !message.content.toLowerCase().includes(`<@1239707285048262796>`)) return;
    const res = await buildResponse(message.content);
    message.reply(res);
  })
}
