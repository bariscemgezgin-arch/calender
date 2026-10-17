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

export async function push(settings, payload) {
  if (!syncBase(settings) || !settings.syncToken) return false;
  const r = await fetch(widgetUrl(settings), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true });
  if (!r.ok) throw new Error(`Widget eşitleme hatası (${r.status})`);
  return true;
}
