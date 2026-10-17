import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStreak, dayStats, gameStats, dateKey, parseKey, weekStart } from '../js/streak.js';
import { parsePlan } from '../js/plan.js';

const habit = (o = {}) => ({ id: 'h', name: 'x', days: [0, 1, 2, 3, 4, 5, 6], createdAt: '2026-10-05', ...o });
// 2026-10-05 Pazartesi
const logsOf = (map) => {
  const l = {};
  for (const [k, v] of Object.entries(map)) (l[k] ||= {}).h = v;
  return l;
};

test('hepsi done -> streak artar', () => {
  const logs = logsOf({ '2026-10-05': 'done', '2026-10-06': 'done', '2026-10-07': 'done' });
  const s = computeStreak(habit(), logs, parseKey('2026-10-07'));
  assert.equal(s.current, 3);
  assert.equal(s.skipsLeft, 2);
});

test('bugün bekleyen gün streak bozmaz', () => {
  const logs = logsOf({ '2026-10-05': 'done' });
  assert.equal(computeStreak(habit(), logs, parseKey('2026-10-06')).current, 1);
});

test('haftada 2 es geçme streak bozmaz, 3.sü bozar', () => {
  const base = { '2026-10-05': 'done', '2026-10-06': 'skip', '2026-10-07': 'skip', '2026-10-08': 'done' };
  let s = computeStreak(habit(), logsOf(base), parseKey('2026-10-08'));
  assert.equal(s.current, 2);
  assert.equal(s.skipsLeft, 0);
  s = computeStreak(habit(), logsOf({ ...base, '2026-10-09': 'skip' }), parseKey('2026-10-09'));
  assert.equal(s.current, 0);
  assert.equal(s.best, 2);
});

test('işaretlenmeyen geçmiş gün kayıp sayılır', () => {
  const logs = logsOf({ '2026-10-05': 'done' }); // 6,7,8 boş
  const s = computeStreak(habit(), logs, parseKey('2026-10-09'));
  assert.equal(s.current, 0); // 3 kayıp (6,7,8) -> bozuldu
});

test('yeni hafta es geçme hakkı yenilenir', () => {
  const logs = logsOf({
    '2026-10-05': 'done', '2026-10-06': 'skip', '2026-10-07': 'skip', '2026-10-08': 'done',
    '2026-10-09': 'done', '2026-10-10': 'done', '2026-10-11': 'done',
    '2026-10-12': 'skip', '2026-10-13': 'done',
  });
  const s = computeStreak(habit(), logs, parseKey('2026-10-13'));
  assert.equal(s.current, 6); // es geçilen gün sayıyı artırmaz ama bozmaz
  assert.equal(s.skipsLeft, 1);
});

test('sadece seçili günler sayılır', () => {
  const h = habit({ days: [0] }); // Pazar
  const logs = logsOf({ '2026-10-11': 'done' });
  assert.equal(computeStreak(h, logs, parseKey('2026-10-14')).current, 1);
});

test('ısı haritası seviyesi ve xp', () => {
  const hs = [habit({ id: 'a' }), habit({ id: 'b' })];
  const today = parseKey('2026-10-06');
  const logs = { '2026-10-05': { a: 'done', b: 'done' }, '2026-10-06': { a: 'done' } };
  assert.equal(dayStats(hs, logs, parseKey('2026-10-05'), today).level, 4);
  assert.equal(dayStats(hs, logs, today, today).level, 2);
  assert.equal(dayStats(hs, {}, parseKey('2026-10-04'), today).level, -1);
  const g = gameStats(hs, logs, today);
  assert.equal(g.xp, 20 + 25 + 10);
  assert.equal(g.perfectStreak, 1);
});

test('haftanın başlangıcı Pazartesi', () => {
  assert.equal(dateKey(weekStart(parseKey('2026-10-11'))), '2026-10-05');
});

test('program metni ayrıştırma', () => {
  const mon = parseKey('2026-10-19');
  const { events, errors } = parsePlan(
    'Pazartesi 09:00-10:30 Ders\nSalı:\n- 14.00 Spor\nÇarşamba 18:00-19:00 Diş hekimi\nanlamsız satır',
    mon,
  );
  assert.deepEqual(events.map((e) => [e.date, e.start, e.end, e.title]), [
    ['2026-10-19', '09:00', '10:30', 'Ders'],
    ['2026-10-20', '14:00', '15:00', 'Spor'],
    ['2026-10-21', '18:00', '19:00', 'Diş hekimi'],
  ]);
  assert.equal(errors.length, 1);
});

test('cumartesi/cuma ve pazar/pazartesi karışmaz', () => {
  const { events } = parsePlan('Cumartesi 10:00 A\nCuma 11:00 B\nPazar 12:00 C', parseKey('2026-10-19'));
  assert.deepEqual(events.map((e) => e.date), ['2026-10-24', '2026-10-23', '2026-10-25']);
});

test('widget özeti', async () => {
  const { buildPayload } = await import('../js/sync.js');
  const hs = [habit({ id: 'a', name: 'Yatak', time: '07:10', emoji: '🛏️' }), habit({ id: 'b', name: 'Uyan', time: '07:00' })];
  const today = parseKey('2026-10-07');
  const logs = { '2026-10-07': { b: 'done' } };
  const p = buildPayload(hs, logs, today);
  assert.equal(p.date, '2026-10-07');
  assert.deepEqual(p.items.map((i) => [i.n, i.s]), [['Uyan', 'done'], ['Yatak', 'pending']]);
  assert.equal(p.heat.length, 70);
  assert.equal(p.heat.at(-1 - 4 + 0) !== undefined, true);
  assert.equal(Object.keys(p.next).length, 7);
  assert.equal(p.next['2026-10-08'].length, 2);
  assert.ok(p.streak && p.streak.n >= 1);
});
