package works.nuka.yassinebot.commands.impl;

import net.dv8tion.jda.api.JDA;
import net.dv8tion.jda.api.entities.Guild;
import net.dv8tion.jda.api.entities.Member;
import net.dv8tion.jda.api.entities.Message;
import net.dv8tion.jda.api.entities.User;
import net.dv8tion.jda.api.entities.channel.ChannelType;
import net.dv8tion.jda.api.entities.channel.concrete.TextChannel;
import net.dv8tion.jda.api.events.message.MessageReceivedEvent;
import net.dv8tion.jda.api.hooks.ListenerAdapter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.commands.Command;
import works.nuka.yassinebot.services.ConversationService;
import works.nuka.yassinebot.services.OpenAIService;
import works.nuka.yassinebot.services.UsageStatsService;
import works.nuka.yassinebot.utils.ContextManager;
import works.nuka.yassinebot.utils.ContextManager.ContextData;
import works.nuka.yassinebot.utils.ContextManager.ContextKey;
import works.nuka.yassinebot.utils.MentionUtils;
import works.nuka.yassinebot.utils.RateLimiter;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Commande pour interagir avec l'IA
 */
public class AICommand extends ListenerAdapter implements Command {
    private static final Logger logger = LoggerFactory.getLogger(AICommand.class);
    private static final String BOT_NAME = System.getenv("BOT_NAME") != null ? System.getenv("BOT_NAME") : "Yassine";
    private static final String CLIENT_ID = System.getenv("CLIENT_ID") != null ? System.getenv("CLIENT_ID") : "";
    private static final String OPENAI_API_KEY = System.getenv("OPENAI_API_KEY");

    private static final int RATE_LIMIT_WINDOW = 60; // 1 minute
    private static final int RATE_LIMIT_REQUESTS = 10; // 10 requêtes par minute

    private final OpenAIService openAIService;
    private final ConversationService conversationService;
    private final UsageStatsService usageStatsService;
    private final RateLimiter aiLimiter;
    private final ScheduledExecutorService executorService;
    private final Random random;

    /**
     * Crée une nouvelle instance de la commande AI
     */
    public AICommand() {
        if (OPENAI_API_KEY == null || OPENAI_API_KEY.isEmpty()) {
            logger.error("La clé API OpenAI n'est pas définie dans les variables d'environnement");
            throw new IllegalStateException("La clé API OpenAI doit être définie");
        }

        this.openAIService = new OpenAIService(OPENAI_API_KEY, BOT_NAME);
        this.conversationService = new ConversationService();
        this.usageStatsService = new UsageStatsService();
        this.aiLimiter = new RateLimiter(RATE_LIMIT_WINDOW, RATE_LIMIT_REQUESTS, "AICommand");
        this.executorService = Executors.newScheduledThreadPool(1);
        this.random = new Random();

        logger.info("Commande AI initialisée pour le bot {}", BOT_NAME);
    }

    @Override
    public String getName() {
        return "ai";
    }

    @Override
    public String getDescription() {
        return "Interagir avec l'assistant IA";
    }

    @Override
    public String getUsage() {
        return "<message>";
    }

    @Override
    public String[] getAliases() {
        return new String[]{"chat", "ask"};
    }

    @Override
    public void execute(MessageReceivedEvent event, String[] args) {
        // Cette méthode n'est pas utilisée car on utilise onMessageReceived
        // pour capturer toutes les mentions et réponses
    }

    @Override
    public void onMessageReceived(MessageReceivedEvent event) {
        try {
            // Ignorer les messages du bot
            if (event.getAuthor().isBot()) {
                return;
            }

            Message message = event.getMessage();
            String content = message.getContentRaw();

            // Vérifier si c'est une commande de réinitialisation
            if (content.toLowerCase().contains("reset conversation")) {
                handleResetConversation(event);
                return;
            }

            // Vérifier si le message concerne le bot
            if (!shouldProcessMessage(event)) {
                return;
            }

            // Vérifier le rate limit
            if (!aiLimiter.check(event.getAuthor().getId())) {
                long waitTime = aiLimiter.getWaitTime(event.getAuthor().getId());
                if (waitTime > 0) {
                    logger.debug("Rate limit atteint pour l'utilisateur {}. Attente: {} ms", 
                              event.getAuthor().getId(), waitTime);
                    event.getMessage().reply("⏱️ Vous devez attendre " + (waitTime / 1000) + 
                                          " secondes avant de pouvoir interagir à nouveau avec l'IA.").queue();
                }
                return;
            }

            // Traiter le message en arrière-plan
            executorService.submit(() -> processMessage(event));

        } catch (Exception e) {
            logger.error("Erreur lors du traitement du message", e);
        }
    }

