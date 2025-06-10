package works.nuka.yassinebot.commands.impl;

import net.dv8tion.jda.api.EmbedBuilder;
import net.dv8tion.jda.api.entities.Message;
import net.dv8tion.jda.api.entities.User;
import net.dv8tion.jda.api.entities.emoji.Emoji;
import net.dv8tion.jda.api.events.interaction.component.ButtonInteractionEvent;
import net.dv8tion.jda.api.events.message.MessageReceivedEvent;
import net.dv8tion.jda.api.hooks.ListenerAdapter;
import net.dv8tion.jda.api.interactions.components.buttons.Button;
import net.dv8tion.jda.api.utils.messages.MessageCreateBuilder;
import net.dv8tion.jda.api.utils.messages.MessageCreateData;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.commands.Command;
import works.nuka.yassinebot.services.UsageStatsService;

import java.awt.*;
import java.util.*;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Commande pour jouer au jeu du moignon (un jeu de réflexe et de hasard)
 */
public class MoignonCommand extends ListenerAdapter implements Command {
    private static final Logger logger = LoggerFactory.getLogger(MoignonCommand.class);
    private static final int GAME_TIMEOUT_MINUTES = 5;
    private static final String EMOJI_HAND = "✋";
    private static final String EMOJI_MOIGNON = "🦴";
    private static final String EMOJI_FIRE = "🔥";
    private static final String EMOJI_SLASH = "🗡️";
    private static final String EMOJI_SHIELD = "🛡️";
    private static final String EMOJI_REST = "💤";
    private static final String EMOJI_HEAL = "💚";

    private final UsageStatsService usageStatsService;
    private final ScheduledExecutorService scheduler;
    private final Map<String, MoignonGame> activeGames;
    private final Random random;

    /**
     * Crée une nouvelle instance de la commande moignon
     */
    public MoignonCommand(UsageStatsService usageStatsService) {
        this.usageStatsService = usageStatsService;
        this.scheduler = Executors.newScheduledThreadPool(1);
        this.activeGames = new ConcurrentHashMap<>();
        this.random = new Random();
        logger.info("Commande Moignon initialisée");
    }

    @Override
    public String getName() {
        return "moignon";
    }

    @Override
    public String getDescription() {
        return "Jouer au jeu du moignon contre un autre joueur ou contre le bot";
    }

    @Override
    public String getUsage() {
        return "[@joueur]";
    }

    @Override
    public String[] getAliases() {
        return new String[]{"stump", "moignons"};
    }

    @Override
    public void execute(MessageReceivedEvent event, String[] args) {
        User challenger = event.getAuthor();
        User opponent;

        // Vérifier si un adversaire est mentionné
        if (event.getMessage().getMentions().getUsers().isEmpty()) {
            // Jouer contre le bot
            opponent = event.getJDA().getSelfUser();
        } else {
            // Jouer contre un autre joueur
            opponent = event.getMessage().getMentions().getUsers().get(0);

            // Vérifier que l'adversaire n'est pas le bot lui-même
            if (opponent.getId().equals(event.getJDA().getSelfUser().getId())) {
                opponent = event.getJDA().getSelfUser();
            }

            // Vérifier que l'adversaire n'est pas le joueur lui-même
            if (opponent.getId().equals(challenger.getId())) {
                event.getMessage().reply("Tu ne peux pas jouer contre toi-même ! Mentionne un autre joueur ou joue contre moi.").queue();
                return;
            }
        }

        // Créer une nouvelle partie
        String gameId = UUID.randomUUID().toString();
        MoignonGame game = new MoignonGame(gameId, challenger, opponent);
        activeGames.put(gameId, game);

        // Envoyer le plateau de jeu initial
        event.getMessage().reply(createGameMessage(game)).queue(message -> {
            game.setMessageId(message.getId());

            // Programmer l'expiration du jeu
            scheduler.schedule(() -> {
                MoignonGame expiredGame = activeGames.get(gameId);
                if (expiredGame != null && !expiredGame.isGameOver()) {
                    activeGames.remove(gameId);
                    message.editMessage(createGameTimeoutMessage(expiredGame)).queue();
                    logger.debug("Partie de moignon {} expirée après {} minutes d'inactivité", gameId, GAME_TIMEOUT_MINUTES);
                }
            }, GAME_TIMEOUT_MINUTES, TimeUnit.MINUTES);

            // Si le bot est l'adversaire, faire jouer le bot
            if (opponent.getId().equals(event.getJDA().getSelfUser().getId()) && game.getCurrentPlayerId().equals(opponent.getId())) {
                scheduler.schedule(() -> playBotMove(game, message), 1, TimeUnit.SECONDS);
            }
        });

        // Enregistrer l'utilisation de la commande
        usageStatsService.logCommandUsage(challenger.getId(), "moignon", event.getGuild() != null ? event.getGuild().getId() : null);
        logger.info("Nouvelle partie de moignon créée: {} entre {} et {}", gameId, challenger.getAsTag(), opponent.getAsTag());
    }

