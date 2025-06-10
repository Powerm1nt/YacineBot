package works.nuka.yassinebot.commands.impl;

import net.dv8tion.jda.api.Permission;
import net.dv8tion.jda.api.entities.Member;
import net.dv8tion.jda.api.entities.User;
import net.dv8tion.jda.api.events.message.MessageReceivedEvent;
import net.dv8tion.jda.api.exceptions.InsufficientPermissionException;
import net.dv8tion.jda.api.exceptions.RateLimitedException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.commands.Command;

import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Commande pour bannir un utilisateur du serveur
 */
public class BanCommand implements Command {
    private static final Logger logger = LoggerFactory.getLogger(BanCommand.class);

    @Override
    public String getName() {
        return "ban";
    }

    @Override
    public String getDescription() {
        return "Bannit un utilisateur du serveur";
    }

    @Override
    public String getUsage() {
        return "ban <@utilisateur> [raison] [--days=X]";
    }

    @Override
    public boolean isRestricted() {
        return true;
    }

    @Override
    public Permission[] getRequiredPermissions() {
        return new Permission[]{Permission.BAN_MEMBERS};
    }

    @Override
    public void execute(MessageReceivedEvent event, String[] args) {
        // Vérifier si la commande est utilisée dans un serveur
        if (!event.isFromGuild()) {
            event.getMessage().reply("❌ Cette commande ne peut être utilisée que dans un serveur.").queue();
            return;
        }

        // Vérifier que l'utilisateur a mentionné quelqu'un
        if (event.getMessage().getMentions().getMembers().isEmpty()) {
            event.getMessage().reply("❌ Vous devez mentionner un utilisateur à bannir.").queue();
            return;
        }

        // Check if the executor has BAN_MEMBERS permission
        if (!event.getMember().hasPermission(Permission.BAN_MEMBERS)) {
            event.getMessage().reply("❌ Vous n'avez pas la permission de bannir des utilisateurs.").queue();
            return;
        }

        // Récupérer l'utilisateur cible
        User targetUser = event.getMessage().getMentions().getUsers().get(0);
        Member targetMember = event.getGuild().getMember(targetUser);

        // Vérifier si l'utilisateur est présent dans le serveur
        if (targetMember != null) {
            // Vérifier si l'utilisateur peut être banni par le bot
            if (!event.getGuild().getSelfMember().canInteract(targetMember)) {
                event.getMessage().reply("❌ Je n'ai pas la permission de bannir cet utilisateur.").queue();
                return;
            }

            // Vérifier si l'utilisateur peut être banni par l'auteur du message
            if (!event.getMember().canInteract(targetMember)) {
                event.getMessage().reply("❌ Vous n'avez pas la permission de bannir cet utilisateur.").queue();
                return;
            }
        }

        // Traiter les arguments pour extraire la raison et les options
        int delDays = 0;
        String reason = "Aucune raison fournie";

        if (args.length > 1) {
            // Parcourir les arguments pour trouver les options et la raison
            List<String> reasonParts = Arrays.asList(args).subList(1, args.length);
            StringBuilder reasonBuilder = new StringBuilder();

            for (String part : reasonParts) {
                if (part.startsWith("--days=")) {
                    try {
                        delDays = Integer.parseInt(part.substring(7));
                        if (delDays < 0) delDays = 0;
                        if (delDays > 7) delDays = 7;
                    } catch (NumberFormatException e) {
                        // Ignorer l'argument invalide
                    }
                } else {
                    reasonBuilder.append(part).append(" ");
                }
            }

            String parsedReason = reasonBuilder.toString().trim();
            if (!parsedReason.isEmpty()) {
                reason = parsedReason;
            }
        }

        final String banReason = reason.length() > 512 ? reason.substring(0, 512) : reason;
        final int finalDelDays = delDays;

        event.getGuild().ban(targetUser, finalDelDays, TimeUnit.valueOf(banReason))
                .queue(success -> {
                    // Use username instead of getAsTag() for future compatibility
                    String userDisplay = targetUser.getName();
                    event.getMessage().reply("✅ **" + userDisplay + "** a été banni du serveur. "
                            + (finalDelDays > 0 ? "(messages des " + finalDelDays + " derniers jours supprimés)" : "")
                            + "\nRaison: " + banReason).queue();
                    logger.info("Utilisateur {} banni par {} sur {}, raison: {}", 
                      targetUser.getId(), event.getAuthor().getId(), 
                      event.getGuild().getId(), banReason);
                }, error -> {
                    String errorMessage = error.getMessage() != null ? error.getMessage() : "Raison inconnue";
                    
                    // Handle specific error types
                    if (error instanceof RateLimitedException) {
                        errorMessage = "Trop de bannissements récents, veuillez réessayer plus tard.";
                    } else if (error instanceof InsufficientPermissionException) {
                        errorMessage = "Le bot n'a pas les permissions suffisantes pour bannir cet utilisateur.";
                    }
                    
                    event.getMessage().reply("❌ Impossible de bannir cet utilisateur: " + errorMessage).queue();
                    logger.error("Erreur lors du bannissement de l'utilisateur {}", targetUser.getId(), error);
                });
    }
}