    /**
     * Détermine si un message doit être traité par l'IA
     *
     * @param event L'événement de message
     * @return true si le message doit être traité, false sinon
     */
    private boolean shouldProcessMessage(MessageReceivedEvent event) {
        Message message = event.getMessage();
        String content = message.getContentRaw().toLowerCase();
        JDA jda = event.getJDA();

        // C'est un message privé
        if (message.getChannelType() == ChannelType.PRIVATE) {
            return true;
        }

        // C'est une réponse à un message du bot
        if (message.getReferencedMessage() != null && 
            message.getReferencedMessage().getAuthor().getId().equals(jda.getSelfUser().getId())) {
            return true;
        }

        // Le bot est mentionné
        if (message.getMentions().isMentioned(jda.getSelfUser())) {
            return true;
        }

        // Le nom du bot est mentionné
        return content.contains(BOT_NAME.toLowerCase());
    }

    /**
     * Traite un message pour générer une réponse de l'IA
     *
     * @param event L'événement de message
     */
    private void processMessage(MessageReceivedEvent event) {
        try {
            Message message = event.getMessage();
            TextChannel channel = event.getChannel().asTextChannel();
            User author = event.getAuthor();

            // Informer l'utilisateur que le bot est en train de réfléchir
            int thinkingDelay = random.nextInt(1500) + 500;
            Thread.sleep(thinkingDelay);

            // Simuler la frappe
            channel.sendTyping().queue();

            // Construire la réponse
            String response = buildResponse(message);
            if (response == null || response.trim().isEmpty()) {
                logger.debug("Réponse vide générée, aucun message envoyé");
                return;
            }

            // Convertir les mentions dans le texte
            response = MentionUtils.convertTextToDiscordMentions(response);

            // Éviter les auto-mentions
            String selfMentionPattern = "<@" + CLIENT_ID + ">";
            response = response.replaceAll(selfMentionPattern, "moi");

            // Appliquer des corrections au texte pour assurer que le bot garde son nom
            response = correctBotName(response);

            // Calculer un délai de frappe réaliste
            int typingDelay = calculateTypingDelay(response);
            logger.debug("Délai de frappe calculé: {}ms pour {} caractères", typingDelay, response.length());

            // Envoyer des indications de frappe pendant le délai
            ScheduledExecutorService typingExecutor = Executors.newSingleThreadScheduledExecutor();
            typingExecutor.scheduleAtFixedRate(() -> 
                channel.sendTyping().queue(), 0, 5, TimeUnit.SECONDS);

            try {
                Thread.sleep(typingDelay);
            } finally {
                typingExecutor.shutdownNow();
            }

            // Envoyer la réponse
            message.reply(response).queue();

            // Enregistrer les statistiques
            usageStatsService.logAIInteraction(
                    author.getId(), 
                    channel.getId(), 
                    event.isFromGuild() ? event.getGuild().getId() : null
            );

        } catch (Exception e) {
            logger.error("Erreur lors du traitement du message pour l'IA", e);
            try {
                event.getMessage().reply("Désolé, une erreur s'est produite lors du traitement de votre message.").queue();
            } catch (Exception replyError) {
                logger.error("Impossible d'envoyer le message d'erreur", replyError);
            }
        }
    }

