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
node --test tests/csv.test.mjs
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

## Yapay zeka özeti kurulumu (Cloud Functions)
Anahtar tarayıcıda değil sunucuda durur. Bunun için Firebase projesini **Blaze (kullandıkça öde)** planına al; bu kullanımda maliyet genelde çok düşüktür. Bilgisayarda Node 20 ve `npm i -g firebase-tools` gerekir:
```
cd ergofit
firebase login
firebase use --add                      # projeni seç
firebase functions:secrets:set ANTHROPIC_API_KEY   # console.anthropic.com'dan aldığın anahtar
(cd functions && npm install)
firebase deploy --only functions,firestore:rules
```
- Fonksiyon `europe-west1`'de çalışır; model varsayılan `claude-sonnet-5-5` (`SUMMARY_MODEL` ile değiştirilebilir).
- **Yapay zekaya giden veri**: yaş, çalışma listesi ve seans notları. Çocuğun adı, telefon, e-posta ve uzun rakam dizileri gönderilmez; not metninde çocuğun adı geçiyorsa "çocuk" ile değiştirilir. Veli bilgisi uygulamada hiç tutulmaz.
- Özet alanlarını yalnızca sunucu yazar; `firestore.rules` istemciden değiştirmeyi engeller.
- Yönetici e-postası `functions/index.js` içinde de var (`ADMIN_EMAIL`); rules ve config ile aynı olmalı.

## Bilinen sınırlar
- Özet yapay zeka üretimidir; hata yapabilir, notlarda olmayanı yazmaması istenir ama aileye iletmeden önce okunmalı.
- Aynı alanı iki kişi aynı anda düzenlerse son kaydeden kazanır (çalışmalar ve notlar ayrı kayıt olduğu için çakışmaz).
- Üyeler bir Google hesabına sahip olmalı.
- Çocuk verisi sağlık verisi sayılır (KVKK): yalnızca gerekli bilgileri gir, Firestore bölgesini ve erişim listesini bilinçli seç.
