package works.nuka.yassinebot.services;

import org.hibernate.Session;
import org.hibernate.Transaction;
import org.hibernate.query.Query;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.models.Config;
import works.nuka.yassinebot.utils.HibernateUtil;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Service pour gérer la configuration du bot
 */
public class ConfigService {
    private static final Logger logger = LoggerFactory.getLogger(ConfigService.class);
    private static final String DEFAULT_PREFIX = "y!";

    /**
     * Récupère une valeur de configuration
     * 
     * @param guildId ID du serveur (peut être null pour une config globale)
     * @param key Clé de configuration
     * @return Valeur de la configuration ou null si non trouvée
     */
    public String getConfig(String guildId, String key) {
        String configKey = buildConfigKey(guildId, key);

        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            Config config = session.get(Config.class, configKey);
            return config != null ? config.getValue() : getDefaultValue(key);
        } catch (Exception e) {
            logger.error("Erreur lors de la récupération de la configuration {}", configKey, e);
            return getDefaultValue(key);
        }
    }

    /**
     * Définit une valeur de configuration
     * 
     * @param guildId ID du serveur (peut être null pour une config globale)
     * @param key Clé de configuration
     * @param value Valeur à définir
     */
    public void setConfig(String guildId, String key, String value) {
        String configKey = buildConfigKey(guildId, key);
        Transaction transaction = null;

        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            transaction = session.beginTransaction();

            Config config = session.get(Config.class, configKey);
            if (config == null) {
                config = new Config(configKey, value);
            } else {
                config.setValue(value);
            }

            session.persist(config);
            transaction.commit();

            logger.info("Configuration mise à jour: {} = {}", configKey, value);
        } catch (Exception e) {
            if (transaction != null) {
                transaction.rollback();
            }
            logger.error("Erreur lors de la mise à jour de la configuration {}", configKey, e);
            throw e;
        }
    }

    /**
     * Supprime une configuration
     * 
     * @param guildId ID du serveur (peut être null pour une config globale)
     * @param key Clé de configuration
     * @return true si supprimée, false sinon
     */
    public boolean removeConfig(String guildId, String key) {
        String configKey = buildConfigKey(guildId, key);
        Transaction transaction = null;

        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            transaction = session.beginTransaction();

            Config config = session.get(Config.class, configKey);
            if (config != null) {
                session.remove(config);
                transaction.commit();
                logger.info("Configuration supprimée: {}", configKey);
                return true;
            } else {
                transaction.rollback();
                return false;
            }
        } catch (Exception e) {
            if (transaction != null) {
                transaction.rollback();
            }
            logger.error("Erreur lors de la suppression de la configuration {}", configKey, e);
            throw e;
        }
    }

    /**
     * Récupère toutes les configurations pour un serveur
     * 
     * @param guildId ID du serveur (peut être null pour les configs globales)
     * @return Map des configurations (clé -> valeur)
     */
    public Map<String, String> getAllConfigs(String guildId) {
        Map<String, String> configs = new HashMap<>();
        String prefix = guildId != null ? guildId + ":" : "global:";

        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            String hql = "FROM Config c WHERE c.key LIKE :prefix";
            Query<Config> query = session.createQuery(hql, Config.class);
            query.setParameter("prefix", prefix + "%");

            List<Config> results = query.list();
            for (Config config : results) {
                // Extraire la clé sans le préfixe
                String key = config.getKey().substring(prefix.length());
                configs.put(key, config.getValue());
            }

            return configs;
        } catch (Exception e) {
            logger.error("Erreur lors de la récupération des configurations pour {}", guildId, e);
            return configs;
        }
    }

    /**
     * Construit la clé de configuration complète
     * 
     * @param guildId ID du serveur (peut être null)
     * @param key Clé de base
     * @return Clé complète
     */
    private String buildConfigKey(String guildId, String key) {
        if (guildId != null && !guildId.isEmpty()) {
            return guildId + ":" + key;
        } else {
            return "global:" + key;
        }
    }

    /**
     * Obtient la valeur par défaut pour une clé
     * 
     * @param key Clé de configuration
     * @return Valeur par défaut
     */
    private String getDefaultValue(String key) {
        return switch (key) {
            case "prefix" -> DEFAULT_PREFIX;
            case "language" -> "fr";
            case "responseType" -> "text";
            case "notifications" -> "true";
            default -> null;
        };
    }
}
