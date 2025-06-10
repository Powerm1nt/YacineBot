package works.nuka.yassinebot.commands.impl;

import net.dv8tion.jda.api.Permission;
import net.dv8tion.jda.api.entities.Member;
import net.dv8tion.jda.api.events.message.MessageReceivedEvent;
import works.nuka.yassinebot.commands.Command;
import works.nuka.yassinebot.models.GuildPreference;
import works.nuka.yassinebot.services.GuildPreferenceService;

import java.util.Arrays;
import java.util.List;

/**
 * Commande pour gérer les préférences du serveur
 */
public class GuildPreferenceCommand implements Command {

    private final GuildPreferenceService preferenceService;

    public GuildPreferenceCommand(GuildPreferenceService preferenceService) {
        this.preferenceService = preferenceService;
    }

    @Override
    public void execute(MessageReceivedEvent event, String[] args) {
        if (args.length < 1) {
            showHelp(event);
            return;
        }

        String subCommand = args[0].toLowerCase();
        Member member = event.getMember();

        // Vérifier les permissions
        if (member == null || !member.hasPermission(Permission.ADMINISTRATOR)) {
            event.getMessage().reply("❌ Vous n'avez pas les permissions nécessaires pour utiliser cette commande.").queue();
            return;
        }

        String guildId = event.getGuild().getId();

        switch (subCommand) {
            case "get":
                handleGetPreference(event, args, guildId);
                break;
            case "set":
                handleSetPreference(event, args, guildId);
                break;
            case "list":
                handleListPreferences(event, guildId);
                break;
            default:
                showHelp(event);
                break;
        }
    }

    private void handleGetPreference(MessageReceivedEvent event, String[] args, String guildId) {
        if (args.length < 2) {
            event.getMessage().reply("❌ Veuillez spécifier une préférence à consulter.").queue();
            return;
        }

        String key = args[1].toLowerCase();
        GuildPreference preferences = preferenceService.getGuildPreferences(guildId);

        String value = "non défini";
        switch (key) {
            case "prefix":
                value = preferences.getPrefix() != null ? preferences.getPrefix() : "non défini";
                break;
            case "automessages":
                value = preferences.getAutoMessagesEnabled() != null ? 
                        (preferences.getAutoMessagesEnabled() ? "activé" : "désactivé") : "désactivé";
                break;
            case "ai":
                value = preferences.getAiEnabled() != null ? 
                        (preferences.getAiEnabled() ? "activé" : "désactivé") : "activé";
                break;
            case "modlog":
                value = preferences.getModLogChannelId() != null ? 
                        preferences.getModLogChannelId() : "non défini";
                break;
            case "welcome":
                value = preferences.getWelcomeChannelId() != null ? 
                        preferences.getWelcomeChannelId() : "non défini";
                break;
            default:
                event.getMessage().reply("❌ Préférence inconnue: " + key).queue();
                return;
        }

        event.getMessage().reply(String.format("📋 **%s**: %s", key, value)).queue();
    }

