package works.nuka.yassinebot.commands.impl;

import net.dv8tion.jda.api.EmbedBuilder;
import net.dv8tion.jda.api.entities.MessageEmbed;
import net.dv8tion.jda.api.events.message.MessageReceivedEvent;
import works.nuka.yassinebot.commands.Command;
import works.nuka.yassinebot.commands.CommandManager;
import works.nuka.yassinebot.config.ConfigLoader;

import java.awt.Color;
import java.util.Map;

/**
 * Commande d'aide qui affiche les commandes disponibles
 */
public class HelpCommand implements Command {
    private final CommandManager commandManager;

    public HelpCommand(CommandManager commandManager) {
        this.commandManager = commandManager;
    }

    @Override
    public String getName() {
        return "help";
    }

    @Override
    public String getDescription() {
        return "Affiche la liste des commandes disponibles";
    }

    @Override
    public String getUsage() {
        return "help [commande]";
    }

    @Override
    public String[] getAliases() {
        return new String[]{"aide", "commands"};
    }

    @Override
    public void execute(MessageReceivedEvent event, String[] args) {
        String prefix = ConfigLoader.getCommandPrefix();
        EmbedBuilder embed = new EmbedBuilder();
        embed.setColor(Color.BLUE);

        // Si un argument est fourni, afficher l'aide pour cette commande spécifique
        if (args.length > 0) {
            String commandName = args[0].toLowerCase();
            Command command = commandManager.getCommands().get(commandName);

            if (command != null) {
                embed.setTitle("Aide pour la commande: " + prefix + command.getName());
                embed.setDescription(command.getDescription());
                embed.addField("Utilisation", prefix + command.getUsage(), false);

                if (command.getAliases().length > 0) {
                    embed.addField("Alias", String.join(", ", command.getAliases()), false);
                }

                if (command.isRestricted()) {
                    embed.addField("Restrictions", "Cette commande est réservée aux utilisateurs autorisés", false);
                }
            } else {
                embed.setTitle("Commande inconnue");
                embed.setDescription("La commande \"" + commandName + "\" n'existe pas.");
            }
        } 
        // Sinon, afficher la liste de toutes les commandes
        else {
            embed.setTitle("Liste des commandes disponibles");
            embed.setDescription("Utilisez `" + prefix + "help [commande]` pour plus d'informations sur une commande spécifique.");

            Map<String, Command> commands = commandManager.getCommands();
            StringBuilder commandsList = new StringBuilder();

            // Éviter les doublons (commandes principales uniquement, pas les alias)
            commands.values().stream().distinct().forEach(cmd -> {
                commandsList.append("`" + prefix).append(cmd.getName()).append("` - ");
                commandsList.append(cmd.getDescription()).append("\n");
            });

            embed.addField("Commandes", commandsList.toString(), false);
        }

        event.getMessage().replyEmbeds(embed.build()).queue();
    }
}
