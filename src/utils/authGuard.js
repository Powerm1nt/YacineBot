import dotenv from 'dotenv';
dotenv.config();

// Liste des IDs d'utilisateurs autorisés
const authorizedUsers = process.env.AUTHORIZED_USERS ? process.env.AUTHORIZED_USERS.split(',') : [];

/**
 * Vérifie si l'utilisateur est autorisé à utiliser les commandes restreintes
 * @param {string} userId - ID de l'utilisateur à vérifier
 * @returns {boolean} - true si l'utilisateur est autorisé, false sinon
 */
export function isAuthorized(userId) {
  // Si la liste des utilisateurs autorisés est vide, aucun utilisateur n'est autorisé
  if (authorizedUsers.length === 0) {
    console.warn('Aucun utilisateur autorisé n\'est configuré dans AUTHORIZED_USERS');
    return false;
  }

  return authorizedUsers.includes(userId);
}

/**
 * Vérifie si l'utilisateur est autorisé et envoie un message d'erreur si ce n'est pas le cas
 * @param {Object} message - Message Discord
 * @returns {boolean} - true si l'utilisateur est autorisé, false sinon
 */
export function checkPermission(message) {
  if (!isAuthorized(message.author.id)) {
    message.reply('❌ Désolé, vous n\'êtes pas autorisé à utiliser cette commande.');
    return false;
  }
  return true;
}
