import { commandLimiter } from '../utils/rateLimit.js';
import { getCommandsMetadata } from '../utils/commandUtils.js';

export const metadata = {
  name: 'help',
  description: 'Affiche la liste des commandes disponibles',
  restricted: false
};

export async function help(client, message, args) {
  // Le rate limiting est déjà vérifié dans app.js pour les commandes
  // Cette vérification est donc redondante mais peut servir de sécurité supplémentaire
  // si la commande est appelée directement ailleurs
  const rateLimitResult = commandLimiter.check(message.author.id);
  if (rateLimitResult !== true) {
    message.reply({ content: rateLimitResult });
    return;
  }

  // Récupération du préfixe de commande depuis la configuration
  const prefix = process.env.COMMAND_PREFIX || 'f!';

  // Liste des noms de commandes disponibles
  let commandNames;
  try {
    // Importer dynamiquement la liste des commandes depuis app.js
    const { commandsList } = await import('../app.js');
    commandNames = commandsList || ['demo', 'help', 'rename', 'avatar', 'mvbio'];
  } catch (error) {
    console.error('Erreur lors de l\'importation de la liste des commandes:', error);
    // Utiliser une liste par défaut si l'importation échoue
    commandNames = ['demo', 'help', 'rename', 'avatar', 'mvbio'];
  }

  // Récupération dynamique des métadonnées des commandes
  const commandsMetadata = await getCommandsMetadata(commandNames);

  // Construction du message d'aide
  let helpMessage = '**Liste des commandes disponibles:**\n\n';

  // Ajouter chaque commande au message
  for (const cmdMeta of commandsMetadata) {
    const restrictedTag = cmdMeta.restricted ? ' (restreinte)' : '';
    helpMessage += `\`${prefix}${cmdMeta.name}\` - ${cmdMeta.description}${restrictedTag}\n`;
  }

  // Ajouter des informations sur les commandes restreintes
  helpMessage += '\n**Note:** Les commandes marquées comme "restreintes" ne sont accessibles qu\'aux utilisateurs autorisés.';

  // Envoyer le message d'aide
  message.reply({ content: helpMessage });
}
