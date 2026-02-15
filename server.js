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
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

app.use(cors());
app.use(express.json());

// ===== DATA STORAGE =====
const DATA_DIR = path.join(__dirname, 'data');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let persistentPlayers = {};
let leaderboard = [];

function loadData() {
  try {
    if (fs.existsSync(PLAYERS_FILE)) {
      const data = fs.readFileSync(PLAYERS_FILE, 'utf8');
      persistentPlayers = data ? JSON.parse(data) : {};
    }
    if (fs.existsSync(LEADERBOARD_FILE)) {
      const data = fs.readFileSync(LEADERBOARD_FILE, 'utf8');
      leaderboard = data ? JSON.parse(data) : [];
    }
    console.log('✅ Data loaded');
  } catch (error) {
    console.error('❌ Load error:', error);
    persistentPlayers = {};
    leaderboard = [];
  }
}

function saveData() {
  try {
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify(persistentPlayers, null, 2));
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(leaderboard, null, 2));
  } catch (error) {
    console.error('❌ Save error:', error);
  }
}

setInterval(saveData, 30000);
loadData();

const players = new Map();
const queue = new Map();
const activeGames = new Map();

// ===== WORD LISTS =====
const WORD_LISTS = {
  4: ["KAPI", "SORU", "BABA", "ASLI", "ELMA", "YAZI", "KALE", "KOŞU", "BİNA", "DANA", "ARZU", "ÖYKÜ", "SÜRE", "HAVA", "KISA", "KUZU", "PARA", "MASA", "MODA", "ORAN", "KUTU", "DERE", "KEÇİ", "SAYI", "KAYI", "GİDİ", "İLKE", "KİRA", "PAŞA", "SEVİ", "UYKU", "AYNA", "BOYA", "ADAM", "ESKİ", "ANNE", "DERİ", "ÖLÇÜ", "GAGA", "HATA", "OLAY", "SENE", "ŞAKA", "İMZA", "KATI", "MEZE", "KORO", "LİSE", "SAHA", "YAPI", "KURS", "GURU", "TAKI", "KOZA", "ARTI", "DURU", "FARE", "YARI", "ÖDÜL", "AYAK", "HOCA", "ALAN", "ÇARE", "KARI", "EŞYA", "İLAÇ", "MAŞA", "KULE", "OVAL", "SIRA", "FOTO", "YÜZÜ", "BATI", "DOĞU", "KÜRE", "ASKI", "ÇENE", "DİZİ", "KOLA", "GECE", "CİNS", "ARPA", "SOPA", "İLİK", "MÜZE", "SİTE", "ÜLKE", "CADI", "LİRA", "GÜCÜ", "EKİN", "ADET", "VALE", "ÇATI", "AYIP", "BORÇ", "KAFE", "DERS", "ÖZEL", "KARA", "İSİM", "HAYI", "ÇITA", "KİLO", "BUSE", "ÖREN", "AMİR", "EKİM", "DANA", "ZARF", "TAHT", "İĞNE", "ÇİVİ", "EĞRİ", "KART", "KAYA", "İMHA", "EKOZ", "HİBE", "VALİ", "İCAT", "LİMAN", "KREP", "KAZA", "İNCE", "KÖŞE", "AKIL", "AYAR", "BONE", "DÜZE", "İCRA", "KIRA", "SEDA", "BÜRO", "SÖZÜ", "ŞİİR", "AVCI", "SİLO", "BANT", "KOTA", "MİNA", "CİLT", "İRAN", "FİRE", "FİDE", "ÖNCÜ", "OKUL", "ADIM", "AZIK", "DİLİ", "KAZI", "AKIM", "EŞİK", "AZİZ", "KORO", "ALAY", "GİŞE", "ŞİLE", "ÖDEM", "SİHİ", "EĞİM", "ÇİFT", "BORU", "SULU", "KATI", "BİRE", "KÜFE", "DÜET", "ALET", "MİNE", "İDOL", "İKNA", "İDRA", "KİRE", "KELE", "KÖYÜ", "RİSK", "SİRK", "TAZE", "TAPU", "TEPE", "VİZE", "YEDİ", "ZAMİ", "ÖDÜN", "YARA", "TANI", "KORU", "ERİM", "OLTA", "SOBA", "SAPA", "DOKU", "KEŞF", "ÜMİT", "GÖZE", "FAİZ", "BALE", "KOYU", "İNCİ", "GİZİ", "KATI", "ORSA"],
  5: ["AKŞAM", "BALON", "CADDE", "DALGA", "ELMAS", "FENER", "GÜNEŞ", "HABER", "İNSAN", "JOKER", "KAYIK", "LIMON", "MASAL", "NEFES", "ORMAN", "PAZAR", "RADYO", "SABAH", "ŞEHİR", "TARLA", "UYGUR", "VÜCUT", "YALAN", "ZAMAN", "ABONE", "BAHAR", "CEKET", "DOLAP", "EMLAK", "FİDAN", "GURUR", "HAYAT", "ISLIK", "İÇKİT", "JETON", "KASAP", "LİSTE", "MERAK", "NODUL", "ORTAK", "PİLOT", "RAKET", "SAYFA", "ŞARKI", "TAVAN", "UZMAN", "VATAN", "YAREN", "ZİHİN", "ACELE", "BALIK", "CİHAN", "DEMİR", "EGZOZ", "FATUR", "GÖLGE", "HUKUK", "ILGAZ", "İPUCU", "JİLET", "KAVUN", "LEVHA", "MİRAS", "NAKIŞ", "ORHAN", "PARÇA", "REÇEL", "SOLUK", "ŞEKER", "TABLO", "UÇKUN", "VALİZ", "YALIN", "ZORLU", "ADRES", "BÖLGE", "CÜMLE", "DÜNYA", "EŞARP", "FIRÇA", "GÖREV", "HESAP", "IŞIMA", "İNKAR", "KABLO", "LOKMA", "MÜZİK", "NİMET", "OPERA", "PEDAL", "ROKET", "SEPET", "ŞÖYLE", "TÜFEK", "UYARI", "VAKIF", "YALDI", "ZİRAİ", "AHLAK", "BELGE", "CEVAP", "DİREK", "ERKEK", "FİYAT", "GÖRÜŞ", "HUZUR", "ASLAN", "İSKEÇ", "KADER", "LAZIM", "METRO", "NESİL", "ORİJİN", "PROJE", "ROMAN", "SÜREÇ", "ŞAHIS", "TEKİN", "UMUTL", "VOTKA", "YAZAR", "ZARAR", "ALTIN", "BÖREK", "CESUR", "DÜĞÜN", "EVRAK", "FLAMA", "GÜVEN", "HİSSE", "IDDI", "İZMİR", "KİTAP", "LİMAN", "MODEL", "NOKTA", "OTİZM", "PAMUK", "REHİN", "SİLAH", "ŞERİT", "TURŞU", "UÇMAK", "VAKİT", "YEMEK", "ZİNCİ", "ANTEN", "BEYAZ", "CAMIZ", "DÜŞÜŞ", "EKSİK", "FORMA", "GÜZEL", "HELVA", "IŞIMA", "İHRAÇ", "KAVGA", "LİSAN", "MADDE", "NAZAR", "OYNAN", "PASTA", "REJİM", "SINAV", "ŞURUP", "TAŞIT", "UYGAR", "VİLLA", "YARIŞ", "ZEBRA", "AYRAN", "BİLET", "CİHAZ", "DURAK", "EYLEM", "FİNAL", "GELİN", "HAKİM", "ISSIZ", "İNCİR", "KAYIP", "LİMİT", "MESAJ", "NİSAN", "ORGAN", "PENYE", "REKOR", "SİVRİ", "ŞÜPHE", "TEPSİ", "UZAYI", "VİRAJ", "YÜZEY", "ZALİM", "ARABA", "BARIŞ", "COŞKU", "DENİZ", "ERKEN", "FESAT", "KAFİR", "HALEF", "ITRAK", "İLHAK", "KARGO", "LAKAP", "MEYVE", "NİÇİN", "OKUMA", "PLAKA", "RADAR", "SAYGI", "ŞOFÖR", "TAVŞA", "UÇKUN", "VURGU", "YAKIN", "ZAMLI"],
  6: ["GARDOP", "KARTAL", "YARDIM", "BALKON", "GÖZLÜK", "TÜRKÇE", "MANTIK", "PİJAMA", "SÖZLÜK", "TOPRAK", "SİNCAP", "HEYKEL", "KUYRUK", "MİLYON", "ÇEYREK", "DOKTOR", "ZEYTİN", "BARDAK", "GAYRET", "MEKTUP", "FIRTIN", "KORKUŞ", "KABİNE", "RESMEN", "ŞÖVALE", "KOLTUK", "YAPRAK", "KAPTAN", "SİGARA", "GURBET", "FISTIK", "HAYVAN", "SARMAL", "BİRLİK", "EKMEKÇ", "CÜZDAN", "SULTAN", "MİKROP", "KAMYON", "DİKKAT", "ŞEFFAF", "VİCDAN", "BAYRAM", "İSTİFA", "KAYNAK", "ADALET", "MUTFAK", "ŞEMSİYE", "TABİAT", "HAYRET", "MÜHÜRL", "DESTAN", "PİKNİK", "KAYKAY", "TAVŞAN", "KONSER", "PİŞMAN", "SAĞLIK", "BİSKEÇ", "MERCAN", "KUDRET", "KISMET", "LASTİK", "NAFAKA", "GAZETE", "MERKEZ", "FELSEF", "KIYMET", "YILDIZ", "SULHÇU", "KEPÇEÇ", "ZAHMET", "TERMİS", "MEYDAN", "ŞAHANE", "İBADET", "KUVVET", "HASRET", "BİRLİK", "VİTRİN", "SİYASET", "KARPUZ", "SİSİLY", "MİSÜLÜ", "KÜLTÜR", "PERDEY", "DİRSEK", "DURDUR", "KAYGAN", "İŞARET", "PARMAK", "TİMSAH", "ŞARJÖR", "MİSAİR", "BOYNUZ", "HORTUM", "SANDAL", "FİLİSİ", "KAYISI", "MAHKUM", "TEKNİK", "YEMİNL", "SİİRTİ", "KİMLİK", "KONTAK", "CÖMERT", "HÜCİRE", "TERLİK", "SİSTEM", "PORSEN", "KUMSAL", "YÜZÜCÜ", "SARMAL", "KAYKAY", "SİRKET", "DİREKÇ", "KİSVEL", "KAYNAŞ", "GÖRSEL", "KAZANÇ", "FİZİKİ", "İHANET", "SIRDAŞ", "BÜLBÜL", "KABARE", "SERVİS", "İSKELE", "KÖPRÜS", "BASKIN", "GÜNCEL", "YALÇIN", "MECLİS", "KORUMA", "KIBRIS", "SİRİKE", "TASARI", "KEŞKEK", "GÜLMEK", "İMKANI", "TÜCCAR", "MASRAF", "HEYBET", "PİRİNÇ", "ŞÖHRET", "TEKLİF", "KÜSMEK", "YAKAMO", "FERSAH", "İSTEKİ", "BİLYAÇ", "KUNDUZ", "KASTEN", "TEMSİL", "KAYNAK", "KOSTÜM", "HESABI", "FESLEĞ", "GERÇEK", "MODERN", "KIYAFE", "KEMANE", "DİNGİL", "BİTKİS", "SÜRGÜN", "İHRACAT", "YALDIZ", "TAKVİM", "TUNCEL", "SAYDAM", "KURŞUN", "SÜSLEM", "TERHİS", "VARLIK", "YANDAŞ", "KORNET", "GÜNCEL", "HAYDİÇ", "KUMPAS", "MİNDER", "SÜREKL", "KIŞLIK", "ŞİMDİK", "GURBET", "FIRTIN", "KABİLE", "İSABET", "KAYGIN", "DÜELLO", "MERHEM", "SABIKA", "TAKDİM", "BİTİRİ", "DÖNEMEÇ", "HEYCANLI", "ŞELALE", "ZALİMİ", "KAVRAM", "KOŞULU", "ZİGZAG"],
  7: ["ANAYASA", "BELEDİYE", "ÇİSANTİ", "DİLEKÇE", "EMİRGAN", "FASULYE", "GÖKYÜZÜ", "HAKARET", "ISPANAK", "İSKELET", "JANDARMA", "KABURGA", "LOKANTA", "MERHABA", "NAKLİYE", "OKYANUS", "PENCERE", "RANDEVU", "SANDALYE", "ŞAMPUAN", "TELEFON", "UYGULAMA", "VAZİYET", "YUMURTA", "ZAFİYET", "AHTAPOT", "BAŞKENT", "CESARET", "DENEYİM", "EĞLENCE", "FABRİKA", "GÖSTERİ", "HASTANE", "IHLAMUR", "İSTİDAT", "KAVANOZ", "LAVANTA", "MİSAFİR", "NUMARAL", "OYUNCU", "PIRLANTA", "REFAHAT", "SAYGILI", "ŞAŞIRMA", "TİYATRO", "UZUNLUK", "VERİMLİ", "YETENEK", "ZORUNLU", "AMBALAJ", "BERABER", "COĞRAFA", "DÜŞÜNCE", "EMNİYET", "FESTİVAL", "GÖRÜNTÜ", "HAYSİYET", "ISIRGAN", "İLGİNÇTİ", "KAZANIM", "LEVREKL", "MUTLULU", "NAMUSLU", "OTOMATİK", "PANAYIR", "REKABET", "SİNEMACI", "ŞAKAYIK", "TEMİZLİK", "UZMANLA", "VALİZLE", "YAZILIM", "ZENGİNL", "AKTARIM", "BİSİKLET", "ÇERÇEVE", "DEĞİRMEN", "EFSANEVİ", "FELAKET", "GİRİŞİM", "HAYALET", "ISMARLA", "İMTİHAN", "KARANFİL", "LİMONATA", "MALİYET", "NİŞASTA", "OKSİJEN", "PERŞEMBE", "SAMİMİYET", "ŞEHİRLİ", "TARTIŞMA", "ÜRETİCİ", "VARİSÇİ", "YIKILMA", "ZABITALA", "ANLAYIŞ", "BAĞLAMA", "CEPHANE", "DÜZENLİ", "EKSİKLİK", "FERAHLIK", "GÖREVLİ", "HAREKET", "IŞILDAK", "İÇECEKLİ", "KONTROL", "LÜBEYYE", "MİLYARD", "NEZAKET", "ORDUEVİ", "PATATES", "REÇETELİ", "SÜREKLİ", "ŞİKAYET", "TOPLANTI", "ÜZÜNTÜLÜ", "VİCDANLI", "YÖNETİM", "ZÜMRÜT", "ALTYAPI", "BULANIK", "CÖMERTLİK", "DÜZELTME", "ELBİSELİ", "FAALİYET", "GÜNEŞLİ", "HAZİNEM", "İLANLAR", "KÜLTÜRLÜ", "MADALYA", "NİTELİK", "OYUNCAK", "PORSİYON", "REHBERLİK", "SEVİYELİ", "ŞAHSİYET", "TAMİRAT", "UYARICI", "VAKİTLİ", "YARATIK", "ZİYARET", "ASİSTAN", "BÖLGESEL", "ÇALIŞKAN", "DİNAMİK", "EĞİTMEN", "FOTOĞRAF", "GÖREVDE", "HAVADİS", "ISIRMAK", "İLETİŞİM", "KAPTANLI", "LAVABOLU", "MANTARLI", "NÖBETÇİ", "OTURMAK", "PARLAMA", "REKORCU", "SATIŞLAR", "ŞAŞIRTMA", "TASARIM", "ÜYELİKLER", "VALİZLER", "YAZILIM", "ZAMANDA", "AVUKATLIK", "BİLDİRİM", "ÇEVRECİ", "DİKKATLİ", "EKİPMAN", "FIKRAAN", "GÜLERİZ", "HAYIRLI", "İSABETLİ", "KAPASİTE", "LAHMACUN", "MERİNOS", "NUMARALI", "ORMANCI", "PANDÜL", "SESSİZLİK", "TECRÜBE", "VİRGÜLLÜ", "YETKİLİ", "ZIMBALI", "ÇİZGİLİ", "DERLEME", "SATILIK", "FARKSIZ", "SABANCI", "HASIRCI"]
};

