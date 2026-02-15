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
  1:{name:"Yeni Doğmuş I",xpNeeded:100},2:{name:"Yeni Doğmuş II",xpNeeded:150},3:{name:"Yeni Doğmuş III",xpNeeded:200},4:{name:"Yeni Doğmuş IV",xpNeeded:250},5:{name:"Yeni Doğmuş V",xpNeeded:300},6:{name:"Amatör I",xpNeeded:400},7:{name:"Amatör II",xpNeeded:500},8:{name:"Amatör III",xpNeeded:600},9:{name:"Amatör IV",xpNeeded:700},10:{name:"Bilirkişi I",xpNeeded:850},11:{name:"Bilirkişi II",xpNeeded:1000},12:{name:"Bilirkişi III",xpNeeded:1200},13:{name:"Bilirkişi IV",xpNeeded:1400},14:{name:"Bilirkişi V",xpNeeded:1600},15:{name:"Usta I",xpNeeded:1850},16:{name:"Usta II",xpNeeded:2100},17:{name:"Usta III",xpNeeded:2400},18:{name:"Usta IV",xpNeeded:2700},19:{name:"Usta V",xpNeeded:3000},20:{name:"General I",xpNeeded:3400},21:{name:"General II",xpNeeded:3800},22:{name:"General III",xpNeeded:4300},23:{name:"General IV",xpNeeded:4800},24:{name:"General V",xpNeeded:5400},25:{name:"CEO I",xpNeeded:6000},26:{name:"CEO II",xpNeeded:6700},27:{name:"CEO III",xpNeeded:7500},28:{name:"CEO IV",xpNeeded:8400},29:{name:"CEO V",xpNeeded:9400},30:{name:"Görmüş Geçirmiş",xpNeeded:10500}
};

for(let i=31;i<=100;i++){
  RANKS[i]={name:"Görmüş Geçirmiş",xpNeeded:RANKS[i-1].xpNeeded+1200};
}

function getRandomWord(length){
  const list=WORD_LISTS[length];
  if(!list||list.length===0)return null;
  return list[Math.floor(Math.random()*list.length)];
}

