package works.nuka.yassinebot.repositories;

import org.hibernate.Session;
import org.hibernate.Transaction;
import org.hibernate.query.Query;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.models.Message;
import works.nuka.yassinebot.utils.HibernateUtil;

import java.util.List;
import java.util.Optional;

/**
 * Repository pour gérer les messages dans la base de données
 */
public class MessageRepository {
    private static final Logger logger = LoggerFactory.getLogger(MessageRepository.class);

    /**
     * Trouve un message par son ID
     *
     * @param id ID du message
     * @return Message optionnel
     */
    public Optional<Message> findById(Long id) {
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            Message message = session.get(Message.class, id);
            return Optional.ofNullable(message);
        } catch (Exception e) {
            logger.error("Erreur lors de la recherche du message avec l'ID {}", id, e);
            return Optional.empty();
        }
    }

    /**
     * Sauvegarde un message
     *
     * @param message Message à sauvegarder
     * @return Message sauvegardé avec ID mis à jour
     */
    public Message save(Message message) {
        Transaction transaction = null;
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            transaction = session.beginTransaction();
            session.persist(message);
            transaction.commit();
            return message;
        } catch (Exception e) {
            if (transaction != null) {
                transaction.rollback();
            }
            logger.error("Erreur lors de la sauvegarde du message", e);
            throw new RuntimeException("Erreur lors de la sauvegarde du message", e);
        }
    }

    /**
     * Met à jour un message existant
     *
     * @param message Message à mettre à jour
     * @return Message mis à jour
     */
    public Message update(Message message) {
        Transaction transaction = null;
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            transaction = session.beginTransaction();
            session.merge(message);
            transaction.commit();
            return message;
        } catch (Exception e) {
            if (transaction != null) {
                transaction.rollback();
            }
            logger.error("Erreur lors de la mise à jour du message", e);
            throw new RuntimeException("Erreur lors de la mise à jour du message", e);
        }
    }

    /**
     * Supprime un message
     *
     * @param message Message à supprimer
     */
    public void delete(Message message) {
        Transaction transaction = null;
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            transaction = session.beginTransaction();
            session.remove(message);
            transaction.commit();
        } catch (Exception e) {
            if (transaction != null) {
                transaction.rollback();
            }
            logger.error("Erreur lors de la suppression du message", e);
            throw new RuntimeException("Erreur lors de la suppression du message", e);
        }
    }

    /**
     * Trouve tous les messages pour une conversation donnée
     *
     * @param conversationId ID de la conversation
     * @return Liste des messages de la conversation
     */
    public List<Message> findByConversationId(Long conversationId) {
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            String hql = "FROM Message m WHERE m.conversation.id = :conversationId ORDER BY m.createdAt";
            Query<Message> query = session.createQuery(hql, Message.class);
            query.setParameter("conversationId", conversationId);
            return query.list();
        } catch (Exception e) {
            logger.error("Erreur lors de la récupération des messages pour la conversation {}", conversationId, e);
            throw new RuntimeException("Erreur lors de la récupération des messages pour la conversation", e);
        }
    }

    /**
     * Trouve les N derniers messages d'une conversation
     *
     * @param conversationId ID de la conversation
     * @param limit Nombre maximum de messages à récupérer
     * @return Liste des derniers messages
     */
    public List<Message> findLastMessagesByConversationId(Long conversationId, int limit) {
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            String hql = "FROM Message m WHERE m.conversation.id = :conversationId ORDER BY m.createdAt DESC";
            Query<Message> query = session.createQuery(hql, Message.class);
            query.setParameter("conversationId", conversationId);
            query.setMaxResults(limit);
            return query.list();
        } catch (Exception e) {
            logger.error("Erreur lors de la récupération des derniers messages pour la conversation {}", conversationId, e);
            throw new RuntimeException("Erreur lors de la récupération des derniers messages", e);
        }
    }
}
