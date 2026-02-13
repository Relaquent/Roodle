const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ===== PERSISTENT STORAGE =====
const DATA_DIR = path.join(__dirname, 'data');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');

// Create data directory if it doesn't exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load or initialize data
let persistentPlayers = {};
let leaderboard = [];

function loadData() {
  try {
    if (fs.existsSync(PLAYERS_FILE)) {
      persistentPlayers = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
    }
    if (fs.existsSync(LEADERBOARD_FILE)) {
      leaderboard = JSON.parse(fs.readFileSync(LEADERBOARD_FILE, 'utf8'));
    }
    console.log('Data loaded successfully');
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

function saveData() {
  try {
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify(persistentPlayers, null, 2));
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(leaderboard, null, 2));
  } catch (error) {
    console.error('Error saving data:', error);
  }
}

// Save data periodically
setInterval(saveData, 30000); // Every 30 seconds

// Load data on startup
loadData();

// ===== GAME STATE =====
const players = new Map(); // socketId -> player data
const queue = new Set(); // waiting players
const activeGames = new Map(); // gameId -> game data

// ===== WORD LISTS =====
const WORD_LISTS = {
  4: ["KAPI", "SORU", "BABA", "ASLI", "ELMA", "YAZI", "KALE", "KOŞU", "BİNA", "DANA", "ARZU", "ÖYKÜ", "SÜRE", "HAVA", "KISA", "KUZU", "PARA", "MASA", "MODA", "ORAN", "KUTU", "DERE", "KEÇİ", "SAYI", "KAYI", "GİDİ", "İLKE", "KİRA", "PAŞA", "SEVİ", "UYKU", "AYNA", "BOYA", "ADAM", "ESKİ", "ANNE", "DERİ", "ÖLÇÜ", "GAGA", "HATA", "OLAY", "SENE", "ŞAKA", "İMZA", "KATI", "MEZE", "KORO", "LİSE", "SAHA", "YAPI"],
  5: ["AKŞAM", "BALON", "CADDE", "DALGA", "ELMAS", "FENER", "GÜNEŞ", "HABER", "İNSAN", "JOKER", "KAYIK", "LIMON", "MASAL", "NEFES", "ORMAN", "PAZAR", "RADYO", "SABAH", "ŞEHİR", "TARLA", "UYGUR", "VÜCUT", "YALAN", "ZAMAN", "ABONE", "BAHAR", "CEKET", "DOLAP", "EMLAK", "FİDAN", "GURUR", "HAYAT", "ISLIK", "İÇKİT", "JETON", "KASAP", "LİSTE", "MERAK", "NODUL", "ORTAK", "PİLOT", "RAKET", "SAYFA", "ŞARKI", "TAVAN", "UZMAN", "VATAN", "YAREN", "ZİHİN"],
  6: ["GARDOP", "KARTAL", "YARDIM", "BALKON", "GÖZLÜK", "TÜRKÇE", "MANTIK", "PİJAMA", "SÖZLÜK", "TOPRAK", "SİNCAP", "HEYKEL", "KUYRUK", "MİLYON", "ÇEYREK", "DOKTOR", "ZEYTİN", "BARDAK", "GAYRET", "MEKTUP", "FIRTIN", "KORKUŞ", "KABİNE", "RESMEN", "ŞÖVALE", "KOLTUK", "YAPRAK", "KAPTAN", "SİGARA", "GURBET", "FISTIK", "HAYVAN", "SARMAL", "BİRLİK", "EKMEKÇ", "CÜZDAN", "SULTAN", "MİKROP", "KAMYON", "DİKKAT"],
  7: ["ANAYASA", "BELEDİYE", "ÇİSANTİ", "DİLEKÇE", "EMİRGAN", "FASULYE", "GÖKYÜZÜ", "HAKARET", "ISPANAK", "İSKELET", "JANDARMA", "KABURGA", "LOKANTA", "MERHABA", "NAKLİYE", "OKYANUS", "PENCERE", "RANDEVU", "SANDALYE", "ŞAMPUAN", "TELEFON", "UYGULAMA", "VAZİYET", "YUMURTA", "ZAFİYET", "AHTAPOT", "BAŞKENT", "CESARET", "DENEYİM", "EĞLENCE"]
};

