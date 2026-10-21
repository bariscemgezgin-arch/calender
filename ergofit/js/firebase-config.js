// Firebase konsolundan aldığın web uygulaması ayarlarını buraya yapıştır (README'de adım adım anlatılıyor).
// Boş bırakılırsa uygulama kayıt tutmayan DEMO modunda açılır.
export const firebaseConfig = {
  apiKey: 'AIzaSyAo46cvtyFUDJHTh5kqKp_G2D1odv_C6Hg',
  authDomain: 'ergofit-2888c.firebaseapp.com',
  projectId: 'ergofit-2888c',
  appId: '1:452834939853:web:4177bcf9949655b6406a84'
};

// İlk yönetici. firestore.rules içindeki ADMIN_EMAIL ile aynı olmalı.
export const bootstrapAdmin = 'bariscemgezgin@gmail.com';

// Cloudflare Worker adresi (yapay zeka özeti için, README'ye bak). Örn. 'https://ergofit-ozet.KULLANICI.workers.dev'
export const summaryEndpoint = '';
