/**
 * Utilitaire pour formater correctement les messages Discord et éviter les erreurs
 * RangeError [MESSAGE_CONTENT_TYPE]: Message content must be a non-empty string
 */

/**
 * Formate un message pour s'assurer qu'il est conforme aux exigences de discord.js
 * @param {string|object} message - Le message à formater
 * @returns {object} - L'objet message correctement formaté
 */
export function formatMessage(message) {
  // Si c'est déjà un objet, s'assurer qu'il a un contenu non vide
  if (typeof message === 'object') {
    // Si pas de contenu et pas d'embeds, ajouter un contenu par défaut
    if (!message.content && (!message.embeds || message.embeds.length === 0)) {
      return { ...message, content: 'Message' };
    }
    // Si contenu vide mais embeds présents, ajouter un contenu minimal
    if (message.content === '' && message.embeds && message.embeds.length > 0) {
      return { ...message, content: '.' };
    }
    return message;
  }

  // Si c'est une chaîne de caractères, la transformer en objet
  if (typeof message === 'string') {
    // Si la chaîne est vide, utiliser un contenu par défaut
    return { content: message || 'Message' };
  }

  // Cas par défaut pour éviter les erreurs
  return { content: 'Message' };
}
