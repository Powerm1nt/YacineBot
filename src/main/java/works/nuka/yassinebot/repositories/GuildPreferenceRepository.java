package works.nuka.yassinebot.repositories;

import org.hibernate.Session;
import works.nuka.yassinebot.models.GuildPreference;

import jakarta.persistence.EntityManager;

import java.util.Optional;

/**
 * Repository pour accéder aux préférences des guildes dans la base de données
 */
public class GuildPreferenceRepository {

    private final EntityManager entityManager;

    public GuildPreferenceRepository(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    /**
     * Récupère les préférences d'une guilde par son ID
     * 
     * @param guildId L'ID de la guilde Discord
     * @return Un Optional contenant les préférences si elles existent
     */
    public Optional<GuildPreference> findByGuildId(String guildId) {
        try {
            Session session = entityManager.unwrap(Session.class);
            GuildPreference preference = session.get(GuildPreference.class, guildId);
            return Optional.ofNullable(preference);
        } catch (Exception e) {
            e.printStackTrace();
            return Optional.empty();
        }
    }

    /**
     * Sauvegarde ou met à jour les préférences d'une guilde
     * 
     * @param preference L'objet de préférences à sauvegarder
     * @return true si l'opération a réussi, false sinon
     */
    public boolean save(GuildPreference preference) {
        try {
            Session session = entityManager.unwrap(Session.class);
            session.beginTransaction();
            session.saveOrUpdate(preference);
            session.getTransaction().commit();
            return true;
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }

    /**
     * Met à jour un attribut spécifique d'une préférence de guilde
     * 
     * @param guildId L'ID de la guilde Discord
     * @param key Le nom de l'attribut à mettre à jour
     * @param value La nouvelle valeur
     * @return true si l'opération a réussi, false sinon
     */
    public boolean updatePreference(String guildId, String key, Object value) {
        try {
            Session session = entityManager.unwrap(Session.class);
            session.beginTransaction();

            // Trouver ou créer la préférence de guilde
            GuildPreference preference = session.get(GuildPreference.class, guildId);
            if (preference == null) {
                preference = new GuildPreference(guildId);
            }

            // Appliquer la mise à jour en fonction de la clé
            switch (key) {
                case "prefix":
                    preference.setPrefix((String) value);
                    break;
                case "autoMessagesEnabled":
                    preference.setAutoMessagesEnabled((Boolean) value);
                    break;
                case "aiEnabled":
                    preference.setAiEnabled((Boolean) value);
                    break;
                case "modLogChannelId":
                    preference.setModLogChannelId((String) value);
                    break;
                case "welcomeChannelId":
                    preference.setWelcomeChannelId((String) value);
                    break;
                case "welcomeMessage":
                    preference.setWelcomeMessage((String) value);
                    break;
                default:
                    // Clé non reconnue
                    return false;
            }

            session.saveOrUpdate(preference);
            session.getTransaction().commit();
            return true;
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }

    /**
     * Supprime les préférences d'une guilde
     * 
     * @param guildId L'ID de la guilde Discord
     * @return true si l'opération a réussi, false sinon
     */
    public boolean delete(String guildId) {
        try {
            Session session = entityManager.unwrap(Session.class);
            session.beginTransaction();

            GuildPreference preference = session.get(GuildPreference.class, guildId);
            if (preference != null) {
                session.delete(preference);
            }

            session.getTransaction().commit();
            return true;
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }
}
