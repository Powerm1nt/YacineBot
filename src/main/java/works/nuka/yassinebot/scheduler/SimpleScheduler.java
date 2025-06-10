package works.nuka.yassinebot.scheduler;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.concurrent.*;

/**
 * Un planificateur simple basé sur ScheduledExecutorService
 */
public class SimpleScheduler {
    private static final Logger logger = LoggerFactory.getLogger(SimpleScheduler.class);

    private final ScheduledExecutorService executor;
    private final Map<String, ScheduledFuture<?>> scheduledTasks;
    private final ExecutorService taskExecutor;
    private volatile boolean running;

    /**
     * Crée un nouveau planificateur avec un pool de threads par défaut
     */
    public SimpleScheduler() {
        this(Executors.newScheduledThreadPool(1), Executors.newCachedThreadPool());
    }

    /**
     * Crée un nouveau planificateur avec les executors spécifiés
     * 
     * @param scheduler L'executor pour la planification
     * @param taskExecutor L'executor pour l'exécution des tâches
     */
    public SimpleScheduler(ScheduledExecutorService scheduler, ExecutorService taskExecutor) {
        this.executor = scheduler;
        this.taskExecutor = taskExecutor;
        this.scheduledTasks = new ConcurrentHashMap<>();
        this.running = true;
    }

    /**
     * Planifie une tâche pour exécution répétée
     * 
     * @param job La tâche à planifier
     * @return true si la tâche a été planifiée avec succès
     */
    public boolean schedule(SimpleJob job) {
        if (!running) {
            logger.warn("Tentative de planification d'une tâche alors que le planificateur est arrêté: {}", job.getName());
            return false;
        }

        logger.info("Planification de la tâche {} avec intervalle {} ms", job.getName(), job.getIntervalMillis());

        // Supprime toute tâche existante avec le même nom
        if (scheduledTasks.containsKey(job.getName())) {
            cancel(job.getName());
        }

        ScheduledFuture<?> future = executor.scheduleAtFixedRate(
                () -> taskExecutor.submit(() -> {
                    try {
                        job.execute();
                    } catch (Exception e) {
                        logger.error("Erreur lors de l'exécution de la tâche {}", job.getName(), e);
                    }
                }),
                0, // Délai initial
                job.getIntervalMillis(),
                TimeUnit.MILLISECONDS
        );

        scheduledTasks.put(job.getName(), future);
        return true;
    }

    /**
     * Annule une tâche planifiée
     * 
     * @param jobName Le nom de la tâche à annuler
     * @return true si la tâche a été annulée, false si elle n'existait pas
     */
    public boolean cancel(String jobName) {
        ScheduledFuture<?> future = scheduledTasks.remove(jobName);
        if (future != null) {
            future.cancel(false);
            logger.info("Tâche annulée: {}", jobName);
            return true;
        }
        return false;
    }

    /**
     * Arrête le planificateur et toutes les tâches
     */
    public void stop() {
        if (!running) {
            return;
        }

        running = false;
        logger.info("Arrêt du planificateur");

        // Annuler toutes les tâches planifiées
        for (String jobName : scheduledTasks.keySet()) {
            cancel(jobName);
        }
        scheduledTasks.clear();

        // Arrêter les executors
        executor.shutdown();
        taskExecutor.shutdown();
        try {
            if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
                executor.shutdownNow();
            }
            if (!taskExecutor.awaitTermination(5, TimeUnit.SECONDS)) {
                taskExecutor.shutdownNow();
            }
        } catch (InterruptedException e) {
            executor.shutdownNow();
            taskExecutor.shutdownNow();
            Thread.currentThread().interrupt();
        }

        logger.info("Planificateur arrêté");
    }

    /**
     * Vérifie si le planificateur est en cours d'exécution
     * 
     * @return true si le planificateur est en cours d'exécution, false sinon
     */
    public boolean isRunning() {
        return running;
    }
}
