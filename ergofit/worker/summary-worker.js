// Ücretsiz Cloudflare Worker: Firebase girişini doğrular, Gemini'ye (ücretsiz katman) özet istemini iletir.
// Gizli değerler Worker ayarlarında durur: GEMINI_API_KEY (Secret). Düz değişkenler: FIREBASE_PROJECT_ID, ALLOWED_ORIGIN, BOOTSTRAP_ADMIN, GEMINI_MODEL (isteğe bağlı).

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const MAX_PROMPT = 30000;

const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), c => c.charCodeAt(0));
const json = s => JSON.parse(new TextDecoder().decode(b64u(s)));

// Firebase ID token'ı (RS256) doğrular; geçerliyse payload'ı döner, değilse hata fırlatır.
export async function verifyIdToken(token, projectId, jwks, nowSec = Math.floor(Date.now() / 1000)) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('bad token');
  const [h, p, s] = parts;
  const header = json(h), payload = json(p);
  if (header.alg !== 'RS256') throw new Error('bad alg');
  const jwk = jwks.keys.find(k => k.kid === header.kid);
  if (!jwk) throw new Error('unknown key');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new Error('bad signature');
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('bad audience');
  if (!payload.sub || payload.exp <= nowSec || payload.iat > nowSec + 60) throw new Error('expired');
  if (!payload.email || payload.email_verified !== true) throw new Error('email not verified');
  return payload;
}

const cors = origin => ({
  'access-control-allow-origin': origin || '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  vary: 'origin'
});
const reply = (status, body, origin) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors(origin) } });

// Kullanıcının kendi token'ıyla members/{email} okunur: Firestore kuralları zaten yetkiyi uygular.
async function roleOf(email, idToken, env) {
  if (email === (env.BOOTSTRAP_ADMIN || '').toLowerCase()) return 'admin';
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/members/${encodeURIComponent(email)}`,
    { headers: { authorization: `Bearer ${idToken}` } });
  if (!r.ok) return null;
  return (await r.json()).fields?.role?.stringValue || null;
}

export default {
  async fetch(req, env) {
    const origin = env.ALLOWED_ORIGIN || '*';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (req.method !== 'POST') return reply(405, { error: 'POST gerekli' }, origin);
    if (req.headers.get('origin') && env.ALLOWED_ORIGIN && req.headers.get('origin') !== env.ALLOWED_ORIGIN) return reply(403, { error: 'Yetkisiz kaynak' }, origin);

    const idToken = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
    let user;
    try {
      const jwks = await (await fetch(JWKS_URL, { cf: { cacheTtl: 3600, cacheEverything: true } })).json();
      user = await verifyIdToken(idToken, env.FIREBASE_PROJECT_ID, jwks);
    } catch { return reply(401, { error: 'Giriş geçersiz, yeniden giriş yap.' }, origin); }

    const role = await roleOf(user.email.toLowerCase(), idToken, env);
    if (role !== 'admin' && role !== 'editor') return reply(403, { error: 'Bu işlem için yetkin yok.' }, origin);

    let body;
    try { body = await req.json(); } catch { return reply(400, { error: 'Geçersiz istek' }, origin); }
    const { system, user: prompt } = body || {};
    if (typeof system !== 'string' || typeof prompt !== 'string' || system.length + prompt.length > MAX_PROMPT) return reply(400, { error: 'Geçersiz istek' }, origin);

    const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 800, temperature: 0.4 }
      })
    });
    if (!r.ok) { console.error('Gemini', r.status, (await r.text()).slice(0, 300)); return reply(502, { error: r.status === 429 ? 'Ücretsiz kota doldu, biraz sonra tekrar dene.' : 'Özet şu an hazırlanamadı.' }, origin); }
    const j = await r.json();
    const text = (j.candidates?.[0]?.content?.parts || []).map(x => x.text || '').join('').trim();
    if (!text) return reply(502, { error: 'Özet üretilemedi, tekrar dene.' }, origin);
    return reply(200, { summary: text }, origin);
  }
};
