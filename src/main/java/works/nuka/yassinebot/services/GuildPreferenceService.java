package works.nuka.yassinebot.services;

import works.nuka.yassinebot.models.GuildPreference;
import works.nuka.yassinebot.repositories.GuildPreferenceRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.Persistence;

/**
 * Service pour gérer les préférences des guildes Discord
 */
public class GuildPreferenceService {

    private final GuildPreferenceRepository repository;
    private final EntityManagerFactory entityManagerFactory;

    /**
     * Constructeur du service de préférences de guilde
     */
    public GuildPreferenceService() {
        this.entityManagerFactory = Persistence.createEntityManagerFactory("yassinebot");
        EntityManager entityManager = entityManagerFactory.createEntityManager();
        this.repository = createRepository();
    }

    /**
     * Crée le repository - méthode extraite pour faciliter les tests
     * 
     * @return Une instance du repository
     */
    protected GuildPreferenceRepository createRepository() {
        EntityManager entityManager = entityManagerFactory.createEntityManager();
        return new GuildPreferenceRepository(entityManager);
    }

    /**
     * Récupère les préférences d'une guilde
     * 
     * @param guildId L'ID de la guilde Discord
     * @return Un objet GuildPreference ou null si non trouvé
     */
    public GuildPreference getGuildPreferences(String guildId) {
        return repository.findByGuildId(guildId).orElse(new GuildPreference(guildId));
    }

    /**
     * Sauvegarde les préférences d'une guilde
     * 
     * @param guildId L'ID de la guilde Discord
     * @param preferences L'objet de préférences à sauvegarder
     * @return true si l'opération a réussi, false sinon
     */
    public boolean saveGuildPreferences(String guildId, GuildPreference preferences) {
        preferences.setGuildId(guildId); // S'assurer que l'ID est correct
        return repository.save(preferences);
    }

    /**
     * Met à jour une préférence spécifique pour une guilde
     * 
     * @param guildId L'ID de la guilde Discord
     * @param key Le nom de la préférence à mettre à jour
     * @param value La nouvelle valeur
     * @return true si l'opération a réussi, false sinon
     */
    public boolean updateGuildPreference(String guildId, String key, Object value) {
        return repository.updatePreference(guildId, key, value);
    }

    /**
     * Vérifie si l'IA est activée pour une guilde
     * 
     * @param guildId L'ID de la guilde Discord
     * @return true si l'IA est activée, false sinon
     */
    public boolean isAiEnabled(String guildId) {
        GuildPreference pref = getGuildPreferences(guildId);
        return pref.getAiEnabled() == null || pref.getAiEnabled(); // Par défaut activé
    }

    /**
     * Vérifie si les messages automatiques sont activés pour une guilde
     * 
     * @param guildId L'ID de la guilde Discord
     * @return true si les messages automatiques sont activés, false sinon
     */
    public boolean areAutoMessagesEnabled(String guildId) {
        GuildPreference pref = getGuildPreferences(guildId);
        return pref.getAutoMessagesEnabled() != null && pref.getAutoMessagesEnabled();
    }

    /**
     * Ferme les ressources du service
     */
    public void close() {
        if (entityManagerFactory != null && entityManagerFactory.isOpen()) {
            entityManagerFactory.close();
        }
    }
}
