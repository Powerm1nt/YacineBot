package works.nuka.yassinebot.services;

import net.dv8tion.jda.api.JDA;
import net.dv8tion.jda.api.entities.Guild;
import net.dv8tion.jda.api.entities.channel.concrete.TextChannel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.models.Task;
import works.nuka.yassinebot.repositories.TaskRepository;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

/**
 * Service pour gérer les tâches planifiées
 */
public class TaskService {
    private static final Logger logger = LoggerFactory.getLogger(TaskService.class);
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final TaskRepository repository;
    private final JDA jda;

    public TaskService(JDA jda) {
        this.repository = new TaskRepository();
        this.jda = jda;
        logger.info("TaskService initialisé");
    }

    /**
     * Crée une nouvelle tâche
     *
     * @param title Titre de la tâche
     * @param description Description de la tâche
     * @param executionTime Date/heure d'exécution
     * @param creatorId ID du créateur
     * @param guildId ID du serveur (peut être null)
     * @param channelId ID du canal (peut être null)
     * @return La tâche créée
     */
    public Task createTask(String title, String description, LocalDateTime executionTime, 
                           String creatorId, String guildId, String channelId) {
        Task task = new Task(title, executionTime, creatorId);
        task.setDescription(description);
        task.setGuildId(guildId);
        task.setChannelId(channelId);

        repository.save(task);
        logger.info("Tâche créée: {}, exécution prévue le {}", title, executionTime.format(DATE_TIME_FORMATTER));
        return task;
    }

    /**
     * Crée une tâche récurrente
     *
     * @param title Titre de la tâche
     * @param description Description de la tâche
     * @param executionTime Date/heure de première exécution
     * @param recurrencePattern Modèle de récurrence (daily, weekly, monthly)
     * @param creatorId ID du créateur
     * @param guildId ID du serveur (peut être null)
     * @param channelId ID du canal (peut être null)
     * @return La tâche créée
     */
    public Task createRecurringTask(String title, String description, LocalDateTime executionTime, 
                                  String recurrencePattern, String creatorId, String guildId, String channelId) {
        Task task = new Task(title, executionTime, creatorId);
        task.setDescription(description);
        task.setGuildId(guildId);
        task.setChannelId(channelId);
        task.setRecurring(true);
        task.setRecurrencePattern(recurrencePattern);

        repository.save(task);
        logger.info("Tâche récurrente créée: {}, première exécution le {}, récurrence: {}", 
                title, executionTime.format(DATE_TIME_FORMATTER), recurrencePattern);
        return task;
    }

    /**
     * Met à jour une tâche existante
     *
     * @param taskId ID de la tâche
     * @param title Nouveau titre (null pour ne pas changer)
     * @param description Nouvelle description (null pour ne pas changer)
     * @param executionTime Nouvelle date/heure (null pour ne pas changer)
     * @return La tâche mise à jour, ou empty si non trouvée
     */
    public Optional<Task> updateTask(Long taskId, String title, String description, LocalDateTime executionTime) {
        Optional<Task> taskOpt = repository.findById(taskId);
        if (taskOpt.isEmpty()) {
            return Optional.empty();
        }

        Task task = taskOpt.get();
        if (title != null) {
            task.setTitle(title);
        }
        if (description != null) {
            task.setDescription(description);
        }
        if (executionTime != null) {
            task.setExecutionTime(executionTime);
        }

        repository.update(task);
        logger.info("Tâche mise à jour: {}", taskId);
        return Optional.of(task);
    }

    /**
     * Marque une tâche comme complétée
     *
     * @param taskId ID de la tâche
     * @return true si la tâche a été complétée, false si non trouvée
     */
    public boolean completeTask(Long taskId) {
        Optional<Task> taskOpt = repository.findById(taskId);
        if (taskOpt.isEmpty()) {
            return false;
        }

        Task task = taskOpt.get();
        task.setCompleted(true);
        repository.update(task);
        logger.info("Tâche marquée comme complétée: {}", taskId);
        return true;
    }

    /**
     * Supprime une tâche
     *
     * @param taskId ID de la tâche
     * @return true si la tâche a été supprimée, false si non trouvée
     */
    public boolean deleteTask(Long taskId) {
        Optional<Task> taskOpt = repository.findById(taskId);
        if (taskOpt.isEmpty()) {
            return false;
        }

        repository.delete(taskOpt.get());
        logger.info("Tâche supprimée: {}", taskId);
        return true;
    }

