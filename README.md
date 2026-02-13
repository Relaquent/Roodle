# Roodle Multiplayer Server

Gerçek zamanlı 1v1 kelime oyunu sunucusu.

## 🚀 Render'da Deploy Etme

### 1. Render.com'da Proje Oluşturma

1. [Render.com](https://render.com)'a gidin ve kayıt olun
2. Dashboard'dan **New +** butonuna tıklayın
3. **Web Service** seçeneğini seçin
4. GitHub repo'nuzu bağlayın veya **Public Git Repository** seçeneği ile manuel deploy edin

### 2. Ayarlar

**Environment:** `Node`
**Build Command:** `npm install`
**Start Command:** `npm start`
**Instance Type:** `Free` (başlangıç için yeterli)

### 3. Environment Variables

Render dashboard'dan şu değişkeni ekleyin:
- `PORT`: 3000 (otomatik)
- `NODE_ENV`: production

### 4. Deploy

- **Deploy** butonuna tıklayın
- Deploy tamamlandığında size bir URL verilecek (örn: `https://your-app.onrender.com`)

## 🔧 Frontend'i Bağlama

`index.html` dosyasındaki `SERVER_URL` değişkenini güncelleyin:

```javascript
const SERVER_URL = 'https://your-app.onrender.com'; // Render URL'inizi buraya yazın
```

## 📦 Yerel Test

```bash
npm install
npm start
```

Sunucu `http://localhost:3000` adresinde çalışacak.

## 🎮 Özellikler

- ✅ Gerçek zamanlı 1v1 oyunlar
- ✅ Otomatik eşleştirme (matchmaking)
- ✅ XP ve seviye sistemi
- ✅ İlerleme kaydetme
- ✅ Rütbe sistemi (Lvl 1-100)
- ✅ WebSocket ile anlık iletişim
- ✅ Rakip bağlantı kesme yönetimi

## 🔒 Güvenlik

- CORS koruması
- Rate limiting (eklenmeli)
- Input validation
- Error handling

## 📊 API Endpoints

- `GET /health` - Sunucu sağlık kontrolü
- `GET /stats` - Oyuncu istatistikleri
- `POST /progress/save` - İlerleme kaydetme
- `GET /progress/:playerId` - Oyuncu ilerlemesini getirme

## 🌐 Socket Events

### Client → Server
- `player:register` - Oyuncu kaydı
- `queue:join` - Sıraya katılma
- `queue:leave` - Sıradan çıkma
- `game:guess` - Tahmin gönderme

### Server → Client
- `player:registered` - Kayıt onayı
- `queue:joined` - Sıraya katılma onayı
- `game:start` - Oyun başlangıcı
- `game:guess:result` - Tahmin sonucu
- `game:opponent:update` - Rakip güncelleme
- `game:end` - Oyun bitişi

## 📝 Notlar

- Free tier Render servisleri 15 dakika hareketsizlik sonrası uyur
- İlk istek biraz yavaş olabilir (cold start)
- Veritabanı kullanmıyoruz, tüm veriler memory'de
- Production için Redis veya MongoDB eklenebilir

## 🐛 Sorun Giderme

1. **Bağlantı hatası**: SERVER_URL doğru mu kontrol edin
2. **CORS hatası**: Render URL'i ALLOWED_ORIGINS'e ekleyin
3. **WebSocket hatası**: HTTPS kullandığınızdan emin olun

## 📞 Destek

Sorularınız için issue açabilirsiniz.
