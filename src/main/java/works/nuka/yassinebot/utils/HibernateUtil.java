package works.nuka.yassinebot.utils;

import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Utilitaire pour gérer la session Hibernate
 */
public class HibernateUtil {
    private static final Logger logger = LoggerFactory.getLogger(HibernateUtil.class);
    private static final SessionFactory sessionFactory = buildSessionFactory();

    private static SessionFactory buildSessionFactory() {
        try {
            // Créer la SessionFactory à partir de hibernate.cfg.xml
            return new Configuration().configure().buildSessionFactory();
        } catch (Throwable ex) {
            logger.error("Échec de création de la SessionFactory", ex);
            throw new ExceptionInInitializerError(ex);
        }
    }

    /**
     * Obtient la fabrique de session Hibernate
     * @return la fabrique de session
     */
    public static SessionFactory getSessionFactory() {
        return sessionFactory;
    }

    /**
     * Ferme la fabrique de session
     */
    public static void shutdown() {
        getSessionFactory().close();
    }
}
