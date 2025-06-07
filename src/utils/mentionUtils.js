const USER_MENTION_REGEX = /<@(\d+)>/g

/**
 * Remplace les mentions d'utilisateurs <@ID> par leurs noms
 * @param {string} text - Texte contenant potentiellement des mentions
 * @param {Object} client - Instance du client Discord
 * @returns {Promise<string>} - Texte avec les mentions remplacées par les noms
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

      // Récupérer l'utilisateur depuis le client Discord
      const user = await client.users.fetch(userId)

      if (user.id === client.user.id) continue
      if (user) {
        // Utiliser le globalName s'il existe, sinon le username
        const displayName = user.globalName || user.username

        // Remplacer la mention par le nom
        result = result.replace(match[0], `@${displayName}`)
        console.log(`Replaced mention ${match[0]} with @${displayName} (ID: ${userId})`)
      }
    } catch (error) {
      console.error(`Error fetching user for mention ${match[0]}:`, error)
    }
  }

  return result
}
