package works.nuka.yassinebot.commands.impl;

import net.dv8tion.jda.api.Permission;
import net.dv8tion.jda.api.entities.Member;
import net.dv8tion.jda.api.entities.User;
import net.dv8tion.jda.api.events.message.MessageReceivedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.commands.Command;
import works.nuka.yassinebot.services.WarnService;

import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.List;

/**
 * Commande pour avertir un utilisateur
 */
public class WarnCommand implements Command {
    private static final Logger logger = LoggerFactory.getLogger(WarnCommand.class);
    private final WarnService warnService = new WarnService();
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

    @Override
    public String getName() {
        return "warn";
    }

    @Override
    public String getDescription() {
        return "Avertir un utilisateur";
    }

    @Override
    public String getUsage() {
        return "warn <@utilisateur> [raison] ou warn list <@utilisateur>";
    }

    @Override
    public boolean isRestricted() {
        return true;
    }

    @Override
    public Permission[] getRequiredPermissions() {
        return new Permission[]{Permission.MODERATE_MEMBERS};
    }

    @Override
    public void execute(MessageReceivedEvent event, String[] args) {
        if (!event.isFromGuild()) {
            event.getMessage().reply("❌ Cette commande ne peut être utilisée que dans un serveur.").queue();
            return;
        }

        if (args.length == 0) {
            event.getMessage().reply("❌ Vous devez mentionner un utilisateur à avertir ou utiliser `warn list @utilisateur` pour voir ses avertissements.").queue();
            return;
        }

        // Gestion de la commande "list"
        if (args[0].equalsIgnoreCase("list") && args.length > 1 && !event.getMessage().getMentions().getUsers().isEmpty()) {
            handleListWarnings(event);
            return;
        }

        // Gestion de l'avertissement
        if (event.getMessage().getMentions().getUsers().isEmpty()) {
            event.getMessage().reply("❌ Vous devez mentionner un utilisateur à avertir.").queue();
            return;
        }

        User targetUser = event.getMessage().getMentions().getUsers().getFirst();
        Member targetMember = event.getGuild().getMember(targetUser);

        if (targetMember == null) {
            event.getMessage().reply("❌ Cet utilisateur n'existe pas ou n'est pas dans ce serveur.").queue();
            return;
        }

        if (targetMember.hasPermission(Permission.MODERATE_MEMBERS)) {
            event.getMessage().reply("❌ Vous ne pouvez pas avertir un modérateur ou un administrateur.").queue();
            return;
        }

        // Extraire la raison (tout après la mention)
        String reason;
        if (args.length > 1) {
            List<String> reasonArgs = Arrays.asList(args).subList(1, args.length);
            reason = String.join(" ", reasonArgs);
        } else {
            reason = "Aucune raison fournie";
        }

        // Ajouter l'avertissement
        int warningCount = warnService.addWarning(
                event.getGuild().getId(),
                targetUser.getId(),
                event.getAuthor().getId(),
                reason
        );

        event.getMessage().reply("✅ **" + targetUser.getName() + "** a reçu un avertissement (" + warningCount + " au total). Raison: " + reason).queue();

        // Envoyer un message privé à l'utilisateur averti
        targetUser.openPrivateChannel().queue(channel -> {
            channel.sendMessage("⚠️ Vous avez reçu un avertissement sur **" + event.getGuild().getName() + "** par " + 
                    event.getAuthor().getName() + ".\n**Raison:** " + reason + "\n**Total d'avertissements:** " + warningCount).queue(
                    success -> {},
                    error -> logger.debug("Impossible d'envoyer un message privé à l'utilisateur (DMs probablement fermés)"));
        });
    }

    /**
     * Gère l'affichage de la liste des avertissements d'un utilisateur
     * @param event événement de message
     */
    private void handleListWarnings(MessageReceivedEvent event) {
        User targetUser = event.getMessage().getMentions().getUsers().getFirst();
        List<WarnService.Warning> warnings = warnService.getUserWarnings(event.getGuild().getId(), targetUser.getId());

        if (warnings.isEmpty()) {
            event.getMessage().reply("✅ **" + targetUser.getName() + "** n'a aucun avertissement.").queue();
            return;
        }

        StringBuilder warningsList = new StringBuilder("**Avertissements de " + targetUser.getName() + "** (" + warnings.size() + "):\n\n");
        for (int i = 0; i < warnings.size(); i++) {
            WarnService.Warning warning = warnings.get(i);
            String date = warning.timestamp().format(DATE_FORMATTER);
            warningsList.append("**").append(i + 1).append(".**")
                    .append(" ").append(warning.reason())
                    .append(" - par <@").append(warning.moderatorId()).append(">")
                    .append(" le ").append(date).append("\n");
        }

        event.getMessage().reply(warningsList.toString()).queue();
    }
}