const RANKS = {
  1:{name:"Yeni Doğmuş I",xpNeeded:0},
  2:{name:"Yeni Doğmuş II",xpNeeded:100},
  3:{name:"Yeni Doğmuş III",xpNeeded:250},
  4:{name:"Kelime Avcısı I",xpNeeded:450},
  5:{name:"Kelime Avcısı II",xpNeeded:700},
  6:{name:"Kelime Avcısı III",xpNeeded:1000},
  7:{name:"Usta Oyuncu I",xpNeeded:1400},
  8:{name:"Usta Oyuncu II",xpNeeded:1900},
  9:{name:"Usta Oyuncu III",xpNeeded:2500},
  10:{name:"Efsane",xpNeeded:3200}
};

// ===== COSMETICS =====
const COSMETICS = {
  avatarFrames: [
    { id: 'default', name: 'Varsayılan', cost: 0, unlocked: true },
    { id: 'bronze', name: 'Bronz Çerçeve', cost: 500, emoji: '🥉' },
    { id: 'silver', name: 'Gümüş Çerçeve', cost: 1000, emoji: '🥈' },
    { id: 'gold', name: 'Altın Çerçeve', cost: 2000, emoji: '🥇' },
    { id: 'diamond', name: 'Elmas Çerçeve', cost: 5000, emoji: '💎' },
    { id: 'fire', name: 'Ateş Çerçevesi', cost: 3000, emoji: '🔥' },
    { id: 'ice', name: 'Buz Çerçevesi', cost: 3000, emoji: '❄️' },
    { id: 'star', name: 'Yıldız Çerçevesi', cost: 4000, emoji: '⭐' }
  ],
  profileBadges: [
    { id: 'winner', name: 'Kazanan', cost: 0, unlocked: true, emoji: '🏆' },
    { id: 'streak3', name: '3 Seri', cost: 300, emoji: '🔥' },
    { id: 'streak5', name: '5 Seri', cost: 800, emoji: '🔥🔥' },
    { id: 'streak10', name: '10 Seri', cost: 2000, emoji: '🔥🔥🔥' },
    { id: 'master', name: 'Kelime Ustası', cost: 5000, emoji: '👑' },
    { id: 'legend', name: 'Efsane', cost: 10000, emoji: '⚡' }
  ],
  profileColors: [
    { id: 'default', name: 'Varsayılan', cost: 0, unlocked: true, color: '#00ffb3' },
    { id: 'purple', name: 'Mor', cost: 500, color: '#9b59b6' },
    { id: 'red', name: 'Kırmızı', cost: 500, color: '#e74c3c' },
    { id: 'blue', name: 'Mavi', cost: 500, color: '#3498db' },
    { id: 'orange', name: 'Turuncu', cost: 500, color: '#e67e22' },
    { id: 'pink', name: 'Pembe', cost: 800, color: '#ff0095' },
    { id: 'cyan', name: 'Camgöbeği', cost: 800, color: '#00e1ff' },
    { id: 'rainbow', name: 'Gökkuşağı', cost: 3000, color: 'linear-gradient(135deg, #00ffb3, #00e1ff, #ff0095, #ffd600)' }
  ]
};