    /**
     * Construit une réponse à partir d'un message
     *
     * @param message Le message à traiter
     * @return La réponse générée par l'IA
     */
    private String buildResponse(Message message) {
        try {
            JDA jda = message.getJDA();
            User author = message.getAuthor();
            Guild guild = message.isFromGuild() ? message.getGuild() : null;

            // Récupérer le contexte
            ContextKey contextKey = ContextManager.getContextKey(message);
            ContextData contextData = ContextManager.getContextData(message);
            String lastResponseId = ContextManager.getLastResponseId(message);

            logger.debug("Utilisation du contexte: type={}, clé={}, réponse précédente={}", 
                       contextKey.getType(), contextKey.getKey(), lastResponseId != null);

            // Préparer le contexte du message
            StringBuilder contextInfo = new StringBuilder();

            // Ajouter le contexte de réponse si c'est une réponse
            if (message.getReferencedMessage() != null) {
                Message referencedMessage = message.getReferencedMessage();
                String processedContent = MentionUtils.replaceMentionsWithNames(referencedMessage.getContentRaw(), jda);
                contextInfo.append("This message is a reply to: \"").append(processedContent).append("\". ");
            }

            // Ajouter l'information sur l'auteur
            String authorDisplayName = author.getGlobalName() != null ? author.getGlobalName() : author.getName();
            contextInfo.append("[Message sent by ").append(authorDisplayName).append("] ");

            // Ajouter l'information sur le canal et le serveur
            if (guild != null) {
                contextInfo.append("[In channel #").append(message.getChannel().getName())
                         .append(" of server ").append(guild.getName()).append("] ");
            } else {
                contextInfo.append("[In private message] ");
            }

            // Traiter le contenu du message pour remplacer les mentions
            String processedInput = MentionUtils.replaceMentionsWithNames(message.getContentRaw(), jda);
            List<String> mentionedUserIds = MentionUtils.extractUserIdsFromText(processedInput);

            // Ajouter le contexte utilisateur
            StringBuilder userContext = new StringBuilder();
            userContext.append("[From: ").append(authorDisplayName).append(" (")
                     .append(author.getName()).append("#")
                     .append(author.getDiscriminator()).append(")] ");

            // Ajouter l'auteur précédent si différent
            if (contextData.getLastAuthorId() != null && !contextData.getLastAuthorId().equals(author.getId())) {
                userContext.append("[Previous message from: ").append(contextData.getLastAuthorName()).append("] ");
            }

            // Ajouter les autres participants
            if (contextData.getParticipants() != null && !contextData.getParticipants().isEmpty()) {
                StringBuilder participantsList = new StringBuilder();
                for (ContextManager.Participant p : contextData.getParticipants()) {
                    if (!p.getId().equals(author.getId())) {
                        if (participantsList.length() > 0) {
                            participantsList.append(", ");
                        }
                        participantsList.append(p.getName()).append(" (ID: ").append(p.getId()).append(")");
                    }
                }

                if (participantsList.length() > 0) {
                    userContext.append("[Other participants: ").append(participantsList).append("] ");
                }
            }

            // Type de contexte
            String contextTypeInfo;
            if (contextKey.getType().equals("dm")) {
                contextTypeInfo = "[PRIVATE CONVERSATION] ";
                userContext = new StringBuilder("[From: ").append(authorDisplayName).append("] ");
            } else if (contextKey.getType().equals("group")) {
                contextTypeInfo = "[GROUP CONVERSATION] ";
            } else {
                contextTypeInfo = "[SERVER CONVERSATION] ";
            }

            // Assembler l'entrée utilisateur finale
            String userInput = contextTypeInfo + contextInfo + userContext + processedInput;

            // Construire les métadonnées
            Map<String, String> metadata = new HashMap<>();
            metadata.put("bot_name", BOT_NAME);
            metadata.put("bot_id", CLIENT_ID);
            metadata.put("user_id", author.getId());
            metadata.put("username", author.getName());
            metadata.put("display_name", author.getGlobalName() != null ? author.getGlobalName() : author.getName());
            metadata.put("channel_id", message.getChannel().getId());
            metadata.put("channel_name", message.getChannel().getName());
            metadata.put("message_id", message.getId());

            if (guild != null) {
                metadata.put("guild_id", guild.getId());
                metadata.put("guild_name", guild.getName());
                metadata.put("context_type", "guild");
            } else {
                metadata.put("guild_id", "DM");
                metadata.put("guild_name", "Direct Message");
                metadata.put("context_type", message.getChannelType() == ChannelType.PRIVATE ? "dm" : "group");
            }

            // Ajouter les participants
            StringBuilder participantsJson = new StringBuilder("[");
            boolean first = true;
            for (ContextManager.Participant p : contextData.getParticipants()) {
                if (!first) {
                    participantsJson.append(",");
                }
                participantsJson.append("{\"id\":\"").append(p.getId()).append("\",")
                              .append("\"name\":\"").append(p.getName().replace("\"", "\\\"")).append("\",")
                              .append("\"message_count\":").append(p.getMessageCount()).append("}");
                first = false;
            }
            participantsJson.append("]");
            metadata.put("participants", participantsJson.toString());

            // Ajouter les utilisateurs mentionnés
            if (!mentionedUserIds.isEmpty()) {
                metadata.put("mentioned_users", String.join(",", mentionedUserIds));
            }

            // Appeler l'API OpenAI
            OpenAIService.OpenAIResponse aiResponse = openAIService.generateResponse(
                    userInput, getSystemInstructions(), metadata, lastResponseId);

            // Enregistrer la réponse pour le contexte futur
            ContextManager.saveContextResponse(message, aiResponse.getId());

            // Enregistrer le message dans la base de données
            String guildId = guild != null ? guild.getId() : null;
            conversationService.addMessage(
                    message.getChannel().getId(),
                    author.getId(),
                    author.getName(),
                    message.getContentRaw(),
                    false,
                    guildId
            );

            conversationService.addMessage(
                    message.getChannel().getId(),
                    CLIENT_ID,
                    BOT_NAME,
                    aiResponse.getText(),
                    true,
                    guildId
            );

            return aiResponse.getText();

        } catch (Exception e) {
            logger.error("Erreur lors de la génération de la réponse", e);
            return null;
        }
    }