// ===== RANK SYSTEM =====
const RANKS = {
  1: { name: "Yeni Doğmuş I", xpNeeded: 100 },
  2: { name: "Yeni Doğmuş II", xpNeeded: 150 },
  3: { name: "Yeni Doğmuş III", xpNeeded: 200 },
  4: { name: "Yeni Doğmuş IV", xpNeeded: 250 },
  5: { name: "Yeni Doğmuş V", xpNeeded: 300 },
  6: { name: "Amatör I", xpNeeded: 400 },
  7: { name: "Amatör II", xpNeeded: 500 },
  8: { name: "Amatör III", xpNeeded: 600 },
  9: { name: "Amatör IV", xpNeeded: 700 },
  10: { name: "Bilirkişi I", xpNeeded: 850 },
  11: { name: "Bilirkişi II", xpNeeded: 1000 },
  12: { name: "Bilirkişi III", xpNeeded: 1200 },
  13: { name: "Bilirkişi IV", xpNeeded: 1400 },
  14: { name: "Bilirkişi V", xpNeeded: 1600 },
  15: { name: "Usta I", xpNeeded: 1850 },
  16: { name: "Usta II", xpNeeded: 2100 },
  17: { name: "Usta III", xpNeeded: 2400 },
  18: { name: "Usta IV", xpNeeded: 2700 },
  19: { name: "Usta V", xpNeeded: 3000 },
  20: { name: "General I", xpNeeded: 3400 },
  21: { name: "General II", xpNeeded: 3800 },
  22: { name: "General III", xpNeeded: 4300 },
  23: { name: "General IV", xpNeeded: 4800 },
  24: { name: "General V", xpNeeded: 5400 },
  25: { name: "CEO I", xpNeeded: 6000 },
  26: { name: "CEO II", xpNeeded: 6700 },
  27: { name: "CEO III", xpNeeded: 7500 },
  28: { name: "CEO IV", xpNeeded: 8400 },
  29: { name: "CEO V", xpNeeded: 9400 },
  30: { name: "Görmüş Geçirmiş", xpNeeded: 10500 }
};

for (let i = 31; i <= 100; i++) {
  RANKS[i] = { name: "Görmüş Geçirmiş", xpNeeded: RANKS[i-1].xpNeeded + 1200 };
}

// ===== HELPER FUNCTIONS =====
function getRandomWord(length) {
  const list = WORD_LISTS[length];
  return list[Math.floor(Math.random() * list.length)];
}

function generateGameId() {
  return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function coinFlip() {
  return Math.random() < 0.5;
}

function getPlayerData(playerId) {
  if (!persistentPlayers[playerId]) {
    persistentPlayers[playerId] = {
      playerId,
      totalXP: 0,
      level: 1,
      currentXP: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      gamesPlayed: 0,
      rankedPoints: 1000, // Starting ELO-like rating
      highestRank: 1000,
      winStreak: 0,
      bestWinStreak: 0
    };
  }
  return persistentPlayers[playerId];
}

function updatePlayerLevel(playerId, xpGained) {
  let playerData = getPlayerData(playerId);

  playerData.totalXP += xpGained;
  playerData.currentXP += xpGained;

  let leveledUp = false;
  while (playerData.level < 100) {
    const nextRank = RANKS[playerData.level + 1];
    if (playerData.totalXP >= nextRank.xpNeeded) {
      playerData.level++;
      playerData.currentXP = 0;
      leveledUp = true;
    } else {
      break;
    }
  }

  persistentPlayers[playerId] = playerData;
  saveData();
  
  return { playerData, leveledUp };
}

function updateRankedPoints(winner, loser, isDraw = false) {
  const winnerData = getPlayerData(winner);
  const loserData = getPlayerData(loser);

  const K = 32; // K-factor for ELO
  const expectedWinner = 1 / (1 + Math.pow(10, (loserData.rankedPoints - winnerData.rankedPoints) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerData.rankedPoints - loserData.rankedPoints) / 400));

  if (isDraw) {
    winnerData.rankedPoints += Math.round(K * (0.5 - expectedWinner));
    loserData.rankedPoints += Math.round(K * (0.5 - expectedLoser));
    winnerData.draws++;
    loserData.draws++;
  } else {
    const winnerChange = Math.round(K * (1 - expectedWinner));
    const loserChange = Math.round(K * (0 - expectedLoser));
    
    winnerData.rankedPoints += winnerChange;
    loserData.rankedPoints += loserChange;
    
    winnerData.wins++;
    winnerData.winStreak++;
    winnerData.bestWinStreak = Math.max(winnerData.bestWinStreak, winnerData.winStreak);
    
    loserData.losses++;
    loserData.winStreak = 0;
  }

  winnerData.highestRank = Math.max(winnerData.highestRank, winnerData.rankedPoints);
  loserData.highestRank = Math.max(loserData.highestRank, loserData.rankedPoints);

  winnerData.gamesPlayed++;
  loserData.gamesPlayed++;

  persistentPlayers[winner] = winnerData;
  persistentPlayers[loser] = loserData;
  
  updateLeaderboard(winner);
  updateLeaderboard(loser);
  
  saveData();

  return {
    winnerPoints: winnerData.rankedPoints,
    loserPoints: loserData.rankedPoints,
    winnerChange: isDraw ? Math.round(K * (0.5 - expectedWinner)) : Math.round(K * (1 - expectedWinner)),
    loserChange: isDraw ? Math.round(K * (0.5 - expectedLoser)) : Math.round(K * (0 - expectedLoser))
  };
}

