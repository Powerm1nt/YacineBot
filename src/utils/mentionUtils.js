const USER_MENTION_REGEX = /<@(\d+)>/g

/**
 * Remplace les mentions d'utilisateurs <@ID> par une combinaison de nom + ID
 * @param {string} text - Texte contenant potentiellement des mentions
 * @param {Object} client - Instance du client Discord
 * @returns {Promise<string>} - Texte avec les mentions enrichies
 */
export async function replaceMentionsWithNames(text, client) {
  if (!text || !client || !USER_MENTION_REGEX.test(text)) return text

  let result = text
  let match

  // Réinitialiser le regex pour pouvoir l'utiliser à nouveau
  USER_MENTION_REGEX.lastIndex = 0

  // Pour chaque mention trouvée
  while ((match = USER_MENTION_REGEX.exec(text)) !== null) {
    try {
      const userId = match[1]
      const originalMention = match[0] // Capture le format original <@ID>

      // Récupérer l'utilisateur depuis le client Discord
      const user = await client.users.fetch(userId)

      if (user.id === client.user.id) continue
      if (user) {
        // Utiliser le globalName s'il existe, sinon le username
        const displayName = user.globalName || user.username

        // Remplacer la mention par le nom avec l'ID
        // Format: @nom (ID: ID) - ce format sera converti en <@ID> par le système
        result = result.replace(originalMention, `@${displayName} (ID: ${userId})`)
        console.log(`Enhanced mention ${originalMention} with name @${displayName} (ID: ${userId})`)
      }
    } catch (error) {
      console.error(`Error fetching user for mention ${match[0]}:`, error)
    }
  }

  return result
}

/**
 * Extrait les IDs d'utilisateurs à partir de mentions au format @nom (ID: 123456789)
 * Utile pour trouver les IDs à partir du format enrichi de mentions
 * @param {string} text - Texte contenant des mentions enrichies
 * @returns {Array<string>} - Liste des IDs trouvés
 */
export function extractUserIdsFromText(text) {
  if (!text) return []

  // Capturer les IDs des mentions enrichies au format @nom (ID: 123456789)
  const idRegex = /\(ID: (\d+)\)/g
  const directMentionRegex = /<@(\d+)>/g

  const ids = []
  let match

  // Extraire les IDs des mentions enrichies
  while ((match = idRegex.exec(text)) !== null) {
    ids.push(match[1])
  }

  // Extraire les IDs des mentions directes
  directMentionRegex.lastIndex = 0
  while ((match = directMentionRegex.exec(text)) !== null) {
    ids.push(match[1])
  }

  // Éliminer les doublons
  return [...new Set(ids)]
}

/**
 * Vérifie si un message mentionne un utilisateur spécifique
 * @param {string} text - Texte du message
 * @param {string} userId - ID de l'utilisateur à rechercher
 * @returns {boolean} - True si l'utilisateur est mentionné
 */
export function isUserMentioned(text, userId) {
  if (!text || !userId) return false

  // Vérifier les mentions directes <@ID>
  if (text.includes(`<@${userId}>`)) return true

  // Vérifier les mentions directes @ID sans balises
  if (text.includes(`@${userId}`)) return true

  // Vérifier les mentions enrichies (ID: userId)
  return text.includes(`(ID: ${userId})`)
}

/**
 * Vérifie si le format d'une mention est valide
 * @param {string} mention - Texte de la mention
 * @returns {boolean} - True si le format est valide
 */
export function isValidMentionFormat(mention) {
  if (!mention) return false

  // Format Discord standard <@ID>
  if (/<@\d{17,20}>/.test(mention)) return true

  // Format enrichi @nom (ID: ID)
  if (/@[^(]+\s*\(ID:\s*\d{17,20}\)/.test(mention)) return true

  // Format ID direct @ID
  if (/@\d{17,20}(?![\d])/.test(mention)) return true

  return false
}

/**
 * Convertit le texte d'une réponse de l'IA pour assurer que toutes les mentions sont au format Discord <@ID>
 * @param {string} text - Texte de l'IA avec des formats de mention variés
 * @returns {string} - Texte avec des mentions Discord <@ID>
 */
export function convertAITextToDiscordMentions(text) {
  if (!text) return text

  // Préserver d'abord les mentions déjà correctement formatées avec un marqueur temporaire
  // pour éviter toute modification ultérieure
  const correctMentions = [];
  let preservedText = text.replace(/<@(\d{17,20})>/g, (match, id) => {
    const marker = `__MENTION_${correctMentions.length}__`;
    correctMentions.push(match);
    return marker;
  });

  // Convertir les différents formats en mentions correctes

  // Format: @nom (ID: 123456789) -> <@123456789>
  preservedText = preservedText.replace(/@([^(]+)\s*\(ID:\s*(\d+)\)/g, (match, name, id) => `<@${id}>`);

  // Format: (ID: 123456789) -> <@123456789>
  preservedText = preservedText.replace(/\(ID:\s*(\d+)\)/g, (match, id) => `<@${id}>`);

  // Format: @123456789 (sans chevrons) -> <@123456789>
  preservedText = preservedText.replace(/@(\d{17,20})(?![\d])/g, (match, id) => `<@${id}>`);

  // Format: ID:123456789 -> <@123456789>
  preservedText = preservedText.replace(/ID[:\s]+(\d{17,20})/g, (match, id) => `<@${id}>`);

  // Restaurer les mentions correctes originales
  correctMentions.forEach((mention, index) => {
    preservedText = preservedText.replace(`__MENTION_${index}__`, mention);
  });

  return removeSelfMentions(preservedText);
}

/**
 * Supprime les mentions du bot lui-même dans un texte
 * @param {string} text - Texte contenant potentiellement des auto-mentions
 * @returns {string} - Texte sans auto-mentions
 */
export function removeSelfMentions(text) {
  if (!text || !process.env.CLIENT_ID) return text

  // Remplacer les auto-mentions par "moi" pour éviter que le bot se mentionne
  const selfMentionRegex = new RegExp(`<@${process.env.CLIENT_ID}>`, 'g')
  return text.replace(selfMentionRegex, 'moi')
}
