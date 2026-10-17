// Cloudflare Worker: widget özetini saklar. Gizli adres = erişim anahtarı (/s/<rastgele-anahtar>).
// KV namespace'i "KV" adıyla bağlanmalı.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (body, status = 200) =>
  new Response(body, { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const m = new URL(req.url).pathname.match(/^\/s\/([A-Za-z0-9_-]{24,64})$/);
    if (!m) return json('{"error":"not found"}', 404);
    const key = m[1];
    if (req.method === 'PUT') {
      const text = await req.text();
      if (text.length > 20000) return json('{"error":"too large"}', 413);
      try { JSON.parse(text); } catch { return json('{"error":"bad json"}', 400); }
      await env.KV.put(key, text, { expirationTtl: 60 * 60 * 24 * 90 });
      return json('{"ok":true}');
    }
    if (req.method === 'GET') {
      const v = await env.KV.get(key);
      return v ? json(v) : json('{"error":"empty"}', 404);
    }
    return json('{"error":"method"}', 405);
  },
};
