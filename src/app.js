import dotenv from 'dotenv';
import { Client } from 'discord.js-selfbot-v13'
import { demo } from './commands/demo.js'
import { ai } from './commands/ai.js'
import { commandLimiter } from './utils/rateLimit.js'
dotenv.config();

// Configuration globale du bot
const BOT_CONFIG = {
  name: 'Yascine',  // Nom immuable du bot
  prefix: 'f!'     // Préfixe pour les commandes
};

const client = new Client();

// Utiliser le préfixe de la configuration centralisée
const prefix = BOT_CONFIG.prefix;

const commands = {
  demo: async (message, args) => demo(client, message, args),
}

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
}

client.on('ready', async () => {
  console.log(`${client.user.username} is ready!`);
})

client.login(process.env.TOKEN)
  .then(() => registerFeatures(client))
  .catch(console.error);

