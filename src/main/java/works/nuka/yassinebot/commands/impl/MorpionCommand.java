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
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Commande pour jouer au morpion (tic-tac-toe)
 */
public class MorpionCommand extends ListenerAdapter implements Command {
    private static final Logger logger = LoggerFactory.getLogger(MorpionCommand.class);
    private static final int GAME_TIMEOUT_MINUTES = 5;
    private static final String EMOJI_X = "❌";
    private static final String EMOJI_O = "⭕";
    private static final String EMOJI_EMPTY = "⬜";

    private final UsageStatsService usageStatsService;
    private final ScheduledExecutorService scheduler;
    private final Map<String, MorpionGame> activeGames;

    /**
     * Crée une nouvelle instance de la commande morpion
     */
    public MorpionCommand(UsageStatsService usageStatsService) {
        this.usageStatsService = usageStatsService;
        this.scheduler = Executors.newScheduledThreadPool(1);
        this.activeGames = new ConcurrentHashMap<>();
        logger.info("Commande Morpion initialisée");
    }

    @Override
    public String getName() {
        return "morpion";
    }

    @Override
    public String getDescription() {
        return "Jouer au morpion contre un autre joueur ou contre le bot";
    }

    @Override
    public String getUsage() {
        return "[@joueur]";
    }

    @Override
    public String[] getAliases() {
        return new String[]{"tictactoe", "xo"};
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
        MorpionGame game = new MorpionGame(gameId, challenger, opponent);
        activeGames.put(gameId, game);

        // Envoyer le plateau de jeu initial
        event.getMessage().reply(createGameMessage(game)).queue(message -> {
            game.setMessageId(message.getId());

            // Programmer l'expiration du jeu
            scheduler.schedule(() -> {
                MorpionGame expiredGame = activeGames.get(gameId);
                if (expiredGame != null && !expiredGame.isGameOver()) {
                    activeGames.remove(gameId);
                    message.editMessage(createGameTimeoutMessage(expiredGame)).queue();
                    logger.debug("Partie de morpion {} expirée après {} minutes d'inactivité", gameId, GAME_TIMEOUT_MINUTES);
                }
            }, GAME_TIMEOUT_MINUTES, TimeUnit.MINUTES);

            // Si le bot est l'adversaire, faire jouer le bot
            if (opponent.getId().equals(event.getJDA().getSelfUser().getId()) && game.getCurrentPlayer().getId().equals(opponent.getId())) {
                scheduler.schedule(() -> playBotMove(game, message), 1, TimeUnit.SECONDS);
            }
        });

        // Enregistrer l'utilisation de la commande
        usageStatsService.logCommandUsage(challenger.getId(), "morpion", event.getGuild() != null ? event.getGuild().getId() : null);
        logger.info("Nouvelle partie de morpion créée: {} entre {} et {}", gameId, challenger.getName(), opponent.getName());
    }

