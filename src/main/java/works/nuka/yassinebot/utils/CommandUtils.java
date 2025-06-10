package works.nuka.yassinebot.utils;

import net.dv8tion.jda.api.EmbedBuilder;
import net.dv8tion.jda.api.entities.Member;
import net.dv8tion.jda.api.entities.Message;
import net.dv8tion.jda.api.entities.MessageEmbed;
import net.dv8tion.jda.api.entities.User;
import net.dv8tion.jda.api.events.message.MessageReceivedEvent;

import java.awt.Color;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Utilitaires pour faciliter le traitement des commandes
 */
public class CommandUtils {

    /**
     * Analyse les arguments d'une commande
     * 
     * @param content Le contenu du message
     * @param prefix Le préfixe de commande
     * @param commandName Le nom de la commande
     * @return Un tableau d'arguments
     */
    public static String[] parseArgs(String content, String prefix, String commandName) {
        // Retirer le préfixe et le nom de la commande
        String argsString = content.substring(prefix.length() + commandName.length()).trim();

        // Si pas d'arguments, retourner un tableau vide
        if (argsString.isEmpty()) {
            return new String[0];
        }

        List<String> args = new ArrayList<>();
        StringBuilder currentArg = new StringBuilder();
        boolean inQuotes = false;

        // Parcourir chaque caractère de la chaîne d'arguments
        for (char c : argsString.toCharArray()) {
            if (c == '"') {
                // Basculer l'état des guillemets
                inQuotes = !inQuotes;
            } else if (c == ' ' && !inQuotes) {
                // Espace hors guillemets = séparateur d'argument
                if (currentArg.length() > 0) {
                    args.add(currentArg.toString());
                    currentArg = new StringBuilder();
                }
            } else {
                // Ajouter le caractère à l'argument en cours
                currentArg.append(c);
            }
        }

        // Ajouter le dernier argument s'il existe
        if (currentArg.length() > 0) {
            args.add(currentArg.toString());
        }

        return args.toArray(new String[0]);
    }

    /**
     * Extrait un membre à partir d'une mention ou d'un ID
     * 
     * @param event L'événement de message
     * @param arg L'argument contenant la mention ou l'ID
     * @return Le membre correspondant ou null
     */
    public static Member getMemberFromArg(MessageReceivedEvent event, String arg) {
        if (arg == null || arg.isEmpty()) {
            return null;
        }

        // Essayer d'extraire un ID à partir d'une mention
        String userId = MentionUtils.extractUserId(arg);

        // Si c'est une mention valide
        if (userId != null) {
            return event.getGuild().getMemberById(userId);
        }

        // Sinon, essayer d'utiliser l'argument directement comme ID
        if (arg.matches("\\d+")) {
            return event.getGuild().getMemberById(arg);
        }

        // Enfin, essayer de chercher par nom
        List<Member> members = event.getGuild().getMembersByName(arg, true);
        if (!members.isEmpty()) {
            return members.get(0); // Retourner le premier membre correspondant
        }

        return null;
    }

    /**
     * Crée un embed simple avec un titre et une description
     * 
     * @param title Le titre de l'embed
     * @param description La description de l'embed
     * @param color La couleur de l'embed
     * @return Un objet MessageEmbed
     */
    public static MessageEmbed createEmbed(String title, String description, Color color) {
        return new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor(color)
                .setTimestamp(Instant.now())
                .build();
    }

    /**
     * Crée un embed d'erreur
     * 
     * @param message Le message d'erreur
     * @return Un objet MessageEmbed
     */
    public static MessageEmbed createErrorEmbed(String message) {
        return createEmbed("❌ Erreur", message, Color.RED);
    }

    /**
     * Crée un embed de succès
     * 
     * @param message Le message de succès
     * @return Un objet MessageEmbed
     */
    public static MessageEmbed createSuccessEmbed(String message) {
        return createEmbed("✅ Succès", message, Color.GREEN);
    }

    /**
     * Crée un embed d'information
     * 
     * @param message Le message d'information
     * @return Un objet MessageEmbed
     */
    public static MessageEmbed createInfoEmbed(String message) {
        return createEmbed("ℹ️ Information", message, Color.BLUE);
    }

    /**
     * Extrait la raison d'une commande de modération
     * 
     * @param args Les arguments de la commande
     * @param startIndex L'index à partir duquel extraire la raison
     * @return La raison ou "Aucune raison spécifiée"
     */
    public static String getReason(String[] args, int startIndex) {
        if (args.length <= startIndex) {
            return "Aucune raison spécifiée";
        }

        return String.join(" ", java.util.Arrays.copyOfRange(args, startIndex, args.length));
    }

    /**
     * Convertit une durée textuelle en millisecondes
     * 
     * @param durationString La durée textuelle (ex: "1h", "30m", "1d")
     * @return La durée en millisecondes ou -1 si invalide
     */
    public static long parseDuration(String durationString) {
        if (durationString == null || durationString.isEmpty()) {
            return -1;
        }

        try {
            // Extraire le nombre et l'unité
            String numberPart = durationString.replaceAll("[^0-9]", "");
            String unitPart = durationString.replaceAll("[0-9]", "").toLowerCase();

            long number = Long.parseLong(numberPart);

            // Convertir en millisecondes selon l'unité
            switch (unitPart) {
                case "s":
                    return number * 1000; // Secondes
                case "m":
                    return number * 60 * 1000; // Minutes
                case "h":
                    return number * 60 * 60 * 1000; // Heures
                case "d":
                    return number * 24 * 60 * 60 * 1000; // Jours
                default:
                    return -1; // Unité invalide
            }
        } catch (NumberFormatException e) {
            return -1; // Format de nombre invalide
        }
    }
}