    @Override
    public void onButtonInteraction(ButtonInteractionEvent event) {
        String[] componentId = event.getComponentId().split(":");
        if (componentId.length < 3 || !componentId[0].equals("moignon")) {
            return;
        }

        String gameId = componentId[1];
        String action = componentId[2];
        MoignonGame game = activeGames.get(gameId);

        // Vérifier si le jeu existe
        if (game == null) {
            event.reply("Cette partie n'existe plus.").setEphemeral(true).queue();
            return;
        }

        // Vérifier si le jeu est terminé
        if (game.isGameOver()) {
            event.reply("Cette partie est déjà terminée.").setEphemeral(true).queue();
            return;
        }

        // Vérifier si c'est le tour du joueur qui a cliqué
        User player = event.getUser();
        if (!player.getId().equals(game.getCurrentPlayerId())) {
            event.reply("Ce n'est pas ton tour de jouer !").setEphemeral(true).queue();
            return;
        }

        // Exécuter l'action
        boolean success = game.executeAction(action, player.getId());
        if (!success) {
            event.reply("Action invalide !").setEphemeral(true).queue();
            return;
        }

        // Mettre à jour le message
        event.editMessage(createGameMessage(game)).queue();

        // Vérifier si le jeu est terminé
        if (game.isGameOver()) {
            activeGames.remove(gameId);
            logger.debug("Partie de moignon {} terminée. Vainqueur: {}", gameId, 
                    game.getWinner() != null ? game.getWinner().getAsTag() : "Match nul");
            return;
        }

        // Si c'est au tour du bot, faire jouer le bot
        if (game.getCurrentPlayerId().equals(event.getJDA().getSelfUser().getId())) {
            scheduler.schedule(() -> {
                Message message = event.getMessage();
                playBotMove(game, message);
            }, 1, TimeUnit.SECONDS);
        }
    }

    /**
     * Fait jouer le bot
     * 
     * @param game La partie en cours
     * @param message Le message contenant le plateau de jeu
     */
    private void playBotMove(MoignonGame game, Message message) {
        if (game.isGameOver() || !game.getCurrentPlayerId().equals(message.getJDA().getSelfUser().getId())) {
            return;
        }

        // Logique du bot
        String action = botDecideAction(game);
        game.executeAction(action, message.getJDA().getSelfUser().getId());

        // Mettre à jour le message
        message.editMessage(createGameMessage(game)).queue();

        // Vérifier si le jeu est terminé
        if (game.isGameOver()) {
            activeGames.remove(game.getGameId());
            logger.debug("Partie de moignon {} terminée par le bot. Vainqueur: {}", game.getGameId(), 
                    game.getWinner() != null ? game.getWinner().getAsTag() : "Match nul");
        }
    }

