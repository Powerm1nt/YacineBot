package works.nuka.yassinebot.repositories;

import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import org.hibernate.Session;
import org.hibernate.Transaction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.models.Bio;

import java.util.List;

/**
 * Repository pour gérer les biographies des utilisateurs
 */
public class BioRepository {
    private static final Logger logger = LoggerFactory.getLogger(BioRepository.class);

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Trouve une bio par l'ID de l'utilisateur
     *
     * @param userId L'ID de l'utilisateur
     * @return La bio trouvée ou null si aucune n'existe
     */
    public Bio findByUserId(String userId) {
        try {
            Session session = entityManager.unwrap(Session.class);
            return session.createQuery("FROM Bio WHERE userId = :userId", Bio.class)
                    .setParameter("userId", userId)
                    .uniqueResult();
        } catch (NoResultException e) {
            return null;
        } catch (Exception e) {
            logger.error("Erreur lors de la recherche de bio par userId", e);
            return null;
        }
    }

    /**
     * Sauvegarde une bio
     *
     * @param bio La bio à sauvegarder
     * @return La bio sauvegardée
     */
    public Bio save(Bio bio) {
        Session session = entityManager.unwrap(Session.class);
        Transaction transaction = session.beginTransaction();
        try {
            session.saveOrUpdate(bio);
            transaction.commit();
            return bio;
        } catch (Exception e) {
            transaction.rollback();
            logger.error("Erreur lors de la sauvegarde de la bio", e);
            throw e;
        }
    }

    /**
     * Supprime une bio
     *
     * @param bio La bio à supprimer
     */
    public void delete(Bio bio) {
        Session session = entityManager.unwrap(Session.class);
        Transaction transaction = session.beginTransaction();
        try {
            session.delete(bio);
            transaction.commit();
        } catch (Exception e) {
            transaction.rollback();
            logger.error("Erreur lors de la suppression de la bio", e);
            throw e;
        }
    }

    /**
     * Trouve toutes les bios
     *
     * @return Liste de toutes les bios
     */
    public List<Bio> findAll() {
        try {
            Session session = entityManager.unwrap(Session.class);
            return session.createQuery("FROM Bio", Bio.class).list();
        } catch (Exception e) {
            logger.error("Erreur lors de la recherche de toutes les bios", e);
            return List.of();
        }
    }
}