function generateGameId(){
  return `game_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;
}

function coinFlip(){
  return Math.random()<0.5;
}

function getPlayerData(playerId){
  if(!persistentPlayers[playerId]){
    persistentPlayers[playerId]={playerId,totalXP:0,level:1,currentXP:0,wins:0,losses:0,draws:0,gamesPlayed:0,rankedPoints:1000,highestRank:1000,winStreak:0,bestWinStreak:0,lastSeen:Date.now()};
  }
  persistentPlayers[playerId].lastSeen=Date.now();
  return persistentPlayers[playerId];
}

function updatePlayerLevel(playerId,xpGained){
  let playerData=getPlayerData(playerId);
  playerData.totalXP+=xpGained;
  playerData.currentXP+=xpGained;
  let leveledUp=false;
  while(playerData.level<100){
    const nextRank=RANKS[playerData.level+1];
    if(playerData.totalXP>=nextRank.xpNeeded){
      playerData.level++;
      playerData.currentXP=0;
      leveledUp=true;
    }else break;
  }
  playerData.rank=RANKS[playerData.level].name;
  persistentPlayers[playerId]=playerData;
  saveData();
  return{playerData,leveledUp};
}

function updateRankedPoints(winnerId,loserId,isDraw=false){
  const winnerData=getPlayerData(winnerId);
  const loserData=getPlayerData(loserId);
  const K=32;
  const expectedWinner=1/(1+Math.pow(10,(loserData.rankedPoints-winnerData.rankedPoints)/400));
  const expectedLoser=1/(1+Math.pow(10,(winnerData.rankedPoints-loserData.rankedPoints)/400));
  let winnerChange=0;
  let loserChange=0;
  if(isDraw){
    winnerChange=Math.round(K*(0.5-expectedWinner));
    loserChange=Math.round(K*(0.5-expectedLoser));
    winnerData.rankedPoints+=winnerChange;
    loserData.rankedPoints+=loserChange;
    winnerData.draws++;
    loserData.draws++;
  }else{
    winnerChange=Math.round(K*(1-expectedWinner));
    loserChange=Math.round(K*(0-expectedLoser));
    winnerData.rankedPoints+=winnerChange;
    loserData.rankedPoints+=loserChange;
    winnerData.wins++;
    winnerData.winStreak++;
    winnerData.bestWinStreak=Math.max(winnerData.bestWinStreak,winnerData.winStreak);
    loserData.losses++;
    loserData.winStreak=0;
  }
  winnerData.highestRank=Math.max(winnerData.highestRank,winnerData.rankedPoints);
  loserData.highestRank=Math.max(loserData.highestRank,loserData.rankedPoints);
  winnerData.gamesPlayed++;
  loserData.gamesPlayed++;
  persistentPlayers[winnerId]=winnerData;
  persistentPlayers[loserId]=loserData;
  updateLeaderboard(winnerId);
  updateLeaderboard(loserId);
  saveData();
  return{winnerPoints:winnerData.rankedPoints,loserPoints:loserData.rankedPoints,winnerChange:winnerChange,loserChange:loserChange};
}

function updateLeaderboard(playerId){
  const playerData=getPlayerData(playerId);
  let currentNick='Oyuncu';
  for(const[socketId,player]of players.entries()){
    if(player.playerId===playerId){
      currentNick=player.nick;
      break;
    }
  }
  const existingIndex=leaderboard.findIndex(p=>p.playerId===playerId);
  const leaderboardEntry={playerId:playerData.playerId,nick:currentNick,rankedPoints:playerData.rankedPoints,level:playerData.level,rank:playerData.rank||RANKS[playerData.level].name,wins:playerData.wins,losses:playerData.losses,draws:playerData.draws,gamesPlayed:playerData.gamesPlayed,winStreak:playerData.winStreak};
  if(existingIndex>=0){
    leaderboard[existingIndex]=leaderboardEntry;
  }else{
    leaderboard.push(leaderboardEntry);
  }
  leaderboard.sort((a,b)=>b.rankedPoints-a.rankedPoints);
  if(leaderboard.length>100){
    leaderboard=leaderboard.slice(0,100);
  }
  saveData();
}

function getLeaderboard(){
  return leaderboard.slice(0,50);
}

function tryMatchPlayers(){
  if(queue.size<2)return;
  const queueArray=Array.from(queue.entries());
  for(let i=0;i<queueArray.length-1;i++){
    const[player1Id,player1Pref]=queueArray[i];
    for(let j=i+1;j<queueArray.length;j++){
      const[player2Id,player2Pref]=queueArray[j];
      if(player1Pref.wordLength===player2Pref.wordLength||player1Pref.wordLength===0||player2Pref.wordLength===0){
        const player1=players.get(player1Id);
        const player2=players.get(player2Id);
        if(!player1||!player2)continue;
        createMatch(player1Id,player2Id,player1Pref.wordLength||player2Pref.wordLength||5);
        return;
      }
    }
  }
  if(queueArray.length>=2){
    const[player1Id,player1Pref]=queueArray[0];
    const[player2Id,player2Pref]=queueArray[1];
    const player1=players.get(player1Id);
    const player2=players.get(player2Id);
    if(player1&&player2){
      createMatch(player1Id,player2Id,player1Pref.wordLength||player2Pref.wordLength||5);
    }
  }
}

function createMatch(player1Id,player2Id,wordLength){
  const player1=players.get(player1Id);
  const player2=players.get(player2Id);
  if(!player1||!player2)return;
  
  // Remove from queue
  queue.delete(player1Id);
  queue.delete(player2Id);
  
  const gameId=generateGameId();
  const targetWord=getRandomWord(wordLength);
  if(!targetWord){
    console.error(`No word for length ${wordLength}`);
    queue.set(player1Id,{wordLength,joinedAt:Date.now()});
    queue.set(player2Id,{wordLength,joinedAt:Date.now()});
    return;
  }
  
  // Randomly decide who goes first
  const firstPlayer=coinFlip()?player1Id:player2Id;
  
  const game={
    gameId,
    targetWord,
    wordLength,
    players:{
      [player1Id]:{
        playerId:player1.playerId,
        nick:player1.nick,
        level:player1.level,
        guesses:[],
        finished:false,
        won:false
      },
      [player2Id]:{
        playerId:player2.playerId,
        nick:player2.nick,
        level:player2.level,
        guesses:[],
        finished:false,
        won:false
      }
    },
    currentTurn:firstPlayer,
    turnNumber:0,
    maxGuesses:6,
    status:'active',
    createdAt:Date.now(),
    lastActivity:Date.now()
  };
  
  activeGames.set(gameId,game);
  player1.currentGameId=gameId;
  player2.currentGameId=gameId;
  
  console.log(`🎮 Game ${gameId} | ${player1.nick} vs ${player2.nick} | Word: ${targetWord} | First: ${firstPlayer === player1Id ? player1.nick : player2.nick}`);
  
  // Send game start to both players with correct turn information
  io.to(player1Id).emit('game:start',{
    gameId,
    wordLength,
    opponent:{
      nick:player2.nick,
      level:player2.level,
      rank:getPlayerData(player2.playerId).rank
    },
    yourTurn: firstPlayer === player1Id
  });
  
  io.to(player2Id).emit('game:start',{
    gameId,
    wordLength,
    opponent:{
      nick:player1.nick,
      level:player1.level,
      rank:getPlayerData(player1.playerId).rank
    },
    yourTurn: firstPlayer === player2Id
  });
  
  broadcastQueueUpdate();
}

function broadcastQueueUpdate(){
  const queuePlayers=Array.from(queue.keys()).map(socketId=>{
    const player=players.get(socketId);
    return player?{nick:player.nick,level:player.level,rank:getPlayerData(player.playerId).rank}:null;
  }).filter(Boolean);
  io.emit('queue:update',{players:queuePlayers});
}

io.on('connection',(socket)=>{
  console.log('🔌 Client connected:',socket.id);
  
  socket.on('player:register',(data)=>{
    try{
      const{playerId,nick,level,preferredLength}=data;
      const storedData=getPlayerData(playerId||socket.id);
      players.set(socket.id,{
        socketId:socket.id,
        playerId:playerId||socket.id,
        nick:(nick||'Oyuncu').substring(0,16),
        level:storedData.level||level||1,
        rank:storedData.rank||RANKS[storedData.level||1].name,
        preferredLength:preferredLength||5,
        currentGameId:null,
        connectedAt:Date.now()
      });
      socket.emit('player:registered',{playerId:playerId||socket.id,progress:storedData});
      console.log(`✅ Registered: ${nick} (${socket.id})`);
    }catch(error){
      console.error('❌ Register error:',error);
      socket.emit('error',{message:'Kayıt hatası!'});
    }
  });
  
  socket.on('queue:join',(data)=>{
    try{
      const player=players.get(socket.id);
      if(!player){
        socket.emit('error',{message:'Önce kayıt olun!'});
        return;
      }
      if(queue.has(socket.id)){
        socket.emit('error',{message:'Zaten sıradasınız!'});
        return;
      }
      const wordLength=data.preferredLength||player.preferredLength||5;
      if(!WORD_LISTS[wordLength]||WORD_LISTS[wordLength].length===0){
        socket.emit('error',{message:'Bu uzunluk desteklenmiyor!'});
        return;
      }
      queue.set(socket.id,{wordLength:wordLength,joinedAt:Date.now()});
      socket.emit('queue:joined',{position:queue.size});
      console.log(`🎯 ${player.nick} joined queue -> ${queue.size} players`);
      broadcastQueueUpdate();
      setTimeout(()=>tryMatchPlayers(),100);
    }catch(error){
      console.error('❌ Queue join error:',error);
      socket.emit('error',{message:'Sıra hatası!'});
    }
  });
  
  socket.on('queue:leave',()=>{
    try{
      queue.delete(socket.id);
      socket.emit('queue:left');
      broadcastQueueUpdate();
      console.log(`⬅️ Player left queue: ${socket.id}`);
    }catch(error){
      console.error('❌ Queue leave error:',error);
    }
  });
  
  socket.on('game:guess',(data)=>{
    try{
      const{gameId,guess}=data;
      console.log(`📥 Guess received from ${socket.id}: "${guess}" in game ${gameId}`);
      
      if(!guess||typeof guess!=='string'){
        socket.emit('error',{message:'Geçersiz tahmin!'});
        return;
      }
      
      const game=activeGames.get(gameId);
      if(!game||game.status!=='active'){
        socket.emit('error',{message:'Oyun bulunamadı!'});
        return;
      }
      
      // Check if it's this player's turn
      if(game.currentTurn!==socket.id){
        console.log(`❌ Not player's turn. Current: ${game.currentTurn}, Sender: ${socket.id}`);
        socket.emit('error',{message:'Sıran değil!'});
        return;
      }
      
      const playerData=game.players[socket.id];
      if(!playerData||playerData.finished){
        socket.emit('error',{message:'Oyun bitti!'});
        return;
      }
      
      const normalizedGuess=guess.toUpperCase().trim();
      if(normalizedGuess.length!==game.wordLength){
        socket.emit('error',{message:'Kelime uzunluğu hatalı!'});
        return;
      }
      
      game.lastActivity=Date.now();
      game.turnNumber++;
      
      const result=evaluateGuess(normalizedGuess,game.targetWord);
      const won=result.every(r=>r==='correct');
      
      playerData.guesses.push({
        guess:normalizedGuess,
        result,
        turnNumber:game.turnNumber,
        timestamp:Date.now()
      });
      
      console.log(`✅ Guess processed: ${normalizedGuess} = ${result.join(',')} | Won: ${won}`);
      
      // Send result back to the player who guessed
      socket.emit('game:guess:result',{
        guess:normalizedGuess,
        result,
        won,
        lost:false,
        guessCount:playerData.guesses.length
      });
      
      // Get opponent ID
      const opponentId=Object.keys(game.players).find(id=>id!==socket.id);
      
      if(opponentId){
        // Update opponent about this player's progress
        io.to(opponentId).emit('game:opponent:update',{
          guessCount:playerData.guesses.length,
          finished:won,
          won:won
        });
        
        // If this player won, end the game
        if(won){
          playerData.finished=true;
          playerData.won=true;
          console.log(`🏆 ${playerData.nick} won!`);
          endGame(gameId,socket.id);
          return;
        }
        
        // Check if all guesses are used
        const allGuessesUsed=Object.values(game.players).every(p=>p.guesses.length>=game.maxGuesses);
        if(allGuessesUsed){
          console.log('🤝 Both players out of guesses - Draw');
          endGame(gameId,null);
          return;
        }
        
        // Switch turn to opponent
        game.currentTurn=opponentId;
        console.log(`🔄 Turn switched to ${opponentId}`);
        
        // Notify opponent it's their turn
        io.to(opponentId).emit('game:opponent:guess',{
          guess:normalizedGuess,
          result,
          opponentWon:false,
          yourTurn:true
        });
        
        io.to(opponentId).emit('game:turn:start',{
          turnNumber:game.turnNumber,
          guessesRemaining:game.maxGuesses-game.players[opponentId].guesses.length
        });
      }
    }catch(error){
      console.error('❌ Guess error:',error);
      socket.emit('error',{message:'Tahmin hatası!'});
    }
  });
  
  socket.on('leaderboard:get',()=>{
    try{
      socket.emit('leaderboard:update',{leaderboard:getLeaderboard()});
    }catch(error){
      console.error('❌ Leaderboard error:',error);
    }
  });
  
  socket.on('disconnect',()=>{
    console.log('🔌❌ Client disconnected:',socket.id);
    try{
      const player=players.get(socket.id);
      if(player&&player.currentGameId){
        const game=activeGames.get(player.currentGameId);
        if(game&&game.status==='active'){
          const opponentId=Object.keys(game.players).find(id=>id!==socket.id);
          if(opponentId){
            io.to(opponentId).emit('game:opponent:disconnected',{message:'Rakibiniz ayrıldı!'});
            endGame(player.currentGameId,opponentId,true);
          }else{
            game.status='abandoned';
            activeGames.delete(player.currentGameId);
          }
        }
      }
      queue.delete(socket.id);
      players.delete(socket.id);
      broadcastQueueUpdate();
    }catch(error){
      console.error('❌ Disconnect error:',error);
    }
  });
});

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