    private void handleSetPreference(MessageReceivedEvent event, String[] args, String guildId) {
        if (args.length < 3) {
            event.getMessage().reply("❌ Veuillez spécifier une préférence et une valeur.").queue();
            return;
        }

        String key = args[1].toLowerCase();
        String valueStr = args[2];
        boolean success = false;

        switch (key) {
            case "prefix":
                success = preferenceService.updateGuildPreference(guildId, "prefix", valueStr);
                break;
            case "automessages":
                boolean autoMessages = valueStr.equalsIgnoreCase("on") || valueStr.equalsIgnoreCase("true");
                success = preferenceService.updateGuildPreference(guildId, "autoMessagesEnabled", autoMessages);
                break;
            case "ai":
                boolean aiEnabled = valueStr.equalsIgnoreCase("on") || valueStr.equalsIgnoreCase("true");
                success = preferenceService.updateGuildPreference(guildId, "aiEnabled", aiEnabled);
                break;
            case "modlog":
                // Assume le format <#ID> ou simplement ID
                String modLogId = valueStr.replaceAll("[<#>]", "");
                success = preferenceService.updateGuildPreference(guildId, "modLogChannelId", modLogId);
                break;
            case "welcome":
                // Assume le format <#ID> ou simplement ID
                String welcomeId = valueStr.replaceAll("[<#>]", "");
                success = preferenceService.updateGuildPreference(guildId, "welcomeChannelId", welcomeId);
                break;
            case "welcomemsg":
                // Joindre tous les arguments restants pour le message
                String welcomeMsg = String.join(" ", Arrays.copyOfRange(args, 2, args.length));
                success = preferenceService.updateGuildPreference(guildId, "welcomeMessage", welcomeMsg);
                break;
            default:
                event.getMessage().reply("❌ Préférence inconnue: " + key).queue();
                return;
        }

        if (success) {
            event.getMessage().reply(String.format("✅ **%s** a été mis à jour avec succès !", key)).queue();
        } else {
            event.getMessage().reply("❌ Une erreur est survenue lors de la mise à jour de la préférence.").queue();
        }
    }

    private void handleListPreferences(MessageReceivedEvent event, String guildId) {
        GuildPreference preferences = preferenceService.getGuildPreferences(guildId);

        StringBuilder sb = new StringBuilder();
        sb.append("📋 **Préférences du serveur**\n\n");
        sb.append(String.format("• **Préfixe**: %s\n", 
                preferences.getPrefix() != null ? preferences.getPrefix() : "non défini"));
        sb.append(String.format("• **Messages auto**: %s\n", 
                preferences.getAutoMessagesEnabled() != null ? 
                (preferences.getAutoMessagesEnabled() ? "activé" : "désactivé") : "désactivé"));
        sb.append(String.format("• **IA**: %s\n", 
                preferences.getAiEnabled() != null ? 
                (preferences.getAiEnabled() ? "activé" : "désactivé") : "activé"));
        sb.append(String.format("• **Canal de modération**: %s\n", 
                preferences.getModLogChannelId() != null ? 
                String.format("<#%s>", preferences.getModLogChannelId()) : "non défini"));
        sb.append(String.format("• **Canal de bienvenue**: %s\n", 
                preferences.getWelcomeChannelId() != null ? 
                String.format("<#%s>", preferences.getWelcomeChannelId()) : "non défini"));

        event.getMessage().reply(sb.toString()).queue();
    }

    private void showHelp(MessageReceivedEvent event) {
        StringBuilder help = new StringBuilder();
        help.append("📋 **Commande de configuration du serveur**\n\n");
        help.append("**Utilisation**:\n");
        help.append("`config list` - Affiche toutes les préférences du serveur\n");
        help.append("`config get <préférence>` - Affiche une préférence spécifique\n");
        help.append("`config set <préférence> <valeur>` - Définit une préférence\n\n");
        help.append("**Préférences disponibles**:\n");
        help.append("• `prefix` - Préfixe des commandes\n");
        help.append("• `automessages` - Messages automatiques (on/off)\n");
        help.append("• `ai` - Fonctionnalités d'IA (on/off)\n");
        help.append("• `modlog` - Canal des logs de modération\n");
        help.append("• `welcome` - Canal de bienvenue\n");
        help.append("• `welcomemsg` - Message de bienvenue personnalisé\n");

        event.getMessage().reply(help.toString()).queue();
    }

    @Override
    public String getName() {
        return "config";
    }

    @Override
    public String getDescription() {
        return "Configure les préférences du serveur";
    }

    @Override
    public List<String> getAliases() {
        return Arrays.asList("preference", "prefs", "settings");
    }

    @Override
    public String getUsage() {
        return "config [list|get <préférence>|set <préférence> <valeur>]";
    }

    @Override
    public boolean requiresGuild() {
        return true;
    }
}
