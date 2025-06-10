package works.nuka.yassinebot.utils;

import net.dv8tion.jda.api.entities.Guild;
import net.dv8tion.jda.api.entities.Message;
import net.dv8tion.jda.api.entities.User;
import net.dv8tion.jda.api.entities.channel.Channel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.services.ConversationService;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Gestionnaire de contexte pour les conversations avec l'IA
 */
public class ContextManager {
    private static final Logger logger = LoggerFactory.getLogger(ContextManager.class);
    private static final ConversationService conversationService = new ConversationService();
    private static final int MAX_MESSAGES = 20;

    /**
     * Classe pour représenter un participant à une conversation
     */
    public static class Participant {
        private String id;
        private String name;
        private int messageCount;

        public Participant(String id, String name) {
            this.id = id;
            this.name = name;
            this.messageCount = 1;
        }

        public String getId() {
            return id;
        }

        public String getName() {
            return name;
        }

        public int getMessageCount() {
            return messageCount;
        }

        public void incrementMessageCount() {
            this.messageCount++;
        }
    }

    /**
     * Classe pour représenter le contexte d'une conversation
     */
    public static class ContextData {
        private String lastAuthorId;
        private String lastAuthorName;
        private List<Participant> participants = new ArrayList<>();

        public String getLastAuthorId() {
            return lastAuthorId;
        }

        public void setLastAuthorId(String lastAuthorId) {
            this.lastAuthorId = lastAuthorId;
        }

        public String getLastAuthorName() {
            return lastAuthorName;
        }

        public void setLastAuthorName(String lastAuthorName) {
            this.lastAuthorName = lastAuthorName;
        }

        public List<Participant> getParticipants() {
            return participants;
        }

        public void addParticipant(Participant participant) {
            // Vérifier si le participant existe déjà
            for (Participant p : participants) {
                if (p.getId().equals(participant.getId())) {
                    p.incrementMessageCount();
                    return;
                }
            }
            participants.add(participant);
        }
    }

    /**
     * Classe pour représenter la clé de contexte pour une conversation
     */
    public static class ContextKey {
        private String type; // "dm", "group", or "guild"
        private String key;  // channel ID

        public ContextKey(String type, String key) {
            this.type = type;
            this.key = key;
        }

        public String getType() {
            return type;
        }

        public String getKey() {
            return key;
        }
    }

    /**
     * Récupère la clé de contexte pour un message
     *
     * @param message Le message
     * @return La clé de contexte
     */
    public static ContextKey getContextKey(Message message) {
        Channel channel = message.getChannel();
        Guild guild = message.getGuild();

        String channelId = channel.getId();
        String type = "guild";

        if (guild == null) {
            type = channel.getType().isGroup() ? "group" : "dm";
        }

        return new ContextKey(type, channelId);
    }

    /**
     * Récupère les données de contexte pour un message
     *
     * @param message Le message
     * @return Les données de contexte
     */
    public static ContextData getContextData(Message message) {
        ContextKey contextKey = getContextKey(message);
        String channelId = contextKey.getKey();
        String guildId = message.isFromGuild() ? message.getGuild().getId() : null;

        // Créer de nouvelles données de contexte
        ContextData contextData = new ContextData();

        // Récupérer les derniers messages pour construire le contexte
        List<works.nuka.yassinebot.models.Message> messages = 
                conversationService.getLastMessages(channelId, guildId, MAX_MESSAGES);

        // Construire le contexte à partir des messages
        Map<String, Participant> participantsMap = new HashMap<>();

        for (works.nuka.yassinebot.models.Message msg : messages) {
            String userId = msg.getUserId();
            String username = msg.getUsername();

            // Ajouter le participant s'il n'existe pas déjà
            if (!participantsMap.containsKey(userId)) {
                participantsMap.put(userId, new Participant(userId, username));
            } else {
                participantsMap.get(userId).incrementMessageCount();
            }

            // Mettre à jour le dernier auteur
            if (!msg.isAiMessage()) {
                contextData.setLastAuthorId(userId);
                contextData.setLastAuthorName(username);
            }
        }

        // Ajouter l'utilisateur actuel s'il n'a pas encore participé
        User author = message.getAuthor();
        String authorId = author.getId();
        if (!participantsMap.containsKey(authorId)) {
            participantsMap.put(authorId, new Participant(authorId, author.getName()));
        }

        // Ajouter tous les participants au contexte
        participantsMap.values().forEach(contextData::addParticipant);

        return contextData;
    }

    /**
     * Enregistre l'ID de réponse de l'IA pour une conversation
     *
     * @param message Le message original
     * @param responseId L'ID de réponse de l'IA
     */
    public static void saveContextResponse(Message message, String responseId) {
        if (responseId == null || responseId.isEmpty()) {
            logger.warn("Tentative d'enregistrement d'un ID de réponse vide");
            return;
        }

        String channelId = message.getChannel().getId();
        String guildId = message.isFromGuild() ? message.getGuild().getId() : null;

        conversationService.saveResponseId(channelId, guildId, responseId);
    }

    /**
     * Récupère le dernier ID de réponse pour une conversation
     *
     * @param message Le message
     * @return Le dernier ID de réponse, ou null si aucun
     */
    public static String getLastResponseId(Message message) {
        String channelId = message.getChannel().getId();
        String guildId = message.isFromGuild() ? message.getGuild().getId() : null;

        return conversationService.getLastResponseId(channelId, guildId);
    }

    /**
     * Réinitialise le contexte d'une conversation
     *
     * @param message Le message
     * @return true si la réinitialisation a réussi, false sinon
     */
    public static boolean resetContext(Message message) {
        String channelId = message.getChannel().getId();
        String guildId = message.isFromGuild() ? message.getGuild().getId() : null;

        return conversationService.resetConversation(channelId, guildId);
    }
}
