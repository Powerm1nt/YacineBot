/**
 * Utilitaires pour la gestion des commandes et contextes
 */

/**
 * Génère une clé de contexte unique pour stocker les conversations
 * @param {Object} message - Message Discord
 * @returns {Object} - Objet contenant le type et la clé de contexte
 */
export function getContextKey(message) {
  if (!message || !message.channel) {
    console.error('Invalid message object passed to getContextKey');
    return { type: 'invalid', key: 'invalid_context' };
  }

  if (message.guild) {
    // Si c'est un message de serveur
    return { 
      type: 'guild', 
      key: `${message.guild.id}_${message.channel.id}` 
    };
  } else if (message.channel.type === 'GROUP_DM') {
    // Si c'est un groupe DM
    return { 
      type: 'group', 
      key: message.channel.id 
    };
  } else {
    // Si c'est un DM privé
    return { 
      type: 'dm', 
      key: message.channel.id 
    };
  }
}

/**
 * Importation dynamique des métadonnées de toutes les commandes
 * @param {string[]} commandNames - Tableau des noms de commandes à importer
 * @returns {Promise<Object[]>} - Tableau des métadonnées de commandes
 */
export async function getCommandsMetadata(commandNames) {
  const commandsMetadata = [];

  for (const commandName of commandNames) {
    try {
      // Importer dynamiquement les métadonnées de chaque commande
      const module = await import(`../commands/${commandName}.js`);
      if (module.metadata) {
        commandsMetadata.push(module.metadata);
      }
    } catch (error) {
      console.error(`Erreur lors de l'importation des métadonnées pour ${commandName}:`, error);
    }
  }

  return commandsMetadata;
}

/**
 * Importation dynamique des métadonnées d'une commande
 * @param {string} commandName - Nom de la commande à importer
 * @returns {Promise<Object|null>} - Métadonnées de la commande ou null si non trouvées
 */
export async function getCommandMetadata(commandName) {
  try {
    const module = await import(`../commands/${commandName}.js`);
    return module.metadata || null;
  } catch (error) {
    console.error(`Erreur lors de l'importation des métadonnées pour ${commandName}:`, error);
    return null;
  }
}
