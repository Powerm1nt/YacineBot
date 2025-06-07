import { commandLimiter } from '../utils/rateLimit.js';
import { getCommandsMetadata } from '../utils/commandUtils.js';

export const metadata = {
  name: 'help',
  description: 'Affiche la liste des commandes disponibles',
  restricted: false
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

  const commandsMetadata = await getCommandsMetadata(commandNames);

  let helpMessage = '**Liste des commandes disponibles:**\n\n';

  for (const cmdMeta of commandsMetadata) {
    const restrictedTag = cmdMeta.restricted ? ' (restreinte)' : '';
    helpMessage += `\`${prefix}${cmdMeta.name}\` - ${cmdMeta.description}${restrictedTag}\n`;
  }

  helpMessage += '\n**Note:** Les commandes marquées comme "restreintes" ne sont accessibles qu\'aux utilisateurs autorisés.';

  message.reply({ content: helpMessage });
}
