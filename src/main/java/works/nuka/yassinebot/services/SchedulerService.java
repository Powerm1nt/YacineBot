package works.nuka.yassinebot.services;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.models.Task;
import works.nuka.yassinebot.scheduler.SimpleJob;
import works.nuka.yassinebot.scheduler.SimpleScheduler;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.TimeUnit;

/**
 * Service pour planifier et gérer les tâches récurrentes
 */
public class SchedulerService {
    private static final Logger logger = LoggerFactory.getLogger(SchedulerService.class);
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

    private final SimpleScheduler scheduler;
    private final TaskService taskService;

    public SchedulerService(TaskService taskService) {
        this.scheduler = new SimpleScheduler();
        this.taskService = taskService;
        logger.info("SchedulerService initialisé");
    }

    /**
     * Démarre le planificateur et programme la vérification des tâches
     */
    public void start() {
        // Vérifier les tâches toutes les minutes
        SimpleJob job = SimpleJob.builder()
                .name("task-checker")
                .interval(1, TimeUnit.MINUTES)
                .execute(this::checkTasks)
                .build();

        scheduler.schedule(job);
        logger.info("Planificateur démarré - vérification des tâches programmée toutes les minutes");
    }

    /**
     * Arrête le planificateur
     */
    public void stop() {
        scheduler.stop();
        logger.info("Planificateur arrêté");
    }

    /**
     * Vérifie les tâches à exécuter
     */
    private void checkTasks() {
        LocalDateTime now = LocalDateTime.now();
        logger.debug("Vérification des tâches à exécuter à {}", now.format(FORMATTER));

        try {
            var tasks = taskService.getTasksDueBefore(now);
            logger.debug("{} tâches à traiter", tasks.size());

            for (Task task : tasks) {
                processTask(task, now);
            }
        } catch (Exception e) {
            logger.error("Erreur lors de la vérification des tâches", e);
        }
    }

    /**
     * Traite une tâche dont l'heure d'exécution est arrivée
     *
     * @param task La tâche à traiter
     * @param now L'heure actuelle
     */
    private void processTask(Task task, LocalDateTime now) {
        try {
            // Envoyer la notification si ce n'est pas déjà fait
            if (!task.isNotificationSent()) {
                taskService.sendTaskNotification(task);
            }

            // Si la tâche est récurrente, créer la prochaine occurrence
            if (task.isRecurring() && task.getRecurrencePattern() != null) {
                scheduleNextRecurrence(task);
            }

            // Marquer la tâche comme complétée
            task.setCompleted(true);
            taskService.updateTask(task.getId(), null, null, null);
            logger.info("Tâche {} traitée avec succès", task.getId());
        } catch (Exception e) {
            logger.error("Erreur lors du traitement de la tâche {}", task.getId(), e);
        }
    }

    /**
     * Planifie la prochaine occurrence d'une tâche récurrente
     *
     * @param task La tâche récurrente
     */
    private void scheduleNextRecurrence(Task task) {
        LocalDateTime nextExecution = calculateNextExecution(task);
        if (nextExecution == null) {
            logger.warn("Impossible de calculer la prochaine exécution pour la tâche {}", task.getId());
            return;
        }

        logger.info("Planification de la prochaine occurrence de la tâche {} pour {}", 
                task.getId(), nextExecution.format(FORMATTER));

        // Créer une nouvelle tâche pour la prochaine occurrence
        taskService.createRecurringTask(
                task.getTitle(),
                task.getDescription(),
                nextExecution,
                task.getRecurrencePattern(),
                task.getCreatorId(),
                task.getGuildId(),
                task.getChannelId()
        );
    }

    /**
     * Calcule la prochaine date d'exécution d'une tâche récurrente
     *
     * @param task La tâche récurrente
     * @return La prochaine date d'exécution, ou null si le modèle est invalide
     */
    private LocalDateTime calculateNextExecution(Task task) {
        LocalDateTime lastExecution = task.getExecutionTime();
        String pattern = task.getRecurrencePattern().toLowerCase();

        return switch (pattern) {
            case "daily" -> lastExecution.plus(1, ChronoUnit.DAYS);
            case "weekly" -> lastExecution.plus(7, ChronoUnit.DAYS);
            case "monthly" -> lastExecution.plus(1, ChronoUnit.MONTHS);
            case "yearly", "annual" -> lastExecution.plus(1, ChronoUnit.YEARS);
            default -> {
                if (pattern.matches("\\d+[smhdw]")) {
                    char unit = pattern.charAt(pattern.length() - 1);
                    int amount = Integer.parseInt(pattern.substring(0, pattern.length() - 1));

                    yield switch (unit) {
                        case 's' -> lastExecution.plus(amount, ChronoUnit.SECONDS);
                        case 'm' -> lastExecution.plus(amount, ChronoUnit.MINUTES);
                        case 'h' -> lastExecution.plus(amount, ChronoUnit.HOURS);
                        case 'd' -> lastExecution.plus(amount, ChronoUnit.DAYS);
                        case 'w' -> lastExecution.plus(amount * 7, ChronoUnit.DAYS);
                        default -> null;
                    };
                }
                yield null;
            }
        };
    }
}
