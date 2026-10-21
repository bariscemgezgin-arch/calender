# Ergofit Çocuk Takibi

Ergoterapistlerin çocuk bilgilerini, "şu an çalışılanları", aileye özet ve seans notlarını ortak tuttuğu uygulama. Telefona PWA olarak yüklenir. Değişiklikler anlık olarak herkese yansır; kim, ne zaman güncelledi görünür.

- **Giriş**: Google hesabı. Yalnızca yöneticinin *Yönetim* ekranında tanımladığı e-postalar girebilir.
- **Roller**: Yönetici (her şey, kişi/çocuk silme), Düzenleyici (not, çalışma, çocuk ekleme/düzenleme), İzleyici (salt okunur).
- **Çocuk sayfası**: Şu an çalışılanlar (tikle "ulaşıldı"), aileye kısa özet, tarih/yazar damgalı seans notları.
- **Liste**: arama, "Benim çocuklarım", başkası son 48 saatte güncellediyse rozet.
- **İçe aktarma**: Yönetim → Excel'den yapıştır veya CSV seç.
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

## Bilinen sınırlar
- Aynı alanı iki kişi aynı anda düzenlerse son kaydeden kazanır (çalışmalar ve notlar ayrı kayıt olduğu için çakışmaz; yalnızca "aileye özet" metni ortaktır).
- Üyeler bir Google hesabına sahip olmalı.
- Çocuk verisi sağlık verisi sayılır (KVKK): yalnızca gerekli bilgileri gir, Firestore bölgesini ve erişim listesini bilinçli seç.
