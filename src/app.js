import dotenv from 'dotenv';
import { Client } from 'discord.js-selfbot-v13'
import { demo } from './commands/demo.js'
import { rename } from './commands/rename.js'
import { avatar } from './commands/avatar.js'
import { mvbio } from './commands/mvbio.js'
import { help } from './commands/help.js'
import { ai } from './commands/ai.js'
import { scheduler } from './commands/scheduler.js'
import { commandLimiter } from './utils/rateLimit.js'
import { isAuthorized } from './utils/authGuard.js'
import { getCommandMetadata } from './utils/commandUtils.js'
import { initScheduler } from './services/schedulerService.js'
dotenv.config();

const BOT_CONFIG = {
  name: process.env.BOT_NAME || 'Yascine',
  prefix: process.env.COMMAND_PREFIX || 'f!'
};

const client = new Client();
const prefix = BOT_CONFIG.prefix;

// Définition des commandes avec leurs handlers
const commands = {
  demo: async (message, args) => demo(client, message, args),
  rename: async (message, args) => rename(client, message, args),
  avatar: async (message, args) => avatar(client, message, args),
  mvbio: async (message, args) => mvbio(client, message, args),
  help: async (message, args) => help(client, message, args),
  scheduler: async (message, args) => scheduler(client, message, args),
};

// Liste des commandes disponibles pour l'importation dynamique dans help.js
export const commandsList = Object.keys(commands);

client.on("messageCreate", async (message) => {
  if(message.author.id === client.user.id) return;

  if(message.content.startsWith(prefix)) {
    // Vérifier le rate limit
    const rateLimitResult = commandLimiter.check(message.author.id);
    if (rateLimitResult !== true) {
      return;
    }

    let args = message.content.split(" ").filter(str => /\w+/.test(str));
    let command = args.shift().replace(prefix, "");

    // Vérifier si la commande existe
    if (!commands[command]) {
      message.channel.send(`<@${message.author.id}>, cette commande n'existe pas.`);
      return;
    }

    // Charger les métadonnées de la commande
    const metadata = await getCommandMetadata(command);

    // Vérifier l'autorisation avec les métadonnées chargées
    if (!isAuthorized({ metadata }, message.author.id)) {
      message.reply('❌ Désolé, vous n\'êtes pas autorisé à utiliser cette commande.');
      return;
    }

    try {
      commands[command](message, args);
    } catch(e) {
      message.channel.send("<@" + message.author.id + ">, this command does not exist.");
      console.log(e);
    }
  }
});

if (process.env?.TOKEN === undefined) {
  throw new Error('Token not found');
}

function registerFeatures(client) {
  ai(client)
  .catch(console.error);

  // Initialiser le planificateur de tâches automatiques
  initScheduler(client);
  console.log('Planificateur de tâches automatiques initialisé');
}

client.on('ready', async () => {
  console.log(`${client.user.username} is ready!`);
})

client.login(process.env.TOKEN)
  .then(() => registerFeatures(client))
  .catch(console.error);