    /**
     * Décide de l'action à effectuer pour le bot
     * 
     * @param game La partie en cours
     * @return L'action à effectuer
     */
    private String botDecideAction(MoignonGame game) {
        MoignonGame.Player bot = game.getPlayerById(game.getCurrentPlayerId());
        MoignonGame.Player opponent = game.getPlayerById(game.getOpponentId(game.getCurrentPlayerId()));

        // Stratégie de base du bot
        if (bot.getHands() <= 0) {
            // Si le bot n'a plus de mains, il doit attaquer avec un moignon ou se reposer
            if (bot.getEnergy() < 2) {
                return "rest"; // Se reposer si pas assez d'énergie
            } else if (opponent.getShield() > 0) {
                return "moignon"; // Attaquer avec un moignon pour briser le bouclier
            } else {
                // Choix aléatoire entre attaque et repos
                return random.nextDouble() < 0.7 ? "moignon" : "rest";
            }
        } else {
            // Si le bot a des mains
            if (bot.getEnergy() <= 1) {
                return "rest"; // Se reposer si peu d'énergie
            } else if (bot.getHealth() <= 2 && bot.getEnergy() >= 3) {
                return "heal"; // Se soigner si peu de vie et assez d'énergie
            } else if (opponent.getShield() > 0 && bot.getEnergy() >= 2) {
                // Choisir entre attaque à l'épée ou moignon contre un bouclier
                return random.nextDouble() < 0.5 ? "slash" : "moignon";
            } else if (opponent.getHands() > 0 && bot.getEnergy() >= 3 && bot.getHealth() > 3) {
                // Attaquer les mains de l'adversaire s'il en a
                return "fire";
            } else if (bot.getShield() <= 0 && bot.getEnergy() >= 3 && opponent.getHands() > 0) {
                return "shield"; // Se protéger si l'adversaire peut attaquer
            } else {
                // Choisir une attaque basée sur l'énergie disponible
                if (bot.getEnergy() >= 3) {
                    List<String> options = Arrays.asList("slash", "fire", "shield");
                    return options.get(random.nextInt(options.size()));
                } else {
                    return "slash"; // Attaque basique si peu d'énergie
                }
            }
        }
    }

