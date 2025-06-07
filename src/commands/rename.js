import dotenv from 'dotenv';
dotenv.config();

export async function rename(client, message, args) {
  if (!args || args.length === 0) {
    message.reply('Veuillez spécifier un nouveau nom. Exemple: f!rename NouveauNom');
    return;
  }

  try {
    const newName = args.join(' ');

    // Change nickname
    if (message.guild) {
      console.log(`Changing bot nickname in server from ${message.member.displayName} to ${newName}...`);

      const botMember = message.guild.members.cache.get(client.user.id);
      if (botMember) {
        await botMember.setNickname(newName);
        console.log(`Bot nickname changed to ${botMember.displayName} successfully in server ${message.guild.name}!`);
        await message.reply(`Mon surnom a été changé en ${newName} dans ce serveur ! 😎`);
      } else {
        return new Error('Je n\'ai pas les permissions nécessaires pour changer mon surnom dans ce serveur.');
      }
    } else {
      return new Error('Cette commande ne peut être utilisée que dans un serveur, pas en messages privés.');
    }
  } catch (error) {
    console.error('Error renaming bot:', error);
    message.reply(`Désolé, je n'ai pas pu changer mon nom. ${error.message || 'Erreur inconnue'}`);
  }
}
