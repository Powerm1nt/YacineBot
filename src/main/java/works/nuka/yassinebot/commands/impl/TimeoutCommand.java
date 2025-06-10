package works.nuka.yassinebot.commands.impl;

import net.dv8tion.jda.api.Permission;
import net.dv8tion.jda.api.entities.Member;
import net.dv8tion.jda.api.events.message.MessageReceivedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.commands.Command;

import java.time.Duration;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Commande pour mettre un utilisateur en timeout
 */
public class TimeoutCommand implements Command {
    private static final Logger logger = LoggerFactory.getLogger(TimeoutCommand.class);
    private static final Pattern TIME_PATTERN = Pattern.compile("(\\d+)([smhdw])");

    @Override
    public String getName() {
        return "timeout";
    }

    @Override
    public String getDescription() {
        return "Met un utilisateur en timeout (l'empêche d'envoyer des messages)";
    }

    @Override
    public String getUsage() {
        return "timeout <@utilisateur> <durée> [raison]";
    }

    @Override
    public String[] getAliases() {
        return new String[]{"mute"};
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
        // Vérifier si la commande est utilisée dans un serveur
        if (!event.isFromGuild()) {
            event.getMessage().reply("❌ Cette commande ne peut être utilisée que dans un serveur.").queue();
            return;
        }

        // Vérifier qu'il y a suffisamment d'arguments
        if (args.length < 2 || event.getMessage().getMentionedMembers().isEmpty()) {
            event.getMessage().reply("❌ Vous devez mentionner un utilisateur et spécifier une durée. "
                    + "Exemple: `timeout @utilisateur 1h Raison`").queue();
            return;
        }

        // Récupérer le membre cible
        Member targetMember = event.getMessage().getMentionedMembers().get(0);

        // Vérifier si l'utilisateur peut être mis en timeout par le bot
        if (!event.getGuild().getSelfMember().canInteract(targetMember)) {
            event.getMessage().reply("❌ Je n'ai pas la permission de mettre cet utilisateur en timeout.").queue();
            return;
        }

        // Vérifier si l'utilisateur peut être mis en timeout par l'auteur du message
        if (!event.getMember().canInteract(targetMember)) {
            event.getMessage().reply("❌ Vous n'avez pas la permission de mettre cet utilisateur en timeout.").queue();
            return;
        }

        // Extraire la durée du timeout
        String timeArg = args[1];
        Duration duration = parseDuration(timeArg);
        if (duration == null || duration.isZero() || duration.isNegative()) {
            event.getMessage().reply("❌ Durée invalide. Utilisez un format comme: 30s, 5m, 2h, 1d, 1w").queue();
            return;
        }

        // Limiter la durée maximale à 28 jours (limite Discord)
        if (duration.toSeconds() > 2419200) { // 28 jours en secondes
            duration = Duration.ofSeconds(2419200);
        }

        // Extraire la raison si elle est fournie
        String reason = "Aucune raison fournie";
        if (args.length > 2) {
            reason = String.join(" ", Arrays.copyOfRange(args, 2, args.length));
        }

        // Appliquer le timeout
        final String timeoutReason = reason;
        final Duration finalDuration = duration;
        targetMember.timeoutFor(finalDuration).reason(timeoutReason).queue(
            success -> {
                String durationStr = formatDuration(finalDuration);
                event.getMessage().reply("✅ **" + targetMember.getUser().getAsTag() + 
                    "** a été mis en timeout pour " + durationStr + ".\nRaison: " + timeoutReason).queue();
                logger.info("Utilisateur {} mis en timeout par {} sur {} pour {}, raison: {}", 
                          targetMember.getId(), event.getAuthor().getId(), 
                          event.getGuild().getId(), durationStr, timeoutReason);
            }, 
            error -> {
                event.getMessage().reply("❌ Impossible de mettre cet utilisateur en timeout: " + error.getMessage()).queue();
                logger.error("Erreur lors de la mise en timeout de l'utilisateur {}", targetMember.getId(), error);
            });
    }

    /**
     * Parse une durée à partir d'une chaîne (ex: 10m, 1h, 30s, 1d, 1w)
     * 
     * @param input La chaîne à parser
     * @return La durée correspondante ou null si invalide
     */
    private Duration parseDuration(String input) {
        Matcher matcher = TIME_PATTERN.matcher(input.toLowerCase());
        if (!matcher.matches()) {
            return null;
        }

        int amount = Integer.parseInt(matcher.group(1));
        String unit = matcher.group(2);

        return switch (unit) {
            case "s" -> Duration.ofSeconds(amount);
            case "m" -> Duration.ofMinutes(amount);
            case "h" -> Duration.ofHours(amount);
            case "d" -> Duration.ofDays(amount);
            case "w" -> Duration.ofDays(amount * 7);
            default -> null;
        };
    }

    /**
     * Formate une durée en texte lisible
     * 
     * @param duration La durée à formater
     * @return Une chaîne décrivant la durée
     */
    private String formatDuration(Duration duration) {
        if (duration.toDays() > 0) {
            long days = duration.toDays();
            if (days % 7 == 0 && days > 0) {
                return days / 7 + " semaine" + (days / 7 > 1 ? "s" : "");
            }
            return days + " jour" + (days > 1 ? "s" : "");
        } else if (duration.toHours() > 0) {
            long hours = duration.toHours();
            return hours + " heure" + (hours > 1 ? "s" : "");
        } else if (duration.toMinutes() > 0) {
            long minutes = duration.toMinutes();
            return minutes + " minute" + (minutes > 1 ? "s" : "");
        } else {
            long seconds = duration.getSeconds();
            return seconds + " seconde" + (seconds > 1 ? "s" : "");
        }
    }
}
