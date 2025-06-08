export const metadata = {
  name: 'morpion',
  description: 'Jouer une partie de morpion contre un autre joueur',
  restricted: false,
  usage: 'morpion <@mention_adversaire> [taille]'
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

// Taille minimale et maximale de la grille
const MIN_SIZE = 3;
const MAX_SIZE = 8;
const DEFAULT_SIZE = 3;

// Emojis de nombres pour l'affichage
const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

/**
 * Crée un nouveau plateau de jeu
 * @param {number} size - La taille du plateau (size x size)
 * @returns {Array} Un tableau size x size représentant le plateau de morpion
 */
function createBoard(size) {
  const board = [];
  for (let i = 0; i < size; i++) {
    board.push(Array(size).fill(EMPTY));
  }
  return board;
}

/**
 * Vérifie s'il y a un gagnant
 * @param {Array} board - Le plateau de jeu
 * @param {number} size - La taille du plateau
 * @param {number} winCondition - Nombre de symboles alignés pour gagner
 * @returns {string|null} - Le symbole du gagnant ou null s'il n'y a pas de gagnant
 */
function checkWinner(board, size, winCondition) {
  // Fonction pour vérifier une séquence de symboles
  const checkSequence = (sequence) => {
    if (sequence.length < winCondition) return null;

    for (let i = 0; i <= sequence.length - winCondition; i++) {
      let win = true;
      const symbol = sequence[i];

      if (symbol === EMPTY) continue;

      for (let j = 1; j < winCondition; j++) {
        if (sequence[i + j] !== symbol) {
          win = false;
          break;
        }
      }

      if (win) return symbol;
    }

    return null;
  };

  // Vérifier les lignes
  for (let i = 0; i < size; i++) {
    const winner = checkSequence(board[i]);
    if (winner) return winner;
  }

  // Vérifier les colonnes
  for (let j = 0; j < size; j++) {
    const column = [];
    for (let i = 0; i < size; i++) {
      column.push(board[i][j]);
    }
    const winner = checkSequence(column);
    if (winner) return winner;
  }

  // Vérifier les diagonales (de haut gauche à bas droite)
  for (let k = 0; k <= 2 * (size - 1); k++) {
    const diagonal = [];
    for (let i = 0; i < size; i++) {
      const j = k - i;
      if (j >= 0 && j < size) {
        diagonal.push(board[i][j]);
      }
    }
    const winner = checkSequence(diagonal);
    if (winner) return winner;
  }

  // Vérifier les diagonales (de haut droite à bas gauche)
  for (let k = 0; k <= 2 * (size - 1); k++) {
    const diagonal = [];
    for (let i = 0; i < size; i++) {
      const j = size - 1 - (k - i);
      if (j >= 0 && j < size) {
        diagonal.push(board[i][j]);
      }
    }
    const winner = checkSequence(diagonal);
    if (winner) return winner;
  }

  return null;
}

/**
 * Vérifie si le plateau est plein (match nul)
 * @param {Array} board - Le plateau de jeu
 * @returns {boolean} - true si le plateau est plein, false sinon
 */
function isBoardFull(board) {
  for (let i = 0; i < board.length; i++) {
    for (let j = 0; j < board[i].length; j++) {
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
  const size = board.length;

  // Les positions numériques en haut (limité à la taille de la grille)
  let result = '';
  for (let i = 0; i < size; i++) {
    result += NUMBER_EMOJIS[i];
  }
  result += '\n';

  // Afficher le plateau
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
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

  let message = `**Morpion ${game.size}x${game.size}**\n\n`;
  message += `@${player1.username} (${PLAYER_X}) VS @${player2.username} (${PLAYER_O})\n\n`;
  message += renderBoard(game.board);
  message += `\nC'est au tour de @${currentPlayer.username} (${game.playerSymbols[game.currentPlayer]})\n`;
  message += `Tapez un chiffre de 1 à ${game.size} pour jouer.\n`;
  message += `Alignez ${game.winCondition} symboles pour gagner.\n`;

  if (status) {
    message += `\n${status}\n`;
  }

  return message;
}

export async function morpion(client, message, args) {
  // Si l'utilisateur est déjà dans une partie
  if (Array.from(activeGames.values()).some(game =>
      game.players.includes(message.author.id) &&
      game.state !== GAME_STATES.FINISHED)) {
    message.reply({ content: 'Vous avez déjà une partie en cours !' });
    return;
  }

  // Si aucun adversaire n'est mentionné
  if (!message.mentions.users.size) {
    message.reply({ content: 'Veuillez mentionner un adversaire pour jouer au morpion !\nUsage: `f!morpion @joueur [taille]`' });
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

  // Récupérer la taille de la grille spécifiée (si présente)
  let size = DEFAULT_SIZE;
  if (args.length > 1) {
    const requestedSize = parseInt(args[1]);
    if (!isNaN(requestedSize)) {
      if (requestedSize < MIN_SIZE) {
        message.reply({ content: `La taille minimale de la grille est de ${MIN_SIZE}x${MIN_SIZE}.` });
        return;
      } else if (requestedSize > MAX_SIZE) {
        message.reply({ content: `La taille maximale de la grille est de ${MAX_SIZE}x${MAX_SIZE}.` });
        return;
      }
      size = requestedSize;
    }
  }

  // Déterminer la condition de victoire (nombre de symboles alignés)
  let winCondition = size >= 5 ? 4 : 3;

  // Créer une nouvelle partie
  const gameId = Date.now().toString();
  const game = {
    id: gameId,
    board: createBoard(size),
    size: size,
    winCondition: winCondition,
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
    new RegExp(`^[1-${size}]$`).test(m.content) &&
    game.state === GAME_STATES.PLAYING;

  const collector = message.channel.createMessageCollector({ filter, time: 300000 }); // 5 minutes

  collector.on('collect', async (m) => {
    // Vérifier si c'est bien le tour du joueur
    if (m.author.id !== game.currentPlayer) {
      m.reply({ content: "Ce n'est pas votre tour !" });
      return;
    }

    const column = parseInt(m.content);

    if (isNaN(column) || column < 1 || column > size) {
      m.reply({ content: `Position invalide ! Veuillez choisir un chiffre entre 1 et ${size}.` });
      return;
    }

    const col = column - 1;

    // Trouver la première position libre dans la colonne (en partant du bas)
    let row = -1;
    for (let i = size - 1; i >= 0; i--) {
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
    const winner = checkWinner(game.board, size, game.winCondition);

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
