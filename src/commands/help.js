import { commandLimiter } from '../utils/rateLimit.js';
import { getCommandsMetadata } from '../utils/commandUtils.js';

export const metadata = {
  name: 'help',
  description: 'Affiche la liste des commandes disponibles',
  restricted: false,
  usage: '[commande]'
};

export async function help(client, message, args) {
  const rateLimitResult = commandLimiter.check(message.author.id);
  if (rateLimitResult !== true) {
    message.reply({ content: rateLimitResult });
    return;
  }

  const prefix = process.env.COMMAND_PREFIX || 'f!';

  // Liste des noms de commandes disponibles
  let commandNames;
  try {
    const { commandsList } = await import('../app.js');
    commandNames = commandsList || ['demo', 'help', 'rename', 'avatar', 'mvbio'];
  } catch (error) {
    console.error('Erreur lors de l\'importation de la liste des commandes:', error);
    commandNames = ['demo', 'help', 'rename', 'avatar', 'mvbio'];
  }

  // Si un argument est fourni, afficher l'aide pour cette commande spécifique
  if (args.length > 0) {
    const commandName = args[0].toLowerCase();
    try {
      const module = await import(`../commands/${commandName}.js`);
      if (module.metadata) {
        const cmdMeta = module.metadata;
        const restrictedTag = cmdMeta.restricted ? ' (restreinte)' : '';
        let helpMessage = `**Aide pour la commande ${prefix}${cmdMeta.name}**${restrictedTag}\n\n`;
        helpMessage += `**Description:** ${cmdMeta.description}\n`;

        if (cmdMeta.usage) {
          helpMessage += `**Utilisation:** ${prefix}${cmdMeta.name} ${cmdMeta.usage}\n`;
        }

        message.reply({ content: helpMessage });
        return;
      }
    } catch (error) {
      console.error(`Erreur lors de l'importation des métadonnées pour ${commandName}:`, error);
      message.reply(`❌ La commande '${commandName}' n'existe pas.`);
      return;
    }
  }

  const commandsMetadata = await getCommandsMetadata(commandNames);

  let helpMessage = '**Liste des commandes disponibles:**\n\n';

  for (const cmdMeta of commandsMetadata) {
    const restrictedTag = cmdMeta.restricted ? ' (restreinte)' : '';
    helpMessage += `\`${prefix}${cmdMeta.name}\` - ${cmdMeta.description}${restrictedTag}\n`;

    if (cmdMeta.usage) {
      helpMessage += `  → Usage: ${prefix}${cmdMeta.name} ${cmdMeta.usage}\n`;
    }
  }

  helpMessage += '\n**Note:** Les commandes marquées comme "restreintes" ne sont accessibles qu\'aux utilisateurs autorisés.';
  helpMessage += '\nPour plus d\'informations sur une commande spécifique, tapez `' + prefix + 'help <commande>`.';

  message.reply({ content: helpMessage });
}
