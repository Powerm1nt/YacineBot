package works.nuka.yassinebot.commands.impl;

import net.dv8tion.jda.api.Permission;
import net.dv8tion.jda.api.entities.Guild;
import net.dv8tion.jda.api.entities.Member;
import net.dv8tion.jda.api.events.message.MessageReceivedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.commands.Command;

import java.util.Arrays;

/**
 * Commande pour changer le surnom d'un utilisateur
 */
public class RenameCommand implements Command {
    private static final Logger logger = LoggerFactory.getLogger(RenameCommand.class);

    @Override
    public String getName() {
        return "rename";
    }

    @Override
    public String getDescription() {
        return "Change le surnom d'un utilisateur sur le serveur";
    }

    @Override
    public String getUsage() {
        return "rename <@utilisateur> <nouveau_nom>";
    }

    @Override
    public String[] getAliases() {
        return new String[]{"nick", "nickname"};
    }

    @Override
    public boolean isRestricted() {
        return true;
    }

    @Override
    public Permission[] getRequiredPermissions() {
        return new Permission[]{Permission.NICKNAME_MANAGE};
    }

    @Override
    public void execute(MessageReceivedEvent event, String[] args) {
        // Vérifier si la commande est utilisée dans un serveur
        if (!event.isFromGuild()) {
            event.getMessage().reply("❌ Cette commande ne peut être utilisée que dans un serveur.").queue();
            return;
        }

        Guild guild = event.getGuild();

        // Vérifier si le bot a la permission de gérer les surnoms
        if (!guild.getSelfMember().hasPermission(Permission.NICKNAME_MANAGE)) {
            event.getMessage().reply("❌ Je n'ai pas la permission de gérer les surnoms sur ce serveur.").queue();
            return;
        }

        // Vérifier si l'utilisateur a mentionné quelqu'un
        if (event.getMessage().getMentionedMembers().isEmpty()) {
            event.getMessage().reply("❌ Vous devez mentionner un utilisateur dont vous souhaitez changer le surnom.").queue();
            return;
        }

        // Vérifier s'il y a un nouveau nom
        if (args.length < 2) {
            event.getMessage().reply("❌ Vous devez spécifier un nouveau surnom.").queue();
            return;
        }

        Member targetMember = event.getMessage().getMentionedMembers().get(0);

        // Vérifier si le bot a la permission de modifier ce membre
        if (!guild.getSelfMember().canInteract(targetMember)) {
            event.getMessage().reply("❌ Je n'ai pas la permission de modifier le surnom de cet utilisateur.").queue();
            return;
        }

        // Vérifier si l'auteur de la commande a la permission de modifier ce membre
        if (!event.getMember().canInteract(targetMember)) {
            event.getMessage().reply("❌ Vous n'avez pas la permission de modifier le surnom de cet utilisateur.").queue();
            return;
        }

        // Extraire le nouveau surnom (tous les arguments après la mention)
        String newNickname = String.join(" ", Arrays.copyOfRange(args, 1, args.length));

        // Retirer les délimiteurs de mention au début du surnom (si présents)
        if (newNickname.startsWith("<@") && newNickname.contains(">")) {
            newNickname = newNickname.substring(newNickname.indexOf(">") + 1).trim();
        }

        // Limiter la taille du surnom à 32 caractères (limite Discord)
        if (newNickname.length() > 32) {
            newNickname = newNickname.substring(0, 32);
        }

        // Appliquer le changement de surnom
        String oldNickname = targetMember.getNickname() != null ? targetMember.getNickname() : targetMember.getUser().getName();
        final String finalNickname = newNickname;

        targetMember.modifyNickname(finalNickname).queue(
            success -> {
                event.getMessage().reply("✅ Le surnom de **" + targetMember.getUser().getName() + 
                    "** a été changé de '" + oldNickname + "' à '" + finalNickname + "'.").queue();
                logger.info("Surnom de l'utilisateur {} modifié par {} sur {}: {} -> {}", 
                          targetMember.getId(), event.getAuthor().getId(), 
                          guild.getId(), oldNickname, finalNickname);
            },
            error -> {
                event.getMessage().reply("❌ Impossible de modifier le surnom: " + error.getMessage()).queue();
                logger.error("Erreur lors de la modification du surnom de l'utilisateur {}", targetMember.getId(), error);
            });
    }
}