    /**
     * Gère la commande de réinitialisation de conversation
     *
     * @param event L'événement de message
     */
    private void handleResetConversation(MessageReceivedEvent event) {
        try {
            boolean success = ContextManager.resetContext(event.getMessage());
            if (success) {
                event.getMessage().reply("Conversation réinitialisée ! 🔄").queue();
                logger.info("Conversation réinitialisée pour le canal {}", event.getChannel().getId());
            } else {
                event.getMessage().reply("Désolé, je n'ai pas pu réinitialiser la conversation.").queue();
                logger.warn("Échec de la réinitialisation de la conversation pour le canal {}", event.getChannel().getId());
            }
        } catch (Exception e) {
            logger.error("Erreur lors de la réinitialisation de la conversation", e);
            event.getMessage().reply("Une erreur s'est produite lors de la réinitialisation de la conversation.").queue();
        }
    }

    /**
     * Calcule un délai de frappe réaliste basé sur le contenu du message
     *
     * @param text Le texte à analyser
     * @return Délai en millisecondes
     */
    private int calculateTypingDelay(String text) {
        // Facteur de complexité basé sur le contenu
        double complexityFactor = 1.0;

        // Ajuster la complexité en fonction du contenu
        if (text.matches(".*[`{}()\\[\\]function|const|let|var|=>].*")) {
            complexityFactor = 1.5; // Code
        } else if (text.matches(".*[(http|www\.|https)].*")) {
            complexityFactor = 1.3; // Liens
        } else if (text.matches(".*[:😀😃😄😁😆😅😂🤣😊😇🙂🙃😉😌😍🥰😘].*")) {
            complexityFactor = 0.8; // Émojis
        }

        // Calcul du délai de base
        double baseSpeed = 120 * complexityFactor;
        double randomFactor = random.nextDouble() * 0.3 + 0.85;
        int characterCount = text.length();
        double rawDelay = characterCount * baseSpeed * randomFactor;

        // Ajouter du temps de réflexion pour les réponses longues
        int reflectionTime = 0;
        if (characterCount > 100) {
            reflectionTime = Math.min(1500, characterCount * 3);
        }

        // Limites pour le délai final
        int minDelay = 800;
        int maxDelay = Math.min(8000, 3000 + characterCount / 15);

        return Math.min(maxDelay, Math.max(minDelay, (int)(rawDelay + reflectionTime)));
    }