function endGame(gameId,winnerId=null,disconnected=false){
  try{
    const game=activeGames.get(gameId);
    if(!game)return;
    
    console.log(`🏁 Ending game ${gameId} | Winner: ${winnerId || 'DRAW'} | Disconnected: ${disconnected}`);
    
    const playerIds=Object.keys(game.players);
    const isDraw=!winnerId;
    
    playerIds.forEach(socketId=>{
      const playerData=game.players[socketId];
      const player=players.get(socketId);
      if(!player)return;
      
      const won=socketId===winnerId;
      const opponentId=playerIds.find(id=>id!==socketId);
      if(!opponentId)return;
      
      let xpGained=0;
      let rankedChange=0;
      
      if(isDraw){
        xpGained=30;
        const rankingResult=updateRankedPoints(player.playerId,game.players[opponentId].playerId,true);
        rankedChange=socketId===playerIds[0]?rankingResult.winnerChange:rankingResult.loserChange;
        const{playerData:updatedData,leveledUp}=updatePlayerLevel(player.playerId,xpGained);
        io.to(socketId).emit('game:end',{
          result:'draw',
          targetWord:game.targetWord,
          xpGained,
          rankedChange,
          newRankedPoints:updatedData.rankedPoints,
          progress:updatedData,
          leveledUp
        });
      }else if(won){
        const fastWinBonus=Math.max(0,(game.maxGuesses-playerData.guesses.length))*15;
        xpGained=100+fastWinBonus;
        if(disconnected){xpGained+=50;}
        const rankingResult=updateRankedPoints(player.playerId,game.players[opponentId].playerId,false);
        rankedChange=rankingResult.winnerChange;
        const{playerData:updatedData,leveledUp}=updatePlayerLevel(player.playerId,xpGained);
        io.to(socketId).emit('game:end',{
          result:'win',
          targetWord:game.targetWord,
          xpGained,
          rankedChange,
          newRankedPoints:updatedData.rankedPoints,
          progress:updatedData,
          leveledUp,
          disconnected,
          guessCount:playerData.guesses.length
        });
      }else{
        xpGained=20;
        const rankingResult=updateRankedPoints(game.players[opponentId].playerId,player.playerId,false);
        rankedChange=rankingResult.loserChange;
        const{playerData:updatedData}=updatePlayerLevel(player.playerId,xpGained);
        io.to(socketId).emit('game:end',{
          result:'lose',
          targetWord:game.targetWord,
          xpGained,
          rankedChange,
          newRankedPoints:updatedData.rankedPoints,
          progress:updatedData,
          leveledUp:false
        });
      }
      
      if(player){player.currentGameId=null;}
    });
    
    game.status='finished';
    game.endedAt=Date.now();
    setTimeout(()=>{activeGames.delete(gameId);},5000);
    console.log(`✅ Game ended: ${gameId}`);
  }catch(error){
    console.error('❌ End game error:',error);
  }
}

