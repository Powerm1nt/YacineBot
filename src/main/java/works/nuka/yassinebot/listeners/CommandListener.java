package works.nuka.yassinebot.listeners;

import net.dv8tion.jda.api.entities.Message;
import net.dv8tion.jda.api.events.message.MessageReceivedEvent;
import net.dv8tion.jda.api.hooks.ListenerAdapter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.commands.CommandManager;
import works.nuka.yassinebot.config.ConfigLoader;
import works.nuka.yassinebot.utils.RateLimiter;

import java.util.Arrays;

/**
 * Écouteur pour les commandes Discord
 */
public class CommandListener extends ListenerAdapter {
    private static final Logger logger = LoggerFactory.getLogger(CommandListener.class);
    private final CommandManager commandManager = new CommandManager();
    private final RateLimiter rateLimiter = new RateLimiter(5, 10000); // 5 commandes par 10 secondes

    @Override
    public void onMessageReceived(MessageReceivedEvent event) {
        // Ignorer les messages du bot lui-même
        if (event.getAuthor().isBot()) return;

        Message message = event.getMessage();
        String content = message.getContentRaw();
        String prefix = ConfigLoader.getCommandPrefix();

        // Vérifier si le message commence par le préfixe de commande
        if (content.startsWith(prefix)) {
            // Vérifier la limite de taux
            if (!rateLimiter.check(event.getAuthor().getId())) {
                message.reply("⚠️ Vous envoyez des commandes trop rapidement. Veuillez attendre un peu.").queue();
                return;
            }

            // Extraire le nom de la commande et les arguments
            String[] parts = content.split("\\s+");
            String commandName = parts[0].substring(prefix.length());
            String[] args = Arrays.copyOfRange(parts, 1, parts.length);

            logger.info("Commande reçue: {} de {}", commandName, event.getAuthor().getName());

            // Exécuter la commande
            commandManager.executeCommand(commandName, event, args);
        }
    }
}
