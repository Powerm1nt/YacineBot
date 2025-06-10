package works.nuka.yassinebot.services;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.models.Conversation;
import works.nuka.yassinebot.models.Message;
import works.nuka.yassinebot.repositories.ConversationRepository;
import works.nuka.yassinebot.repositories.MessageRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Service pour gérer les conversations avec l'IA
 */
public class ConversationService {
    private static final Logger logger = LoggerFactory.getLogger(ConversationService.class);
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;

    public ConversationService() {
        this.conversationRepository = new ConversationRepository();
        this.messageRepository = new MessageRepository();
    }

    /**
     * Ajoute un message à une conversation existante ou crée une nouvelle conversation
     *
     * @param channelId ID du canal
     * @param userId ID de l'utilisateur
     * @param username Nom d'utilisateur
     * @param content Contenu du message
     * @param isAiMessage Indique si le message provient de l'IA
     * @param guildId ID du serveur (peut être null pour les DMs)
     * @return Le message créé
     */
    public Message addMessage(String channelId, String userId, String username, 
                             String content, boolean isAiMessage, String guildId) {
        try {
            // Rechercher ou créer la conversation
            Conversation conversation = getOrCreateConversation(channelId, guildId);

            // Créer le message
            Message message = new Message();
            message.setConversation(conversation);
            message.setUserId(userId);
            message.setUsername(username);
            message.setContent(content);
            message.setAiMessage(isAiMessage);

            // Enregistrer le message
            messageRepository.save(message);

            // Si c'est un message de l'IA, mettre à jour lastResponseId
            if (isAiMessage) {
                conversation.setLastResponseId(message.getId().toString());
                conversationRepository.update(conversation);
            }

            logger.debug("Message ajouté à la conversation {}: {}", conversation.getId(), content.substring(0, Math.min(50, content.length())));
            return message;
        } catch (Exception e) {
            logger.error("Erreur lors de l'ajout d'un message", e);
            throw new RuntimeException("Erreur lors de l'ajout du message", e);
        }
    }

    /**
     * Récupère ou crée une conversation pour un canal
     *
     * @param channelId ID du canal
     * @param guildId ID du serveur (peut être null)
     * @return La conversation existante ou nouvellement créée
     */
    public Conversation getOrCreateConversation(String channelId, String guildId) {
        try {
            // Rechercher la conversation existante
            Optional<Conversation> existingConversation = 
                    conversationRepository.findByChannelAndGuild(channelId, guildId);

            if (existingConversation.isPresent()) {
                return existingConversation.get();
            }

            // Créer une nouvelle conversation
            Conversation newConversation = new Conversation();
            newConversation.setChannelId(channelId);
            newConversation.setGuildId(guildId);
            conversationRepository.save(newConversation);

            logger.info("Nouvelle conversation créée pour le canal {} dans le serveur {}", 
                      channelId, guildId != null ? guildId : "DM");
            return newConversation;
        } catch (Exception e) {
            logger.error("Erreur lors de la récupération/création de la conversation", e);
            throw new RuntimeException("Erreur lors de la récupération/création de la conversation", e);
        }
    }

    /**
     * Récupère les derniers messages d'une conversation
     *
     * @param channelId ID du canal
     * @param guildId ID du serveur (peut être null)
     * @param limit Nombre maximum de messages à récupérer
     * @return Liste des derniers messages
     */
    public List<Message> getLastMessages(String channelId, String guildId, int limit) {
        try {
            // Rechercher la conversation
            Optional<Conversation> conversationOpt = 
                    conversationRepository.findByChannelAndGuild(channelId, guildId);

            if (conversationOpt.isEmpty()) {
                return List.of();
            }

            Conversation conversation = conversationOpt.get();
            return messageRepository.findLastMessagesByConversationId(conversation.getId(), limit);
        } catch (Exception e) {
            logger.error("Erreur lors de la récupération des derniers messages", e);
            throw new RuntimeException("Erreur lors de la récupération des derniers messages", e);
        }
    }

    /**
     * Récupère le dernier ID de réponse pour une conversation
     *
     * @param channelId ID du canal
     * @param guildId ID du serveur (peut être null)
     * @return Dernier ID de réponse ou null
     */
    public String getLastResponseId(String channelId, String guildId) {
        try {
            Optional<Conversation> conversationOpt = 
                    conversationRepository.findByChannelAndGuild(channelId, guildId);

            return conversationOpt.map(Conversation::getLastResponseId).orElse(null);
        } catch (Exception e) {
            logger.error("Erreur lors de la récupération du dernier ID de réponse", e);
            return null;
        }
    }

    /**
     * Réinitialise une conversation en supprimant tous ses messages
     *
     * @param channelId ID du canal
     * @param guildId ID du serveur (peut être null)
     * @return true si la réinitialisation a réussi, false sinon
     */
    public boolean resetConversation(String channelId, String guildId) {
        try {
            Optional<Conversation> conversationOpt = 
                    conversationRepository.findByChannelAndGuild(channelId, guildId);

            if (conversationOpt.isEmpty()) {
                return false;
            }

            Conversation conversation = conversationOpt.get();

            // Supprimer la conversation existante et en créer une nouvelle
            conversationRepository.delete(conversation);
            getOrCreateConversation(channelId, guildId);

            logger.info("Conversation réinitialisée pour le canal {} dans le serveur {}", 
                      channelId, guildId != null ? guildId : "DM");
            return true;
        } catch (Exception e) {
            logger.error("Erreur lors de la réinitialisation de la conversation", e);
            return false;
        }
    }

    /**
     * Enregistre un ID de réponse pour une conversation
     *
     * @param channelId ID du canal
     * @param guildId ID du serveur (peut être null)
     * @param responseId ID de la réponse
     */
    public void saveResponseId(String channelId, String guildId, String responseId) {
        try {
            Optional<Conversation> conversationOpt = 
                    conversationRepository.findByChannelAndGuild(channelId, guildId);

            if (conversationOpt.isEmpty()) {
                return;
            }

            Conversation conversation = conversationOpt.get();
            conversation.setLastResponseId(responseId);
            conversationRepository.update(conversation);

            logger.debug("ID de réponse {} enregistré pour la conversation {}", 
                       responseId, conversation.getId());
        } catch (Exception e) {
            logger.error("Erreur lors de l'enregistrement de l'ID de réponse", e);
        }
    }
}
