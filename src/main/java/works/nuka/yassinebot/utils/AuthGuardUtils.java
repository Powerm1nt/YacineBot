package works.nuka.yassinebot.utils;

import net.dv8tion.jda.api.Permission;
import net.dv8tion.jda.api.entities.Member;
import net.dv8tion.jda.api.events.message.MessageReceivedEvent;

/**
 * Utilitaire pour vérifier les permissions des utilisateurs
 */
public class AuthGuardUtils {

    /**
     * Vérifie si un membre a les permissions administrateur
     * 
     * @param event L'événement de message
     * @return true si l'utilisateur est administrateur, false sinon
     */
    public static boolean isAdmin(MessageReceivedEvent event) {
        Member member = event.getMember();
        return member != null && member.hasPermission(Permission.ADMINISTRATOR);
    }

    /**
     * Vérifie si un membre a les permissions de modération (gérer les messages, expulser, bannir)
     * 
     * @param event L'événement de message
     * @return true si l'utilisateur est modérateur, false sinon
     */
    public static boolean isModerator(MessageReceivedEvent event) {
        Member member = event.getMember();
        return member != null && (member.hasPermission(Permission.MESSAGE_MANAGE) ||
                member.hasPermission(Permission.KICK_MEMBERS) ||
                member.hasPermission(Permission.BAN_MEMBERS));
    }

    /**
     * Vérifie si un membre peut utiliser les commandes de modération
     * 
     * @param event L'événement de message
     * @param action Description de l'action pour le message d'erreur
     * @return true si autorisé, false sinon (et envoie un message d'erreur)
     */
    public static boolean canModerate(MessageReceivedEvent event, String action) {
        if (!isModerator(event)) {
            event.getMessage().reply("❌ Vous n'avez pas la permission de " + action).queue();
            return false;
        }
        return true;
    }

    /**
     * Vérifie si un membre peut utiliser les commandes d'administration
     * 
     * @param event L'événement de message
     * @param action Description de l'action pour le message d'erreur
     * @return true si autorisé, false sinon (et envoie un message d'erreur)
     */
    public static boolean canAdministrate(MessageReceivedEvent event, String action) {
        if (!isAdmin(event)) {
            event.getMessage().reply("❌ Vous n'avez pas la permission de " + action).queue();
            return false;
        }
        return true;
    }

    /**
     * Vérifie si le membre cible peut être modéré par l'exécuteur de la commande
     * 
     * @param event L'événement de message
     * @param target Le membre cible de la modération
     * @param action Description de l'action pour le message d'erreur
     * @return true si la modération est possible, false sinon (et envoie un message d'erreur)
     */
    public static boolean canModerateTarget(MessageReceivedEvent event, Member target, String action) {
        Member executor = event.getMember();

        if (executor == null || target == null) {
            event.getMessage().reply("❌ Erreur: Impossible de trouver l'utilisateur.").queue();
            return false;
        }

        // Vérifier si le bot a les permissions nécessaires
        if (!event.getGuild().getSelfMember().canInteract(target)) {
            event.getMessage().reply("❌ Je n'ai pas la permission de " + action + " cet utilisateur.").queue();
            return false;
        }

        // Vérifier si l'exécuteur peut interagir avec la cible
        if (!executor.canInteract(target)) {
            event.getMessage().reply("❌ Vous ne pouvez pas " + action + " cet utilisateur car il a un rôle supérieur au vôtre.").queue();
            return false;
        }

        // Vérifier si la cible est le propriétaire du serveur
        if (target.isOwner()) {
            event.getMessage().reply("❌ Vous ne pouvez pas " + action + " le propriétaire du serveur.").queue();
            return false;
        }

        return true;
    }
}
