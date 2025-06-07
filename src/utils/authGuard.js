const authorizedUsers = process.env.AUTHORIZED_USERS ? process.env.AUTHORIZED_USERS.split(',') : [];

/**
 * Vérifie si l'utilisateur est autorisé à utiliser les commandes restreintes
 * @param command - the command object
 * @param {string} userId - ID de l'utilisateur à vérifier
 * @returns {boolean} - true si l'utilisateur est autorisé, false sinon
 */
export function isAuthorized(command, userId) {
  // Si la liste des utilisateurs autorisés est vide, aucun utilisateur n'est autorisé
  if (authorizedUsers.length === 0) {
    console.warn('Aucun utilisateur autorisé n\'est configuré dans AUTHORIZED_USERS');
    return false;
  }

  // Vérifier si la commande possède des métadonnées
  if (!command || !command.metadata) return true;

  // Vérifier si la commande est restreinte
  if (command.metadata.restricted) {
    console.log("Commande restreinte utilisée par:", userId);
    return authorizedUsers.includes(userId);
  }

  return true;
}