    /**
     * Crée un message pour afficher l'état de la partie
     * 
     * @param game La partie en cours
     * @return Le message à envoyer
     */
    private MessageCreateData createGameMessage(MoignonGame game) {
        EmbedBuilder embed = new EmbedBuilder();
        embed.setTitle("Jeu du Moignon");

        // Informations sur les joueurs
        MoignonGame.Player player1 = game.getPlayer1();
        MoignonGame.Player player2 = game.getPlayer2();

        // Statut du joueur 1
        StringBuilder p1Status = new StringBuilder();
        p1Status.append(getHandsEmoji(player1.getHands())).append(" Mains: **").append(player1.getHands()).append("**\n");
        p1Status.append("❤️ Vie: **").append(player1.getHealth()).append("**\n");
        p1Status.append("⚡ Énergie: **").append(player1.getEnergy()).append("**\n");
        if (player1.getShield() > 0) {
            p1Status.append(EMOJI_SHIELD).append(" Bouclier: **").append(player1.getShield()).append("**\n");
        }
        embed.addField(game.getPlayer1User().getName(), p1Status.toString(), true);

        // Statut du joueur 2
        StringBuilder p2Status = new StringBuilder();
        p2Status.append(getHandsEmoji(player2.getHands())).append(" Mains: **").append(player2.getHands()).append("**\n");
        p2Status.append("❤️ Vie: **").append(player2.getHealth()).append("**\n");
        p2Status.append("⚡ Énergie: **").append(player2.getEnergy()).append("**\n");
        if (player2.getShield() > 0) {
            p2Status.append(EMOJI_SHIELD).append(" Bouclier: **").append(player2.getShield()).append("**\n");
        }
        embed.addField(game.getPlayer2User().getName(), p2Status.toString(), true);

        // Dernière action
        if (game.getLastAction() != null) {
            embed.addField("Dernière action", game.getLastAction(), false);
        }

        // Statut du jeu
        if (game.isGameOver()) {
            if (game.getWinner() != null) {
                embed.addField("Résultat", game.getWinner().getAsMention() + " a gagné !", false);
            } else {
                embed.addField("Résultat", "Match nul !", false);
            }
        } else {
            embed.addField("Tour actuel", game.getCurrentPlayer().getAsMention(), false);
        }

        // Créer les boutons pour les actions
        MessageCreateBuilder builder = new MessageCreateBuilder();
        builder.setEmbeds(embed.build());

        // Ajouter les boutons d'action si le jeu n'est pas terminé
        if (!game.isGameOver()) {
            MoignonGame.Player currentPlayer = game.getPlayerById(game.getCurrentPlayerId());

            // Première ligne de boutons
            builder.addActionRow(
                    createActionButton(game, "slash", EMOJI_SLASH, "Attaque", currentPlayer.getEnergy() < 2 || currentPlayer.getHands() <= 0),
                    createActionButton(game, "moignon", EMOJI_MOIGNON, "Moignon", currentPlayer.getEnergy() < 2),
                    createActionButton(game, "fire", EMOJI_FIRE, "Feu", currentPlayer.getEnergy() < 3 || currentPlayer.getHands() <= 0)
            );

            // Deuxième ligne de boutons
            builder.addActionRow(
                    createActionButton(game, "shield", EMOJI_SHIELD, "Bouclier", currentPlayer.getEnergy() < 3 || currentPlayer.getHands() <= 0),
                    createActionButton(game, "rest", EMOJI_REST, "Repos", false),
                    createActionButton(game, "heal", EMOJI_HEAL, "Soins", currentPlayer.getEnergy() < 3 || currentPlayer.getHands() <= 0)
            );
        }

        return builder.build();
    }

    /**
     * Crée un message pour afficher l'expiration de la partie
     * 
     * @param game La partie expirée
     * @return Le message à envoyer
     */
    private MessageCreateData createGameTimeoutMessage(MoignonGame game) {
        EmbedBuilder embed = new EmbedBuilder();
        embed.setTitle("Jeu du Moignon - Expiré");
        embed.setDescription("La partie a expiré après " + GAME_TIMEOUT_MINUTES + " minutes d'inactivité.");

        // Informations sur les joueurs
        embed.addField("Joueurs", game.getPlayer1User().getAsMention() + " vs " + game.getPlayer2User().getAsMention(), false);

        return new MessageCreateBuilder().setEmbeds(embed.build()).build();
    }

    /**
     * Crée un bouton pour une action
     * 
     * @param game La partie en cours
     * @param action L'action du bouton
     * @param emoji L'emoji à afficher
     * @param label Le libellé du bouton
     * @param disabled Si le bouton est désactivé
     * @return Le bouton à afficher
     */
    private Button createActionButton(MoignonGame game, String action, String emoji, String label, boolean disabled) {
        String buttonId = "moignon:" + game.getGameId() + ":" + action;
        Button button = Button.secondary(buttonId, label).withEmoji(Emoji.fromUnicode(emoji));

        if (disabled || game.isGameOver()) {
            button = button.asDisabled();
        }

        return button;
    }

    /**
     * Retourne l'emoji correspondant au nombre de mains
     * 
     * @param hands Nombre de mains
     * @return Emoji correspondant
     */
    private String getHandsEmoji(int hands) {
        return hands > 0 ? EMOJI_HAND : EMOJI_MOIGNON;
    }

    /**
     * Classe interne représentant une partie du jeu du moignon
     */
    private static class MoignonGame {
        private final String gameId;
        private final User player1User;
        private final User player2User;
        private String messageId;
        private final Player player1;
        private final Player player2;
        private String currentPlayerId;
        private User winner = null;
        private String lastAction = null;

