export class RateLimiter {
  constructor(options = {}) {
    this.options = {
      windowMs: options.windowMs || 30000,
      maxRequests: options.maxRequests || 5,
      message: options.message || ""
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

    if (!this.users.has(userId)) {
      this.users.set(userId, {
        requests: [],
        blocked: false,
        blockExpires: 0
      });
    }

    const userData = this.users.get(userId);

    if (userData.blocked) {
      if (now > userData.blockExpires) {
        userData.blocked = false;
        userData.requests = [];
      } else {
        return this.options.message;
      }
    }

    userData.requests = userData.requests.filter(
      timestamp => now - timestamp < this.options.windowMs
    );

    if (userData.requests.length >= this.options.maxRequests) {
      userData.blocked = true;
      userData.blockExpires = now + this.options.windowMs;
      return this.options.message;
    }

    userData.requests.push(now);
    return true;
  }

  /**
   * Réinitialise les données d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   */
  reset(userId) {
    this.users.delete(userId);
  }

  /**
   * Réinitialise les données de tous les utilisateurs
   */
  resetAll() {
    this.users.clear();
  }
}

export const commandLimiter = new RateLimiter({
  windowMs: 10000,
  maxRequests: 3,
  message: ""
});

export const aiLimiter = new RateLimiter({
  windowMs: 30000, // 30 secondes
  maxRequests: 5,
  message: ""
});
