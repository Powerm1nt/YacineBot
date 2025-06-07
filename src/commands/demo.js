import { commandLimiter } from '../utils/rateLimit.js';

export const metadata = {
  name: 'demo',
  description: 'Affiche un message de démonstration',
  restricted: false
};

export function demo(client, message, args) {
  // Le rate limiting est déjà vérifié dans app.js pour les commandes
  // Cette vérification est donc redondante mais peut servir de sécurité supplémentaire
  // si la commande est appelée directement ailleurs
  const rateLimitResult = commandLimiter.check(message.author.id);
  if (rateLimitResult !== true) {
    message.reply(rateLimitResult);
    return;
  }

  message.reply('demo');
}