        public MoignonGame(String gameId, User player1, User player2) {
            this.gameId = gameId;
            this.player1User = player1;
            this.player2User = player2;

            // Initialiser les joueurs
            this.player1 = new Player(player1.getId());
            this.player2 = new Player(player2.getId());

            // Déterminer aléatoirement qui commence
            this.currentPlayerId = new Random().nextBoolean() ? player1.getId() : player2.getId();
        }

        public String getGameId() {
            return gameId;
        }

        public User getPlayer1User() {
            return player1User;
        }

        public User getPlayer2User() {
            return player2User;
        }

        public Player getPlayer1() {
            return player1;
        }

        public Player getPlayer2() {
            return player2;
        }

        public String getMessageId() {
            return messageId;
        }

        public void setMessageId(String messageId) {
            this.messageId = messageId;
        }

        public String getCurrentPlayerId() {
            return currentPlayerId;
        }

        public User getCurrentPlayer() {
            return currentPlayerId.equals(player1User.getId()) ? player1User : player2User;
        }

        public User getWinner() {
            return winner;
        }

        public String getLastAction() {
            return lastAction;
        }

        public boolean isGameOver() {
            return winner != null || (player1.getHealth() <= 0 && player2.getHealth() <= 0);
        }

        /**
         * Obtient un joueur par son ID
         * 
         * @param playerId L'ID du joueur
         * @return Le joueur correspondant
         */
        public Player getPlayerById(String playerId) {
            return playerId.equals(player1.getId()) ? player1 : player2;
        }

        /**
         * Obtient l'ID de l'adversaire d'un joueur
         * 
         * @param playerId L'ID du joueur
         * @return L'ID de l'adversaire
         */
        public String getOpponentId(String playerId) {
            return playerId.equals(player1.getId()) ? player2.getId() : player1.getId();
        }

