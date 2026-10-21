// Firebase konsolundan aldığın web uygulaması ayarlarını buraya yapıştır (README'de adım adım anlatılıyor).
// Boş bırakılırsa uygulama kayıt tutmayan DEMO modunda açılır.
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: ''
};

// İlk yönetici. firestore.rules içindeki ADMIN_EMAIL ile aynı olmalı.
export const bootstrapAdmin = 'bariscemgezgin@gmail.com';

// Cloudflare Worker adresi (yapay zeka özeti için, README'ye bak). Örn. 'https://ergofit-ozet.KULLANICI.workers.dev'
export const summaryEndpoint = '';
