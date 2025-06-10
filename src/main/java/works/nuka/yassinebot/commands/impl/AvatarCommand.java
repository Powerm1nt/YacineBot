package works.nuka.yassinebot.commands.impl;

import net.dv8tion.jda.api.EmbedBuilder;
import net.dv8tion.jda.api.entities.User;
import net.dv8tion.jda.api.events.message.MessageReceivedEvent;
import works.nuka.yassinebot.commands.Command;

import java.awt.Color;

/**
 * Commande pour afficher l'avatar d'un utilisateur
 */
public class AvatarCommand implements Command {

    @Override
    public String getName() {
        return "avatar";
    }

    @Override
    public String getDescription() {
        return "Affiche l'avatar d'un utilisateur";
    }

    @Override
    public String getUsage() {
        return "avatar [@utilisateur]";
    }

    @Override
    public String[] getAliases() {
        return new String[]{"av", "pfp"};
    }

    @Override
    public void execute(MessageReceivedEvent event, String[] args) {
        User target;

        // Si aucun utilisateur n'est mentionné, utiliser l'auteur du message
        if (event.getMessage().getMentionedUsers().isEmpty()) {
            target = event.getAuthor();
        } else {
            target = event.getMessage().getMentionedUsers().get(0);
        }

        // Construire l'URL de l'avatar en taille originale
        String avatarUrl = target.getEffectiveAvatarUrl() + "?size=1024";

        // Créer un embed avec l'avatar
        EmbedBuilder embed = new EmbedBuilder()
                .setTitle("Avatar de " + target.getName())
                .setImage(avatarUrl)
                .setColor(Color.BLUE)
                .setFooter("Demandé par " + event.getAuthor().getName(), 
                          event.getAuthor().getEffectiveAvatarUrl());

        event.getMessage().replyEmbeds(embed.build()).queue();
    }
}
