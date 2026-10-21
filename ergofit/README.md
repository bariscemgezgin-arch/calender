# Ergofit Çocuk Takibi

Ergoterapistlerin çocuk bilgilerini, "şu an çalışılanları", seans notlarını ve notlardan yapay zekanın hazırladığı aileye özeti ortak tuttuğu uygulama. Telefona PWA olarak yüklenir. Değişiklikler anlık olarak herkese yansır; kim, ne zaman güncelledi görünür.

- **Giriş**: Google hesabı. Yalnızca yöneticinin *Yönetim* ekranında tanımladığı e-postalar girebilir.
- **Roller**: Yönetici (her şey, kişi/çocuk silme), Düzenleyici (not, çalışma, çocuk ekleme/düzenleme), İzleyici (salt okunur).
- **Çocuk sayfası**: Şu an çalışılanlar (tikle "ulaşıldı"), tarih/yazar damgalı seans notları ve **aileye kısa özet**. Özeti kimse elle yazmaz; "Özeti yenile" düğmesine basınca yapay zeka (Claude) notlardan üretir. Yeni not eklendikten sonra özet eskiyse uyarı çıkar.
- **Liste**: arama, "Benim çocuklarım", başkası son 48 saatte güncellediyse rozet.
- **İçe aktarma**: Yönetim → .xlsx/CSV seç veya yapıştır. Yalnızca ad ve doğum tarihi (varsa terapist, çalışılan) okunur; TC, telefon, veli bilgisi okunmaz.
- **Çevrimdışı**: son görülen veri cihazda önbelleklenir; bağlantı gelince eşitlenir.

## Denemek (kurulumsuz)
`js/firebase-config.js` boşken uygulama DEMO modunda açılır (sahte veri, kayıt tutulmaz):
```
cd ergofit && python3 -m http.server 8000   # http://localhost:8000
node --test tests/*.mjs
```

## Gerçek kullanım için Firebase kurulumu (~10 dk, ücretsiz katman yeter)
1. https://console.firebase.google.com → proje oluştur (Analytics gerekmez).
2. **Build → Authentication → Get started → Google** sağlayıcısını etkinleştir.
3. **Build → Firestore Database → Create database** (production mode; bölge olarak `eur3` veya `europe-west`).
4. Firestore → **Rules** sekmesine `firestore.rules` içeriğini yapıştır, **Publish**. Dosyanın başındaki `adminEmail()` ilk yöneticinin e-postasıdır.
5. **Project settings → Your apps → Web (`</>`)** ekle; çıkan `firebaseConfig` değerlerini `js/firebase-config.js` içine yapıştır (`bootstrapAdmin`'i de aynı e-posta yap).
6. Authentication → **Settings → Authorized domains**'e uygulamayı yayınladığın alan adını ekle (örn. `kullanici.github.io`).
7. Yayınla (GitHub Pages vb., HTTPS şart), yönetici e-postasıyla giriş yap → **Yönetim**'den ekibi ekle → çocuk listesini içe aktar.

> `apiKey` gizli bir anahtar değildir; güvenlik `firestore.rules` ile sağlanır. Kuralları yayınlamadan gerçek veri girme.

## Yapay zeka özeti kurulumu (tamamen ücretsiz, kart gerekmez)
Özeti Google Gemini'nin ücretsiz katmanı üretir. Anahtar tarayıcıda değil, ücretsiz bir Cloudflare Worker'da durur; Worker yalnızca Firebase ile giriş yapmış, düzenleyici/yönetici rolündeki kişilerin isteğini kabul eder.
1. https://aistudio.google.com/apikey → **Create API key** (Google hesabınla, kart yok). Anahtarı kopyala.
2. https://dash.cloudflare.com → ücretsiz hesap aç → **Workers & Pages → Create → Hello World → Deploy → Edit code**; `worker/summary-worker.js` içeriğini yapıştırıp **Deploy**.
3. Worker → **Settings → Variables and Secrets** altına ekle:
   - `GEMINI_API_KEY` (tür: **Secret**) = 1. adımdaki anahtar
   - `FIREBASE_PROJECT_ID` = Firebase proje kimliğin
   - `BOOTSTRAP_ADMIN` = yönetici e-postan
   - `ALLOWED_ORIGIN` = uygulamanın adresi, örn. `https://kullanici.github.io` (sonunda `/` ve yol olmadan)
   - isteğe bağlı `GEMINI_MODEL` (varsayılan `gemini-2.5-flash`; Google modeli kaldırırsa AI Studio'daki güncel ücretsiz bir modelin adını yaz)
4. Worker adresini (`https://....workers.dev`) `js/firebase-config.js` içindeki `summaryEndpoint`'e yapıştır.

- **Yapay zekaya giden veri**: yaş, çalışma listesi ve seans notları. Çocuğun adı, telefon, e-posta ve uzun rakam dizileri tarayıcıda temizlenir; not metninde çocuğun adı geçiyorsa "çocuk" ile değiştirilir. Worker bu metni saklamaz.
- **Önemli gizlilik notu**: Gemini'nin *ücretsiz* katmanında Google, gönderilen içeriği ürünlerini geliştirmek için kullanabilir ve insanlar inceleyebilir. İsimsiz de olsa notlar sağlık bilgisi içerir; bunu bilerek kullan. Ücretli katman bunu kapatır.
- Ücretsiz kotanın dakikalık/günlük sınırı vardır; dolarsa "kota doldu, biraz sonra tekrar dene" uyarısı çıkar.
- Özet alanlarını arayüz kilitler (kimse yazamaz); teknik olarak yetkili bir düzenleyici veritabanına doğrudan yazabilir, kapalı bir ekip uygulaması için bu kabul edildi.

## Bilinen sınırlar
- Özet yapay zeka üretimidir; hata yapabilir, notlarda olmayanı yazmaması istenir ama aileye iletmeden önce okunmalı.
- Aynı alanı iki kişi aynı anda düzenlerse son kaydeden kazanır (çalışmalar ve notlar ayrı kayıt olduğu için çakışmaz).
- Üyeler bir Google hesabına sahip olmalı.
- Çocuk verisi sağlık verisi sayılır (KVKK): yalnızca gerekli bilgileri gir, Firestore bölgesini ve erişim listesini bilinçli seç.
