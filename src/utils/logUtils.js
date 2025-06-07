/**
 * Utilitaires pour la journalisation et le débogage
 */

/**
 * Journalise les mentions trouvées dans un texte
 * 
 * @param {string} text - Le texte à analyser
 * @param {string} botId - ID du bot à exclure des mentions
 * @returns {Object} - Informations sur les mentions trouvées
 */
export function logMentionsInfo(text, botId) {
  if (!text) return { count: 0, mentions: [] }

  const mentionsRegex = /<@(\d+)>/g
  const mentions = []
  let match

  while ((match = mentionsRegex.exec(text)) !== null) {
    // Ne pas inclure les mentions du bot lui-même
    if (match[1] !== botId) {
      mentions.push(match[0])
    }
  }

  console.log(`Mentions détectées (${mentions.length}): ${mentions.join(', ')}`)

  return {
    count: mentions.length,
    mentions: mentions
  }
}
