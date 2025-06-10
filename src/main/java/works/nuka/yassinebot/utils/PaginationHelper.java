package works.nuka.yassinebot.utils;

import net.dv8tion.jda.api.EmbedBuilder;
import net.dv8tion.jda.api.entities.Message;
import net.dv8tion.jda.api.entities.MessageEmbed;
import net.dv8tion.jda.api.entities.emoji.Emoji;
import net.dv8tion.jda.api.events.interaction.component.ButtonInteractionEvent;
import net.dv8tion.jda.api.hooks.ListenerAdapter;
import net.dv8tion.jda.api.interactions.components.ActionRow;
import net.dv8tion.jda.api.interactions.components.buttons.Button;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Utilitaire pour créer des messages paginés
 */
public class PaginationHelper {
    private static final Logger logger = LoggerFactory.getLogger(PaginationHelper.class);

    private final List<MessageEmbed> pages;
    private final long userId;
    private int currentPage = 0;
    private Message message;

    /**
     * Crée un nouveau gestionnaire de pagination
     *
     * @param pages Liste des pages (embeds)
     * @param userId ID de l'utilisateur autorisé à naviguer
     */
    public PaginationHelper(List<MessageEmbed> pages, long userId) {
        this.pages = new ArrayList<>(pages);
        this.userId = userId;

        if (this.pages.isEmpty()) {
            this.pages.add(new EmbedBuilder()
                    .setDescription("Aucun contenu disponible")
                    .build());
        }
    }

    /**
     * Crée un nouveau gestionnaire de pagination à partir de contenu divisé en pages
     *
     * @param content Contenu à paginer
     * @param pageSize Taille maximum de chaque page
     * @param title Titre des embeds
     * @param userId ID de l'utilisateur autorisé à naviguer
     */
    public PaginationHelper(String content, int pageSize, String title, long userId) {
        this.userId = userId;
        this.pages = new ArrayList<>();

        // Diviser le contenu en pages
        if (content == null || content.isEmpty()) {
            this.pages.add(new EmbedBuilder()
                    .setTitle(title)
                    .setDescription("Aucun contenu disponible")
                    .build());
        } else {
            List<String> chunks = splitContent(content, pageSize);
            for (int i = 0; i < chunks.size(); i++) {
                this.pages.add(new EmbedBuilder()
                        .setTitle(title + " - Page " + (i + 1) + "/" + chunks.size())
                        .setDescription(chunks.get(i))
                        .build());
            }
        }
    }

    /**
     * Divise un texte en morceaux de taille maximum spécifiée
     *
     * @param content Le contenu à diviser
     * @param chunkSize La taille maximum de chaque morceau
     * @return Liste des morceaux de texte
     */
    private List<String> splitContent(String content, int chunkSize) {
        List<String> chunks = new ArrayList<>();
        int length = content.length();

        for (int i = 0; i < length; i += chunkSize) {
            chunks.add(content.substring(i, Math.min(length, i + chunkSize)));
        }

        return chunks;
    }

    /**
     * Envoie le message paginé en réponse à un autre message
     *
     * @param originalMessage Le message auquel répondre
     * @param timeoutSeconds Délai d'expiration en secondes
     */
    public void send(Message originalMessage, int timeoutSeconds) {
        MessageEmbed currentEmbed = getCurrentPage();

        // Créer les boutons de navigation
        List<Button> buttons = createNavigationButtons();

        originalMessage.replyEmbeds(currentEmbed)
                .setActionRow(buttons)
                .queue(message -> {
                    this.message = message;

                    // Ajouter le listener pour les interactions
                    message.getJDA().addEventListener(new ButtonListener());

                    // Supprimer les boutons après le délai
                    if (timeoutSeconds > 0) {
                        message.editMessageComponents(ActionRow.of(createDisabledButtons()))
                                .queueAfter(timeoutSeconds, TimeUnit.SECONDS, msg -> {
                                    message.getJDA().removeEventListener(ButtonListener.class);
                                }, error -> {
                                    logger.error("Erreur lors de la désactivation des boutons", error);
                                });
                    }
                });
    }

    /**
     * Crée les boutons de navigation
     *
     * @return Liste des boutons
     */
    private List<Button> createNavigationButtons() {
        List<Button> buttons = new ArrayList<>();

        buttons.add(Button.primary("first", Emoji.fromUnicode("⏮️"))
                .withDisabled(currentPage == 0));

        buttons.add(Button.primary("prev", Emoji.fromUnicode("◀️"))
                .withDisabled(currentPage == 0));

        buttons.add(Button.secondary("page", (currentPage + 1) + "/" + pages.size())
                .withDisabled(true));

        buttons.add(Button.primary("next", Emoji.fromUnicode("▶️"))
                .withDisabled(currentPage >= pages.size() - 1));

        buttons.add(Button.primary("last", Emoji.fromUnicode("⏭️"))
                .withDisabled(currentPage >= pages.size() - 1));

        return buttons;
    }

    /**
     * Crée des boutons désactivés pour l'expiration
     *
     * @return Liste des boutons désactivés
     */
    private List<Button> createDisabledButtons() {
        List<Button> buttons = new ArrayList<>();

        buttons.add(Button.primary("first", Emoji.fromUnicode("⏮️")).asDisabled());
        buttons.add(Button.primary("prev", Emoji.fromUnicode("◀️")).asDisabled());
        buttons.add(Button.secondary("page", (currentPage + 1) + "/" + pages.size()).asDisabled());
        buttons.add(Button.primary("next", Emoji.fromUnicode("▶️")).asDisabled());
        buttons.add(Button.primary("last", Emoji.fromUnicode("⏭️")).asDisabled());

        return buttons;
    }

    /**
     * Récupère l'embed de la page actuelle
     *
     * @return L'embed de la page actuelle
     */
    private MessageEmbed getCurrentPage() {
        return pages.get(currentPage);
    }

    /**
     * Classe interne pour gérer les interactions avec les boutons
     */
    private class ButtonListener extends ListenerAdapter {
        @Override
        public void onButtonInteraction(ButtonInteractionEvent event) {
            // Vérifier si c'est le bon message et le bon utilisateur
            if (message == null || event.getMessage().getIdLong() != message.getIdLong() || 
                event.getUser().getIdLong() != userId) {
                return;
            }

            // Traiter l'action du bouton
            switch (event.getComponentId()) {
                case "first" -> currentPage = 0;
                case "prev" -> currentPage = Math.max(0, currentPage - 1);
                case "next" -> currentPage = Math.min(pages.size() - 1, currentPage + 1);
                case "last" -> currentPage = pages.size() - 1;
                default -> { return; }  // Ignorer les autres boutons
            }

            // Mettre à jour le message
            event.editMessageEmbeds(getCurrentPage())
                  .setActionRow(createNavigationButtons())
                  .queue();
        }
    }
}
