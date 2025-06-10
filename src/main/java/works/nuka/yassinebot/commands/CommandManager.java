package works.nuka.yassinebot.commands;

import net.dv8tion.jda.api.events.message.MessageReceivedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.commands.impl.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Gestionnaire des commandes du bot
 */
public class CommandManager {
    private static final Logger logger = LoggerFactory.getLogger(CommandManager.class);
    private final Map<String, Command> commands = new HashMap<>();

    /**
     * Initialise le gestionnaire avec les commandes disponibles
     */
    public CommandManager() {
        // Enregistrer toutes les commandes disponibles
        registerCommand(new DemoCommand());
        registerCommand(new HelpCommand(this));
        registerCommand(new WarnCommand());
        registerCommand(new AvatarCommand());
        registerCommand(new BanCommand());
        registerCommand(new KickCommand());
        registerCommand(new TimeoutCommand());
        registerCommand(new RenameCommand());
        registerCommand(new StatusCommand());
        registerCommand(new ConfigCommand());
        registerCommand(new SchedulerCommand());
        registerCommand(new AICommand());

        logger.info("{} commandes enregistrées", commands.size());
    }

    /**
     * Enregistre une commande dans le gestionnaire
     * @param command la commande à enregistrer
     */
    private void registerCommand(Command command) {
        commands.put(command.getName().toLowerCase(), command);
        // Enregistrer également les alias si présents
        for (String alias : command.getAliases()) {
            commands.put(alias.toLowerCase(), command);
        }
    }

    /**
     * Exécute une commande par son nom
     * @param name nom de la commande
     * @param event événement de message
     * @param args arguments de la commande
     */
    public void executeCommand(String name, MessageReceivedEvent event, String[] args) {
        Command command = commands.get(name.toLowerCase());

        if (command == null) {
            event.getMessage().reply("❌ Cette commande n'existe pas.").queue();
            return;
        }

        // Vérifier les restrictions d'accès
        if (command.isRestricted() && !isAuthorized(event, command)) {
            event.getMessage().reply("❌ Vous n'avez pas la permission d'utiliser cette commande.").queue();
            return;
        }

        try {
            command.execute(event, args);
        } catch (Exception e) {
            logger.error("Erreur lors de l'exécution de la commande {}", name, e);
            event.getMessage().reply("❌ Une erreur s'est produite lors de l'exécution de la commande.").queue();
        }
    }

    /**
     * Vérifie si un utilisateur est autorisé à utiliser une commande
     * @param event événement de message
     * @param command commande à vérifier
     * @return true si l'utilisateur est autorisé
     */
    private boolean isAuthorized(MessageReceivedEvent event, Command command) {
        // Implémenter la logique d'autorisation en fonction des besoins
        // Par exemple, vérifier si l'utilisateur est un administrateur
        if (event.isFromGuild()) {
            return event.getMember().hasPermission(command.getRequiredPermissions());
        }
        return false;
    }

    /**
     * Obtient toutes les commandes enregistrées
     * @return map des commandes
     */
    public Map<String, Command> getCommands() {
        return commands;
    }
}
