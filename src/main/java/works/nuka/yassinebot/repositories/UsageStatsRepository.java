package works.nuka.yassinebot.repositories;

import org.hibernate.Session;
import org.hibernate.Transaction;
import org.hibernate.query.Query;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.models.UsageStats;
import works.nuka.yassinebot.utils.HibernateUtil;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository pour gérer les statistiques d'utilisation dans la base de données
 */
public class UsageStatsRepository {
    private static final Logger logger = LoggerFactory.getLogger(UsageStatsRepository.class);

    /**
     * Trouve des statistiques par leur ID
     *
     * @param id ID des statistiques
     * @return Statistiques optionnelles
     */
    public Optional<UsageStats> findById(Long id) {
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            UsageStats stats = session.get(UsageStats.class, id);
            return Optional.ofNullable(stats);
        } catch (Exception e) {
            logger.error("Erreur lors de la recherche des statistiques avec l'ID {}", id, e);
            return Optional.empty();
        }
    }

    /**
     * Sauvegarde des statistiques
     *
     * @param stats Statistiques à sauvegarder
     * @return Statistiques sauvegardées avec ID mis à jour
     */
    public UsageStats save(UsageStats stats) {
        Transaction transaction = null;
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            transaction = session.beginTransaction();
            session.persist(stats);
            transaction.commit();
            return stats;
        } catch (Exception e) {
            if (transaction != null) {
                transaction.rollback();
            }
            logger.error("Erreur lors de la sauvegarde des statistiques", e);
            throw new RuntimeException("Erreur lors de la sauvegarde des statistiques", e);
        }
    }

    /**
     * Met à jour des statistiques existantes
     *
     * @param stats Statistiques à mettre à jour
     * @return Statistiques mises à jour
     */
    public UsageStats update(UsageStats stats) {
        Transaction transaction = null;
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            transaction = session.beginTransaction();
            session.merge(stats);
            transaction.commit();
            return stats;
        } catch (Exception e) {
            if (transaction != null) {
                transaction.rollback();
            }
            logger.error("Erreur lors de la mise à jour des statistiques", e);
            throw new RuntimeException("Erreur lors de la mise à jour des statistiques", e);
        }
    }

    /**
     * Trouve des statistiques par utilisateur
     *
     * @param userId ID de l'utilisateur
     * @return Liste des statistiques pour l'utilisateur
     */
    public List<UsageStats> findByUserId(String userId) {
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            String hql = "FROM UsageStats s WHERE s.userId = :userId ORDER BY s.timestamp DESC";
            Query<UsageStats> query = session.createQuery(hql, UsageStats.class);
            query.setParameter("userId", userId);
            return query.list();
        } catch (Exception e) {
            logger.error("Erreur lors de la récupération des statistiques pour l'utilisateur {}", userId, e);
            throw new RuntimeException("Erreur lors de la récupération des statistiques par utilisateur", e);
        }
    }

    /**
     * Trouve des statistiques par commande
     *
     * @param commandName Nom de la commande
     * @return Liste des statistiques pour la commande
     */
    public List<UsageStats> findByCommandName(String commandName) {
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            String hql = "FROM UsageStats s WHERE s.commandName = :commandName ORDER BY s.timestamp DESC";
            Query<UsageStats> query = session.createQuery(hql, UsageStats.class);
            query.setParameter("commandName", commandName);
            return query.list();
        } catch (Exception e) {
            logger.error("Erreur lors de la récupération des statistiques pour la commande {}", commandName, e);
            throw new RuntimeException("Erreur lors de la récupération des statistiques par commande", e);
        }
    }

    /**
     * Trouve des statistiques par période
     *
     * @param start Début de la période
     * @param end Fin de la période
     * @return Liste des statistiques pour la période
     */
    public List<UsageStats> findByPeriod(LocalDateTime start, LocalDateTime end) {
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            String hql = "FROM UsageStats s WHERE s.timestamp BETWEEN :start AND :end ORDER BY s.timestamp";
            Query<UsageStats> query = session.createQuery(hql, UsageStats.class);
            query.setParameter("start", start);
            query.setParameter("end", end);
            return query.list();
        } catch (Exception e) {
            logger.error("Erreur lors de la récupération des statistiques pour la période {} à {}", start, end, e);
            throw new RuntimeException("Erreur lors de la récupération des statistiques par période", e);
        }
    }

    /**
     * Trouve des statistiques par serveur
     *
     * @param guildId ID du serveur
     * @return Liste des statistiques pour le serveur
     */
    public List<UsageStats> findByGuildId(String guildId) {
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            String hql = "FROM UsageStats s WHERE s.guildId = :guildId ORDER BY s.timestamp DESC";
            Query<UsageStats> query = session.createQuery(hql, UsageStats.class);
            query.setParameter("guildId", guildId);
            return query.list();
        } catch (Exception e) {
            logger.error("Erreur lors de la récupération des statistiques pour le serveur {}", guildId, e);
            throw new RuntimeException("Erreur lors de la récupération des statistiques par serveur", e);
        }
    }
}
