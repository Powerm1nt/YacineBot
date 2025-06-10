package works.nuka.yassinebot.commands.impl;

import net.dv8tion.jda.api.EmbedBuilder;
import net.dv8tion.jda.api.Permission;
import net.dv8tion.jda.api.events.message.MessageReceivedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.commands.Command;
import works.nuka.yassinebot.services.ConfigService;

import java.awt.Color;
import java.util.Arrays;
import java.util.Map;

/**
 * Commande pour gérer la configuration du bot
 */
public class ConfigCommand implements Command {
    private static final Logger logger = LoggerFactory.getLogger(ConfigCommand.class);
    private final ConfigService configService = new ConfigService();

    @Override
    public String getName() {
        return "config";
    }

    @Override
    public String getDescription() {
        return "Configure les paramètres du bot";
    }

    @Override
    public String getUsage() {
        return "config [get/set/list] [clé] [valeur]";
    }

    @Override
    public boolean isRestricted() {
        return true;
    }

    @Override
    public Permission[] getRequiredPermissions() {
        return new Permission[]{Permission.ADMINISTRATOR};
    }

    @Override
    public void execute(MessageReceivedEvent event, String[] args) {
        if (args.length == 0) {
            showHelp(event);
            return;
        }

        String action = args[0].toLowerCase();
        String guildId = event.isFromGuild() ? event.getGuild().getId() : null;

        try {
            switch (action) {
                case "get" -> {
                    if (args.length < 2) {
                        event.getMessage().reply("❌ Vous devez spécifier une clé. Exemple: `config get prefix`").queue();
                        return;
                    }
                    String key = args[1].toLowerCase();
                    String value = configService.getConfig(guildId, key);
                    if (value != null) {
                        event.getMessage().reply("🔧 Configuration: **" + key + "** = `" + value + "`").queue();
                    } else {
                        event.getMessage().reply("❌ Aucune configuration trouvée pour la clé **" + key + "**").queue();
                    }
                }
                case "set" -> {
                    if (args.length < 3) {
                        event.getMessage().reply("❌ Vous devez spécifier une clé et une valeur. Exemple: `config set prefix !`").queue();
                        return;
                    }
                    String key = args[1].toLowerCase();
                    String value = String.join(" ", Arrays.copyOfRange(args, 2, args.length));
                    configService.setConfig(guildId, key, value);
                    event.getMessage().reply("✅ Configuration mise à jour: **" + key + "** = `" + value + "`").queue();
                }
                case "list" -> {
                    Map<String, String> configs = configService.getAllConfigs(guildId);
                    if (configs.isEmpty()) {
                        event.getMessage().reply("❌ Aucune configuration trouvée").queue();
                        return;
                    }

                    EmbedBuilder embed = new EmbedBuilder()
                            .setTitle("🔧 Configurations")
                            .setColor(Color.BLUE);

                    configs.forEach((key, value) -> 
                            embed.addField(key, "`" + value + "`", false));

                    event.getMessage().replyEmbeds(embed.build()).queue();
                }
                case "delete", "del", "remove", "rm" -> {
                    if (args.length < 2) {
                        event.getMessage().reply("❌ Vous devez spécifier une clé à supprimer. Exemple: `config delete prefix`").queue();
                        return;
                    }
                    String key = args[1].toLowerCase();
                    boolean removed = configService.removeConfig(guildId, key);
                    if (removed) {
                        event.getMessage().reply("✅ Configuration supprimée: **" + key + "**").queue();
                    } else {
                        event.getMessage().reply("❌ Aucune configuration trouvée pour la clé **" + key + "**").queue();
                    }
                }
                default -> showHelp(event);
            }
        } catch (Exception e) {
            logger.error("Erreur lors de l'exécution de la commande config", e);
            event.getMessage().reply("❌ Une erreur s'est produite lors du traitement de la configuration: " + e.getMessage()).queue();
        }
    }

    /**
     * Affiche l'aide de la commande config
     *
     * @param event L'événement de message
     */
    private void showHelp(MessageReceivedEvent event) {
        EmbedBuilder embed = new EmbedBuilder()
                .setTitle("🔧 Aide - Configuration")
                .setColor(Color.BLUE)
                .setDescription("Gère les paramètres de configuration du bot")
                .addField("Obtenir une valeur", "`config get <clé>`", false)
                .addField("Définir une valeur", "`config set <clé> <valeur>`", false)
                .addField("Lister toutes les configurations", "`config list`", false)
                .addField("Supprimer une configuration", "`config delete <clé>`", false)
                .addField("Clés disponibles", "prefix, language, responseType, notifications", false);

        event.getMessage().replyEmbeds(embed.build()).queue();
    }
}
