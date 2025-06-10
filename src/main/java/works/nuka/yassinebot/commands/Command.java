package works.nuka.yassinebot.commands;

import net.dv8tion.jda.api.Permission;
import net.dv8tion.jda.api.events.message.MessageReceivedEvent;

/**
 * Interface pour les commandes du bot
 */
public interface Command {
    /**
     * Obtient le nom de la commande
     * @return le nom
     */
    String getName();

    /**
     * Obtient la description de la commande
     * @return la description
     */
    String getDescription();

    /**
     * Obtient les exemples d'utilisation de la commande
     * @return les exemples d'utilisation
     */
    String getUsage();

    /**
     * Obtient les alias de la commande
     * @return les alias
     */
    default String[] getAliases() {
        return new String[0];
    }

    /**
     * Vérifie si la commande est restreinte aux utilisateurs autorisés
     * @return true si restreinte
     */
    default boolean isRestricted() {
        return false;
    }

    /**
     * Obtient les permissions requises pour exécuter la commande
     * @return les permissions requises
     */
    default Permission[] getRequiredPermissions() {
        return new Permission[0];
    }

    /**
     * Exécute la commande
     * @param event événement de message
     * @param args arguments de la commande
     */
    void execute(MessageReceivedEvent event, String[] args);
}
