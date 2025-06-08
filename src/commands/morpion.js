import { commandLimiter } from '../utils/rateLimit.js';

export const metadata = {
  name: 'morpion',
  description: 'Jouer une partie de morpion contre un autre joueur',
  restricted: false,
  usage: 'morpion <@mention_adversaire>'
};

// Structure pour stocker les parties en cours
const activeGames = new Map();

// Symboles utilisés pour le jeu
const EMPTY = '⬜';
const PLAYER_X = '🔴';
const PLAYER_O = '🔵';

// Constantes pour les états du jeu
const GAME_STATES = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  FINISHED: 'finished'
};

/**
 * Crée un nouveau plateau de jeu
 * @returns {Array} Un tableau 3x3 représentant le plateau de morpion
 */
function createBoard() {
  return [
    [EMPTY, EMPTY, EMPTY],
    [EMPTY, EMPTY, EMPTY],
    [EMPTY, EMPTY, EMPTY]
  ];
}

/**
 * Vérifie s'il y a un gagnant
 * @param {Array} board - Le plateau de jeu
 * @returns {string|null} - Le symbole du gagnant ou null s'il n'y a pas de gagnant
 */
function checkWinner(board) {
  // Vérifier les lignes
  for (let i = 0; i < 3; i++) {
    if (board[i][0] !== EMPTY && board[i][0] === board[i][1] && board[i][1] === board[i][2]) {
      return board[i][0];
    }
  }

  // Vérifier les colonnes
  for (let j = 0; j < 3; j++) {
    if (board[0][j] !== EMPTY && board[0][j] === board[1][j] && board[1][j] === board[2][j]) {
      return board[0][j];
    }
  }

  // Vérifier les diagonales
  if (board[0][0] !== EMPTY && board[0][0] === board[1][1] && board[1][1] === board[2][2]) {
    return board[0][0];
  }
  if (board[0][2] !== EMPTY && board[0][2] === board[1][1] && board[1][1] === board[2][0]) {
    return board[0][2];
  }

  return null;
}

/**
 * Vérifie si le plateau est plein (match nul)
 * @param {Array} board - Le plateau de jeu
 * @returns {boolean} - true si le plateau est plein, false sinon
 */
function isBoardFull(board) {
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board[i][j] === EMPTY) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Génère une représentation visuelle du plateau
 * @param {Array} board - Le plateau de jeu
 * @returns {string} - Représentation visuelle du plateau
 */
function renderBoard(board) {
  // Les positions numériques en haut
  let result = '1️⃣2️⃣3️⃣\n';
  // Afficher le plateau
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      result += board[i][j];
    }
    result += '\n';
  }

  return result;
}

/**
 * Crée un message formaté pour le jeu de morpion
 * @param {Object} game - L'objet du jeu
 * @param {Object} client - Le client Discord
 * @param {String} status - Message de statut à afficher
 * @returns {String} - Le message formaté
 */
