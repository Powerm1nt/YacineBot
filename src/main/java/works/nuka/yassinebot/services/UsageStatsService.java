package works.nuka.yassinebot.services;

import net.dv8tion.jda.api.events.message.MessageReceivedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.commands.Command;
import works.nuka.yassinebot.models.UsageStats;
import works.nuka.yassinebot.repositories.UsageStatsRepository;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

/**
 * Service pour gérer les statistiques d'utilisation du bot
 */
public class UsageStatsService {
    private static final Logger logger = LoggerFactory.getLogger(UsageStatsService.class);
    private final UsageStatsRepository repository;

    public UsageStatsService() {
        this.repository = new UsageStatsRepository();
    }

    /**
     * Enregistre l'utilisation d'une commande
     *
     * @param event L'événement de message
     * @param command La commande exécutée
     * @param args Les arguments de la commande
     */
    public void logCommand(MessageReceivedEvent event, Command command, String[] args) {
        try {
            UsageStats stats = new UsageStats(
                    event.getAuthor().getId(),
                    event.getChannel().getId(),
                    "COMMAND"
            );

            stats.setCommandName(command.getName());
            if (event.isFromGuild()) {
                stats.setGuildId(event.getGuild().getId());
            }

            if (args.length > 0) {
                // Limiter la longueur des arguments pour éviter de stocker trop de données
                String argsStr = String.join(" ", Arrays.copyOf(args, Math.min(args.length, 5)));
                if (argsStr.length() > 100) {
                    argsStr = argsStr.substring(0, 100) + "...";
                }
                stats.setArguments(argsStr);
            }

            repository.save(stats);
            logger.debug("Commande {} enregistrée pour l'utilisateur {}", command.getName(), event.getAuthor().getId());
        } catch (Exception e) {
            logger.error("Erreur lors de l'enregistrement des statistiques de commande", e);
        }
    }

    /**
     * Enregistre une erreur lors de l'exécution d'une commande
     *
     * @param event L'événement de message
     * @param commandName Le nom de la commande
     * @param error L'erreur survenue
     */
    public void logError(MessageReceivedEvent event, String commandName, Throwable error) {
        try {
            UsageStats stats = new UsageStats(
                    event.getAuthor().getId(),
                    event.getChannel().getId(),
                    "ERROR"
            );

            stats.setCommandName(commandName);
            stats.setSuccess(false);
            stats.setErrorMessage(error.getMessage());

            if (event.isFromGuild()) {
                stats.setGuildId(event.getGuild().getId());
            }

            repository.save(stats);
            logger.debug("Erreur pour la commande {} enregistrée pour l'utilisateur {}", 
                    commandName, event.getAuthor().getId());
        } catch (Exception e) {
            logger.error("Erreur lors de l'enregistrement de l'erreur", e);
        }
    }

    /**
     * Enregistre une action d'IA
     *
     * @param userId ID de l'utilisateur
     * @param channelId ID du canal
     * @param guildId ID du serveur (peut être null)
     */
    public void logAIInteraction(String userId, String channelId, String guildId) {
        try {
            UsageStats stats = new UsageStats(
                    userId,
                    channelId,
                    "AI_INTERACTION"
            );

            stats.setGuildId(guildId);
            repository.save(stats);
        } catch (Exception e) {
            logger.error("Erreur lors de l'enregistrement de l'interaction IA", e);
        }
    }

    /**
     * Obtient les statistiques d'utilisation pour un utilisateur
     *
     * @param userId ID de l'utilisateur
     * @return Liste des statistiques pour l'utilisateur
     */
    public List<UsageStats> getUserStats(String userId) {
        return repository.findByUserId(userId);
    }

    /**
     * Obtient les statistiques d'utilisation pour une commande
     *
     * @param commandName Nom de la commande
     * @return Liste des statistiques pour la commande
     */
    public List<UsageStats> getCommandStats(String commandName) {
        return repository.findByCommandName(commandName);
    }

    /**
     * Obtient les statistiques d'utilisation pour une période
     *
     * @param start Début de la période
     * @param end Fin de la période
     * @return Liste des statistiques pour la période
     */
    public List<UsageStats> getStatsByPeriod(LocalDateTime start, LocalDateTime end) {
        return repository.findByPeriod(start, end);
    }
}