function updateLeaderboard(playerId) {
  const playerData = getPlayerData(playerId);
  
  const existingIndex = leaderboard.findIndex(p => p.playerId === playerId);
  
  const leaderboardEntry = {
    playerId: playerData.playerId,
    nick: players.get(Object.keys(players).find(k => players.get(k)?.playerId === playerId))?.nick || 'Oyuncu',
    rankedPoints: playerData.rankedPoints,
    level: playerData.level,
    wins: playerData.wins,
    losses: playerData.losses,
    draws: playerData.draws,
    gamesPlayed: playerData.gamesPlayed,
    winStreak: playerData.winStreak
  };

  if (existingIndex >= 0) {
    leaderboard[existingIndex] = leaderboardEntry;
  } else {
    leaderboard.push(leaderboardEntry);
  }

  // Sort by ranked points
  leaderboard.sort((a, b) => b.rankedPoints - a.rankedPoints);
  
  // Keep top 100
  leaderboard = leaderboard.slice(0, 100);
  
  saveData();
}

function getLeaderboard() {
  return leaderboard.slice(0, 50); // Return top 50
}

// ===== MATCHMAKING =====
function tryMatchmaking() {
  if (queue.size < 2) return;

  const [player1Id, player2Id] = Array.from(queue).slice(0, 2);
  
  queue.delete(player1Id);
  queue.delete(player2Id);

  const player1 = players.get(player1Id);
  const player2 = players.get(player2Id);

  if (!player1 || !player2) return;

  const gameId = generateGameId();
  const wordLength = player1.preferredLength || 5;
  const targetWord = getRandomWord(wordLength);

  // Coin flip to determine first player
  const player1First = coinFlip();
  const firstPlayerId = player1First ? player1Id : player2Id;

  const game = {
    id: gameId,
    targetWord,
    wordLength,
    maxGuesses: 12, // Total 12 guesses (6 per player initially, extends if needed)
    currentTurn: firstPlayerId,
    turnNumber: 0,
    allGuesses: [], // All guesses in order
    players: {
      [player1Id]: {
        socketId: player1Id,
        playerId: player1.playerId,
        nick: player1.nick,
        level: player1.level,
        rank: player1.rank,
        rankedPoints: getPlayerData(player1.playerId).rankedPoints,
        myGuesses: [],
        finished: false,
        won: false
      },
      [player2Id]: {
        socketId: player2Id,
        playerId: player2.playerId,
        nick: player2.nick,
        level: player2.level,
        rank: player2.rank,
        rankedPoints: getPlayerData(player2.playerId).rankedPoints,
        myGuesses: [],
        finished: false,
        won: false
      }
    },
    startTime: Date.now(),
    status: 'active'
  };

  activeGames.set(gameId, game);
  
  players.get(player1Id).currentGameId = gameId;
  players.get(player2Id).currentGameId = gameId;

  // Notify both players
  io.to(player1Id).emit('game:start', {
    gameId,
    opponent: {
      nick: player2.nick,
      level: player2.level,
      rank: player2.rank,
      rankedPoints: game.players[player2Id].rankedPoints
    },
    wordLength,
    yourTurn: player1First,
    maxGuesses: game.maxGuesses
  });

  io.to(player2Id).emit('game:start', {
    gameId,
    opponent: {
      nick: player1.nick,
      level: player1.level,
      rank: player1.rank,
      rankedPoints: game.players[player1Id].rankedPoints
    },
    wordLength,
    yourTurn: !player1First,
    maxGuesses: game.maxGuesses
  });

  console.log(`Game started: ${gameId} - ${player1.nick} vs ${player2.nick} - First: ${player1First ? player1.nick : player2.nick}`);
}

