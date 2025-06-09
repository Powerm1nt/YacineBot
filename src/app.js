import dotenv from 'dotenv';
import { Client } from 'discord.js-selfbot-v13'
import { createClient } from '@supabase/supabase-js'
import { demo } from './commands/demo.js'
import { rename } from './commands/rename.js'
import { avatar } from './commands/avatar.js'
import { mvbio } from './commands/mvbio.js'
import { help } from './commands/help.js'
import { ai } from './commands/ai.js'
import { scheduler } from './commands/scheduler.js'
import { status } from './commands/status.js'
import { ban } from './commands/ban.js'
import { kick } from './commands/kick.js'
import { timeout } from './commands/timeout.js'
import { warn } from './commands/warn.js'
import { commandLimiter } from './utils/rateLimit.js'
import { isAuthorized } from './utils/authGuard.js'
import { getCommandMetadata } from './utils/commandUtils.js'
import { initScheduler } from './services/schedulerService.js'
import { morpion } from './commands/morpion.js'
import { moignon } from './commands/moignon.js'
import { SUPABASE_CONFIG, validateDatabaseConfig, validateSupabaseConfig } from './config/database.js'
import { config } from './commands/config.js'
import { isSchedulerEnabled } from './utils/configService.js'
import { context } from './commands/context.js'
dotenv.config();

// Vérification de la configuration de la base de données
if (!validateDatabaseConfig()) {
  console.error('La configuration de la base de données est incomplète. Vérifiez votre fichier .env');
  process.exit(1);
}

// Initialisation de Supabase pour la compatibilité avec l'ancien code
if (!validateSupabaseConfig()) {
  console.warn('La configuration Supabase est incomplète. Certaines fonctionnalités pourraient ne pas fonctionner.');
}

export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);

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
  status: async (message, args) => status(client, message, args),
  ban: async (message, args) => ban(client, message, args),
  kick: async (message, args) => kick(client, message, args),
  timeout: async (message, args) => timeout(client, message, args),
  warn: async (message, args) => warn(client, message, args),
  morpion: async (message, args) => morpion(client, message, args),
  moignon: async (message, args) => moignon(client, message, args),
  config: async (message, args) => config(client, message, args),
  context: async (message, args) => context(client, message, args),
};

// Liste des commandes disponibles pour l'importation dynamique dans help.js
export const commandsList = Object.keys(commands);

client.on("messageCreate", async (message) => {
  if(message.author.id === client.user.id) return;

  if(message.content.startsWith(prefix)) {
    const rateLimitResult = commandLimiter.check(message.author.id);
    if (rateLimitResult !== true) {
      return;
    }

    let args = message.content.split(" ").filter(str => /\w+/.test(str));
    let command = args.shift().replace(prefix, "");

    if (!commands[command]) {
      message.channel.send(`<@${message.author.id}>, cette commande n'existe pas.`);
      return;
    }

    const metadata = await getCommandMetadata(command);
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

async function registerFeatures(client) {
  try {
    // Initialiser l'IA
    await ai(client);

    // Initialiser le planificateur de tâches automatiques
    if (await isSchedulerEnabled()) {
      await initScheduler(client);
      console.log('Planificateur de tâches automatiques initialisé');
    }
  } catch (error) {
    console.error('Erreur lors de l\'initialisation des fonctionnalités:', error);
    // Ne pas quitter pour permettre le fonctionnement de base du bot
  }
}

  // Gestionnaire d'erreurs global pour éviter les crashs du bot
  process.on('uncaughtException', (error) => {
  console.error('Err: (uncaughtException):', error);
  });

  process.on('unhandledRejection', (reason, promise) => {
  console.error('Promise rejected: (unhandledRejection):', reason);
  });

client.on('ready', async () => {
  console.log(`${client.user.username} is ready!`);
})

client.login(process.env.TOKEN)
  .then(() => registerFeatures(client))
  .catch(console.error);
