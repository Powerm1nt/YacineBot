package works.nuka.yassinebot.utils;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Utilitaire pour la journalisation des événements
 */
public class LogUtils {

    private static final Logger logger = LoggerFactory.getLogger(LogUtils.class);
    private static final DateTimeFormatter dateFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /**
     * Enregistre un message d'information
     * 
     * @param tag Étiquette identifiant la source du message
     * @param message Message à journaliser
     */
    public static void info(String tag, String message) {
        String formattedMessage = formatLogMessage(tag, message);
        logger.info(formattedMessage);
        System.out.println("[INFO] " + formattedMessage);
    }

    /**
     * Enregistre un message d'avertissement
     * 
     * @param tag Étiquette identifiant la source du message
     * @param message Message à journaliser
     */
    public static void warn(String tag, String message) {
        String formattedMessage = formatLogMessage(tag, message);
        logger.warn(formattedMessage);
        System.out.println("[WARN] " + formattedMessage);
    }

    /**
     * Enregistre un message d'erreur
     * 
     * @param tag Étiquette identifiant la source du message
     * @param message Message à journaliser
     */
    public static void error(String tag, String message) {
        String formattedMessage = formatLogMessage(tag, message);
        logger.error(formattedMessage);
        System.err.println("[ERROR] " + formattedMessage);
    }

    /**
     * Enregistre un message d'erreur avec une exception
     * 
     * @param tag Étiquette identifiant la source du message
     * @param message Message à journaliser
     * @param throwable Exception associée à l'erreur
     */
    public static void error(String tag, String message, Throwable throwable) {
        String formattedMessage = formatLogMessage(tag, message);
        logger.error(formattedMessage, throwable);
        System.err.println("[ERROR] " + formattedMessage);
        throwable.printStackTrace();
    }

    /**
     * Enregistre un message de débogage
     * 
     * @param tag Étiquette identifiant la source du message
     * @param message Message à journaliser
     */
    public static void debug(String tag, String message) {
        String formattedMessage = formatLogMessage(tag, message);
        logger.debug(formattedMessage);

        // En développement, afficher les messages de débogage
        if (Boolean.parseBoolean(System.getenv("DEBUG_MODE"))) {
            System.out.println("[DEBUG] " + formattedMessage);
        }
    }

    /**
     * Formate un message de journal avec date et étiquette
     * 
     * @param tag Étiquette identifiant la source du message
     * @param message Message à formater
     * @return Message formaté
     */
    private static String formatLogMessage(String tag, String message) {
        LocalDateTime now = LocalDateTime.now();
        return String.format("[%s] [%s] %s", dateFormatter.format(now), tag, message);
    }

    /**
     * Enregistre les détails d'une commande exécutée
     * 
     * @param commandName Nom de la commande
     * @param userId ID de l'utilisateur
     * @param guildId ID de la guilde (ou null si DM)
     * @param args Arguments de la commande
     */
    public static void logCommand(String commandName, String userId, String guildId, String[] args) {
        String argsStr = args.length > 0 ? String.join(" ", args) : "";
        String location = guildId != null ? "Serveur: " + guildId : "Messages privés";
        info("Command", String.format("%s par %s dans %s [args: %s]", 
                commandName, userId, location, argsStr));
    }

    /**
     * Enregistre un événement du bot
     * 
     * @param eventType Type d'événement
     * @param details Détails de l'événement
     */
    public static void logEvent(String eventType, String details) {
        info("Event", String.format("%s - %s", eventType, details));
    }
}
