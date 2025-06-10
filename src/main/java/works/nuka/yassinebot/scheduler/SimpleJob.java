package works.nuka.yassinebot.scheduler;

import java.util.concurrent.TimeUnit;

/**
 * Représente une tâche planifiée simple
 */
public class SimpleJob {
    private final String name;
    private final long intervalMillis;
    private final Runnable task;

    private SimpleJob(String name, long interval, TimeUnit unit, Runnable task) {
        this.name = name;
        this.intervalMillis = unit.toMillis(interval);
        this.task = task;
    }

    /**
     * Obtient le nom de la tâche
     * 
     * @return Le nom de la tâche
     */
    public String getName() {
        return name;
    }

    /**
     * Obtient l'intervalle d'exécution en millisecondes
     * 
     * @return Intervalle en ms
     */
    public long getIntervalMillis() {
        return intervalMillis;
    }

    /**
     * Exécute la tâche
     */
    public void execute() {
        task.run();
    }

    /**
     * Builder pour créer une instance de SimpleJob
     */
    public static class Builder {
        private String name;
        private long interval;
        private TimeUnit unit = TimeUnit.MILLISECONDS;
        private Runnable task;

        public Builder name(String name) {
            this.name = name;
            return this;
        }

        public Builder interval(long interval, TimeUnit unit) {
            this.interval = interval;
            this.unit = unit;
            return this;
        }

        public Builder execute(Runnable task) {
            this.task = task;
            return this;
        }

        public SimpleJob build() {
            if (name == null) {
                name = "job-" + System.currentTimeMillis();
            }
            if (task == null) {
                throw new IllegalStateException("Une tâche doit être spécifiée");
            }
            if (interval <= 0) {
                throw new IllegalStateException("L'intervalle doit être positif");
            }
            return new SimpleJob(name, interval, unit, task);
        }
    }

    /**
     * Crée un nouveau builder pour configurer un SimpleJob
     * 
     * @return Un nouveau builder
     */
    public static Builder builder() {
        return new Builder();
    }
}