// ===== SOCKET.IO EVENTS =====
io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  // Player registration
  socket.on('player:register', (data) => {
    const { playerId, nick, level, rank, preferredLength } = data;
    
    const actualPlayerId = playerId || socket.id;
    const playerData = getPlayerData(actualPlayerId);
    
    players.set(socket.id, {
      socketId: socket.id,
      playerId: actualPlayerId,
      nick: nick || 'Oyuncu',
      level: level || playerData.level,
      rank: rank || RANKS[playerData.level].name,
      preferredLength: preferredLength || 5,
      currentGameId: null
    });

    socket.emit('player:registered', {
      playerId: actualPlayerId,
      progress: playerData
    });

    console.log(`Player registered: ${nick} (Level ${playerData.level}, Ranked: ${playerData.rankedPoints})`);
  });

  // Join queue
  socket.on('queue:join', (data) => {
    const player = players.get(socket.id);
    if (!player) {
      socket.emit('error', { message: 'Player not registered' });
      return;
    }

    if (data.preferredLength) {
      player.preferredLength = data.preferredLength;
    }

    queue.add(socket.id);
    
    socket.emit('queue:joined', {
      queueSize: queue.size
    });

    Array.from(queue).forEach(playerId => {
      const queuePlayer = players.get(playerId);
      if (queuePlayer) {
        io.to(playerId).emit('queue:update', {
          queueSize: queue.size,
          players: Array.from(queue).map(id => {
            const p = players.get(id);
            return p ? {
              nick: p.nick,
              level: p.level,
              rank: p.rank,
              rankedPoints: getPlayerData(p.playerId).rankedPoints
            } : null;
          }).filter(Boolean)
        });
      }
    });

    console.log(`Player joined queue: ${player.nick} (Queue size: ${queue.size})`);

    tryMatchmaking();
  });

  // Leave queue
  socket.on('queue:leave', () => {
    queue.delete(socket.id);
    socket.emit('queue:left');
    console.log(`Player left queue (Queue size: ${queue.size})`);
  });

  // Submit guess (TURN-BASED)
  socket.on('game:guess', (data) => {
    const { gameId, guess } = data;
    const game = activeGames.get(gameId);
    
    if (!game) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    const playerData = game.players[socket.id];
    if (!playerData) {
      socket.emit('error', { message: 'Player not in game' });
      return;
    }

    // Check if it's player's turn
    if (game.currentTurn !== socket.id) {
      socket.emit('error', { message: 'Not your turn!' });
      return;
    }

    // Validate guess
    const targetWord = game.targetWord;
    const result = evaluateGuess(guess.toUpperCase(), targetWord);
    
    const guessData = {
      playerId: socket.id,
      playerNick: playerData.nick,
      word: guess.toUpperCase(),
      result,
      turnNumber: game.turnNumber
    };

    game.allGuesses.push(guessData);
    playerData.myGuesses.push(guessData);
    game.turnNumber++;

    const won = guess.toUpperCase() === targetWord;

    // Send result to both players
    const opponentId = Object.keys(game.players).find(id => id !== socket.id);
    
    io.to(socket.id).emit('game:guess:result', {
      guess: guess.toUpperCase(),
      result,
      won,
      yourTurn: false
    });

    if (opponentId) {
      io.to(opponentId).emit('game:opponent:guess', {
        guess: guess.toUpperCase(),
        result,
        opponentWon: won,
        yourTurn: !won
      });
    }

    // Check win condition
    if (won) {
      playerData.finished = true;
      playerData.won = true;
      endGame(gameId, socket.id);
      return;
    }

    // Check if game should continue or end in draw
    if (game.turnNumber >= game.maxGuesses) {
      endGame(gameId, null); // Draw
      return;
    }

    // Switch turn
    game.currentTurn = opponentId;
    
    io.to(opponentId).emit('game:turn:start', {
      turnNumber: game.turnNumber,
      guessesRemaining: game.maxGuesses - game.turnNumber
    });
  });

  // Get leaderboard
  socket.on('leaderboard:get', () => {
    socket.emit('leaderboard:update', {
      leaderboard: getLeaderboard()
    });
  });

  // Request progress
  socket.on('player:progress:get', (data) => {
    const playerId = data.playerId || socket.id;
    const progress = getPlayerData(playerId);
    socket.emit('player:progress:update', { progress });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    
    const player = players.get(socket.id);
    if (player && player.currentGameId) {
      const game = activeGames.get(player.currentGameId);
      if (game && game.status === 'active') {
        const opponentId = Object.keys(game.players).find(id => id !== socket.id);
        if (opponentId) {
          io.to(opponentId).emit('game:opponent:disconnected');
          
          // Award win to opponent
          endGame(player.currentGameId, opponentId, true);
        }
        
        activeGames.delete(player.currentGameId);
      }
    }
    
    queue.delete(socket.id);
    players.delete(socket.id);
  });
});

