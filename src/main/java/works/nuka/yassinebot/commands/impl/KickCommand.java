package works.nuka.yassinebot.commands.impl;

import net.dv8tion.jda.api.Permission;
import net.dv8tion.jda.api.entities.Member;
import net.dv8tion.jda.api.events.message.MessageReceivedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.commands.Command;

import java.util.Arrays;

/**
 * Commande pour expulser un utilisateur du serveur
 */
public class KickCommand implements Command {
    private static final Logger logger = LoggerFactory.getLogger(KickCommand.class);

    @Override
    public String getName() {
        return "kick";
    }

    @Override
    public String getDescription() {
        return "Expulse un utilisateur du serveur";
    }

    @Override
    public String getUsage() {
        return "kick <@utilisateur> [raison]";
    }

    @Override
    public boolean isRestricted() {
        return true;
    }

    @Override
    public Permission[] getRequiredPermissions() {
        return new Permission[]{Permission.KICK_MEMBERS};
    }

    @Override
    public void execute(MessageReceivedEvent event, String[] args) {
        // Vérifier si la commande est utilisée dans un serveur
        if (!event.isFromGuild()) {
            event.getMessage().reply("❌ Cette commande ne peut être utilisée que dans un serveur.").queue();
            return;
        }

        // Vérifier que l'utilisateur a mentionné quelqu'un
        if (event.getMessage().getMentionedMembers().isEmpty()) {
            event.getMessage().reply("❌ Vous devez mentionner un utilisateur à expulser.").queue();
            return;
        }

        // Récupérer le membre cible
        Member targetMember = event.getMessage().getMentionedMembers().get(0);

        // Vérifier si l'utilisateur peut être expulsé par le bot
        if (!event.getGuild().getSelfMember().canInteract(targetMember)) {
            event.getMessage().reply("❌ Je n'ai pas la permission d'expulser cet utilisateur.").queue();
            return;
        }

        // Vérifier si l'utilisateur peut être expulsé par l'auteur du message
        if (!event.getMember().canInteract(targetMember)) {
            event.getMessage().reply("❌ Vous n'avez pas la permission d'expulser cet utilisateur.").queue();
            return;
        }

        // Extraire la raison si elle est fournie
        String reason = "Aucune raison fournie";
        if (args.length > 1) {
            reason = String.join(" ", Arrays.copyOfRange(args, 1, args.length));
        }

        // Exécuter l'expulsion
        final String kickReason = reason;
        targetMember.kick(kickReason).queue(
            success -> {
                event.getMessage().reply("✅ **" + targetMember.getUser().getAsTag() + 
                    "** a été expulsé du serveur.\nRaison: " + kickReason).queue();
                logger.info("Utilisateur {} expulsé par {} sur {}, raison: {}", 
                          targetMember.getId(), event.getAuthor().getId(), 
                          event.getGuild().getId(), kickReason);
            }, 
            error -> {
                event.getMessage().reply("❌ Impossible d'expulser cet utilisateur: " + error.getMessage()).queue();
                logger.error("Erreur lors de l'expulsion de l'utilisateur {}", targetMember.getId(), error);
            });
    }
}
