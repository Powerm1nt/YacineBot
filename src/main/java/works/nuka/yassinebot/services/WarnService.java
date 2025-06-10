package works.nuka.yassinebot.services;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Service pour gérer les avertissements des utilisateurs
 */
public class WarnService {
    private static final Logger logger = LoggerFactory.getLogger(WarnService.class);
    private static final String WARNINGS_FILE = "data/warnings.json";
    private static final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
    private static final Map<String, Map<String, List<Warning>>> warnings = new HashMap<>();

    /**
     * Représente un avertissement utilisateur
     * @param moderatorId ID du modérateur qui a donné l'avertissement
     * @param reason raison de l'avertissement
     * @param timestamp date et heure de l'avertissement
     */
    public record Warning(String moderatorId, String reason, LocalDateTime timestamp) {}

    /**
     * Constructeur qui initialise le service et charge les avertissements
     */
    public WarnService() {
        ensureDirectoryExists();
        loadWarnings();
    }

    /**
     * S'assure que le répertoire de données existe
     */
    private void ensureDirectoryExists() {
        Path dataDir = Paths.get("data");
        if (!Files.exists(dataDir)) {
            try {
                Files.createDirectories(dataDir);
                logger.info("Répertoire de données créé: {}", dataDir);
            } catch (IOException e) {
                logger.error("Impossible de créer le répertoire de données", e);
            }
        }
    }

    /**
     * Charge les avertissements depuis le fichier JSON
     */
    private void loadWarnings() {
        Path warningsPath = Paths.get(WARNINGS_FILE);
        if (!Files.exists(warningsPath)) {
            try {
                // Créer un fichier vide si inexistant
                objectMapper.writeValue(new File(WARNINGS_FILE), new HashMap<>());
                logger.info("Fichier d'avertissements créé: {}", WARNINGS_FILE);
            } catch (IOException e) {
                logger.error("Impossible de créer le fichier d'avertissements", e);
            }
            return;
        }

        try {
            TypeReference<HashMap<String, HashMap<String, List<Map<String, Object>>>>> typeRef = 
                    new TypeReference<>() {};

            Map<String, HashMap<String, List<Map<String, Object>>>> rawData = 
                    objectMapper.readValue(new File(WARNINGS_FILE), typeRef);

            // Convertir les données brutes en objets Warning
            rawData.forEach((guildId, guildWarnings) -> {
                warnings.put(guildId, new HashMap<>());
                guildWarnings.forEach((userId, userWarnings) -> {
                    List<Warning> userWarningsList = new ArrayList<>();
                    for (Map<String, Object> warning : userWarnings) {
                        String moderatorId = (String) warning.get("moderatorId");
                        String reason = (String) warning.get("reason");
                        long timestamp = ((Number) warning.get("timestamp")).longValue();
                        LocalDateTime dateTime = LocalDateTime.ofEpochSecond(timestamp / 1000, 0, java.time.ZoneOffset.UTC);
                        userWarningsList.add(new Warning(moderatorId, reason, dateTime));
                    }
                    warnings.get(guildId).put(userId, userWarningsList);
                });
            });

            logger.info("Avertissements chargés avec succès");
        } catch (IOException e) {
            logger.error("Erreur lors du chargement des avertissements", e);
        }
    }

    /**
     * Sauvegarde les avertissements dans le fichier JSON
     */
    private void saveWarnings() {
        try {
            objectMapper.writeValue(new File(WARNINGS_FILE), warnings);
            logger.debug("Avertissements sauvegardés avec succès");
        } catch (IOException e) {
            logger.error("Erreur lors de la sauvegarde des avertissements", e);
        }
    }

    /**
     * Ajoute un avertissement à un utilisateur
     * @param guildId ID du serveur
     * @param userId ID de l'utilisateur
     * @param moderatorId ID du modérateur
     * @param reason raison de l'avertissement
     * @return nombre total d'avertissements pour l'utilisateur
     */
    public int addWarning(String guildId, String userId, String moderatorId, String reason) {
        warnings.computeIfAbsent(guildId, k -> new HashMap<>());
        warnings.get(guildId).computeIfAbsent(userId, k -> new ArrayList<>());

        Warning warning = new Warning(moderatorId, reason, LocalDateTime.now());
        warnings.get(guildId).get(userId).add(warning);
        saveWarnings();

        return warnings.get(guildId).get(userId).size();
    }

    /**
     * Récupère les avertissements d'un utilisateur
     * @param guildId ID du serveur
     * @param userId ID de l'utilisateur
     * @return liste des avertissements
     */
    public List<Warning> getUserWarnings(String guildId, String userId) {
        if (!warnings.containsKey(guildId) || !warnings.get(guildId).containsKey(userId)) {
            return new ArrayList<>();
        }
        return new ArrayList<>(warnings.get(guildId).get(userId));
    }

    /**
     * Récupère tous les avertissements d'un serveur
     * @param guildId ID du serveur
     * @return map des avertissements par utilisateur
     */
    public Map<String, List<Warning>> getGuildWarnings(String guildId) {
        return warnings.getOrDefault(guildId, new HashMap<>());
    }

    /**
     * Supprime un avertissement d'un utilisateur
     * @param guildId ID du serveur
     * @param userId ID de l'utilisateur
     * @param index index de l'avertissement à supprimer
     * @return true si supprimé avec succès
     */
    public boolean removeWarning(String guildId, String userId, int index) {
        if (!warnings.containsKey(guildId) || 
            !warnings.get(guildId).containsKey(userId) || 
            index < 0 || 
            index >= warnings.get(guildId).get(userId).size()) {
            return false;
        }

        warnings.get(guildId).get(userId).remove(index);
        saveWarnings();
        return true;
    }

    /**
     * Supprime tous les avertissements d'un utilisateur
     * @param guildId ID du serveur
     * @param userId ID de l'utilisateur
     * @return true si supprimé avec succès
     */
    public boolean clearUserWarnings(String guildId, String userId) {
        if (!warnings.containsKey(guildId) || !warnings.get(guildId).containsKey(userId)) {
            return false;
        }

        warnings.get(guildId).remove(userId);
        saveWarnings();
        return true;
    }
}