// ===== GAME LOGIC =====
function evaluateGuess(guess, target) {
  const result = Array(target.length).fill('absent');
  const targetArr = target.split('');
  const guessArr = guess.split('');
  const targetCount = {};

  targetArr.forEach(l => targetCount[l] = (targetCount[l] || 0) + 1);

  for (let i = 0; i < target.length; i++) {
    if (guessArr[i] === targetArr[i]) {
      result[i] = 'correct';
      targetCount[guessArr[i]]--;
    }
  }

  for (let i = 0; i < target.length; i++) {
    if (result[i] === 'absent' && targetCount[guessArr[i]] > 0) {
      result[i] = 'present';
      targetCount[guessArr[i]]--;
    }
  }

  return result;
}

function endGame(gameId, winnerId = null, disconnected = false) {
  const game = activeGames.get(gameId);
  if (!game) return;

  const playerIds = Object.keys(game.players);
  const isDraw = !winnerId;

  playerIds.forEach(socketId => {
    const playerData = game.players[socketId];
    const player = players.get(socketId);
    
    if (!player) return;

    const won = socketId === winnerId;
    const isWinner = won;
    const opponentId = playerIds.find(id => id !== socketId);
    
    let xpGained = 0;
    let rankedChange = 0;

    if (isDraw) {
      // Draw
      xpGained = 30;
      const rankingResult = updateRankedPoints(player.playerId, game.players[opponentId].playerId, true);
      rankedChange = socketId === playerIds[0] ? rankingResult.winnerChange : rankingResult.loserChange;
      
      const { playerData: updatedData, leveledUp } = updatePlayerLevel(player.playerId, xpGained);
      
      io.to(socketId).emit('game:end', {
        result: 'draw',
        targetWord: game.targetWord,
        xpGained,
        rankedChange,
        newRankedPoints: updatedData.rankedPoints,
        progress: updatedData,
        leveledUp,
        allGuesses: game.allGuesses
      });
    } else if (isWinner) {
      // Winner
      xpGained = 100 + (game.maxGuesses - game.turnNumber) * 10; // Bonus for quick win
      const rankingResult = updateRankedPoints(player.playerId, game.players[opponentId].playerId, false);
      rankedChange = rankingResult.winnerChange;
      
      const { playerData: updatedData, leveledUp } = updatePlayerLevel(player.playerId, xpGained);
      
      io.to(socketId).emit('game:end', {
        result: 'win',
        targetWord: game.targetWord,
        xpGained,
        rankedChange,
        newRankedPoints: updatedData.rankedPoints,
        progress: updatedData,
        leveledUp,
        disconnected,
        allGuesses: game.allGuesses
      });
    } else {
      // Loser
      xpGained = 20;
      const rankingResult = updateRankedPoints(game.players[opponentId].playerId, player.playerId, false);
      rankedChange = rankingResult.loserChange;
      
      const { playerData: updatedData } = updatePlayerLevel(player.playerId, xpGained);
      
      io.to(socketId).emit('game:end', {
        result: 'lose',
        targetWord: game.targetWord,
        xpGained,
        rankedChange,
        newRankedPoints: updatedData.rankedPoints,
        progress: updatedData,
        leveledUp: false,
        allGuesses: game.allGuesses
      });
    }

    if (player) {
      player.currentGameId = null;
    }
  });

  game.status = 'finished';
  activeGames.delete(gameId);
  console.log(`Game ended: ${gameId} - Winner: ${winnerId || 'DRAW'}`);
}

// ===== REST API =====
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    players: players.size,
    queue: queue.size,
    activeGames: activeGames.size,
    totalRegistered: Object.keys(persistentPlayers).length
  });
});

app.get('/stats', (req, res) => {
  res.json({
    totalPlayers: players.size,
    queueSize: queue.size,
    activeGames: activeGames.size,
    registeredPlayers: Object.keys(persistentPlayers).length,
    leaderboardSize: leaderboard.length
  });
});

app.get('/leaderboard', (req, res) => {
  res.json({
    leaderboard: getLeaderboard()
  });
});

app.get('/player/:playerId', (req, res) => {
  const { playerId } = req.params;
  const playerData = getPlayerData(playerId);
  
  const rank = leaderboard.findIndex(p => p.playerId === playerId) + 1;
  
  res.json({
    player: playerData,
    leaderboardRank: rank || null
  });
});

// ===== SERVER START =====
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🎮 Roodle Multiplayer Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🏆 Leaderboard: http://localhost:${PORT}/leaderboard`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: saving data and closing HTTP server');
  saveData();
  server.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: saving data and closing HTTP server');
  saveData();
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
