package works.nuka.yassinebot.utils;

import net.dv8tion.jda.api.EmbedBuilder;
import net.dv8tion.jda.api.entities.Message;
import net.dv8tion.jda.api.entities.MessageEmbed;
import net.dv8tion.jda.api.entities.channel.middleman.MessageChannel;
import net.dv8tion.jda.api.requests.restaction.MessageCreateAction;

import java.awt.Color;
import java.time.Instant;
import java.util.concurrent.TimeUnit;

/**
 * Utilitaire pour faciliter la manipulation des messages Discord
 */
public class MessageUtils {

    /**
     * Envoie un message texte simple
     * 
     * @param channel Le canal où envoyer le message
     * @param content Le contenu du message
     * @return L'action de création du message
     */
    public static MessageCreateAction sendMessage(MessageChannel channel, String content) {
        return channel.sendMessage(content);
    }

    /**
     * Envoie un embed simple avec un titre et une description
     * 
     * @param channel Le canal où envoyer l'embed
     * @param title Le titre de l'embed
     * @param description La description de l'embed
     * @param color La couleur de l'embed
     * @return L'action de création du message
     */
    public static MessageCreateAction sendEmbed(MessageChannel channel, String title, 
                                                String description, Color color) {
        MessageEmbed embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor(color)
                .setTimestamp(Instant.now())
                .build();

        return channel.sendMessageEmbeds(embed);
    }

    /**
     * Envoie un message d'erreur en embed
     * 
     * @param channel Le canal où envoyer le message
     * @param message Le message d'erreur
     * @return L'action de création du message
     */
    public static MessageCreateAction sendError(MessageChannel channel, String message) {
        return sendEmbed(channel, "❌ Erreur", message, Color.RED);
    }

    /**
     * Envoie un message de succès en embed
     * 
     * @param channel Le canal où envoyer le message
     * @param message Le message de succès
     * @return L'action de création du message
     */
    public static MessageCreateAction sendSuccess(MessageChannel channel, String message) {
        return sendEmbed(channel, "✅ Succès", message, Color.GREEN);
    }

    /**
     * Envoie un message d'information en embed
     * 
     * @param channel Le canal où envoyer le message
     * @param message Le message d'information
     * @return L'action de création du message
     */
    public static MessageCreateAction sendInfo(MessageChannel channel, String message) {
        return sendEmbed(channel, "ℹ️ Information", message, Color.BLUE);
    }

    /**
     * Envoie un message temporaire qui sera supprimé après un délai
     * 
     * @param channel Le canal où envoyer le message
     * @param content Le contenu du message
     * @param duration La durée en secondes avant suppression
     */
    public static void sendTemporaryMessage(MessageChannel channel, String content, int duration) {
        channel.sendMessage(content).queue(message -> 
            message.delete().queueAfter(duration, TimeUnit.SECONDS)
        );
    }

    /**
     * Envoie un message embed temporaire qui sera supprimé après un délai
     * 
     * @param channel Le canal où envoyer le message
     * @param title Le titre de l'embed
     * @param description La description de l'embed
     * @param color La couleur de l'embed
     * @param duration La durée en secondes avant suppression
     */
    public static void sendTemporaryEmbed(MessageChannel channel, String title, 
                                         String description, Color color, int duration) {
        MessageEmbed embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor(color)
                .setTimestamp(Instant.now())
                .build();

        channel.sendMessageEmbeds(embed).queue(message -> 
            message.delete().queueAfter(duration, TimeUnit.SECONDS)
        );
    }

    /**
     * Supprime un message après un délai
     * 
     * @param message Le message à supprimer
     * @param duration La durée en secondes avant suppression
     */
    public static void deleteAfter(Message message, int duration) {
        message.delete().queueAfter(duration, TimeUnit.SECONDS);
    }

    /**
     * Édite un message existant
     * 
     * @param message Le message à éditer
     * @param newContent Le nouveau contenu du message
     */
    public static void editMessage(Message message, String newContent) {
        message.editMessage(newContent).queue();
    }

    /**
     * Édite un embed existant
     * 
     * @param message Le message contenant l'embed à éditer
     * @param newEmbed Le nouvel embed
     */
    public static void editEmbed(Message message, MessageEmbed newEmbed) {
        message.editMessageEmbeds(newEmbed).queue();
    }

    /**
     * Crée un embed de charge (loading)
     * 
     * @param description Le message de chargement
     * @return Un embed de chargement
     */
    public static MessageEmbed createLoadingEmbed(String description) {
        return new EmbedBuilder()
                .setTitle("⏳ Chargement")
                .setDescription(description)
                .setColor(Color.ORANGE)
                .setTimestamp(Instant.now())
                .build();
    }

    /**
     * Convertit un texte en chunks pour respecter la limite de Discord
     * 
     * @param text Le texte à diviser
     * @param chunkSize La taille maximale de chaque chunk
     * @return Un tableau de chunks
     */
    public static String[] splitMessage(String text, int chunkSize) {
        if (text == null || text.isEmpty()) {
            return new String[0];
        }

        if (text.length() <= chunkSize) {
            return new String[] { text };
        }

        int parts = (int) Math.ceil((double) text.length() / chunkSize);
        String[] result = new String[parts];

        for (int i = 0; i < parts; i++) {
            int start = i * chunkSize;
            int end = Math.min((i + 1) * chunkSize, text.length());
            result[i] = text.substring(start, end);
        }

        return result;
    }
}