        /**
         * Exécute une action pour un joueur
         * 
         * @param action L'action à exécuter
         * @param playerId L'ID du joueur qui exécute l'action
         * @return true si l'action a été exécutée avec succès, false sinon
         */
        public boolean executeAction(String action, String playerId) {
            // Vérifier que c'est bien le tour du joueur
            if (!playerId.equals(currentPlayerId) || isGameOver()) {
                return false;
            }

            Player currentPlayer = getPlayerById(playerId);
            Player opponent = getPlayerById(getOpponentId(playerId));
            String playerName = playerId.equals(player1User.getId()) ? player1User.getName() : player2User.getName();

            boolean actionExecuted = false;

            switch (action) {
                case "slash":
                    // Attaque à l'épée (coûte 2 énergie, nécessite des mains)
                    if (currentPlayer.getEnergy() >= 2 && currentPlayer.getHands() > 0) {
                        int damage = 2;
                        currentPlayer.useEnergy(2);

                        // Si l'adversaire a un bouclier, réduire les dégâts
                        if (opponent.getShield() > 0) {
                            opponent.reduceShield(1);
                            damage = 1;
                            lastAction = playerName + " attaque à l'épée mais le bouclier de l'adversaire réduit les dégâts !";
                        } else {
                            lastAction = playerName + " attaque à l'épée et inflige " + damage + " dégâts !";
                        }

                        opponent.takeDamage(damage);
                        actionExecuted = true;
                    }
                    break;

                case "moignon":
                    // Attaque avec un moignon (coûte 2 énergie)
                    if (currentPlayer.getEnergy() >= 2) {
                        int damage = 1;
                        currentPlayer.useEnergy(2);

                        // Si l'adversaire a un bouclier, détruire le bouclier mais pas de dégâts
                        if (opponent.getShield() > 0) {
                            opponent.reduceShield(1);
                            lastAction = playerName + " frappe avec son moignon et détruit un bouclier !";
                        } else {
                            opponent.takeDamage(damage);
                            lastAction = playerName + " frappe avec son moignon et inflige " + damage + " dégâts !";
                        }

                        actionExecuted = true;
                    }
                    break;

                case "fire":
                    // Attaque de feu (coûte 3 énergie, nécessite des mains)
                    if (currentPlayer.getEnergy() >= 3 && currentPlayer.getHands() > 0) {
                        currentPlayer.useEnergy(3);

                        // Le feu brûle une main de l'adversaire s'il en a
                        if (opponent.getHands() > 0) {
                            opponent.loseHand();
                            lastAction = playerName + " lance une boule de feu et brûle une main de l'adversaire !";
                        } else {
                            // Si l'adversaire n'a plus de mains, inflige des dégâts à la place
                            opponent.takeDamage(2);
                            lastAction = playerName + " lance une boule de feu et inflige 2 dégâts !";
                        }

                        actionExecuted = true;
                    }
                    break;

                case "shield":
                    // Se protéger avec un bouclier (coûte 3 énergie, nécessite des mains)
                    if (currentPlayer.getEnergy() >= 3 && currentPlayer.getHands() > 0) {
                        currentPlayer.useEnergy(3);
                        currentPlayer.addShield(2);
                        lastAction = playerName + " se protège avec un bouclier !";
                        actionExecuted = true;
                    }
                    break;

                case "rest":
                    // Se reposer (récupère 2 énergie)
                    currentPlayer.addEnergy(2);
                    lastAction = playerName + " se repose et récupère 2 points d'énergie.";
                    actionExecuted = true;
                    break;

                case "heal":
                    // Se soigner (coûte 3 énergie, nécessite des mains)
                    if (currentPlayer.getEnergy() >= 3 && currentPlayer.getHands() > 0) {
                        currentPlayer.useEnergy(3);
                        currentPlayer.heal(2);
                        lastAction = playerName + " se soigne et récupère 2 points de vie.";
                        actionExecuted = true;
                    }
                    break;
            }

            // Vérifier si un joueur a gagné
            if (player1.getHealth() <= 0) {
                winner = player2User;
            } else if (player2.getHealth() <= 0) {
                winner = player1User;
            }

            // Passer au tour suivant si l'action a été exécutée
            if (actionExecuted) {
                currentPlayerId = getOpponentId(playerId);
            }

            return actionExecuted;
        }

        /**
         * Classe interne représentant un joueur dans le jeu du moignon
         */
        public static class Player {
            private final String id;
            private int hands;
            private int health;
            private int energy;
            private int shield;

            public Player(String id) {
                this.id = id;
                this.hands = 2; // Commence avec 2 mains
                this.health = 5; // Commence avec 5 points de vie
                this.energy = 3; // Commence avec 3 points d'énergie
                this.shield = 0; // Commence sans bouclier
            }

            public String getId() {
                return id;
            }

            public int getHands() {
                return hands;
            }

            public int getHealth() {
                return health;
            }

            public int getEnergy() {
                return energy;
            }

            public int getShield() {
                return shield;
            }

            public void loseHand() {
                if (hands > 0) {
                    hands--;
                }
            }

            public void takeDamage(int amount) {
                health -= amount;
                if (health < 0) health = 0;
            }

            public void heal(int amount) {
                health += amount;
                if (health > 10) health = 10; // Limite maximale de santé
            }

            public void useEnergy(int amount) {
                energy -= amount;
                if (energy < 0) energy = 0;
            }

            public void addEnergy(int amount) {
                energy += amount;
                if (energy > 10) energy = 10; // Limite maximale d'énergie
            }

            public void addShield(int amount) {
                shield += amount;
                if (shield > 5) shield = 5; // Limite maximale de bouclier
            }

            public void reduceShield(int amount) {
                shield -= amount;
                if (shield < 0) shield = 0;
            }
        }
    }
}
