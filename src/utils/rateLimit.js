export class RateLimiter {
  constructor(options = {}) {
    this.options = {
      windowMs: options.windowMs || 30000,
      maxRequests: options.maxRequests || 10,
      message: options.message || "⚠️ Veuillez attendre avant d'envoyer une autre commande."
    };

    this.users = new Map();
  }

  /**
   * Vérifie si un utilisateur a dépassé sa limite
   * @param {string} userId - ID de l'utilisateur
   * @returns {boolean|string} - true si l'utilisateur peut continuer, sinon le message d'erreur
   */
  check(userId) {
    const now = Date.now();

    // Si l'utilisateur n'existe pas encore, l'initialiser
    if (!this.users.has(userId)) {
      this.users.set(userId, {
        requests: [now], // Première requête
        blocked: false,
        blockExpires: 0
      });
      return true; // Première requête, toujours autorisée
    }

    const userData = this.users.get(userId);

    // Si l'utilisateur est bloqué, vérifier si le blocage est terminé
    if (userData.blocked) {
      if (now >= userData.blockExpires) {
        // Le blocage est terminé, réinitialiser
        userData.blocked = false;
        userData.requests = [now]; // Nouvelle requête après déblocage
        return true;
      } else {
        // Encore bloqué
        const timeLeft = Math.ceil((userData.blockExpires - now) / 1000);
        return `⚠️ Vous utilisez les commandes trop rapidement. Veuillez attendre ${timeLeft} seconde(s).`;
      }
    }

    // Nettoyer les anciennes requêtes hors de la fenêtre de temps
    userData.requests = userData.requests.filter(
      timestamp => (now - timestamp) < this.options.windowMs
    );

    // Debug pour voir combien de requêtes sont comptées
    console.log(`Utilisateur ${userId}: ${userData.requests.length}/${this.options.maxRequests} requêtes dans les dernières ${this.options.windowMs/1000}s`);

    // Vérifier si l'utilisateur dépasse la limite
    if (userData.requests.length >= this.options.maxRequests) {
      // Bloquer l'utilisateur
      userData.blocked = true;
      userData.blockExpires = now + this.options.windowMs;
      const timeLeft = Math.ceil(this.options.windowMs / 1000);
      return `⚠️ Vous utilisez les commandes trop rapidement. Veuillez attendre ${timeLeft} seconde(s).`;
    }

    // Ajouter cette requête à l'historique
    userData.requests.push(now);
    return true;
  }

  reset(userId) {
    this.users.delete(userId);
  }

  resetAll() {
    this.users.clear();
  }
}

export const commandLimiter = new RateLimiter({
  windowMs: 10000,
  maxRequests: 3,
  message: "⚠️ Vous utilisez les commandes trop rapidement. Veuillez attendre quelques secondes."
});

export const aiLimiter = new RateLimiter({
  windowMs: 30000, // 30 secondes
  maxRequests: 10,
  message: "⚠️ Vous interagissez avec l'IA trop rapidement. Veuillez attendre quelques secondes."
});
