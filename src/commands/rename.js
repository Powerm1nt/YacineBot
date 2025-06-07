import dotenv from 'dotenv';
dotenv.config();

export const metadata = {
  name: 'rename',
  description: 'Change le surnom du bot dans le serveur actuel',
  restricted: false,
  usage: '<nouveau_nom>'
};

export async function rename(client, message, args) {
  if (!args || args.length === 0) {
    message.reply('Veuillez spécifier un nouveau nom. Exemple: f!rename NouveauNom');
    return;
  }

  try {
    // Utiliser tous les arguments comme nouveau nom
    const newName = args.join(' ');

    // Créer un message de statut que nous mettrons à jour
    const statusMessage = await message.reply(`⏳ Traitement de votre demande en cours...`);

    // Changement du surnom dans le serveur si applicable
    if (message.guild) {
      console.log(`Changing bot nickname in server from ${message.member.displayName} to ${newName}...`);

      const botMember = message.guild.members.cache.get(client.user.id);
      if (!botMember) {
        throw new Error('Je n\'ai pas pu trouver mon compte sur ce serveur.');
      }

      await botMember.setNickname(newName);
      console.log(`Surnom du bot changé en ${botMember.displayName} avec succès dans le serveur ${message.guild.name}!`);
    } else {
      console.log('La commande a été utilisée en messages privés, pas de changement de surnom.');
    }

    // Construire et afficher le message de confirmation
    const confirmationMessage = `✅ Mon surnom a été changé en "${newName}" dans ce serveur ! 😎`;

    // Mettre à jour le message de statut avec la confirmation
    await statusMessage.edit(confirmationMessage);

  } catch (error) {
    console.error('Erreur lors du changement de surnom:', error);
    if (statusMessage) {
      statusMessage.edit(`❌ Désolé, je n'ai pas pu changer mon surnom. ${error.message || 'Erreur inconnue'}`);
    } else {
      message.reply(`❌ Désolé, je n'ai pas pu changer mon surnom. ${error.message || 'Erreur inconnue'}`);
    }
  }
}
