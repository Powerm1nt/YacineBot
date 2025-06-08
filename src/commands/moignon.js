import { commandLimiter } from '../utils/rateLimit.js';

export const metadata = {
  name: 'moignon',
  description: 'Envoie un gif de moignon',
  restricted: false,
  usage: 'moignon'
};

export function moignon(client, message, args) {
  const rateLimitResult = commandLimiter.check(message.author.id);
  if (rateLimitResult !== true) {
    message.reply({ content: rateLimitResult });
    return;
  }

  message.reply({ content: 'https://tenor.com/view/kaeloo-moignon-gif-27174106' });
}