    /**
     * Récupère une tâche par son ID
     *
     * @param taskId ID de la tâche
     * @return La tâche, ou empty si non trouvée
     */
    public Optional<Task> getTaskById(Long taskId) {
        return repository.findById(taskId);
    }

    /**
     * Récupère toutes les tâches pour un serveur
     *
     * @param guildId ID du serveur
     * @return Liste des tâches pour ce serveur
     */
    public List<Task> getTasksByGuild(String guildId) {
        return repository.findByGuildId(guildId);
    }

    /**
     * Récupère toutes les tâches créées par un utilisateur
     *
     * @param creatorId ID de l'utilisateur
     * @return Liste des tâches créées par cet utilisateur
     */
    public List<Task> getTasksByCreator(String creatorId) {
        return repository.findByCreatorId(creatorId);
    }

    /**
     * Récupère toutes les tâches à exécuter avant un moment donné
     *
     * @param before Date/heure limite
     * @return Liste des tâches à exécuter
     */
    public List<Task> getTasksDueBefore(LocalDateTime before) {
        return repository.findTasksDueBefore(before);
    }

    /**
     * Envoie une notification pour une tâche
     *
     * @param task La tâche pour laquelle envoyer une notification
     * @return true si la notification a été envoyée, false sinon
     */
    public boolean sendTaskNotification(Task task) {
        if (task.getChannelId() == null) {
            logger.warn("Impossible d'envoyer une notification pour la tâche {}: aucun canal spécifié", task.getId());
            return false;
        }

        try {
            if (task.getGuildId() != null) {
                // Notification sur un serveur
                Guild guild = jda.getGuildById(task.getGuildId());
                if (guild == null) {
                    logger.warn("Serveur {} non trouvé pour la notification de tâche {}", task.getGuildId(), task.getId());
                    return false;
                }

                TextChannel channel = guild.getTextChannelById(task.getChannelId());
                if (channel == null) {
                    logger.warn("Canal {} non trouvé pour la notification de tâche {}", task.getChannelId(), task.getId());
                    return false;
                }

                String message = buildTaskNotificationMessage(task);
                channel.sendMessage(message).queue(
                    success -> {
                        task.setNotificationSent(true);
                        repository.update(task);
                        logger.info("Notification envoyée pour la tâche {}", task.getId());
                    },
                    error -> logger.error("Erreur lors de l'envoi de la notification pour la tâche {}", task.getId(), error)
                );

                return true;
            } else {
                // Notification en message privé
                jda.retrieveUserById(task.getCreatorId())
                    .flatMap(user -> user.openPrivateChannel())
                    .flatMap(channel -> {
                        String message = buildTaskNotificationMessage(task);
                        return channel.sendMessage(message);
                    })
                    .queue(
                        success -> {
                            task.setNotificationSent(true);
                            repository.update(task);
                            logger.info("Notification privée envoyée pour la tâche {}", task.getId());
                        },
                        error -> logger.error("Erreur lors de l'envoi de la notification privée pour la tâche {}", task.getId(), error)
                    );

                return true;
            }
        } catch (Exception e) {
            logger.error("Erreur lors de l'envoi de la notification pour la tâche {}", task.getId(), e);
            return false;
        }
    }

    /**
     * Construit le message de notification pour une tâche
     *
     * @param task La tâche
     * @return Le message formaté
     */
    private String buildTaskNotificationMessage(Task task) {
        StringBuilder message = new StringBuilder();
        message.append(":alarm_clock: **Rappel de tâche**\n\n");
        message.append(":pushpin: **").append(task.getTitle()).append("**\n");

        if (task.getDescription() != null && !task.getDescription().isEmpty()) {
            message.append(":notepad_spiral: ").append(task.getDescription()).append("\n");
        }

        message.append(":calendar: Date: ").append(task.getExecutionTime().format(DATE_TIME_FORMATTER)).append("\n");

        if (task.isRecurring()) {
            message.append(":repeat: Tâche récurrente: ").append(formatRecurrencePattern(task.getRecurrencePattern())).append("\n");
        }

        message.append("\n<@").append(task.getCreatorId()).append(">");

        return message.toString();
    }

    /**
     * Formate le modèle de récurrence de manière lisible
     *
     * @param pattern Le modèle de récurrence
     * @return Description lisible du modèle
     */
    private String formatRecurrencePattern(String pattern) {
        if (pattern == null) {
            return "Inconnu";
        }

        return switch (pattern.toLowerCase()) {
            case "daily" -> "Tous les jours";
            case "weekly" -> "Toutes les semaines";
            case "monthly" -> "Tous les mois";
            default -> pattern;
        };
    }
}
