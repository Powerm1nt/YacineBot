export class RateLimiter {
  constructor(options = {}) {
    this.options = {
      windowMs: options.windowMs || 30000,
      maxRequests: options.maxRequests || 10,
      message: options.message || "⚠️ Veuillez attendre avant d'envoyer une autre commande."
    };

    this.users = new Map();
  }

  check(userId) {
    const now = Date.now();

    if (!this.users.has(userId)) {
      this.users.set(userId, {
        requests: [], 
        lastRequestTime: now,
        blocked: false,
        blockExpires: 0
      });
    }

    const userData = this.users.get(userId);

    if (userData.blocked) {
      if (now >= userData.blockExpires) {
        userData.blocked = false;
        userData.requests = [];
        userData.lastRequestTime = now;
      } else {
        const timeLeft = Math.ceil((userData.blockExpires - now) / 1000);
        return `⚠️ Vous utilisez les commandes trop rapidement. Veuillez attendre ${timeLeft} seconde(s).`;
      }
    }

    userData.lastRequestTime = now;

    if (userData.requests.length >= this.options.maxRequests) {
      userData.blocked = true;
      userData.blockExpires = now + this.options.windowMs;
      userData.requests = [];
      const timeLeft = Math.ceil(this.options.windowMs / 1000);
      return `⚠️ Limite atteinte ! Vous avez effectué ${this.options.maxRequests} requêtes. Veuillez attendre ${timeLeft} seconde(s).`;
    }

    userData.requests.push(now);
    return true;
  }
}

export const commandLimiter = new RateLimiter({
  windowMs: 10000,
  maxRequests: 10,
  message: "⚠️ Vous utilisez les commandes trop rapidement. Veuillez attendre quelques secondes."
});

export const aiLimiter = new RateLimiter({
  windowMs: 30000,
  maxRequests: 15,
  message: "⚠️ Vous interagissez avec l'IA trop rapidement. Veuillez attendre quelques secondes."
});
