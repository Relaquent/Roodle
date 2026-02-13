const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
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

// ===== GAME STATE =====
const players = new Map(); // socketId -> player data
const queue = new Set(); // waiting players
const activeGames = new Map(); // gameId -> game data
const playerProgress = new Map(); // playerId -> progress data

// ===== WORD LISTS =====
const WORD_LISTS = {
  4: ["KAPI", "SORU", "BABA", "ASLI", "ELMA", "YAZI", "KALE", "KOŞU", "BİNA", "DANA", "ARZU", "ÖYKÜ", "SÜRE", "HAVA", "KISA", "KUZU", "PARA", "MASA", "MODA", "ORAN", "KUTU", "DERE", "KEÇİ", "SAYI", "KAYI", "GİDİ", "İLKE", "KİRA", "PAŞA", "SEVİ", "UYKU", "AYNA", "BOYA", "ADAM", "ESKİ", "ANNE", "DERİ", "ÖLÇÜ", "GAGA", "HATA", "OLAY", "SENE", "ŞAKA", "İMZA", "KATI", "MEZE", "KORO", "LİSE", "SAHA", "YAPI", "KURS", "GURU", "TAKI", "KOZA", "ARTI", "DURU", "FARE", "YARI", "ÖDÜL", "AYAK", "HOCA", "ALAN", "ÇARE", "KARI", "EŞYA", "İLAÇ", "MAŞA", "KULE", "OVAL", "SIRA", "FOTO", "YÜZÜ", "BATI", "DOĞU", "KÜRE", "ASKI", "ÇENE", "DİZİ", "KOLA", "GECE", "CİNS", "ARPA", "SOPA", "İLİK", "MÜZE", "SİTE", "ÜLKE", "CADI", "LİRA", "GÜCÜ", "EKİN", "ADET", "VALE", "ÇATI", "AYIP", "BORÇ", "KAFE", "DERS", "ÖZEL", "KARA", "İSİM", "HAYI", "ÇITA", "KİLO", "BUSE", "ÖREN", "AMİR", "EKİM", "DANA", "ZARF", "TAHT", "İĞNE", "ÇİVİ", "EĞRİ", "KART", "KAYA", "İMHA", "EKOZ", "HİBE", "VALİ", "İCAT", "LİMAN", "KREP", "KAZA", "İNCE", "KÖŞE", "AKIL", "AYAR", "BONE", "DÜZE", "İCRA", "KIRA", "SEDA", "BÜRO", "SÖZÜ", "ŞİİR", "AVCI", "SİLO", "BANT", "KOTA", "MİNA", "CİLT", "İRAN", "FİRE", "FİDE", "ÖNCÜ", "OKUL", "ADIM", "AZIK", "DİLİ", "KAZI", "AKIM", "EŞİK", "AZİZ", "KORO", "ALAY", "GİŞE", "ŞİLE", "ÖDEM", "SİHİ", "EĞİM", "ÇİFT", "BORU", "SULU", "KATI", "BİRE", "KÜFE", "DÜET", "ALET", "MİNE", "İDOL", "İKNA", "İDRA", "KİRE", "KELE", "KÖYÜ", "RİSK", "SİRK", "TAZE", "TAPU", "TEPE", "VİZE", "YEDİ", "ZAMİ", "ÖDÜN", "YARA", "TANI", "KORU", "ERİM", "OLTA", "SOBA", "SAPA", "DOKU", "KEŞF", "ÜMİT", "GÖZE", "FAİZ", "BALE", "KOYU", "İNCİ", "GİZİ", "KATI", "ORSA"],
  5: ["AKŞAM", "BALON", "CADDE", "DALGA", "ELMAS", "FENER", "GÜNEŞ", "HABER", "İNSAN", "JOKER", "KAYIK", "LIMON", "MASAL", "NEFES", "ORMAN", "PAZAR", "RADYO", "SABAH", "ŞEHİR", "TARLA", "UYGUR", "VÜCUT", "YALAN", "ZAMAN", "ABONE", "BAHAR", "CEKET", "DOLAP", "EMLAK", "FİDAN", "GURUR", "HAYAT", "ISLIK", "İÇKİT", "JETON", "KASAP", "LİSTE", "MERAK", "NODUL", "ORTAK", "PİLOT", "RAKET", "SAYFA", "ŞARKI", "TAVAN", "UZMAN", "VATAN", "YAREN", "ZİHİN", "ACELE", "BALIK", "CİHAN", "DEMİR", "EGZOZ", "FATUR", "GÖLGE", "HUKUK", "ILGAZ", "İPUCU", "JİLET", "KAVUN", "LEVHA", "MİRAS", "NAKIŞ", "ORHAN", "PARÇA", "REÇEL", "SOLUK", "ŞEKER", "TABLO", "UÇKUN", "VALİZ", "YALIN", "ZORLU", "ADRES", "BÖLGE", "CÜMLE", "DÜNYA", "EŞARP", "FIRÇA", "GÖREV", "HESAP", "IŞIMA", "İNKAR", "KABLO", "LOKMA", "MÜZİK", "NİMET", "OPERA", "PEDAL", "ROKET", "SEPET", "ŞÖYLE", "TÜFEK", "UYARI", "VAKIF", "YALDI", "ZİRAİ", "AHLAK", "BELGE", "CEVAP", "DİREK", "ERKEK", "FİYAT", "GÖRÜŞ", "HUZUR", "ASLAN", "İSKEÇ", "KADER", "LAZIM", "METRO", "NESİL", "ORİJİN", "PROJE", "ROMAN", "SÜREÇ", "ŞAHIS", "TEKİN", "UMUTL", "VOTKA", "YAZAR", "ZARAR", "ALTIN", "BÖREK", "CESUR", "DÜĞÜN", "EVRAK", "FLAMA", "GÜVEN", "HİSSE", "IDDI", "İZMİR", "KİTAP", "LİMAN", "MODEL", "NOKTA", "OTİZM", "PAMUK", "REHİN", "SİLAH", "ŞERİT", "TURŞU", "UÇMAK", "VAKİT", "YEMEK", "ZİNCİ", "ANTEN", "BEYAZ", "CAMIZ", "DÜŞÜŞ", "EKSİK", "FORMA", "GÜZEL", "HELVA", "IŞIMA", "İHRAÇ", "KAVGA", "LİSAN", "MADDE", "NAZAR", "OYNAN", "PASTA", "REJİM", "SINAV", "ŞURUP", "TAŞIT", "UYGAR", "VİLLA", "YARIŞ", "ZEBRA", "AYRAN", "BİLET", "CİHAZ", "DURAK", "EYLEM", "FİNAL", "GELİN", "HAKİM", "ISSIZ", "İNCİR", "KAYIP", "LİMİT", "MESAJ", "NİSAN", "ORGAN", "PENYE", "REKOR", "SİVRİ", "ŞÜPHE", "TEPSİ", "UZAYI", "VİRAJ", "YÜZEY", "ZALİM", "ARABA", "BARIŞ", "COŞKU", "DENİZ", "ERKEN", "FESAT", "KAFİR", "HALEF", "ITRAK", "İLHAK", "KARGO", "LAKAP", "MEYVE", "NİÇİN", "OKUMA", "PLAKA", "RADAR", "SAYGI", "ŞOFÖR", "TAVŞA", "UÇKUN", "VURGU", "YAKIN", "ZAMLI"],
  6: ["GARDOP", "KARTAL", "YARDIM", "BALKON", "GÖZLÜK", "TÜRKÇE", "MANTIK", "PİJAMA", "SÖZLÜK", "TOPRAK", "SİNCAP", "HEYKEL", "KUYRUK", "MİLYON", "ÇEYREK", "DOKTOR", "ZEYTİN", "BARDAK", "GAYRET", "MEKTUP", "FIRTIN", "KORKUŞ", "KABİNE", "RESMEN", "ŞÖVALE", "KOLTUK", "YAPRAK", "KAPTAN", "SİGARA", "GURBET", "FISTIK", "HAYVAN", "SARMAL", "BİRLİK", "EKMEKÇ", "CÜZDAN", "SULTAN", "MİKROP", "KAMYON", "DİKKAT", "ŞEFFAF", "VİCDAN", "BAYRAM", "İSTİFA", "KAYNAK", "ADALET", "MUTFAK", "ŞEMSİYE", "TABİAT", "HAYRET", "MÜHÜRL", "DESTAN", "PİKNİK", "KAYKAY", "TAVŞAN", "KONSER", "PİŞMAN", "SAĞLIK", "BİSKEÇ", "MERCAN", "KUDRET", "KISMET", "LASTİK", "NAFAKA", "GAZETE", "MERKEZ", "FELSEF", "KIYMET", "YILDIZ", "SULHÇU", "KEPÇEÇ", "ZAHMET", "TERMİS", "MEYDAN", "ŞAHANE", "İBADET", "KUVVET", "HASRET", "BİRLİK", "VİTRİN", "SİYASET", "KARPUZ", "SİSİLY", "MİSÜLÜ", "KÜLTÜR", "PERDEY", "DİRSEK", "DURDUR", "KAYGAN", "İŞARET", "PARMAK", "TİMSAH", "ŞARJÖR", "MİSAİR", "BOYNUZ", "HORTUM", "SANDAL", "FİLİSİ", "KAYISI", "MAHKUM", "TEKNİK", "YEMİNL", "SİİRTİ", "KİMLİK", "KONTAK", "CÖMERT", "HÜCİRE", "TERLİK", "SİSTEM", "PORSEN", "KUMSAL", "YÜZÜCÜ", "SARMAL", "KAYKAY", "SİRKET", "DİREKÇ", "KİSVEL", "KAYNAŞ", "GÖRSEL", "KAZANÇ", "FİZİKİ", "İHANET", "SIRDAŞ", "BÜLBÜL", "KABARE", "SERVİS", "İSKELE", "KÖPRÜS", "BASKIN", "GÜNCEL", "YALÇIN", "MECLİS", "KORUMA", "KIBRIS", "SİRİKE", "TASARI", "KEŞKEK", "GÜLMEK", "İMKANI", "TÜCCAR", "MASRAF", "HEYBET", "PİRİNÇ", "ŞÖHRET", "TEKLİF", "KÜSMEK", "YAKAMO", "FERSAH", "İSTEKİ", "BİLYAÇ", "KUNDUZ", "KASTEN", "TEMSİL", "KAYNAK", "KOSTÜM", "HESABI", "FESLEĞ", "GERÇEK", "MODERN", "KIYAFE", "KEMANE", "DİNGİL", "BİTKİS", "SÜRGÜN", "İHRACAT", "YALDIZ", "TAKVİM", "TUNCEL", "SAYDAM", "KURŞUN", "SÜSLEM", "TERHİS", "VARLIK", "YANDAŞ", "KORNET", "GÜNCEL", "HAYDİÇ", "KUMPAS", "MİNDER", "SÜREKL", "KIŞLIK", "ŞİMDİK", "GURBET", "FIRTIN", "KABİLE", "İSABET", "KAYGIN", "DÜELLO", "MERHEM", "SABIKA", "TAKDİM", "BİTİRİ", "DÖNEMEÇ", "HEYCANLI", "ŞELALE", "ZALİMİ", "KAVRAM", "KOŞULU", "ZİGZAG"],
  7: ["ANAYASA", "BELEDİYE", "ÇİSANTİ", "DİLEKÇE", "EMİRGAN", "FASULYE", "GÖKYÜZÜ", "HAKARET", "ISPANAK", "İSKELET", "JANDARMA", "KABURGA", "LOKANTA", "MERHABA", "NAKLİYE", "OKYANUS", "PENCERE", "RANDEVU", "SANDALYE", "ŞAMPUAN", "TELEFON", "UYGULAMA", "VAZİYET", "YUMURTA", "ZAFİYET", "AHTAPOT", "BAŞKENT", "CESARET", "DENEYİM", "EĞLENCE", "FABRİKA", "GÖSTERİ", "HASTANE", "IHLAMUR", "İSTİDAT", "KAVANOZ", "LAVANTA", "MİSAFİR", "NUMARAL", "OYUNCU", "PIRLANTA", "REFAHAT", "SAYGILI", "ŞAŞIRMA", "TİYATRO", "UZUNLUK", "VERİMLİ", "YETENEK", "ZORUNLU", "AMBALAJ", "BERABER", "COĞRAFA", "DÜŞÜNCE", "EMNİYET", "FESTİVAL", "GÖRÜNTÜ", "HAYSİYET", "ISIRGAN", "İLGİNÇTİ", "KAZANIM", "LEVREKL", "MUTLULU", "NAMUSLU", "OTOMATİK", "PANAYIR", "REKABET", "SİNEMACI", "ŞAKAYIK", "TEMİZLİK", "UZMANLA", "VALİZLE", "YAZILIM", "ZENGİNL", "AKTARIM", "BİSİKLET", "ÇERÇEVE", "DEĞİRMEN", "EFSANEVİ", "FELAKET", "GİRİŞİM", "HAYALET", "ISMARLA", "İMTİHAN", "KARANFİL", "LİMONATA", "MALİYET", "NİŞASTA", "OKSİJEN", "PERŞEMBE", "SAMİMİYET", "ŞEHİRLİ", "TARTIŞMA", "ÜRETİCİ", "VARİSÇİ", "YIKILMA", "ZABITALA", "ANLAYIŞ", "BAĞLAMA", "CEPHANE", "DÜZENLİ", "EKSİKLİK", "FERAHLIK", "GÖREVLİ", "HAREKET", "IŞILDAK", "İÇECEKLİ", "KONTROL", "LÜBEYYE", "MİLYARD", "NEZAKET", "ORDUEVİ", "PATATES", "REÇETELİ", "SÜREKLİ", "ŞİKAYET", "TOPLANTI", "ÜZÜNTÜLÜ", "VİCDANLI", "YÖNETİM", "ZÜMRÜT", "ALTYAPI", "BULANIK", "CÖMERTLİK", "DÜZELTME", "ELBİSELİ", "FAALİYET", "GÜNEŞLİ", "HAZİNEM", "İLANLAR", "KÜLTÜRLÜ", "MADALYA", "NİTELİK", "OYUNCAK", "PORSİYON", "REHBERLİK", "SEVİYELİ", "ŞAHSİYET", "TAMİRAT", "UYARICI", "VAKİTLİ", "YARATIK", "ZİYARET", "ASİSTAN", "BÖLGESEL", "ÇALIŞKAN", "DİNAMİK", "EĞİTMEN", "FOTOĞRAF", "GÖREVDE", "HAVADİS", "ISIRMAK", "İLETİŞİM", "KAPTANLI", "LAVABOLU", "MANTARLI", "NÖBETÇİ", "OTURMAK", "PARLAMA", "REKORCU", "SATIŞLAR", "ŞAŞIRTMA", "TASARIM", "ÜYELİKLER", "VALİZLER", "YAZILIM", "ZAMANDA", "AVUKATLIK", "BİLDİRİM", "ÇEVRECİ", "DİKKATLİ", "EKİPMAN", "FIKRAAN", "GÜLERİZ", "HAYIRLI", "İSABETLİ", "KAPASİTE", "LAHMACUN", "MERİNOS", "NUMARALI", "ORMANCI", "PANDÜL", "SESSİZLİK", "TECRÜBE", "VİRGÜLLÜ", "YETKİLİ", "ZIMBALI", "ÇİZGİLİ", "DERLEME", "SATILIK", "FARKSIZ", "SABANCI", "HASIRCI"]
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

// Generate ranks up to level 100
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

function calculateXP(won, guessCount) {
  if (!won) return 10; // Participation XP
  
  let baseXP = 50;
  const bonuses = {
    1: 100,
    2: 75,
    3: 50,
    4: 30,
    5: 20,
    6: 10
  };
  
  return baseXP + (bonuses[guessCount] || 0);
}

function updatePlayerLevel(playerId, xpGained) {
  let progress = playerProgress.get(playerId) || {
    totalXP: 0,
    level: 1,
    currentXP: 0,
    wins: 0,
    losses: 0,
    gamesPlayed: 0
  };

  progress.totalXP += xpGained;
  progress.currentXP += xpGained;

  // Check for level up
  let leveledUp = false;
  while (progress.level < 100) {
    const nextRank = RANKS[progress.level + 1];
    if (progress.totalXP >= nextRank.xpNeeded) {
      progress.level++;
      progress.currentXP = 0;
      leveledUp = true;
    } else {
      break;
    }
  }

  playerProgress.set(playerId, progress);
  return { progress, leveledUp };
}

function getPlayerProgress(playerId) {
  return playerProgress.get(playerId) || {
    totalXP: 0,
    level: 1,
    currentXP: 0,
    wins: 0,
    losses: 0,
    gamesPlayed: 0
  };
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

  const game = {
    id: gameId,
    players: {
      [player1Id]: {
        socketId: player1Id,
        playerId: player1.playerId,
        nick: player1.nick,
        level: player1.level,
        rank: player1.rank,
        guesses: [],
        currentGuess: 0,
        finished: false,
        won: false,
        guessCount: 0
      },
      [player2Id]: {
        socketId: player2Id,
        playerId: player2.playerId,
        nick: player2.nick,
        level: player2.level,
        rank: player2.rank,
        guesses: [],
        currentGuess: 0,
        finished: false,
        won: false,
        guessCount: 0
      }
    },
    targetWord,
    wordLength,
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
      rank: player2.rank
    },
    wordLength
  });

  io.to(player2Id).emit('game:start', {
    gameId,
    opponent: {
      nick: player1.nick,
      level: player1.level,
      rank: player1.rank
    },
    wordLength
  });

  console.log(`Game started: ${gameId} - ${player1.nick} vs ${player2.nick}`);
}

