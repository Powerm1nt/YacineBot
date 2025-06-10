export const metadata = {
  name: 'demo',
  description: 'Affiche un message de démonstration',
  restricted: false,
  usage: 'demo'
};

export function demo(client, message, args) {
  message.reply({ content: 'Voici une démonstration du bot ! 🤖' });
}
