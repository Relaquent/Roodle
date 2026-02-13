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
  if (leaderboard.length > 100) {
    leaderboard = leaderboard.slice(0, 100);
  }
  
  saveData();
}

function getLeaderboard() {
  return leaderboard.slice(0, 50);
}

function tryMatchPlayers() {
  if (queue.size < 2) return;

  const queueArray = Array.from(queue);
  
  // Simple matchmaking: take first two players
  const player1Id = queueArray[0];
  const player2Id = queueArray[1];

  const player1 = players.get(player1Id);
  const player2 = players.get(player2Id);

  if (!player1 || !player2) return;

  // Remove from queue
  queue.delete(player1Id);
  queue.delete(player2Id);

  // Create game
  const gameId = generateGameId();
  const wordLength = player1.preferredLength || 5;
  const targetWord = getRandomWord(wordLength);
  const firstPlayer = coinFlip() ? player1Id : player2Id;

  const game = {
    gameId,
    targetWord,
    wordLength,
    players: {
      [player1Id]: {
        playerId: player1.playerId,
        nick: player1.nick,
        guesses: [],
        finished: false,
        won: false
      },
      [player2Id]: {
        playerId: player2.playerId,
        nick: player2.nick,
        guesses: [],
        finished: false,
        won: false
      }
    },
    currentTurn: firstPlayer,
    turnNumber: 0,
    maxGuesses: 6,
    status: 'active',
    createdAt: Date.now(),
    allGuesses: []
  };

  activeGames.set(gameId, game);

  player1.currentGameId = gameId;
  player2.currentGameId = gameId;

  console.log(`Game created: ${gameId} - ${player1.nick} vs ${player2.nick} - First: ${firstPlayer === player1Id ? player1.nick : player2.nick}`);

  // Notify both players
  io.to(player1Id).emit('game:start', {
    gameId,
    wordLength,
    opponent: { nick: player2.nick, level: player2.level },
    yourTurn: firstPlayer === player1Id
  });

  io.to(player2Id).emit('game:start', {
    gameId,
    wordLength,
    opponent: { nick: player1.nick, level: player1.level },
    yourTurn: firstPlayer === player2Id
  });

  // Broadcast updated queue
  broadcastQueueUpdate();
}

function broadcastQueueUpdate() {
  const queuePlayers = Array.from(queue).map(socketId => {
    const player = players.get(socketId);
    return player ? {
      nick: player.nick,
      level: player.level,
      rank: player.rank
    } : null;
  }).filter(Boolean);

  io.emit('queue:update', { players: queuePlayers });
}

// ===== SOCKET EVENTS =====
io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  // Player registration
  socket.on('player:register', (data) => {
    const { playerId, nick, level, rank, preferredLength } = data;
    
    const storedData = getPlayerData(playerId || socket.id);
    
    players.set(socket.id, {
      socketId: socket.id,
      playerId: playerId || socket.id,
      nick: nick || 'Oyuncu',
      level: storedData.level || level || 1,
      rank: storedData.rank || rank || 'Yeni Doğmuş I',
      preferredLength: preferredLength || 5,
      currentGameId: null,
      connectedAt: Date.now()
    });

    socket.emit('player:registered', {
      playerId: playerId || socket.id,
      progress: storedData
    });

    console.log(`Player registered: ${nick} (${socket.id})`);
  });

  // Queue management
  socket.on('queue:join', (data) => {
    const player = players.get(socket.id);
    if (!player) {
      socket.emit('error', { message: 'Önce kayıt olmalısınız!' });
      return;
    }

    if (queue.has(socket.id)) {
      socket.emit('error', { message: 'Zaten sıradasınız!' });
      return;
    }

    if (data.wordLength) {
      player.preferredLength = data.wordLength;
    }

    queue.add(socket.id);
    socket.emit('queue:joined', { position: queue.size });
    
    console.log(`Player joined queue: ${player.nick} - Queue size: ${queue.size}`);
    
    broadcastQueueUpdate();
    tryMatchPlayers();
  });

  socket.on('queue:leave', () => {
    queue.delete(socket.id);
    socket.emit('queue:left');
    broadcastQueueUpdate();
    console.log(`Player left queue: ${socket.id} - Queue size: ${queue.size}`);
  });

  // Game actions
  socket.on('game:guess', (data) => {
    const { gameId, guess } = data;
    const game = activeGames.get(gameId);
    
    if (!game || game.status !== 'active') {
      socket.emit('error', { message: 'Oyun bulunamadı!' });
      return;
    }

    // DÜZELTME: Sıra kontrolü doğru yapılıyor
    if (game.currentTurn !== socket.id) {
      socket.emit('error', { message: 'Senin sıran değil!' });
      return;
    }

    const playerData = game.players[socket.id];
    if (!playerData || playerData.finished) {
      socket.emit('error', { message: 'Bu oyunda aktif değilsiniz!' });
      return;
    }

    game.turnNumber++;
    const result = evaluateGuess(guess.toUpperCase(), game.targetWord);
    const won = result.every(r => r === 'correct');

    playerData.guesses.push({ guess: guess.toUpperCase(), result });
    game.allGuesses.push({
      player: playerData.nick,
      guess: guess.toUpperCase(),
      result,
      turn: game.turnNumber
    });

    // Send result to current player
    socket.emit('game:guess:result', {
      guess: guess.toUpperCase(),
      result,
      won,
      lost: false
    });

    // Send opponent update
    const opponentId = Object.keys(game.players).find(id => id !== socket.id);
    if (opponentId) {
      io.to(opponentId).emit('game:opponent:guess', {
        guess: guess.toUpperCase(),
        result,
        opponentWon: won,
        yourTurn: won ? false : true // DÜZELTME: Rakip kazandıysa sıra yok, kazanmadıysa sıra rakipte
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
    if (game.turnNumber >= game.maxGuesses * 2) { // Her oyuncu 6 tahmin
      endGame(gameId, null); // Draw
      return;
    }

    // DÜZELTME: Sırayı doğru değiştir
    game.currentTurn = opponentId;
    
    // Rakibe sıranın geldiğini bildir
    if (opponentId) {
      io.to(opponentId).emit('game:turn:start', {
        turnNumber: game.turnNumber,
        guessesRemaining: (game.maxGuesses * 2) - game.turnNumber
      });
    }
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
      xpGained = 100 + (game.maxGuesses - Math.floor(game.turnNumber / 2)) * 10; // Bonus for quick win
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
