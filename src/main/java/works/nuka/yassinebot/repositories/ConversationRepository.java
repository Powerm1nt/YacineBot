package works.nuka.yassinebot.repositories;

import org.hibernate.Session;
import org.hibernate.Transaction;
import org.hibernate.query.Query;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.models.Conversation;
import works.nuka.yassinebot.models.Message;
import works.nuka.yassinebot.utils.HibernateUtil;

import java.util.Optional;

/**
 * Repository pour les opérations sur les conversations
 */
public class ConversationRepository {
    private static final Logger logger = LoggerFactory.getLogger(ConversationRepository.class);

    /**
     * Récupère une conversation par son ID de canal et de guilde
     * @param channelId ID du canal
     * @param guildId ID de la guilde (peut être null)
     * @return Optional contenant la conversation si trouvée
     */
    public Optional<Conversation> findByChannelIdAndGuildId(String channelId, String guildId) {
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            String hql = "FROM Conversation c LEFT JOIN FETCH c.messages WHERE c.channelId = :channelId AND c.guildId = :guildId";
            Query<Conversation> query = session.createQuery(hql, Conversation.class);
            query.setParameter("channelId", channelId);
            query.setParameter("guildId", guildId == null ? "" : guildId);
            return query.uniqueResultOptional();
        } catch (Exception e) {
            logger.error("Erreur lors de la recherche de conversation", e);
            return Optional.empty();
        }
    }

    /**
     * Crée une nouvelle conversation
     * @param channelId ID du canal
     * @param guildId ID de la guilde (peut être null)
     * @return la conversation créée
     */
    public Conversation create(String channelId, String guildId) {
        Conversation conversation = new Conversation(channelId, guildId == null ? "" : guildId);

        Transaction transaction = null;
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            transaction = session.beginTransaction();
            session.persist(conversation);
            transaction.commit();
            return conversation;
        } catch (Exception e) {
            if (transaction != null) {
                transaction.rollback();
            }
            logger.error("Erreur lors de la création de conversation", e);
            throw e;
        }
    }

    /**
     * Met à jour une conversation
     * @param conversation la conversation à mettre à jour
     * @return la conversation mise à jour
     */
    public Conversation update(Conversation conversation) {
        Transaction transaction = null;
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            transaction = session.beginTransaction();
            session.merge(conversation);
            transaction.commit();
            return conversation;
        } catch (Exception e) {
            if (transaction != null) {
                transaction.rollback();
            }
            logger.error("Erreur lors de la mise à jour de conversation", e);
            throw e;
        }
    }

    /**
     * Ajoute un message à une conversation
     * @param conversationId ID de la conversation
     * @param message le message à ajouter
     * @return le message ajouté
     */
    public Message addMessage(Long conversationId, Message message) {
        Transaction transaction = null;
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            transaction = session.beginTransaction();

            Conversation conversation = session.get(Conversation.class, conversationId);
            if (conversation == null) {
                throw new IllegalArgumentException("Conversation non trouvée avec l'ID: " + conversationId);
            }

            message.setConversation(conversation);
            session.persist(message);
            transaction.commit();
            return message;
        } catch (Exception e) {
            if (transaction != null) {
                transaction.rollback();
            }
            logger.error("Erreur lors de l'ajout de message à la conversation", e);
            throw e;
        }
    }

    /**
     * Supprime une conversation et tous ses messages
     * @param channelId ID du canal
     * @param guildId ID de la guilde (peut être null)
     * @return true si supprimé avec succès
     */
    public boolean delete(String channelId, String guildId) {
        Transaction transaction = null;
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            transaction = session.beginTransaction();

            String hql = "DELETE FROM Conversation WHERE channelId = :channelId AND guildId = :guildId";
            Query<?> query = session.createQuery(hql);
            query.setParameter("channelId", channelId);
            query.setParameter("guildId", guildId == null ? "" : guildId);
            int result = query.executeUpdate();
package works.nuka.yassinebot.repositories;

import org.hibernate.Session;
import org.hibernate.Transaction;
import org.hibernate.query.Query;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.models.Conversation;
import works.nuka.yassinebot.utils.HibernateUtil;

import java.util.List;
import java.util.Optional;

/**
 * Repository pour gérer les conversations dans la base de données
 */
public class ConversationRepository {
    private static final Logger logger = LoggerFactory.getLogger(ConversationRepository.class);

    /**
     * Trouve une conversation par son ID
     *
     * @param id ID de la conversation
     * @return Conversation optionnelle
     */
    public Optional<Conversation> findById(Long id) {
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            Conversation conversation = session.get(Conversation.class, id);
            return Optional.ofNullable(conversation);
        } catch (Exception e) {
            logger.error("Erreur lors de la recherche de la conversation avec l'ID {}", id, e);
            return Optional.empty();
        }
    }

    /**
     * Trouve une conversation par canal et serveur
     *
     * @param channelId ID du canal
     * @param guildId ID du serveur (peut être null pour les DMs)
     * @return Conversation optionnelle
     */
    public Optional<Conversation> findByChannelAndGuild(String channelId, String guildId) {
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            String hql = "FROM Conversation c WHERE c.channelId = :channelId";
            if (guildId != null) {
                hql += " AND c.guildId = :guildId";
            } else {
                hql += " AND c.guildId IS NULL";
            }

            Query<Conversation> query = session.createQuery(hql, Conversation.class);
            query.setParameter("channelId", channelId);
            if (guildId != null) {
                query.setParameter("guildId", guildId);
            }

            return query.uniqueResultOptional();
        } catch (Exception e) {
            logger.error("Erreur lors de la recherche de la conversation pour le canal {} et le serveur {}", 
                    channelId, guildId, e);
            return Optional.empty();
        }
    }

    /**
     * Sauvegarde une conversation
     *
     * @param conversation Conversation à sauvegarder
     * @return Conversation sauvegardée avec ID mis à jour
     */
    public Conversation save(Conversation conversation) {
        Transaction transaction = null;
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            transaction = session.beginTransaction();
            session.persist(conversation);
            transaction.commit();
            return conversation;
        } catch (Exception e) {
            if (transaction != null) {
                transaction.rollback();
            }
            logger.error("Erreur lors de la sauvegarde de la conversation", e);
            throw new RuntimeException("Erreur lors de la sauvegarde de la conversation", e);
        }
    }

    /**
     * Met à jour une conversation existante
     *
     * @param conversation Conversation à mettre à jour
     * @return Conversation mise à jour
     */
    public Conversation update(Conversation conversation) {
        Transaction transaction = null;
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            transaction = session.beginTransaction();
            session.merge(conversation);
            transaction.commit();
            return conversation;
        } catch (Exception e) {
            if (transaction != null) {
                transaction.rollback();
            }
            logger.error("Erreur lors de la mise à jour de la conversation", e);
            throw new RuntimeException("Erreur lors de la mise à jour de la conversation", e);
        }
    }

    /**
     * Supprime une conversation
     *
     * @param conversation Conversation à supprimer
     */
    public void delete(Conversation conversation) {
        Transaction transaction = null;
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            transaction = session.beginTransaction();
            session.remove(conversation);
            transaction.commit();
        } catch (Exception e) {
            if (transaction != null) {
                transaction.rollback();
            }
            logger.error("Erreur lors de la suppression de la conversation", e);
            throw new RuntimeException("Erreur lors de la suppression de la conversation", e);
        }
    }

    /**
     * Trouve toutes les conversations
     *
     * @return Liste de toutes les conversations
     */
    public List<Conversation> findAll() {
        try (Session session = HibernateUtil.getSessionFactory().openSession()) {
            return session.createQuery("FROM Conversation", Conversation.class).list();
        } catch (Exception e) {
            logger.error("Erreur lors de la récupération de toutes les conversations", e);
            throw new RuntimeException("Erreur lors de la récupération de toutes les conversations", e);
        }
    }
}
            transaction.commit();
            return result > 0;
        } catch (Exception e) {
            if (transaction != null) {
                transaction.rollback();
            }
            logger.error("Erreur lors de la suppression de conversation", e);
            throw e;
        }
    }
}