setInterval(()=>{
  const now=Date.now();
  const timeout=5*60*1000;
  for(const[gameId,game]of activeGames.entries()){
    if(game.status==='active'&&(now-game.lastActivity)>timeout){
      console.log(`⏰ Game timeout: ${gameId}`);
      endGame(gameId,null);
    }
  }
},60000);

app.get('/health',(req,res)=>{
  res.json({
    status:'ok',
    timestamp:Date.now(),
    players:players.size,
    queue:queue.size,
    activeGames:activeGames.size,
    totalRegistered:Object.keys(persistentPlayers).length
  });
});

app.get('/stats',(req,res)=>{
  res.json({
    totalPlayers:players.size,
    queueSize:queue.size,
    activeGames:activeGames.size,
    registeredPlayers:Object.keys(persistentPlayers).length,
    leaderboardSize:leaderboard.length
  });
});

app.get('/leaderboard',(req,res)=>{
  res.json({leaderboard:getLeaderboard()});
});

app.get('/player/:playerId',(req,res)=>{
  const{playerId}=req.params;
  const playerData=getPlayerData(playerId);
  const rank=leaderboard.findIndex(p=>p.playerId===playerId)+1;
  res.json({player:playerData,leaderboardRank:rank||null});
});

const PORT=process.env.PORT||3000;

server.listen(PORT,()=>{
  console.log(`
╔═══════════════════════════════════════╗
║  🎮 ROODLE BY RELAQUENT - SERVER 🎮  ║
╠═══════════════════════════════════════╣
║  Port: ${PORT.toString().padEnd(30)}║
║  Status: ✅ READY                    ║
╚═══════════════════════════════════════╝
  `);
  console.log(`📊 /health | 🏆 /leaderboard | 📈 /stats`);
});

process.on('SIGTERM',()=>{
  console.log('⚠️  SIGTERM received');
  saveData();
  server.close(()=>{
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT',()=>{
  console.log('⚠️  SIGINT received');
  saveData();
  server.close(()=>{
    console.log('✅ Server closed');
    process.exit(0);
  });
});