    @Override
    public void onButtonInteraction(ButtonInteractionEvent event) {
        String[] componentId = event.getComponentId().split(":");
        if (componentId.length < 3 || !componentId[0].equals("morpion")) {
            return;
        }

        String gameId = componentId[1];
        MorpionGame game = activeGames.get(gameId);

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
        if (!player.getId().equals(game.getCurrentPlayer().getId())) {
            event.reply("Ce n'est pas ton tour de jouer !").setEphemeral(true).queue();
            return;
        }

        // Extraire les coordonnées du bouton
        int row = Integer.parseInt(componentId[2].substring(0, 1));
        int col = Integer.parseInt(componentId[2].substring(1, 2));

        // Vérifier si la case est vide
        if (game.getBoard()[row][col] != 0) {
            event.reply("Cette case est déjà occupée !").setEphemeral(true).queue();
            return;
        }

        // Jouer le coup
        game.play(row, col);

        // Mettre à jour le message
        event.editMessage(createGameMessage(game)).queue();

        // Vérifier si le jeu est terminé
        if (game.isGameOver()) {
            activeGames.remove(gameId);
            logger.debug("Partie de morpion {} terminée. Vainqueur: {}", gameId, 
                    game.getWinner() != null ? game.getWinner().getAsTag() : "Match nul");
            return;
        }

        // Si c'est au tour du bot, faire jouer le bot
        if (game.getCurrentPlayer().getId().equals(event.getJDA().getSelfUser().getId())) {
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
    private void playBotMove(MorpionGame game, Message message) {
        if (game.isGameOver() || !game.getCurrentPlayer().getId().equals(message.getJDA().getSelfUser().getId())) {
            return;
        }

        // Trouver le meilleur coup à jouer
        Point move = findBestMove(game);

        // Jouer le coup
        game.play(move.x, move.y);

        // Mettre à jour le message
        message.editMessage(createGameMessage(game)).queue();

        // Vérifier si le jeu est terminé
        if (game.isGameOver()) {
            activeGames.remove(game.getGameId());
            logger.debug("Partie de morpion {} terminée par le bot. Vainqueur: {}", game.getGameId(), 
                    game.getWinner() != null ? game.getWinner().getAsTag() : "Match nul");
        }
    }

    /**
     * Trouve le meilleur coup à jouer pour le bot
     * Implémentation de l'algorithme minimax avec élagage alpha-beta
     * 
     * @param game La partie en cours
     * @return Les coordonnées du meilleur coup à jouer
     */
    private Point findBestMove(MorpionGame game) {
        int[][] board = game.getBoard();
        int bestScore = Integer.MIN_VALUE;
        Point bestMove = new Point(-1, -1);

        // Valeur pour le bot (toujours O = 2)
        int botPlayer = 2;

        // Parcourir toutes les cases vides
        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) {
                if (board[i][j] == 0) {
                    // Essayer ce coup
                    board[i][j] = botPlayer;

                    // Calculer le score de ce coup
                    int score = minimax(board, 0, false, botPlayer, Integer.MIN_VALUE, Integer.MAX_VALUE);

                    // Annuler le coup
                    board[i][j] = 0;

                    // Mettre à jour le meilleur coup
                    if (score > bestScore) {
                        bestScore = score;
                        bestMove.setLocation(i, j);
                    }
                }
            }
        }

        return bestMove;
    }

    /**
     * Algorithme minimax avec élagage alpha-beta
     * 
     * @param board Le plateau de jeu
     * @param depth La profondeur de récursion
     * @param isMaximizing Si c'est le tour du joueur qui maximise
     * @param botPlayer La valeur du joueur bot (2)
     * @param alpha La valeur alpha pour l'élagage
     * @param beta La valeur beta pour l'élagage
     * @return Le score du meilleur coup
     */
    private int minimax(int[][] board, int depth, boolean isMaximizing, int botPlayer, int alpha, int beta) {
        // Joueur humain (toujours X = 1)
        int humanPlayer = 1;

        // Vérifier si le jeu est terminé
        int winner = checkWinner(board);
        if (winner == botPlayer) return 10 - depth; // Le bot gagne
        if (winner == humanPlayer) return depth - 10; // L'humain gagne
        if (isBoardFull(board)) return 0; // Match nul

        if (isMaximizing) {
            // Tour du bot (maximiser)
            int bestScore = Integer.MIN_VALUE;
            for (int i = 0; i < 3; i++) {
                for (int j = 0; j < 3; j++) {
                    if (board[i][j] == 0) {
                        board[i][j] = botPlayer;
                        int score = minimax(board, depth + 1, false, botPlayer, alpha, beta);
                        board[i][j] = 0;
                        bestScore = Math.max(score, bestScore);
                        alpha = Math.max(alpha, bestScore);
                        if (beta <= alpha) break; // Élagage alpha
                    }
                }
            }
            return bestScore;
        } else {
            // Tour de l'humain (minimiser)
            int bestScore = Integer.MAX_VALUE;
            for (int i = 0; i < 3; i++) {
                for (int j = 0; j < 3; j++) {
                    if (board[i][j] == 0) {
                        board[i][j] = humanPlayer;
                        int score = minimax(board, depth + 1, true, botPlayer, alpha, beta);
                        board[i][j] = 0;
                        bestScore = Math.min(score, bestScore);
                        beta = Math.min(beta, bestScore);
                        if (beta <= alpha) break; // Élagage beta
                    }
                }
            }
            return bestScore;
        }
    }

