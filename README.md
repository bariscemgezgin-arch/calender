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

## Bilinen sınırlar
- Gerçek bir Android/iOS **ana ekran widget'ı** PWA ile yapılamaz. Şimdilik: ana ekran ikonu + rozet + `#widget` mini ekranı. Gerçek widget için uygulamanın Capacitor/native sarmalayıcıyla paketlenmesi gerekir.
- Hatırlatma bildirimi yok (sunucusuz web uygulaması güvenilir zamanlı bildirim gönderemez).
