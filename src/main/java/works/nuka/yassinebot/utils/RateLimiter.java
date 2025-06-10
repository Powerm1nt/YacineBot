package works.nuka.yassinebot.utils;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Utilitaire pour limiter le taux d'utilisation des commandes
 */
public class RateLimiter {
    private final Map<String, UserRateLimit> limits = new ConcurrentHashMap<>();
    private final int maxRequests; // Nombre maximum de requêtes
    private final long timeWindow; // Fenêtre de temps en millisecondes

    /**
     * Crée un nouveau limiteur de taux
     * @param maxRequests nombre maximum de requêtes
     * @param timeWindow fenêtre de temps en millisecondes
     */
    public RateLimiter(int maxRequests, long timeWindow) {
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindow;
    }

    /**
     * Vérifie si l'utilisateur peut effectuer une nouvelle requête
     * @param userId ID de l'utilisateur
     * @return true si l'utilisateur peut effectuer une requête, false sinon
     */
    public boolean check(String userId) {
        UserRateLimit userLimit = limits.computeIfAbsent(userId, id -> new UserRateLimit(maxRequests));
        return userLimit.tryAcquire();
    }
package works.nuka.yassinebot.utils;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Utilitaire pour limiter le taux d'utilisation des fonctionnalités du bot
 */
public class RateLimiter {
    private static final Logger logger = LoggerFactory.getLogger(RateLimiter.class);

    private final Map<String, UserLimit> userLimits = new ConcurrentHashMap<>();
    private final long windowMillis;
    private final int maxRequests;
    private final String name;

    /**
     * Crée un nouveau limiteur de taux
     *
     * @param windowSeconds Fenêtre de temps en secondes
     * @param maxRequests Nombre maximum de requêtes dans la fenêtre
     * @param name Nom du limiteur (pour le logging)
     */
    public RateLimiter(int windowSeconds, int maxRequests, String name) {
        this.windowMillis = windowSeconds * 1000L;
        this.maxRequests = maxRequests;
        this.name = name;
        logger.info("RateLimiter '{}' créé: {} requêtes par {} secondes", name, maxRequests, windowSeconds);
    }

    /**
     * Vérifie si l'utilisateur peut effectuer une nouvelle requête
     *
     * @param userId ID de l'utilisateur
     * @return true si la requête est autorisée, false sinon
     */
    public boolean check(String userId) {
        UserLimit userLimit = userLimits.computeIfAbsent(userId, id -> new UserLimit());
        return userLimit.check();
    }

    /**
     * Indique combien de temps l'utilisateur doit attendre avant de pouvoir faire une nouvelle requête
     *
     * @param userId ID de l'utilisateur
     * @return Temps d'attente en millisecondes, 0 si aucune attente n'est nécessaire
     */
    public long getWaitTime(String userId) {
        UserLimit userLimit = userLimits.get(userId);
        if (userLimit == null) {
            return 0;
        }
        return userLimit.getWaitTimeMillis();
    }

    /**
     * Réinitialise la limite pour un utilisateur
     *
     * @param userId ID de l'utilisateur
     */
    public void reset(String userId) {
        userLimits.remove(userId);
    }

    /**
     * Classe interne pour suivre les limites par utilisateur
     */
    private class UserLimit {
        private final long[] requestTimestamps;
        private int currentIndex = 0;
        private int count = 0;

        public UserLimit() {
            this.requestTimestamps = new long[maxRequests];
        }

        public synchronized boolean check() {
            long now = Instant.now().toEpochMilli();

            // Nettoyer les requêtes expirées
            while (count > 0 && now - requestTimestamps[oldestIndex()] > windowMillis) {
                requestTimestamps[oldestIndex()] = 0;
                count--;
                currentIndex = (currentIndex + 1) % maxRequests;
            }

            // Vérifier si l'utilisateur a atteint sa limite
            if (count >= maxRequests) {
                logger.debug("Rate limit atteint pour l'utilisateur dans '{}'", name);
                return false;
            }

            // Enregistrer la nouvelle requête
            int insertIndex = (currentIndex + count) % maxRequests;
            requestTimestamps[insertIndex] = now;
            count++;

            return true;
        }

        public synchronized long getWaitTimeMillis() {
            if (count < maxRequests) {
                return 0;
            }

            long now = Instant.now().toEpochMilli();
            long oldestTime = requestTimestamps[oldestIndex()];
            long waitTime = (oldestTime + windowMillis) - now;

            return Math.max(0, waitTime);
        }

        private int oldestIndex() {
            return currentIndex;
        }
    }
}
    /**
     * Représente les limites de taux pour un utilisateur
     */
    private class UserRateLimit {
        private final int maxRequests;
        private int requestCount;
        private long resetTime;

        /**
         * Crée une nouvelle limite de taux pour un utilisateur
         * @param maxRequests nombre maximum de requêtes
         */
        public UserRateLimit(int maxRequests) {
            this.maxRequests = maxRequests;
            this.requestCount = 0;
            this.resetTime = System.currentTimeMillis() + timeWindow;
        }

        /**
         * Tente d'acquérir une autorisation pour une nouvelle requête
         * @return true si l'autorisation est accordée, false sinon
         */
        public synchronized boolean tryAcquire() {
            long currentTime = System.currentTimeMillis();

            // Réinitialiser le compteur si la fenêtre de temps est passée
            if (currentTime >= resetTime) {
                requestCount = 0;
                resetTime = currentTime + timeWindow;
            }

            // Vérifier si la limite est atteinte
            if (requestCount >= maxRequests) {
                return false;
            }

            // Incrémenter le compteur et accorder l'autorisation
            requestCount++;
            return true;
        }
    }
}
