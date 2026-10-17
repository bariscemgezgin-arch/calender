# Dopamin Döngüsü

Takvim + günlük görev tikleri + streak + ısı haritası. Kurulum/derleme yok; düz HTML/JS, telefona PWA olarak yüklenir.

## Özellikler
- **Bugün**: görevler saat sırasıyla; tik at (✓ +10 XP), gerekirse ⏭ ile es geç. Tüm görevler bitince kusursuz gün bonusu (+25 XP), seviye atlama.
- **Streak kuralı**: her görevin kendi streak'i var. Haftada (Pzt–Paz) **2 es geçme** hakkı var; 3. kayıpta (es geçilen veya işaretlenmeyen gün) o görevin streak'i sıfırlanır.
- **Rapor**: gün sonu raporu (rütbe, XP, seviye), 18 haftalık ısı haritası, haftalık streak tablosu. Haritada bir güne dokun → o günün raporu.
- **Hafta**: Google Takvim etkinlikleri + "haftalık program yapıştır" (`Pazartesi 09:00-10:30 Ders` satırları → toplu olarak Google Takvim'e eklenir).
- **Widget görünümü**: `index.html#widget`; ayrıca ana ekran ikonunda kalan görev sayısı rozeti.
- Tek seferlik küçük görevler (belirli bir tarih) ve tekrarlı görevler (seçili günler).
- Veri cihazda (localStorage) saklanır; Ayarlar'dan JSON yedek al/yükle.

## Çalıştırma
```
python3 -m http.server 8000   # sonra http://localhost:8000
node --test tests/logic.test.mjs
```
Telefonda kullanmak için HTTPS'te yayınla (ör. GitHub Pages) ve Chrome/Safari'de "Ana ekrana ekle".

## Google Takvim bağlantısı
1. https://console.cloud.google.com → proje oluştur → **Google Calendar API**'yi etkinleştir.
2. OAuth consent screen → External, kendi e-postanı "Test users"a ekle.
3. Credentials → **OAuth client ID** → *Web application*; "Authorized JavaScript origins"e uygulamanın adresini ekle (örn. `https://kullanici.github.io`).
4. Client ID'yi uygulamada **Ayarlar → OAuth Client ID**'ye yapıştır, **Bağlan**'a bas. (Kapsam: `calendar.events`.)

Erişim jetonu 1 saat geçerlidir ve sayfa yenilenince tekrar "Bağlan" gerekir (sunucusuz çalıştığı için).

## iPhone ana ekran widget'ı — bilgisayarsız yol (Scriptable + özel GitHub deposu)
Özet, GitHub'da **özel (private)** bir depodaki `dopamin.json` dosyasına yazılır; Scriptable aynı dosyayı okur. Kod editörü gerekmez, hepsi telefondan yapılır.
1. github.com/new → depo adı `dopamin-data`, **Private**, *Add a README* işaretli → Create.
2. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate: *Repository access: Only select repositories* → `dopamin-data`; *Permissions → Repository permissions → Contents: Read and write*. Token'ı kopyala.
3. Uygulamada **Ayarlar → iPhone widget'ı**: depo (`kullanıcı/dopamin-data`) ve token'ı yapıştır, **Şimdi gönder**.
4. **Scriptable kodunu kopyala** → Scriptable'da yeni script'e yapıştır → ana ekrana Scriptable widget'ı ekle, Script olarak onu seç.

Token tarayıcıda (ve Scriptable betiğinde) saklanır; yalnızca o depoya erişir. Yedek dosyasına yazılmaz.

## iPhone widget'ı — alternatif: Scriptable + Cloudflare Worker
Tarayıcı uygulamaları widget yapamaz; bu yüzden uygulama her tikten sonra küçük bir özeti (görevler, XP, streak, ısı haritası) kendi Cloudflare Worker'ına yollar, iPhone'daki **Scriptable** uygulaması bunu okuyup widget'ı çizer. Hepsi ücretsiz.
1. **Worker**: Cloudflare Dashboard → *Workers & Pages* → *Create* → *Hello World* → Deploy → *Edit code*; `worker/worker.js` içeriğini yapıştırıp Deploy.
2. **KV**: *Storage & Databases → KV → Create namespace* (`dopamin`). Worker'ın *Settings → Bindings → Add → KV namespace*; değişken adı **KV**, namespace'i seç.
3. Worker adresini (`https://….workers.dev`) uygulamada **Ayarlar → iPhone widget'ı → Worker adresi**'ne yapıştır, **Şimdi gönder**'e bas.
4. iPhone'a App Store'dan **Scriptable** kur. **Ayarlar → Scriptable kodunu kopyala**'ya bas, Scriptable'da yeni script oluşturup yapıştır.
5. Ana ekrana Scriptable widget'ı ekle (Küçük ya da Orta), widget'a uzun bas → *Edit Widget* → Script: yeni script'i seç.

Gizli adres (`/s/<rastgele anahtar>`) erişim anahtarıdır; adresi kimseyle paylaşma. Yedek dosyasına anahtar yazılmaz. iOS widget'ı kendi takvimine göre yeniler (genelde 15–30 dk), bu yüzden tik atınca anında değişmeyebilir. Yeni güne uyanınca uygulamayı açmasan bile widget o günün görev listesini gösterir.

## Bilinen sınırlar
- Widget Scriptable üzerinden çalışır (gerçek bir iOS uygulaması değil); yenileme sıklığını iOS belirler.
- Hatırlatma bildirimi yok (sunucusuz web uygulaması güvenilir zamanlı bildirim gönderemez).
