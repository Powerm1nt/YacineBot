import { commandLimiter } from '../utils/rateLimit.js';
import { formatMessage } from '../utils/messageFormatter.js';

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
const PLAYER_X = '❌';
const PLAYER_O = '⭕';

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
  // Ajouter les emojis pour les numéros de position
  const positions = [
    ['1️⃣', '2️⃣', '3️⃣'],
    ['4️⃣', '5️⃣', '6️⃣'],
    ['7️⃣', '8️⃣', '9️⃣']
  ];

  let result = '';
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      // Si la case est vide, afficher le numéro de position, sinon afficher le symbole
      result += board[i][j] === EMPTY ? positions[i][j] : board[i][j];
    }
    result += '\\n'; // Nouvelle ligne
  }
  return result;
}

/**
 * Convertit un numéro de position (1-9) en coordonnées [row, col]
 * @param {number} position - La position (1-9)
 * @returns {Array} - Les coordonnées [row, col]
 */
function positionToCoordinates(position) {
  position = parseInt(position);
  if (isNaN(position) || position < 1 || position > 9) {
    return null;
  }
  
  position--; // Convertir de 1-9 à 0-8
  const row = Math.floor(position / 3);
  const col = position % 3;
  
  return [row, col];
}

export async function morpion(client, message, args) {
  // Vérifier la limite de taux
  const rateLimitResult = commandLimiter.check(message.author.id);
  if (rateLimitResult !== true) {
    message.reply(formatMessage(rateLimitResult));
    return;
  }

  // Si l'utilisateur est déjà dans une partie
  if (Array.from(activeGames.values()).some(game => 
      game.players.includes(message.author.id) && 
      game.state !== GAME_STATES.FINISHED)) {
    message.reply(formatMessage('Vous avez déjà une partie en cours !'));
    return;
  }

  // Si aucun adversaire n'est mentionné
  if (!message.mentions.users.size) {
    message.reply(formatMessage('Veuillez mentionner un adversaire pour jouer au morpion !'));
    return;
  }

  const opponent = message.mentions.users.first();
  
  // Vérifier que l'adversaire n'est pas un bot
  if (opponent.bot) {
    message.reply(formatMessage('Vous ne pouvez pas jouer contre un bot !'));
    return;
  }
  
  // Vérifier que l'adversaire n'est pas l'utilisateur lui-même
  if (opponent.id === message.author.id) {
    message.reply(formatMessage('Vous ne pouvez pas jouer contre vous-même !'));
    return;
  }

  // Vérifier que l'adversaire n'est pas déjà dans une partie
  if (Array.from(activeGames.values()).some(game => 
      game.players.includes(opponent.id) && 
      game.state !== GAME_STATES.FINISHED)) {
    message.reply(formatMessage(`${opponent.username} a déjà une partie en cours !`));
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

  const initialMessage = `
🎮 **Nouvelle partie de Morpion** 🎮
${message.author.username} (${PLAYER_X}) VS ${opponent.username} (${PLAYER_O})

${renderBoard(game.board)}

C'est au tour de ${message.author.username} (${PLAYER_X})
Pour jouer, tapez un chiffre de 1 à 9 correspondant à la position.
`;

  const gameMessage = await message.channel.send(formatMessage(initialMessage));
  
  // Créer un collecteur de messages pour cette partie
  const filter = m => 
    (m.author.id === message.author.id || m.author.id === opponent.id) && 
    /^[1-9]$/.test(m.content) &&
    game.state === GAME_STATES.PLAYING;
  
  const collector = message.channel.createMessageCollector({ filter, time: 300000 }); // 5 minutes
  
  collector.on('collect', async (m) => {
    // Vérifier si c'est bien le tour du joueur
    if (m.author.id !== game.currentPlayer) {
      m.reply(formatMessage("Ce n'est pas votre tour !"));
      return;
    }
    
    const position = m.content;
    const coordinates = positionToCoordinates(position);
    
    if (!coordinates) {
      m.reply(formatMessage("Position invalide ! Veuillez choisir un chiffre entre 1 et 9."));
      return;
    }
    
    const [row, col] = coordinates;
    
    // Vérifier si la case est déjà occupée
    if (game.board[row][col] !== EMPTY) {
      m.reply(formatMessage("Cette case est déjà occupée ! Veuillez en choisir une autre."));
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
      
      const winMessage = `
🎮 **Partie de Morpion** 🎮
${renderBoard(game.board)}

🎉 **${m.author.username}** a gagné la partie ! 🎉
`;
      
      message.channel.send(formatMessage(winMessage));
      collector.stop('winner');
    } else if (isBoardFull(game.board)) {
      game.state = GAME_STATES.FINISHED;
      
      const drawMessage = `
🎮 **Partie de Morpion** 🎮
${renderBoard(game.board)}

🤝 **Match nul !** 🤝
`;
      
      message.channel.send(formatMessage(drawMessage));
      collector.stop('draw');
    } else {
      // Changer de joueur
      game.currentPlayer = game.players.find(id => id !== m.author.id);
      const nextPlayerUsername = client.users.cache.get(game.currentPlayer).username;
      const nextPlayerSymbol = game.playerSymbols[game.currentPlayer];
      
      const turnMessage = `
🎮 **Partie de Morpion** 🎮
${renderBoard(game.board)}

C'est au tour de **${nextPlayerUsername}** (${nextPlayerSymbol})
`;
      
      message.channel.send(formatMessage(turnMessage));
    }
  });
  
  collector.on('end', (collected, reason) => {
    if (reason === 'time') {
      // La partie a expiré
      game.state = GAME_STATES.FINISHED;
      
      message.channel.send(formatMessage("⏰ La partie a expiré par inactivité !"));
    }
    
    // Supprimer la partie de la liste des parties actives après un certain temps
    setTimeout(() => {
      activeGames.delete(gameId);
    }, 60000); // Garder la partie en mémoire pendant 1 minute après la fin
  });
}