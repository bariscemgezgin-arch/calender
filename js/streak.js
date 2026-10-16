// Saf (DOM'suz) oyun mantığı: tarih yardımcıları, streak, ısı haritası seviyesi, XP.
export const MAX_SKIPS = 2; // haftada serbest es geçme hakkı

const pad = (n) => String(n).padStart(2, '0');
export const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
// Haftalar Pazartesi başlar.
export const weekStart = (d) => addDays(d, -((d.getDay() + 6) % 7));
export const weekStartKey = (d) => dateKey(weekStart(d));

// Bir görev o gün listede mi? (tek seferlik görev ya da haftanın seçili günleri)
export function isActiveOn(h, d) {
  const k = dateKey(d);
  if (k < h.createdAt) return false;
  if (h.archivedAt && k >= h.archivedAt) return false;
  if (h.once) return h.once === k;
  return h.days.includes(d.getDay());
}
export const scheduledHabits = (habits, d) => habits.filter((h) => isActiveOn(h, d));

// Bir günün durumu: done | skip | miss (geçmişte işaretlenmemiş) | pending (bugün/gelecek)
export function statusOf(logs, habitId, d, today) {
  const k = dateKey(d);
  const s = logs[k]?.[habitId];
  if (s === 'done' || s === 'skip') return s;
  return k < dateKey(today) ? 'miss' : 'pending';
}

/**
 * Streak kuralı: planlı günlerde "done" streak'i artırır. Es geçilen ya da
 * işaretlenmeden bırakılan gün "kayıp" sayılır; aynı haftada (Pzt-Paz) kayıp
 * sayısı MAX_SKIPS'i aşarsa streak sıfırlanır. İlk MAX_SKIPS kayıp streak'i bozmaz.
 */
export function computeStreak(h, logs, today) {
  if (h.once) return { current: 0, best: 0, skipsUsed: 0, skipsLeft: MAX_SKIPS };
  const todayK = dateKey(today);
  const lastK = h.archivedAt && h.archivedAt <= todayK ? dateKey(addDays(parseKey(h.archivedAt), -1)) : todayK;
  let current = 0;
  let best = 0;
  let wk = null;
  let misses = 0;
  for (let d = parseKey(h.createdAt); dateKey(d) <= lastK; d = addDays(d, 1)) {
    if (!h.days.includes(d.getDay())) continue;
    const k = dateKey(d);
    const w = weekStartKey(d);
    if (w !== wk) {
      wk = w;
      misses = 0;
    }
    const s = logs[k]?.[h.id];
    if (s === 'done') {
      current++;
      best = Math.max(best, current);
    } else if (s === 'skip' || k < todayK) {
      misses++;
      if (misses > MAX_SKIPS) current = 0;
    }
  }
  const skipsUsed = wk === weekStartKey(today) ? Math.min(misses, MAX_SKIPS) : 0;
  return { current, best, skipsUsed, skipsLeft: MAX_SKIPS - skipsUsed };
}

// Bir günün özeti ve ısı haritası seviyesi (-1: o gün görev yok, 0..4).
export function dayStats(habits, logs, d, today) {
  const list = scheduledHabits(habits, d);
  const items = list.map((h) => ({ habit: h, status: statusOf(logs, h.id, d, today) }));
  const done = items.filter((i) => i.status === 'done').length;
  const skipped = items.filter((i) => i.status === 'skip').length;
  const total = items.length;
  const ratio = total ? done / total : 0;
  let level = -1;
  if (total) level = done === 0 ? 0 : ratio < 0.5 ? 1 : ratio < 0.8 ? 2 : ratio < 1 ? 3 : 4;
  const perfect = total > 0 && done === total;
  const xp = done * 10 + (perfect ? 25 : 0);
  return { items, total, done, skipped, ratio, level, perfect, xp };
}

export function gameStats(habits, logs, today) {
  const live = habits;
  if (!live.length) return { xp: 0, level: 1, into: 0, need: 40, perfectStreak: 0 };
  const first = live.reduce((m, h) => (h.createdAt < m ? h.createdAt : m), live[0].createdAt);
  let xp = 0;
  let perfectStreak = 0;
  const todayK = dateKey(today);
  for (let d = parseKey(first); dateKey(d) <= todayK; d = addDays(d, 1)) {
    const s = dayStats(habits, logs, d, today);
    xp += s.xp;
    if (s.total === 0) continue;
    if (s.perfect) perfectStreak++;
    else if (dateKey(d) < todayK) perfectStreak = 0;
  }
  const level = 1 + Math.floor(Math.sqrt(xp / 40));
  const base = 40 * (level - 1) ** 2;
  const next = 40 * level ** 2;
  return { xp, level, into: xp - base, need: next - base, perfectStreak };
}

export function rankOf(s) {
  if (!s.total) return { title: 'Dinlenme günü', emoji: '😴' };
  if (s.perfect) return { title: 'Kusursuz gün!', emoji: '🏆' };
  if (s.ratio >= 0.8) return { title: 'Harika gidiyor', emoji: '⭐' };
  if (s.ratio >= 0.5) return { title: 'İyi iş', emoji: '💪' };
  if (s.done > 0) return { title: 'Güzel bir başlangıç', emoji: '🌱' };
  return { title: 'Yarın yeni gün', emoji: '🌅' };
}