function createGameMessage(game, client, status) {
  const player1 = client.users.cache.get(game.players[0]);
  const player2 = client.users.cache.get(game.players[1]);
  const currentPlayer = client.users.cache.get(game.currentPlayer);

  let message = `**Morpion**\n\n`;
  message += `@${player1.username} (${PLAYER_X}) VS @${player2.username} (${PLAYER_O})\n\n`;
  message += renderBoard(game.board);
  message += `\nC'est au tour de @${currentPlayer.username} (${game.playerSymbols[game.currentPlayer]})\n`;
  message += `Tapez un chiffre de 1 à 3 pour jouer.\n`;
  if (status) {
    message += `\n${status}\n`;
  }

  return message;
}
export async function morpion(client, message, args) {
  // Vérifier la limite de taux
  const rateLimitResult = commandLimiter.check(message.author.id);
  if (rateLimitResult !== true) {
    message.reply({ content: rateLimitResult });
    return;
  }

  // Si l'utilisateur est déjà dans une partie
  if (Array.from(activeGames.values()).some(game =>
      game.players.includes(message.author.id) &&
      game.state !== GAME_STATES.FINISHED)) {
    message.reply({ content: 'Vous avez déjà une partie en cours !' });
    return;
  }

  // Si aucun adversaire n'est mentionné
  if (!message.mentions.users.size) {
    message.reply({ content: 'Veuillez mentionner un adversaire pour jouer au morpion !' });
    return;
  }

  const opponent = message.mentions.users.first();

  // Vérifier que l'adversaire n'est pas un bot
  if (opponent.bot) {
    message.reply({ content: 'Vous ne pouvez pas jouer contre un bot !' });
    return;
  }

  // Vérifier que l'adversaire n'est pas l'utilisateur lui-même
  if (opponent.id === message.author.id) {
    message.reply({ content: 'Vous ne pouvez pas jouer contre vous-même !' });
    return;
  }

  // Vérifier que l'adversaire n'est pas déjà dans une partie
  if (Array.from(activeGames.values()).some(game =>
      game.players.includes(opponent.id) &&
      game.state !== GAME_STATES.FINISHED)) {
    message.reply({ content: `${opponent.username} a déjà une partie en cours !` });
    return;
  }

  // Créer une nouvelle partie
  const gameId = Date.now().toString();
  const game = {
    id: gameId,
    board: createBoard(),
    players: [message.author.id, opponent.id],
    playerSymbols: {
      [message.author.id]: PLAYER_X,
      [opponent.id]: PLAYER_O
    },
    currentPlayer: message.author.id,
    state: GAME_STATES.PLAYING,
    channel: message.channel.id
  };

  activeGames.set(gameId, game);

  // Créer et envoyer le message initial
  const initialMessage = createGameMessage(game, client);
  const gameMessage = await message.channel.send({ content: initialMessage });

  // Créer un collecteur de messages pour cette partie
  const filter = m =>
    (m.author.id === message.author.id || m.author.id === opponent.id) &&
    /^[1-3]$/.test(m.content) &&
    game.state === GAME_STATES.PLAYING;

  const collector = message.channel.createMessageCollector({ filter, time: 300000 }); // 5 minutes

  collector.on('collect', async (m) => {
    // Vérifier si c'est bien le tour du joueur
    if (m.author.id !== game.currentPlayer) {
      m.reply({ content: "Ce n'est pas votre tour !" });
      return;
    }

    const column = parseInt(m.content);

    if (isNaN(column) || column < 1 || column > 3) {
      m.reply({ content: "Position invalide ! Veuillez choisir un chiffre entre 1 et 3." });
      return;
    }

    const col = column - 1;

    // Trouver la première position libre dans la colonne (en partant du bas)
    let row = -1;
    for (let i = 2; i >= 0; i--) {
      if (game.board[i][col] === EMPTY) {
        row = i;
        break;
      }
    }

    if (row === -1) {
      m.reply({ content: "Cette colonne est déjà pleine ! Veuillez en choisir une autre." });
      return;
    }

    // Placer le symbole du joueur
    game.board[row][col] = game.playerSymbols[m.author.id];
    
    // Vérifier s'il y a un gagnant
    const winner = checkWinner(game.board);
    
    // Mettre à jour l'état du jeu
    if (winner) {
      game.state = GAME_STATES.FINISHED;
      game.winner = m.author.id;
      
      const winStatus = `🎉 **${m.author.username}** a gagné la partie ! 🎉`;
      const winMessage = createGameMessage(game, client, winStatus);

      message.channel.send({ content: winMessage });
      collector.stop('winner');
    } else if (isBoardFull(game.board)) {
      game.state = GAME_STATES.FINISHED;
      
      const drawStatus = `🤝 **Match nul !** 🤝`;
      const drawMessage = createGameMessage(game, client, drawStatus);

      message.channel.send({ content: drawMessage });
      collector.stop('draw');
    } else {
      // Changer de joueur
      game.currentPlayer = game.players.find(id => id !== m.author.id);

      const turnMessage = createGameMessage(game, client);
      message.channel.send({ content: turnMessage });
    }
  });

  collector.on('end', (collected, reason) => {
    if (reason === 'time') {
      // La partie a expiré
      game.state = GAME_STATES.FINISHED;
      
      const timeoutMessage = createGameMessage(game, client, "⏰ La partie a expiré par inactivité !");
      message.channel.send({ content: timeoutMessage });
    }
    
    // Supprimer la partie de la liste des parties actives après un certain temps
    setTimeout(() => {
      activeGames.delete(gameId);
    }, 60000); // Garder la partie en mémoire pendant 1 minute après la fin
  });
}