function getRandomWord(length){
  const list=WORD_LISTS[length];
  if(!list||list.length===0)return null;
  return list[Math.floor(Math.random()*list.length)];
}

function generateGameId(){
  return `game_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;
}

function getPlayerData(playerId){
  if(!persistentPlayers[playerId]){
    persistentPlayers[playerId]={
      playerId,totalXP:0,level:1,currentXP:0,wins:0,losses:0,draws:0,
      gamesPlayed:0,rankedPoints:1000,highestRank:1000,winStreak:0,
      bestWinStreak:0,lastSeen:Date.now(),
      coins: 0, // Virtual currency for cosmetics
      dailyPlayedToday: null, // Track daily game date
      cosmetics: {
        ownedFrames: ['default'],
        ownedBadges: ['winner'],
        ownedColors: ['default'],
        ownedBackgrounds: ['none'],
        ownedTitles: ['none'],
        equippedFrame: 'default',
        equippedBadge: 'winner',
        equippedColor: 'default',
        equippedBackground: 'none',
        equippedTitle: 'none'
      }
    };
  }
  persistentPlayers[playerId].lastSeen=Date.now();
  return persistentPlayers[playerId];
}

function updatePlayerLevel(playerId,xpGained,coinsGained=0){
  let playerData=getPlayerData(playerId);
  playerData.totalXP+=xpGained;
  playerData.currentXP+=xpGained;
  playerData.coins = (playerData.coins || 0) + coinsGained;
  
  let leveledUp=false;
  while(playerData.level<10){
    const nextRank=RANKS[playerData.level+1];
    if(!nextRank)break;
    if(playerData.totalXP>=nextRank.xpNeeded){
      playerData.level++;
      playerData.currentXP=0;
      playerData.coins += 500; // Bonus coins on level up
      leveledUp=true;
    }else break;
  }
  playerData.rank=RANKS[playerData.level]?.name||'Level '+playerData.level;
  persistentPlayers[playerId]=playerData;
  saveData();
  return{playerData,leveledUp};
}

function updateRankedPoints(winnerId,loserId,isDraw=false){
  const winnerData=getPlayerData(winnerId);
  const loserData=getPlayerData(loserId);
  const K=32;
  const expectedWinner=1/(1+Math.pow(10,(loserData.rankedPoints-winnerData.rankedPoints)/400));
  let winnerChange=0;
  let loserChange=0;
  
  if(isDraw){
    winnerChange=Math.round(K*(0.5-expectedWinner));
    loserChange=Math.round(K*(0.5-(1-expectedWinner)));
    winnerData.rankedPoints+=winnerChange;
    loserData.rankedPoints+=loserChange;
    winnerData.draws++;
    loserData.draws++;
  }else{
    winnerChange=Math.round(K*(1-expectedWinner));
    loserChange=Math.round(K*(0-(1-expectedWinner)));
    winnerData.rankedPoints+=winnerChange;
    loserData.rankedPoints+=loserChange;
    winnerData.wins++;
    winnerData.winStreak++;
    loserData.losses++;
    loserData.winStreak=0;
  }
  
  winnerData.gamesPlayed++;
  loserData.gamesPlayed++;
  persistentPlayers[winnerId]=winnerData;
  persistentPlayers[loserId]=loserData;
  saveData();
  
  return{winnerChange,loserChange,winnerPoints:winnerData.rankedPoints,loserPoints:loserData.rankedPoints};
}

function getLeaderboard(){
  return leaderboard.slice(0,50);
}

function tryMatchPlayers(){
  if(queue.size<2)return;
  const queueArray=Array.from(queue.entries());
  
  const[player1Id]=queueArray[0];
  const[player2Id]=queueArray[1];
  const player1=players.get(player1Id);
  const player2=players.get(player2Id);
  
  if(player1&&player2){
    const wordLength=queue.get(player1Id).wordLength||5;
    createMatch(player1Id,player2Id,wordLength);
  }
}

function createMatch(player1Id,player2Id,wordLength){
  const player1=players.get(player1Id);
  const player2=players.get(player2Id);
  if(!player1||!player2)return;
  
  queue.delete(player1Id);
  queue.delete(player2Id);
  
  const gameId=generateGameId();
  const targetWord=getRandomWord(wordLength);
  
  if(!targetWord){
    console.error(`No word for length ${wordLength}`);
    return;
  }
  
  const startsFirst = Math.random() < 0.5 ? player1Id : player2Id;
  
  console.log('');
  console.log('🎮 ========== NEW GAME ==========');
  console.log(`   Game ID: ${gameId}`);
  console.log(`   Player 1: ${player1.nick} (${player1Id})`);
  console.log(`   Player 2: ${player2.nick} (${player2Id})`);
  console.log(`   Word: ${targetWord}`);
  console.log(`   Starts First: ${startsFirst === player1Id ? player1.nick : player2.nick} (${startsFirst})`);
  console.log('================================');
  console.log('');
  
  const game={
    gameId,
    targetWord,
    wordLength,
    player1Id,
    player2Id,
    player1Nick: player1.nick,
    player2Nick: player2.nick,
    sharedBoard:[],
    currentRow:0,
    currentTurn: startsFirst,
    turnTimer: null,
    turnStartTime: Date.now(),
    maxGuesses:12,
    status:'active',
    winner:null,
    chatMessages: [],
    createdAt:Date.now(),
    lastActivity:Date.now()
  };
  
  activeGames.set(gameId,game);
  player1.currentGameId=gameId;
  player2.currentGameId=gameId;
  
  // Get player cosmetics
  const player1Data = getPlayerData(player1.playerId);
  const player2Data = getPlayerData(player2.playerId);
  
  const player1Turn = startsFirst === player1Id;
  console.log(`📤 Sending to ${player1.nick}: yourTurn=${player1Turn}`);
  io.to(player1Id).emit('game:start',{
    gameId,
    wordLength,
    opponent:{
      nick:player2.nick,
      level:player2.level,
      rank:player2Data.rank,
      cosmetics: player2Data.cosmetics
    },
    yourTurn: player1Turn
  });
  
  const player2Turn = startsFirst === player2Id;
  console.log(`📤 Sending to ${player2.nick}: yourTurn=${player2Turn}`);
  io.to(player2Id).emit('game:start',{
    gameId,
    wordLength,
    opponent:{
      nick:player1.nick,
      level:player1.level,
      rank:player1Data.rank,
      cosmetics: player1Data.cosmetics
    },
    yourTurn: player2Turn
  });
  
  // Start turn timer
  startTurnTimer(gameId);
  
  broadcastQueueUpdate();
}

function startTurnTimer(gameId) {
  const game = activeGames.get(gameId);
  if (!game || game.status !== 'active') return;
  
  // Clear any existing timer
  if (game.turnTimer) {
    clearTimeout(game.turnTimer);
  }
  
  game.turnStartTime = Date.now();
  
  // 30 second timer
  game.turnTimer = setTimeout(() => {
    handleTurnTimeout(gameId);
  }, 30000);
}

function handleTurnTimeout(gameId) {
  const game = activeGames.get(gameId);
  if (!game || game.status !== 'active') return;
  
  console.log(`⏰ Turn timeout for game ${gameId}`);
  
  // Current player loses their turn
  const currentPlayerId = game.currentTurn;
  const otherPlayerId = currentPlayerId === game.player1Id ? game.player2Id : game.player1Id;
  
  // Switch turn
  game.currentTurn = otherPlayerId;
  
  // Notify both players
  io.to(currentPlayerId).emit('turn:timeout', {
    message: 'Süre doldu! Sıra rakibine geçti.'
  });
  
  io.to(otherPlayerId).emit('turn:timeout', {
    message: 'Rakip süre aşımı yaptı. Senin sıran!'
  });
  
  // Update turn display
  io.to(currentPlayerId).emit('game:turn:update', {
    yourTurn: false,
    nextRow: game.currentRow
  });
  
  io.to(otherPlayerId).emit('game:turn:update', {
    yourTurn: true,
    nextRow: game.currentRow
  });
  
  // Start new timer
  startTurnTimer(gameId);
}

function broadcastQueueUpdate(){
  const queuePlayers=Array.from(queue.keys()).map(socketId=>{
    const player=players.get(socketId);
    return player?{nick:player.nick,level:player.level,rank:'Yeni'}:null;
  }).filter(Boolean);
  io.emit('queue:update',{players:queuePlayers});
}

function evaluateGuess(guess,target){
  const result=Array(target.length).fill('absent');
  const targetArr=target.split('');
  const guessArr=guess.split('');
  const targetCount={};
  
  targetArr.forEach(l=>targetCount[l]=(targetCount[l]||0)+1);
  
  for(let i=0;i<target.length;i++){
    if(guessArr[i]===targetArr[i]){
      result[i]='correct';
      targetCount[guessArr[i]]--;
    }
  }
  
  for(let i=0;i<target.length;i++){
    if(result[i]==='absent'&&targetCount[guessArr[i]]>0){
      result[i]='present';
      targetCount[guessArr[i]]--;
    }
  }
  
  return result;
}

function broadcastOnlineCount() {
  const onlinePlayers = Array.from(players.values()).map(p => ({
    playerId: p.playerId,
    nick: p.nick,
    level: p.level || 1,
    rank: getPlayerData(p.playerId).rank,
    inGame: p.currentGameId ? true : false
  }));
  
  io.emit('online:count', { 
    count: players.size,
    players: onlinePlayers
  });
}

// Broadcast online count every 5 seconds
setInterval(broadcastOnlineCount, 5000);

// ===== SOCKET HANDLERS =====
io.on('connection',(socket)=>{
  console.log('🔌 Connected:',socket.id);
  broadcastOnlineCount();
  
  socket.on('player:register',(data)=>{
    try{
      const{playerId,nick}=data;
      const storedData=getPlayerData(playerId||socket.id);
      players.set(socket.id,{
        socketId:socket.id,
        playerId:playerId||socket.id,
        nick:(nick||'Oyuncu').substring(0,16),
        level:storedData.level||1,
        currentGameId:null,
        connectedAt:Date.now()
      });
      socket.emit('player:registered',{playerId:playerId||socket.id,progress:storedData});
      console.log(`✅ Registered: ${nick} (${socket.id})`);
      broadcastOnlineCount();
    }catch(error){
      console.error('❌ Register error:',error);
    }
  });
  
  socket.on('queue:join',(data)=>{
    try{
      const player=players.get(socket.id);
      if(!player)return;
      if(queue.has(socket.id))return;
      
      const wordLength=data.preferredLength||5;
      queue.set(socket.id,{wordLength,joinedAt:Date.now()});
      socket.emit('queue:joined',{position:queue.size});
      console.log(`🎯 ${player.nick} joined queue (${queue.size} total)`);
      broadcastQueueUpdate();
      setTimeout(()=>tryMatchPlayers(),100);
    }catch(error){
      console.error('❌ Queue join error:',error);
    }
  });
  
  socket.on('queue:leave',()=>{
    queue.delete(socket.id);
    socket.emit('queue:left');
    broadcastQueueUpdate();
  });
  
  socket.on('game:guess',(data)=>{
    try{
      const{gameId,guess}=data;
      const game=activeGames.get(gameId);
      
      if(!game||game.status!=='active'){
        console.log(`❌ Game not found or not active: ${gameId}`);
        socket.emit('error',{message:'Oyun bulunamadı!'});
        return;
      }
      
      console.log('');
      console.log('📥 ========== GUESS RECEIVED ==========');
      console.log(`   From: ${socket.id}`);
      console.log(`   Game current turn: ${game.currentTurn}`);
      console.log(`   Is their turn? ${game.currentTurn === socket.id}`);
      console.log(`   Guess: ${guess}`);
      
      if(game.currentTurn !== socket.id){
        console.log(`❌ NOT YOUR TURN!`);
        socket.emit('error',{message:'Sıran değil!'});
        return;
      }
      
      // Clear turn timer
      if (game.turnTimer) {
        clearTimeout(game.turnTimer);
        game.turnTimer = null;
      }
      
      const normalizedGuess=guess.toUpperCase().trim();
      if(normalizedGuess.length!==game.wordLength){
        socket.emit('error',{message:'Kelime uzunluğu hatalı!'});
        return;
      }
      
      game.lastActivity=Date.now();
      
      const result=evaluateGuess(normalizedGuess,game.targetWord);
      const won=result.every(r=>r==='correct');
      
      const boardEntry={
        guess:normalizedGuess,
        result,
        playerId:socket.id,
        rowIndex:game.currentRow
      };
      game.sharedBoard.push(boardEntry);
      
      console.log(`   Result: ${result.join(',')}`);
      console.log(`   Won: ${won}`);
      console.log(`   Row: ${game.currentRow}`);
      
      if(won){
        game.winner=socket.id;
        game.status='finished';
        console.log(`🏆 ${socket.id} WON!`);
        endGame(gameId,socket.id);
        return;
      }
      
      game.currentRow++;
      
      if(game.currentRow>=game.maxGuesses){
        console.log(`🤝 DRAW - Max guesses reached`);
        endGame(gameId,null);
        return;
      }
      
      const nextTurn = game.currentTurn === game.player1Id ? game.player2Id : game.player1Id;
      game.currentTurn = nextTurn;
      
      console.log(`   Next turn: ${nextTurn}`);
      console.log(`   Next row: ${game.currentRow}`);
      console.log('=====================================');
      console.log('');
      
      io.to(socket.id).emit('game:board:update',{
        rowIndex:boardEntry.rowIndex,
        guess:normalizedGuess,
        result,
        nextRow:game.currentRow,
        yourTurn:false
      });
      
      const opponentId = socket.id === game.player1Id ? game.player2Id : game.player1Id;
      io.to(opponentId).emit('game:board:update',{
        rowIndex:boardEntry.rowIndex,
        guess:normalizedGuess,
        result,
        nextRow:game.currentRow,
        yourTurn:true
      });
      
      // Start new turn timer
      startTurnTimer(gameId);
      
    }catch(error){
      console.error('❌ Guess error:',error);
      socket.emit('error',{message:'Tahmin hatası!'});
    }
  });
  
  socket.on('chat:message', (data) => {
    try {
      const { gameId, message } = data;
      const game = activeGames.get(gameId);
      
      if (!game || game.status !== 'active') return;
      
      const player = players.get(socket.id);
      if (!player) return;
      
      const chatMessage = {
        nick: player.nick,
        message: message.substring(0, 100),
        timestamp: Date.now(),
        playerId: socket.id
      };
      
      game.chatMessages.push(chatMessage);
      
      // Keep only last 50 messages
      if (game.chatMessages.length > 50) {
        game.chatMessages = game.chatMessages.slice(-50);
      }
      
      // Broadcast to both players
      io.to(game.player1Id).emit('chat:message', chatMessage);
      io.to(game.player2Id).emit('chat:message', chatMessage);
      
    } catch (error) {
      console.error('❌ Chat error:', error);
    }
  });
  
  socket.on('cosmetic:buy', (data) => {
    try {
      const { itemType, itemId } = data;
      const player = players.get(socket.id);
      if (!player) return;
      
      const playerData = getPlayerData(player.playerId);
      
      // Simple cost lookup - in real app, fetch from database
      const costs = {
        frame: { default:0, bronze:800, silver:1500, gold:3000, diamond:6000, fire:4500, ice:4500, lightning:5500, cosmic:8000, phoenix:10000, shadow:7500, rainbow:9000, galaxy:12000 },
        badge: { winner:0, streak3:500, streak5:1200, streak10:3000, speedster:2500, perfectionist:4000, master:6000, veteran:5000, legend:12000, unbeatable:15000, genius:8000, collector:10000 },
        color: { default:0, crimson:800, royal:800, toxic:1200, purple:1200, sunset:1500, cyberpink:2000, electric:2000, gold:3000, rainbow:5000, lava:4500, ocean:4500, galaxy:6000, matrix:7000, prismatic:10000 },
        background: { none:0, stars:2000, matrix:3500, fire:4000, lightning:5000, cosmic:6000, aurora:7500, portal:10000 },
        title: { none:0, glow:1500, wave:2500, shake:2500, rainbow:4000, glitch:5000, fire:6000, hologram:8000 }
      };
      
      let ownedArray = null;
      let cost = 0;
      
      if (itemType === 'frame') {
        ownedArray = playerData.cosmetics.ownedFrames;
        cost = costs.frame[itemId] || 999999;
      } else if (itemType === 'badge') {
        ownedArray = playerData.cosmetics.ownedBadges;
        cost = costs.badge[itemId] || 999999;
      } else if (itemType === 'color') {
        ownedArray = playerData.cosmetics.ownedColors;
        cost = costs.color[itemId] || 999999;
      } else if (itemType === 'background') {
        ownedArray = playerData.cosmetics.ownedBackgrounds || ['none'];
        if (!playerData.cosmetics.ownedBackgrounds) playerData.cosmetics.ownedBackgrounds = ['none'];
        cost = costs.background[itemId] || 999999;
      } else if (itemType === 'title') {
        ownedArray = playerData.cosmetics.ownedTitles || ['none'];
        if (!playerData.cosmetics.ownedTitles) playerData.cosmetics.ownedTitles = ['none'];
        cost = costs.title[itemId] || 999999;
      }
      
      if (!ownedArray) {
        socket.emit('error', { message: 'Geçersiz kozmetik türü!' });
        return;
      }
      
      if (ownedArray.includes(itemId)) {
        socket.emit('error', { message: 'Zaten sahipsin!' });
        return;
      }
      
      if (playerData.coins < cost) {
        socket.emit('error', { message: 'Yeterli coinin yok!' });
        return;
      }
      
      playerData.coins -= cost;
      ownedArray.push(itemId);
      
      persistentPlayers[player.playerId] = playerData;
      saveData();
      
      socket.emit('cosmetic:purchased', {
        itemType,
        itemId,
        newCoins: playerData.coins,
        cosmetics: playerData.cosmetics
      });
      
    } catch (error) {
      console.error('❌ Cosmetic buy error:', error);
    }
  });
  
  socket.on('cosmetic:equip', (data) => {
    try {
      const { itemType, itemId } = data;
      const player = players.get(socket.id);
      if (!player) return;
      
      const playerData = getPlayerData(player.playerId);
      
      if (itemType === 'frame') {
        if (!playerData.cosmetics.ownedFrames.includes(itemId)) return;
        playerData.cosmetics.equippedFrame = itemId;
      } else if (itemType === 'badge') {
        if (!playerData.cosmetics.ownedBadges.includes(itemId)) return;
        playerData.cosmetics.equippedBadge = itemId;
      } else if (itemType === 'color') {
        if (!playerData.cosmetics.ownedColors.includes(itemId)) return;
        playerData.cosmetics.equippedColor = itemId;
      } else if (itemType === 'background') {
        if (!playerData.cosmetics.ownedBackgrounds) playerData.cosmetics.ownedBackgrounds = ['none'];
        if (!playerData.cosmetics.ownedBackgrounds.includes(itemId)) return;
        playerData.cosmetics.equippedBackground = itemId;
      } else if (itemType === 'title') {
        if (!playerData.cosmetics.ownedTitles) playerData.cosmetics.ownedTitles = ['none'];
        if (!playerData.cosmetics.ownedTitles.includes(itemId)) return;
        playerData.cosmetics.equippedTitle = itemId;
      }
      
      persistentPlayers[player.playerId] = playerData;
      saveData();
      
      socket.emit('cosmetic:equipped', {
        itemType,
        itemId,
        cosmetics: playerData.cosmetics
      });
      
    } catch (error) {
      console.error('❌ Cosmetic equip error:', error);
    }
  });
  
  socket.on('daily:check', () => {
    try {
      const player = players.get(socket.id);
      if (!player) return;
      
      const playerData = getPlayerData(player.playerId);
      const today = new Date().toISOString().split('T')[0];
      
      const canPlay = playerData.dailyPlayedToday !== today;
      
      socket.emit('daily:status', {
        canPlay,
        lastPlayed: playerData.dailyPlayedToday
      });
      
    } catch (error) {
      console.error('❌ Daily check error:', error);
    }
  });
  
  socket.on('daily:complete', () => {
    try {
      const player = players.get(socket.id);
      if (!player) return;
      
      const playerData = getPlayerData(player.playerId);
      const today = new Date().toISOString().split('T')[0];
      
      if (playerData.dailyPlayedToday === today) {
        socket.emit('error', { message: 'Bugün zaten oynadın!' });
        return;
      }
      
      playerData.dailyPlayedToday = today;
      persistentPlayers[player.playerId] = playerData;
      saveData();
      
      socket.emit('daily:completed', {
        date: today
      });
      
    } catch (error) {
      console.error('❌ Daily complete error:', error);
    }
  });
  
  socket.on('leaderboard:get',()=>{
    socket.emit('leaderboard:update',{leaderboard:getLeaderboard()});
  });
  
  socket.on('disconnect',()=>{
    console.log('🔌❌ Disconnected:',socket.id);
    const player=players.get(socket.id);
    if(player&&player.currentGameId){
      const game=activeGames.get(player.currentGameId);
      if(game&&game.status==='active'){
        // Clear timer
        if (game.turnTimer) {
          clearTimeout(game.turnTimer);
        }
        const opponentId = socket.id === game.player1Id ? game.player2Id : game.player1Id;
        if(opponentId){
          endGame(player.currentGameId,opponentId,true);
        }
      }
    }
    queue.delete(socket.id);
    players.delete(socket.id);
    broadcastQueueUpdate();
    broadcastOnlineCount();
  });
});

function endGame(gameId,winnerId=null,disconnected=false){
  try{
    const game=activeGames.get(gameId);
    if(!game)return;
    
    // Clear timer
    if (game.turnTimer) {
      clearTimeout(game.turnTimer);
      game.turnTimer = null;
    }
    
    console.log('');
    console.log('🏁 ========== GAME END ==========');
    console.log(`   Game ID: ${gameId}`);
    console.log(`   Winner: ${winnerId || 'DRAW'}`);
    console.log(`   Disconnected: ${disconnected}`);
    console.log('================================');
    console.log('');
    
    const isDraw=!winnerId;
    const player1Id = game.player1Id;
    const player2Id = game.player2Id;
    
    [player1Id, player2Id].forEach(socketId=>{
      const player=players.get(socketId);
      if(!player)return;
      
      const won=socketId===winnerId;
      const opponentId = socketId === player1Id ? player2Id : player1Id;
      
      let xpGained=0;
      let coinsGained=0;
      let rankedChange=0;
      
      if(isDraw){
        xpGained=30;
        coinsGained=50;
        const rankingResult=updateRankedPoints(player.playerId,players.get(opponentId)?.playerId||'',true);
        rankedChange=socketId===player1Id?rankingResult.winnerChange:rankingResult.loserChange;
        const{playerData:updatedData,leveledUp}=updatePlayerLevel(player.playerId,xpGained,coinsGained);
        
        io.to(socketId).emit('game:end',{
          result:'draw',
          targetWord:game.targetWord,
          xpGained,
          coinsGained,
          rankedChange,
          newRankedPoints:updatedData.rankedPoints,
          progress:updatedData,
          leveledUp
        });
      }else if(won){
        const fastWinBonus=Math.max(0,(game.maxGuesses-game.currentRow))*10;
        xpGained=100+fastWinBonus;
        coinsGained=150 + fastWinBonus;
        if(disconnected){
          xpGained+=50;
          coinsGained+=100;
        }
        
        const rankingResult=updateRankedPoints(player.playerId,players.get(opponentId)?.playerId||'',false);
        rankedChange=rankingResult.winnerChange;
        const{playerData:updatedData,leveledUp}=updatePlayerLevel(player.playerId,xpGained,coinsGained);
        
        io.to(socketId).emit('game:end',{
          result:'win',
          targetWord:game.targetWord,
          xpGained,
          coinsGained,
          rankedChange,
          newRankedPoints:updatedData.rankedPoints,
          progress:updatedData,
          leveledUp,
          disconnected,
          guessCount:game.currentRow
        });
      }else{
        xpGained=20;
        coinsGained=30;
        const rankingResult=updateRankedPoints(players.get(opponentId)?.playerId||'',player.playerId,false);
        rankedChange=rankingResult.loserChange;
        const{playerData:updatedData}=updatePlayerLevel(player.playerId,xpGained,coinsGained);
        
        io.to(socketId).emit('game:end',{
          result:'lose',
          targetWord:game.targetWord,
          xpGained,
          coinsGained,
          rankedChange,
          newRankedPoints:updatedData.rankedPoints,
          progress:updatedData,
          leveledUp:false
        });
      }
      
      if(player)player.currentGameId=null;
    });
    
    game.status='finished';
    setTimeout(()=>activeGames.delete(gameId),5000);
  }catch(error){
    console.error('❌ End game error:',error);
  }
}

setInterval(()=>{
  const now=Date.now();
  const timeout=5*60*1000;
  for(const[gameId,game]of activeGames.entries()){
    if(game.status==='active'&&(now-game.lastActivity)>timeout){
      endGame(gameId,null);
    }
  }
},60000);

// ===== REST API =====
app.get('/health',(req,res)=>{
  res.json({
    status:'ok',
    timestamp:Date.now(),
    players:players.size,
    queue:queue.size,
    activeGames:activeGames.size
  });
});

app.get('/stats',(req,res)=>{
  res.json({
    totalPlayers:players.size,
    queueSize:queue.size,
    activeGames:activeGames.size
  });
});

const PORT=process.env.PORT||3000;

server.listen(PORT,()=>{
  console.log(`
╔═══════════════════════════════════════╗
║  🎮 ROODLE BY RELAQUENT - SERVER 🎮  ║
║   v2.0 - ENHANCED EDITION             ║
╠═══════════════════════════════════════╣
║  Port: ${PORT.toString().padEnd(30)}║
║  Features: ✅ Chat, Timer, Cosmetics ║
║  Daily Limit: ✅ FIXED               ║
║  Ranks: ✅ 10 Levels                 ║
╚═══════════════════════════════════════╝
  `);
  console.log(`📊 Endpoints: /health /stats`);
  console.log('');
});

process.on('SIGTERM',()=>{
  saveData();
  server.close(()=>process.exit(0));
});

process.on('SIGINT',()=>{
  saveData();
  server.close(()=>process.exit(0));
});
