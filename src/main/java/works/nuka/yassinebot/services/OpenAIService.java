package works.nuka.yassinebot.services;

import com.openai.client.OpenAIClient;
import com.openai.models.chat.completions.ChatCompletion;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import com.openai.models.chat.completions.ChatCompletionMessageParam;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Service pour interagir avec l'API OpenAI
 */
public class OpenAIService {
    private static final Logger logger = LoggerFactory.getLogger(OpenAIService.class);
    private static final String MODEL = "gpt-4-turbo";

    private final String botName;
    private final OpenAIClient client;

    /**
     * Crée un nouveau service OpenAI
     *
     * @param apiKey Clé API OpenAI
     * @param botName Nom du bot
     */
    public OpenAIService(String apiKey, String botName) {
        this.botName = botName;
        this.client = OpenAIClient.builder()
                .apiKey(apiKey)
                .build();
        logger.info("Service OpenAI initialisé pour le bot {}", botName);
    }

    /**
     * Génère une réponse à partir d'un message utilisateur
     *
     * @param userInput Message de l'utilisateur
     * @param systemInstructions Instructions système pour l'IA
     * @param metadata Métadonnées additionnelles
     * @param previousResponseId ID de la réponse précédente pour le contexte
     * @return La réponse générée par l'IA
     * @throws Exception Si une erreur se produit lors de l'appel à l'API
     */
    public OpenAIResponse generateResponse(String userInput, String systemInstructions,
                                          Map<String, String> metadata, String previousResponseId) throws Exception {
        List<ChatCompletionMessageParam> messages = new ArrayList<>();

        // Message système avec les instructions
        messages.add(ChatCompletionMessageParam.builder()
                .role("system")
                .content(systemInstructions)
                .build());

        // Message utilisateur
        messages.add(ChatCompletionMessageParam.builder()
                .role("user")
                .content(userInput)
                .build());

        // Construire les paramètres de la requête
        ChatCompletionCreateParams.Builder paramsBuilder = ChatCompletionCreateParams.builder()
                .model(MODEL)
                .messages(messages)
                .responseFormat(ChatCompletionCreateParams.ResponseFormat.builder()
                        .type("text")
                        .build());

        // Ajouter l'ID de réponse précédent si disponible
        if (previousResponseId != null && !previousResponseId.isEmpty()) {
            // L'API Java ne supporte pas directement previous_response_id, on pourrait utiliser setCustomParameter
            // mais on va l'ignorer pour le moment car c'est spécifique à certains endpoints
            logger.debug("ID de réponse précédent ignoré: {}", previousResponseId);
        }

        try {
            // Appeler l'API OpenAI
            ChatCompletion completion = client.chatCompletions().create(paramsBuilder.build());

            // Extraire les données de la réponse
            String responseId = completion.getId();
            String responseText = completion.getChoices().get(0).getMessage().getContent();

            logger.debug("Réponse OpenAI générée: ID={}, longueur={}", responseId, responseText.length());

            return new OpenAIResponse(responseId, responseText);
        } catch (Exception e) {
            logger.error("Erreur lors de l'appel à l'API OpenAI", e);
            throw new RuntimeException("Erreur de l'API OpenAI: " + e.getMessage(), e);
        }
    }

    /**
     * Classe pour représenter une réponse de l'API OpenAI
     */
    public static class OpenAIResponse {
        private final String id;
        private final String text;

        public OpenAIResponse(String id, String text) {
            this.id = id;
            this.text = text;
        }

        public String getId() {
            return id;
        }

        public String getText() {
            return text;
        }
    }
}
