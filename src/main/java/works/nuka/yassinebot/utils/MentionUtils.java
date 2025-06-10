package works.nuka.yassinebot.utils;

import net.dv8tion.jda.api.JDA;
import net.dv8tion.jda.api.entities.Guild;
import net.dv8tion.jda.api.entities.Member;
import net.dv8tion.jda.api.entities.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Utilitaire pour gérer les mentions Discord
 */
public class MentionUtils {
    private static final Logger logger = LoggerFactory.getLogger(MentionUtils.class);

    private static final Pattern USER_MENTION_PATTERN = Pattern.compile("<@!?(\\d+)>");
    private static final Pattern ROLE_MENTION_PATTERN = Pattern.compile("<@&(\\d+)>");
    private static final Pattern CHANNEL_MENTION_PATTERN = Pattern.compile("<#(\\d+)>");

    /**
     * Remplace les mentions dans un texte par des noms d'utilisateurs
     *
     * @param text Le texte contenant des mentions
     * @param jda L'instance JDA pour résoudre les utilisateurs
     * @return Le texte avec les mentions remplacées par des noms
     */
    public static String replaceMentionsWithNames(String text, JDA jda) {
        if (text == null || text.isEmpty()) {
            return text;
        }

        String result = text;

        // Remplacer les mentions d'utilisateurs
        Matcher userMatcher = USER_MENTION_PATTERN.matcher(result);
        while (userMatcher.find()) {
            String userId = userMatcher.group(1);
            try {
                User user = jda.retrieveUserById(userId).complete();
                if (user != null) {
                    String replacement = user.getName() + " (ID: " + userId + ")";
                    result = result.replace(userMatcher.group(), replacement);
                }
            } catch (Exception e) {
                logger.warn("Impossible de résoudre l'utilisateur avec l'ID {}", userId, e);
            }
        }

        // Remplacer les mentions de rôles
        Matcher roleMatcher = ROLE_MENTION_PATTERN.matcher(result);
        while (roleMatcher.find()) {
            String roleId = roleMatcher.group(1);
            for (Guild guild : jda.getGuilds()) {
                try {
                    var role = guild.getRoleById(roleId);
                    if (role != null) {
                        String replacement = "@" + role.getName() + " (Role ID: " + roleId + ")";
                        result = result.replace(roleMatcher.group(), replacement);
                        break;
                    }
                } catch (Exception e) {
                    logger.warn("Impossible de résoudre le rôle avec l'ID {}", roleId, e);
                }
            }
        }

        // Remplacer les mentions de canaux
        Matcher channelMatcher = CHANNEL_MENTION_PATTERN.matcher(result);
        while (channelMatcher.find()) {
            String channelId = channelMatcher.group(1);
            try {
                var channel = jda.getChannelById(net.dv8tion.jda.api.entities.channel.Channel.class, channelId);
                if (channel != null) {
                    String replacement = "#" + channel.getName() + " (Channel ID: " + channelId + ")";
                    result = result.replace(channelMatcher.group(), replacement);
                }
            } catch (Exception e) {
                logger.warn("Impossible de résoudre le canal avec l'ID {}", channelId, e);
            }
        }

        return result;
    }

    /**
     * Convertit un texte contenant des mentions avec des IDs en mentions Discord
     *
     * @param text Le texte avec des mentions au format "User (ID: 123456789)"
     * @return Le texte avec des mentions Discord
     */
    public static String convertTextToDiscordMentions(String text) {
        if (text == null || text.isEmpty()) {
            return text;
        }

        // Recherche des motifs comme "Nom d'utilisateur (ID: 123456789)"
        Pattern idPattern = Pattern.compile("([^\\(]+)\\s*\\(ID:\s*(\\d+)\\)");
        Matcher matcher = idPattern.matcher(text);
        StringBuffer result = new StringBuffer();

        while (matcher.find()) {
            String userId = matcher.group(2);
            matcher.appendReplacement(result, "<@" + userId + ">");
        }
        matcher.appendTail(result);

        return result.toString();
    }

    /**
     * Extrait les IDs d'utilisateurs d'un texte contenant des mentions
     *
     * @param text Le texte à analyser
     * @return Liste des IDs d'utilisateurs trouvés
     */
    public static List<String> extractUserIdsFromText(String text) {
        List<String> userIds = new ArrayList<>();
        if (text == null || text.isEmpty()) {
            return userIds;
        }

        // Extraire les IDs des mentions directes
        Matcher userMatcher = USER_MENTION_PATTERN.matcher(text);
        while (userMatcher.find()) {
            userIds.add(userMatcher.group(1));
        }

        // Extraire les IDs des motifs "Nom (ID: 123456789)"
        Pattern idPattern = Pattern.compile("([^\\(]+)\\s*\\(ID:\s*(\\d+)\\)");
        Matcher idMatcher = idPattern.matcher(text);
        while (idMatcher.find()) {
            userIds.add(idMatcher.group(2));
        }

        return userIds;
    }

    /**
     * Récupère les noms d'utilisateurs mentionnés dans un texte
     *
     * @param text Le texte contenant des mentions
     * @param guild Le serveur pour résoudre les membres
     * @return Liste des noms d'utilisateurs trouvés
     */
    public static List<String> extractUserNamesFromMentions(String text, Guild guild) {
        List<String> userNames = new ArrayList<>();
        if (text == null || text.isEmpty() || guild == null) {
            return userNames;
        }

        Matcher matcher = USER_MENTION_PATTERN.matcher(text);
        while (matcher.find()) {
            String userId = matcher.group(1);
            try {
                Member member = guild.retrieveMemberById(userId).complete();
                if (member != null) {
                    userNames.add(member.getUser().getName());
                }
            } catch (Exception e) {
                logger.warn("Impossible de résoudre le membre avec l'ID {}", userId, e);
            }
        }

        return userNames;
    }
}
