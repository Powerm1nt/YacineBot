package works.nuka.yassinebot.repositories;

import org.hibernate.Session;
import org.hibernate.Transaction;
import org.hibernate.query.Query;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.models.Task;
import works.nuka.yassinebot.utils.HibernateUtil;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository pour gérer les tâches planifiées dans la base de données
 */
public class TaskRepository {
    private static final Logger logger = LoggerFactory.getLogger(TaskRepository.class);

    /**
     * Trouve une tâche par son ID
     *
     * @param id ID de la tâche
     * @return Tâche optionnelle
     */
    public Optional<Task> findById(Long id) {
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            Task task = session.get(Task.class, id);
            return Optional.ofNullable(task);
        } catch (Exception e) {
            logger.error("Erreur lors de la recherche de la tâche avec l'ID {}", id, e);
            return Optional.empty();
        }
    }

    /**
     * Sauvegarde une tâche
     *
     * @param task Tâche à sauvegarder
     * @return Tâche sauvegardée avec ID mis à jour
     */
    public Task save(Task task) {
        Transaction transaction = null;
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            transaction = session.beginTransaction();
            session.persist(task);
            transaction.commit();
            return task;
        } catch (Exception e) {
            if (transaction != null) {
                transaction.rollback();
            }
            logger.error("Erreur lors de la sauvegarde de la tâche", e);
            throw new RuntimeException("Erreur lors de la sauvegarde de la tâche", e);
        }
    }

    /**
     * Met à jour une tâche existante
     *
     * @param task Tâche à mettre à jour
     * @return Tâche mise à jour
     */
    public Task update(Task task) {
        Transaction transaction = null;
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            transaction = session.beginTransaction();
            session.merge(task);
            transaction.commit();
            return task;
        } catch (Exception e) {
            if (transaction != null) {
                transaction.rollback();
            }
            logger.error("Erreur lors de la mise à jour de la tâche", e);
            throw new RuntimeException("Erreur lors de la mise à jour de la tâche", e);
        }
    }

    /**
     * Supprime une tâche
     *
     * @param task Tâche à supprimer
     */
    public void delete(Task task) {
        Transaction transaction = null;
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            transaction = session.beginTransaction();
            session.remove(task);
            transaction.commit();
        } catch (Exception e) {
            if (transaction != null) {
                transaction.rollback();
            }
            logger.error("Erreur lors de la suppression de la tâche", e);
            throw new RuntimeException("Erreur lors de la suppression de la tâche", e);
        }
    }

    /**
     * Trouve toutes les tâches
     *
     * @return Liste de toutes les tâches
     */
    public List<Task> findAll() {
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            return session.createQuery("FROM Task ORDER BY executionTime", Task.class).list();
        } catch (Exception e) {
            logger.error("Erreur lors de la récupération de toutes les tâches", e);
            throw new RuntimeException("Erreur lors de la récupération de toutes les tâches", e);
        }
    }

    /**
     * Trouve les tâches qui doivent être exécutées avant un moment donné
     *
     * @param before Date/heure avant laquelle les tâches doivent être exécutées
     * @return Liste des tâches à exécuter
     */
    public List<Task> findTasksDueBefore(LocalDateTime before) {
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            String hql = "FROM Task t WHERE t.executionTime <= :before AND t.completed = false ORDER BY t.executionTime";
            Query<Task> query = session.createQuery(hql, Task.class);
            query.setParameter("before", before);
            return query.list();
        } catch (Exception e) {
            logger.error("Erreur lors de la récupération des tâches dues avant {}", before, e);
            throw new RuntimeException("Erreur lors de la récupération des tâches dues", e);
        }
    }

    /**
     * Trouve les tâches par serveur
     *
     * @param guildId ID du serveur
     * @return Liste des tâches du serveur
     */
    public List<Task> findByGuildId(String guildId) {
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            String hql = "FROM Task t WHERE t.guildId = :guildId ORDER BY t.executionTime";
            Query<Task> query = session.createQuery(hql, Task.class);
            query.setParameter("guildId", guildId);
            return query.list();
        } catch (Exception e) {
            logger.error("Erreur lors de la récupération des tâches pour le serveur {}", guildId, e);
            throw new RuntimeException("Erreur lors de la récupération des tâches par serveur", e);
        }
    }

    /**
     * Trouve les tâches par créateur
     *
     * @param creatorId ID du créateur
     * @return Liste des tâches créées par l'utilisateur
     */
    public List<Task> findByCreatorId(String creatorId) {
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            String hql = "FROM Task t WHERE t.creatorId = :creatorId ORDER BY t.executionTime";
            Query<Task> query = session.createQuery(hql, Task.class);
            query.setParameter("creatorId", creatorId);
            return query.list();
        } catch (Exception e) {
            logger.error("Erreur lors de la récupération des tâches pour le créateur {}", creatorId, e);
            throw new RuntimeException("Erreur lors de la récupération des tâches par créateur", e);
        }
    }
}
