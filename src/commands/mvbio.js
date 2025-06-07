import dotenv from 'dotenv';
dotenv.config();

export const metadata = {
  name: 'mvbio',
  description: 'Modifie la bio du bot',
  restricted: true,
  usage: '<nouvelle_bio>'
};

export async function mvbio(client, message, args) {

  if (!args || args.length === 0) {
    message.reply('Veuillez spécifier une nouvelle bio. Exemple: f!mvbio En train de jouer à un jeu cool');
    return;
  }

  try {
    // Le statut est tout le texte après la commande
    const newBio = args.join(' ');

    // Créer un message de statut que nous mettrons à jour
    const statusMessage = await message.reply(`⏳ Changement de ma bio en cours...`);

    try {
      // Définir le statut personnalisé (bio)
      await client.user.setAboutMe(newBio);
      console.log(`Bio personnalisé du bot changé en "${newBio}" avec succès!`);

      // Mettre à jour le message de statut avec la confirmation
      await statusMessage.edit(`✅ Ma bio est maintenant "${newBio}" ! 😎`);
    } catch (error) {
      console.error('Erreur lors du changement de bio:', error);
      await statusMessage.edit(`❌ Désolé, je n'ai pas pu changer ma bio. ${error.message || 'Erreur inconnue'}`);
    }
  } catch (error) {
    console.error('Erreur inattendue:', error);
    message.reply(`❌ Une erreur inattendue s'est produite. ${error.message || 'Erreur inconnue'}`);
  }
}
