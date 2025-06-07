import { commandLimiter } from '../utils/rateLimit.js';
import fs from 'fs';
import path from 'path';

export const metadata = {
  name: 'warn',
  description: 'Avertir un utilisateur',
  restricted: true,
  usage: '<@utilisateur> [raison]'
};

// Chemin vers le fichier de stockage des avertissements
const warningsFilePath = path.join(process.cwd(), 'data', 'warnings.json');

// Fonction pour s'assurer que le répertoire data existe
function ensureDirectoryExists() {
  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Fonction pour charger les avertissements
function loadWarnings() {
  ensureDirectoryExists();

  if (!fs.existsSync(warningsFilePath)) {
    // Créer un fichier vide si le fichier n'existe pas
    fs.writeFileSync(warningsFilePath, JSON.stringify({}));
    return {};
  }

  try {
    const data = fs.readFileSync(warningsFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erreur lors du chargement des avertissements:', error);
    return {};
  }
}

// Fonction pour sauvegarder les avertissements
function saveWarnings(warnings) {
  ensureDirectoryExists();

  try {
    fs.writeFileSync(warningsFilePath, JSON.stringify(warnings, null, 2));
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des avertissements:', error);
  }
}

// Fonction pour ajouter un avertissement
function addWarning(guildId, userId, moderatorId, reason) {
  const warnings = loadWarnings();

  // Initialiser les objets si nécessaire
  if (!warnings[guildId]) warnings[guildId] = {};
  if (!warnings[guildId][userId]) warnings[guildId][userId] = [];

  // Ajouter le nouvel avertissement
  warnings[guildId][userId].push({
    moderatorId,
    reason,
    timestamp: Date.now()
  });

  // Sauvegarder les changements
  saveWarnings(warnings);

  // Retourner le nombre total d'avertissements
  return warnings[guildId][userId].length;
}

// Fonction pour obtenir les avertissements d'un utilisateur
function getUserWarnings(guildId, userId) {
  const warnings = loadWarnings();
  return (warnings[guildId] && warnings[guildId][userId]) ? warnings[guildId][userId] : [];
}

export async function warn(client, message, args) {
  // Vérifier les permissions de l'utilisateur
  if (!message.member.permissions.has('MODERATE_MEMBERS')) {
    return message.reply('❌ Vous n\'avez pas la permission d\'avertir des membres.');
  }

  // Sous-commande pour afficher les avertissements
  if (args[0] === 'list' && message.mentions.users.size) {
    const target = message.mentions.users.first();
    const warnings = getUserWarnings(message.guild.id, target.id);

    if (warnings.length === 0) {
      return message.reply(`✅ **${target.tag}** n'a aucun avertissement.`);
    }

    let warningsList = `**Avertissements de ${target.tag}** (${warnings.length}):\n\n`;
    warnings.forEach((warning, index) => {
      const date = new Date(warning.timestamp).toLocaleDateString();
      warningsList += `**${index + 1}.** ${warning.reason} - par <@${warning.moderatorId}> le ${date}\n`;
    });

    return message.reply(warningsList);
  }

  // Vérifier si un utilisateur est mentionné
  if (!message.mentions.users.size) {
    return message.reply('❌ Vous devez mentionner un utilisateur à avertir ou utiliser `warn list @utilisateur` pour voir ses avertissements.');
  }

  const target = message.mentions.members.first();
  if (!target) {
    return message.reply('❌ Cet utilisateur n\'existe pas ou n\'est pas dans ce serveur.');
  }

  // Ne pas permettre d'avertir les modérateurs ou administrateurs
  if (target.permissions.has('MODERATE_MEMBERS')) {
    return message.reply('❌ Vous ne pouvez pas avertir un modérateur ou un administrateur.');
  }

  // Extraire la raison (tous les arguments après la mention)
  const reason = args.slice(1).join(' ') || 'Aucune raison fournie';

  // Ajouter l'avertissement
  const warningCount = addWarning(message.guild.id, target.id, message.author.id, reason);

  message.reply(`✅ **${target.user.tag}** a reçu un avertissement (${warningCount} au total). Raison: ${reason}`);

  // Notifier l'utilisateur par MP
  try {
    await target.send(`⚠️ Vous avez reçu un avertissement sur **${message.guild.name}** par ${message.author.tag}.\n**Raison:** ${reason}\n**Total d'avertissements:** ${warningCount}`);
  } catch (error) {
    // Ignorer silencieusement si l'utilisateur a les MPs désactivés
  }
}