// ===== SOCKET.IO EVENTS =====
io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  // Player registration
  socket.on('player:register', (data) => {
    const { playerId, nick, level, rank, preferredLength } = data;
    
    players.set(socket.id, {
      socketId: socket.id,
      playerId: playerId || socket.id,
      nick: nick || 'Oyuncu',
      level: level || 1,
      rank: rank || 'Yeni Doğmuş I',
      preferredLength: preferredLength || 5,
      currentGameId: null
    });

    // Load player progress
    const progress = getPlayerProgress(playerId || socket.id);
    
    socket.emit('player:registered', {
      playerId: playerId || socket.id,
      progress
    });

    console.log(`Player registered: ${nick} (Level ${level})`);
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

    // Broadcast queue update to all waiting players
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
              rank: p.rank
            } : null;
          }).filter(Boolean)
        });
      }
    });

    console.log(`Player joined queue: ${player.nick} (Queue size: ${queue.size})`);

    // Try matchmaking
    tryMatchmaking();
  });

  // Leave queue
  socket.on('queue:leave', () => {
    queue.delete(socket.id);
    socket.emit('queue:left');
    console.log(`Player left queue (Queue size: ${queue.size})`);
  });

  // Submit guess
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

    if (playerData.finished) {
      socket.emit('error', { message: 'Already finished' });
      return;
    }

    // Validate guess
    const targetWord = game.targetWord;
    const result = evaluateGuess(guess.toUpperCase(), targetWord);
    
    playerData.guesses.push({
      word: guess.toUpperCase(),
      result
    });
    playerData.currentGuess++;

    const won = guess.toUpperCase() === targetWord;
    const lost = playerData.currentGuess >= 6 && !won;

    if (won || lost) {
      playerData.finished = true;
      playerData.won = won;
      playerData.guessCount = playerData.currentGuess;
    }

    // Send result to player
    socket.emit('game:guess:result', {
      guess: guess.toUpperCase(),
      result,
      won,
      lost
    });

    // Send opponent update
    const opponentId = Object.keys(game.players).find(id => id !== socket.id);
    if (opponentId) {
      io.to(opponentId).emit('game:opponent:update', {
        guessCount: playerData.currentGuess,
        finished: playerData.finished,
        won: playerData.won
      });
    }

    // Check if game is over
    const allFinished = Object.values(game.players).every(p => p.finished);
    if (allFinished) {
      endGame(gameId);
    }
  });

  // Request progress
  socket.on('player:progress:get', (data) => {
    const playerId = data.playerId || socket.id;
    const progress = getPlayerProgress(playerId);
    socket.emit('player:progress:update', { progress });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    
    const player = players.get(socket.id);
    if (player && player.currentGameId) {
      const game = activeGames.get(player.currentGameId);
      if (game) {
        // Notify opponent
        const opponentId = Object.keys(game.players).find(id => id !== socket.id);
        if (opponentId) {
          io.to(opponentId).emit('game:opponent:disconnected');
          
          // Award win to opponent
          const opponentPlayer = game.players[opponentId];
          const opponentData = players.get(opponentId);
          
          if (opponentPlayer && opponentData) {
            const xpGained = calculateXP(true, opponentPlayer.currentGuess || 1);
            const { progress, leveledUp } = updatePlayerLevel(opponentData.playerId, xpGained);
            progress.wins++;
            progress.gamesPlayed++;
            playerProgress.set(opponentData.playerId, progress);

            io.to(opponentId).emit('game:end', {
              result: 'win',
              reason: 'opponent_disconnected',
              xpGained,
              progress,
              leveledUp
            });
          }
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

  // Check correct positions
  for (let i = 0; i < target.length; i++) {
    if (guessArr[i] === targetArr[i]) {
      result[i] = 'correct';
      targetCount[guessArr[i]]--;
    }
  }

  // Check present letters
  for (let i = 0; i < target.length; i++) {
    if (result[i] === 'absent' && targetCount[guessArr[i]] > 0) {
      result[i] = 'present';
      targetCount[guessArr[i]]--;
    }
  }

  return result;
}

function endGame(gameId) {
  const game = activeGames.get(gameId);
  if (!game) return;

  const playerIds = Object.keys(game.players);
  const results = {};

  playerIds.forEach(socketId => {
    const playerData = game.players[socketId];
    const player = players.get(socketId);
    
    if (!player) return;

    const won = playerData.won;
    const xpGained = calculateXP(won, playerData.guessCount);
    const { progress, leveledUp } = updatePlayerLevel(player.playerId, xpGained);

    if (won) {
      progress.wins++;
    } else {
      progress.losses++;
    }
    progress.gamesPlayed++;

    playerProgress.set(player.playerId, progress);

    results[socketId] = {
      won,
      guessCount: playerData.guessCount,
      xpGained,
      progress,
      leveledUp
    };

    // Send game end event
    io.to(socketId).emit('game:end', {
      result: won ? 'win' : 'lose',
      targetWord: game.targetWord,
      xpGained,
      progress,
      leveledUp,
      opponent: {
        nick: game.players[playerIds.find(id => id !== socketId)]?.nick,
        guessCount: game.players[playerIds.find(id => id !== socketId)]?.guessCount,
        won: game.players[playerIds.find(id => id !== socketId)]?.won
      }
    });

    // Clear current game
    player.currentGameId = null;
  });

  activeGames.delete(gameId);
  console.log(`Game ended: ${gameId}`);
}

// ===== REST API =====
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    players: players.size,
    queue: queue.size,
    activeGames: activeGames.size
  });
});

app.get('/stats', (req, res) => {
  res.json({
    totalPlayers: players.size,
    queueSize: queue.size,
    activeGames: activeGames.size,
    totalProgress: playerProgress.size
  });
});

app.post('/progress/save', (req, res) => {
  const { playerId, progress } = req.body;
  if (!playerId || !progress) {
    return res.status(400).json({ error: 'Missing data' });
  }
  
  playerProgress.set(playerId, progress);
  res.json({ success: true });
});

app.get('/progress/:playerId', (req, res) => {
  const { playerId } = req.params;
  const progress = getPlayerProgress(playerId);
  res.json({ progress });
});

// ===== SERVER START =====
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🎮 Roodle Multiplayer Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});