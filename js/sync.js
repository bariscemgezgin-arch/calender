// Widget için günlük özet: uygulama bunu Cloudflare Worker'a yollar, Scriptable widget'ı okuyup çizer.
import * as S from './streak.js';

const WEEKS = 10;
const byTime = (a, b) => (a.t || '99:99').localeCompare(b.t || '99:99') || a.n.localeCompare(b.n, 'tr');
const brief = (h) => ({ n: h.name, e: h.emoji || '', t: h.time || '' });

export function buildPayload(habits, logs, today) {
  const st = S.dayStats(habits, logs, today, today);
  const g = S.gameStats(habits, logs, today);
  const items = st.items
    .map(({ habit: h, status }) => ({ ...brief(h), s: status === 'miss' ? 'pending' : status }))
    .sort(byTime);
  const first = S.addDays(S.weekStart(today), -7 * (WEEKS - 1));
  let heat = '';
  for (let i = 0; i < WEEKS * 7; i++) {
    const d = S.addDays(first, i);
    if (d > today) heat += 'f';
    else {
      const l = S.dayStats(habits, logs, d, today).level;
      heat += l < 0 ? 'n' : String(l);
    }
  }
  let streak = null;
  for (const h of habits) {
    if (h.once || h.archivedAt) continue;
    const c = S.computeStreak(h, logs, today).current;
    if (c > 0 && (!streak || c > streak.n)) streak = { name: h.name, n: c };
  }
  // Yeni güne uyanıldığında uygulama açılmamış olsa da widget bugünün listesini bilsin.
  const next = {};
  for (let k = 0; k < 7; k++) {
    const d = S.addDays(today, k);
    next[S.dateKey(d)] = S.scheduledHabits(habits, d).map(brief).sort(byTime);
  }
  return { v: 1, at: new Date().toISOString(), date: S.dateKey(today), level: g.level, xp: g.xp, into: g.into, need: g.need, perfectStreak: g.perfectStreak, streak, heat, items, next };
}

export const syncBase = (s) => (s.syncUrl || '').trim().replace(/\/+$/, '');
export const widgetUrl = (s) => `${syncBase(s)}/s/${s.syncToken}`;

export function randomToken() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const ghRepo = (s) => (s.syncRepo || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, '');
// 'github': özel depoya dosya yaz (Worker gerekmez); 'worker': Cloudflare Worker.
export const mode = (s) => (ghRepo(s) && (s.syncGhToken || '').trim() ? 'github' : syncBase(s) ? 'worker' : '');

const b64 = (str) => {
  let bin = '';
  for (const b of new TextEncoder().encode(str)) bin += String.fromCharCode(b);
  return btoa(bin);
};
let queue = Promise.resolve();

async function pushGithub(s, payload) {
  const api = `https://api.github.com/repos/${ghRepo(s)}/contents/dopamin.json`;
  const h = { Authorization: `Bearer ${s.syncGhToken.trim()}`, Accept: 'application/vnd.github+json' };
  for (let attempt = 0; attempt < 2; attempt++) {
    const g = await fetch(api, { headers: h, cache: 'no-store' });
    if (g.status === 401 || g.status === 403) throw new Error('GitHub token geçersiz ya da yetkisiz');
    const sha = g.ok ? (await g.json()).sha : undefined;
    const r = await fetch(api, {
      method: 'PUT',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'sync', content: b64(JSON.stringify(payload)), sha }),
    });
    if (r.ok) return true;
    if (r.status === 409 || r.status === 422) continue; // sha eskidi, tekrar dene
    if (r.status === 404) throw new Error('GitHub deposu bulunamadı (ad ya da token izni?)');
    throw new Error(`GitHub eşitleme hatası (${r.status})`);
  }
  throw new Error('GitHub eşitleme çakıştı, tekrar dene');
}

async function pushWorker(s, payload) {
  const r = await fetch(widgetUrl(s), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true });
  if (!r.ok) throw new Error(`Widget eşitleme hatası (${r.status})`);
  return true;
}

export function push(settings, payload) {
  const m = mode(settings);
  if (!m) return Promise.resolve(false);
  if (m === 'worker' && !settings.syncToken) return Promise.resolve(false);
  const run = () => (m === 'github' ? pushGithub(settings, payload) : pushWorker(settings, payload));
  queue = queue.then(run, run);
  return queue;
}
