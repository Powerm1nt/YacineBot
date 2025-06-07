import { commandLimiter } from '../utils/rateLimit.js';

export const metadata = {
  name: 'demo',
  description: 'Affiche un message de démonstration',
  restricted: false,
  usage: 'demo'
};

export function demo(client, message, args) {
  const rateLimitResult = commandLimiter.check(message.author.id);
  if (rateLimitResult !== true) {
    message.reply({ content: rateLimitResult });
    return;
  }

  message.reply({ content: 'Voici une démonstration du bot ! 🤖' });
}