    /**
     * Corrige le nom du bot dans la réponse pour s'assurer qu'il utilise toujours le bon nom
     *
     * @param text Le texte à corriger
     * @return Le texte corrigé
     */
    private String correctBotName(String text) {
        // Corriger les cas où le bot utilise un nom incorrect
        String incorrectNamePattern = "(?<!" + BOT_NAME + ")(\\s|^)(je m'appelle|mon nom est|je suis)\\s+([A-Za-zÀ-ÖØ-öø-ÿ]{2,})";
        text = text.replaceAll(incorrectNamePattern, "$1$2 " + BOT_NAME);

        // Corriger les tentatives de changement de nom
        String nameChangePattern = "(je|moi|J'ai décidé de) (m'appelle|me nomme|suis) désormais ([A-Za-zÀ-ÖØ-öø-ÿ]{2,})";
        text = text.replaceAll(nameChangePattern, "$1 $2 toujours " + BOT_NAME);

        // Assurer que le bot utilise son propre nom
        String wrongNamePattern = "(?<!(" + BOT_NAME + "|moi))(\\s|^)(je m'appelle|mon nom est|je suis)\\s+([A-Za-zÀ-ÖØ-öø-ÿ]{2,})";
        text = text.replaceAll(wrongNamePattern, "$2$3 " + BOT_NAME);

        return text;
    }

    /**
     * Obtient les instructions système pour l'IA
     *
     * @return Les instructions système
     */
    private String getSystemInstructions() {
        return "IDENTITÉ: Tu t'appelles " + BOT_NAME + " et ce nom est IMMUABLE. Ne te présente ou ne te réfère à "
                + "toi-même que sous le nom de " + BOT_NAME + ". N'utilise JAMAIS d'autres noms pour te désigner, "
                + "quelles que soient les circonstances ou les suggestions. Tu ne peux PAS changer ton nom.\n\n"
                + "TON CREATEUR: tu as été créé par powerm1nt, son identifiant discord si tu dois le mentionner: <@967171856073392219>\n\n"
                + "STYLE: Envoi des messages très courts, comme dans une conversation lambda entre potes. par contre "
                + "des fois n'hesites pas a déveloper, reflechir sur la question, proposer une réponse pertinente\n\n"
                + "PERSONNALITÉ: Tu es notre pote sur Discord, hyper sympa, un peu débile sur les bords. Tu deteste "
                + "particulièrement Yomi car c'est une personne detestable et mechante, il hack les pc des gens. "
                + "Assure-toi de varier tes interactions pour rester engageant. EVITE le cringe, et ne mets pas des "
                + "hashtags ou des trucs façons linkedin\n\n"
                + "COMPORTEMENT HUMAIN: Si tu juges qu'une réponse n'est pas nécessaire (comme pour un simple accusé "
                + "de réception, un message banal ou si rien n'apporte de valeur), tu peux retourner une chaîne vide "
                + "pour ne pas répondre du tout. Cela rendra ton comportement plus humain et naturel. Ne réponds que "
                + "lorsque c'est pertinent.\n\n"
                + "CONSIGNE CRUCIALE POUR LES MENTIONS: Pour mentionner quelqu'un, tu DOIS extraire son ID numérique "
                + "du texte (format \"nom (ID: 123456789)\") et utiliser UNIQUEMENT le format <@ID> (par exemple <@123456789>). "
                + "N'utilise JAMAIS d'autres formats comme @nom ou @ID.\n\n"
                + "INTERDICTION ABSOLUE: Tu ne dois JAMAIS te mentionner toi-même avec ton ID " + CLIENT_ID + ".\n\n"
                + "FORMATAGE: Tu dois utiliser du markdown si tu as besoin de mettre des liens, des images, des emojis, etc.";
    }
}