    /**
     * Vérifie s'il y a un gagnant sur le plateau
     * 
     * @param board Le plateau de jeu
     * @return 1 pour X, 2 pour O, 0 pour aucun gagnant
     */
    private int checkWinner(int[][] board) {
        // Vérifier les lignes
        for (int i = 0; i < 3; i++) {
            if (board[i][0] != 0 && board[i][0] == board[i][1] && board[i][1] == board[i][2]) {
                return board[i][0];
            }
        }

        // Vérifier les colonnes
        for (int j = 0; j < 3; j++) {
            if (board[0][j] != 0 && board[0][j] == board[1][j] && board[1][j] == board[2][j]) {
                return board[0][j];
            }
        }

        // Vérifier les diagonales
        if (board[0][0] != 0 && board[0][0] == board[1][1] && board[1][1] == board[2][2]) {
            return board[0][0];
        }
        if (board[0][2] != 0 && board[0][2] == board[1][1] && board[1][1] == board[2][0]) {
            return board[0][2];
        }

        return 0; // Pas de gagnant
    }

    /**
     * Vérifie si le plateau est plein
     * 
     * @param board Le plateau de jeu
     * @return true si le plateau est plein, false sinon
     */
    private boolean isBoardFull(int[][] board) {
        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) {
                if (board[i][j] == 0) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * Crée un message pour afficher le plateau de jeu
     * 
     * @param game La partie en cours
     * @return Le message à envoyer
     */
    private MessageCreateData createGameMessage(MorpionGame game) {
        EmbedBuilder embed = new EmbedBuilder();
        embed.setTitle("Partie de Morpion");

        // Informations sur les joueurs
        String xPlayer = game.getChallengerSymbol() == 1 ? game.getChallenger().getAsMention() : game.getOpponent().getAsMention();
        String oPlayer = game.getChallengerSymbol() == 2 ? game.getChallenger().getAsMention() : game.getOpponent().getAsMention();
        embed.setDescription(EMOJI_X + " " + xPlayer + "\n" + EMOJI_O + " " + oPlayer);

        // Statut du jeu
        if (game.isGameOver()) {
            if (game.getWinner() != null) {
                String winnerSymbol = game.getWinnerSymbol() == 1 ? EMOJI_X : EMOJI_O;
                embed.addField("Résultat", winnerSymbol + " " + game.getWinner().getAsMention() + " a gagné !", false);
            } else {
                embed.addField("Résultat", "Match nul !", false);
            }
        } else {
            String currentPlayerSymbol = game.getCurrentPlayerSymbol() == 1 ? EMOJI_X : EMOJI_O;
            embed.addField("Tour actuel", currentPlayerSymbol + " " + game.getCurrentPlayer().getAsMention(), false);
        }

        // Créer les boutons pour le plateau
        MessageCreateBuilder builder = new MessageCreateBuilder();
        builder.setEmbeds(embed.build());

        // Ajouter les boutons pour chaque ligne
        for (int i = 0; i < 3; i++) {
            builder.addActionRow(
                    createCellButton(game, i, 0),
                    createCellButton(game, i, 1),
                    createCellButton(game, i, 2)
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
    private MessageCreateData createGameTimeoutMessage(MorpionGame game) {
        EmbedBuilder embed = new EmbedBuilder();
        embed.setTitle("Partie de Morpion - Expirée");
        embed.setDescription("La partie a expiré après " + GAME_TIMEOUT_MINUTES + " minutes d'inactivité.");

        // Informations sur les joueurs
        String xPlayer = game.getChallengerSymbol() == 1 ? game.getChallenger().getAsMention() : game.getOpponent().getAsMention();
        String oPlayer = game.getChallengerSymbol() == 2 ? game.getChallenger().getAsMention() : game.getOpponent().getAsMention();
        embed.addField("Joueurs", EMOJI_X + " " + xPlayer + "\n" + EMOJI_O + " " + oPlayer, false);

        return new MessageCreateBuilder().setEmbeds(embed.build()).build();
    }

    /**
     * Crée un bouton pour une cellule du plateau
     * 
     * @param game La partie en cours
     * @param row La ligne de la cellule
     * @param col La colonne de la cellule
     * @return Le bouton à afficher
     */
    private Button createCellButton(MorpionGame game, int row, int col) {
        int value = game.getBoard()[row][col];
        String buttonId = "morpion:" + game.getGameId() + ":" + row + col;
        String emoji;

        switch (value) {
            case 1:
                emoji = EMOJI_X;
                break;
            case 2:
                emoji = EMOJI_O;
                break;
            default:
                emoji = EMOJI_EMPTY;
                break;
        }

        Button button = Button.secondary(buttonId, Emoji.fromUnicode(emoji));

        // Désactiver le bouton si la case est occupée ou si le jeu est terminé
        if (value != 0 || game.isGameOver()) {
            button = button.asDisabled();
        }

        return button;
    }

    /**
     * Classe interne représentant une partie de morpion
     */
    private static class MorpionGame {
        private final String gameId;
        private final User challenger;
        private final User opponent;
        private String messageId;
        private final int[][] board = new int[3][3]; // 0 = vide, 1 = X, 2 = O
        private boolean isXTurn = true; // X commence toujours
        private final int challengerSymbol; // 1 = X, 2 = O
        private User winner = null;
        private int winnerSymbol = 0;

        public MorpionGame(String gameId, User challenger, User opponent) {
            this.gameId = gameId;
            this.challenger = challenger;
            this.opponent = opponent;

            // Le challenger est toujours X (1)
            this.challengerSymbol = 1;
        }

        public String getGameId() {
            return gameId;
        }

        public User getChallenger() {
            return challenger;
        }

        public User getOpponent() {
            return opponent;
        }

        public String getMessageId() {
            return messageId;
        }

        public void setMessageId(String messageId) {
            this.messageId = messageId;
        }

        public int[][] getBoard() {
            return board;
        }

        public User getCurrentPlayer() {
            if (isXTurn) {
                return challengerSymbol == 1 ? challenger : opponent;
            } else {
                return challengerSymbol == 2 ? challenger : opponent;
            }
        }

        public int getCurrentPlayerSymbol() {
            return isXTurn ? 1 : 2;
        }

        public int getChallengerSymbol() {
            return challengerSymbol;
        }

        public User getWinner() {
            return winner;
        }

        public int getWinnerSymbol() {
            return winnerSymbol;
        }

        public boolean isGameOver() {
            return winner != null || isBoardFull();
        }

        /**
         * Joue un coup sur le plateau
         * 
         * @param row La ligne du coup
         * @param col La colonne du coup
         */
        public void play(int row, int col) {
            if (isGameOver() || board[row][col] != 0) {
                return;
            }

            // Jouer le coup
            board[row][col] = isXTurn ? 1 : 2;

            // Vérifier s'il y a un gagnant
            checkGameStatus();

            // Changer de joueur
            isXTurn = !isXTurn;
        }

        /**
         * Vérifie si le plateau est plein
         * 
         * @return true si le plateau est plein, false sinon
         */
        private boolean isBoardFull() {
            for (int i = 0; i < 3; i++) {
                for (int j = 0; j < 3; j++) {
                    if (board[i][j] == 0) {
                        return false;
                    }
                }
            }
            return true;
        }

        /**
         * Vérifie s'il y a un gagnant sur le plateau
         */
        private void checkGameStatus() {
            // Vérifier les lignes
            for (int i = 0; i < 3; i++) {
                if (board[i][0] != 0 && board[i][0] == board[i][1] && board[i][1] == board[i][2]) {
                    setWinner(board[i][0]);
                    return;
                }
            }

            // Vérifier les colonnes
            for (int j = 0; j < 3; j++) {
                if (board[0][j] != 0 && board[0][j] == board[1][j] && board[1][j] == board[2][j]) {
                    setWinner(board[0][j]);
                    return;
                }
            }

            // Vérifier les diagonales
            if (board[0][0] != 0 && board[0][0] == board[1][1] && board[1][1] == board[2][2]) {
                setWinner(board[0][0]);
                return;
            }
            if (board[0][2] != 0 && board[0][2] == board[1][1] && board[1][1] == board[2][0]) {
                setWinner(board[0][2]);
            }
        }

        /**
         * Définit le gagnant de la partie
         * 
         * @param symbol Le symbole du gagnant (1 = X, 2 = O)
         */
        private void setWinner(int symbol) {
            this.winnerSymbol = symbol;
            this.winner = symbol == challengerSymbol ? challenger : opponent;
        }
    }
}
