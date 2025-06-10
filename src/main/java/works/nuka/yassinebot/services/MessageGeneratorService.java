package works.nuka.yassinebot.services;

import java.util.Arrays;
import java.util.List;
import java.util.Random;

/**
 * Service pour générer des messages dynamiques
 * Utilisé principalement pour les messages automatiques programmés
 */
public class MessageGeneratorService {

    private final Random random = new Random();
    private final OpenAIService openAIService;

    // Listes de questions et prompts prédéfinis
    private final List<String> generalQuestions = Arrays.asList(
        "Qu'est-ce qui vous rend heureux aujourd'hui ?",
        "Si vous pouviez voyager n'importe où, où iriez-vous ?",
        "Quelle est votre passion secrète ?",
        "Quel est votre film préféré et pourquoi ?",
        "Si vous pouviez avoir un super pouvoir, lequel choisiriez-vous ?",
        "Quel est votre plat préféré ?",
        "Quelle est la meilleure chose qui vous soit arrivée cette semaine ?",
        "Partagez un objectif que vous souhaitez atteindre cette année",
        "Quel est votre livre préféré ?",
        "Quelle compétence aimeriez-vous maîtriser ?"
    );

    private final List<String> techQuestions = Arrays.asList(
        "Quelle technologie vous enthousiasme le plus en ce moment ?",
        "Quel langage de programmation préférez-vous et pourquoi ?",
        "Partagez un projet technique sur lequel vous travaillez",
        "Quel est votre gadget tech préféré ?",
        "Quelle est votre opinion sur l'IA ?"
    );

    private final List<String> gameQuestions = Arrays.asList(
        "À quel jeu jouez-vous en ce moment ?",
        "Quel est votre jeu vidéo préféré de tous les temps ?",
        "Quel personnage de jeu vidéo aimeriez-vous être ?",
        "Partagez un moment mémorable que vous avez vécu dans un jeu",
        "Console ou PC? Défendez votre choix!"
    );

    /**
     * Constructeur du générateur de messages
     * 
     * @param openAIService Service OpenAI pour la génération avancée
     */
    public MessageGeneratorService(OpenAIService openAIService) {
        this.openAIService = openAIService;
    }

    /**
     * Génère une question aléatoire parmi les questions prédéfinies
     * 
     * @return Une question aléatoire
     */
    public String generateRandomQuestion() {
        // Combine toutes les listes de questions
        List<String> allQuestions = Arrays.asList(
            getRandomFromList(generalQuestions),
            getRandomFromList(techQuestions),
            getRandomFromList(gameQuestions)
        );

        return getRandomFromList(allQuestions);
    }

    /**
     * Génère une question sur un sujet spécifique
     * 
     * @param topic Le sujet ("general", "tech", "game")
     * @return Une question sur le sujet demandé
     */
    public String generateQuestionOnTopic(String topic) {
        switch (topic.toLowerCase()) {
            case "tech":
            case "technologie":
                return getRandomFromList(techQuestions);
            case "game":
            case "jeu":
            case "gaming":
                return getRandomFromList(gameQuestions);
            case "general":
            case "général":
            default:
                return getRandomFromList(generalQuestions);
        }
    }

    /**
     * Génère une question avancée en utilisant l'IA
     * 
     * @param context Contexte pour la génération de la question
     * @return Une question générée par l'IA
     */
    public String generateAIQuestion(String context) {
        try {
            String prompt = "Génère une question intéressante pour un serveur Discord";
            if (context != null && !context.isEmpty()) {
                prompt += " sur le sujet: " + context;
            }
            prompt += ". La question doit être engageante et favoriser la discussion.";

            // Utilise l'API OpenAI pour générer une question
            return openAIService.generateText(prompt, 0.7f, 100);
        } catch (Exception e) {
            // En cas d'erreur, retourne une question prédéfinie
            return generateRandomQuestion();
        }
    }

    /**
     * Génère un message de bienvenue personnalisé
     * 
     * @param username Le nom d'utilisateur
     * @param guildName Le nom du serveur
     * @return Un message de bienvenue personnalisé
     */
    public String generateWelcomeMessage(String username, String guildName) {
        List<String> welcomeMessages = Arrays.asList(
            "Bienvenue %s sur %s ! Nous sommes ravis de t'accueillir parmi nous ! 🎉",
            "Hey %s ! Bienvenue sur %s. N'hésite pas à te présenter ! 👋",
            "Un nouvel aventurier %s a rejoint %s ! Bienvenue parmi nous ! 🚀",
            "Bienvenue %s ! Profite bien de ton séjour sur %s ! 🌟",
            "%s vient d'arriver sur %s ! Accueillez-le chaleureusement ! 🔥"
        );

        String template = getRandomFromList(welcomeMessages);
        return String.format(template, username, guildName);
    }

    /**
     * Sélectionne un élément aléatoire d'une liste
     * 
     * @param list La liste d'éléments
     * @return Un élément aléatoire de la liste
     */
    private <T> T getRandomFromList(List<T> list) {
        if (list == null || list.isEmpty()) {
            return null;
        }
        return list.get(random.nextInt(list.size()));
    }
}
