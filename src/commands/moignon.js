export const metadata = {
  name: 'moignon',
  description: 'Envoie un gif de moignon',
  restricted: false,
  usage: 'moignon'
};

export function moignon(client, message, args) {
  message.reply({ content: 'https://tenor.com/view/kaeloo-moignon-gif-27174106' });
}
