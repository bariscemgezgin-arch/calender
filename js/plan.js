// "Pazartesi 09:00-10:30 Ders" biçimindeki haftalık program metnini etkinliklere çevirir.
import { addDays, dateKey } from './streak.js';

const DAY_OFFSET = {
  pazartesi: 0, pzt: 0, sali: 1, sal: 1, carsamba: 2, cars: 2, car: 2,
  persembe: 3, pers: 3, per: 3, cuma: 4, cum: 4, cumartesi: 5, cmt: 5, pazar: 6, paz: 6,
};
const DAY_RE = /^(pazartesi|pzt|sali|sal|carsamba|cars|car|persembe|pers|per|cumartesi|cmt|cuma|cum|pazar|paz)\b[\s:.,-]*/;
const TIME_RE = /(\d{1,2})[:.](\d{2})(?:\s*[-–—]\s*(\d{1,2})[:.](\d{2}))?/;

const fold = (s) =>
  s
    .toLocaleLowerCase('tr')
    .replace(/ç/g, 'c').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ı/g, 'i');

const hhmm = (h, m) => `${String(h).padStart(2, '0')}:${m}`;

/** @param {string} text @param {Date} monday haftanın Pazartesi'si */
export function parsePlan(text, monday) {
  const events = [];
  const errors = [];
  let day = null;
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim().replace(/^[-*•]\s*/, '');
    if (!line) continue;
    const m = fold(line).match(DAY_RE);
    if (m) {
      day = DAY_OFFSET[m[1]];
      line = line.slice(m[0].length).trim();
      if (!line) continue; // sadece gün başlığı
    }
    const t = line.match(TIME_RE);
    if (day === null || !t) {
      errors.push(raw.trim());
      continue;
    }
    const sh = +t[1];
    const sm = t[2];
    let end;
    if (t[3]) end = hhmm(+t[3], t[4]);
    else end = hhmm((sh + 1) % 24, sm);
    const title = (line.slice(0, t.index) + ' ' + line.slice(t.index + t[0].length)).replace(/\s+/g, ' ').replace(/^[\s:–—-]+|[\s:–—-]+$/g, '');
    events.push({
      date: dateKey(addDays(monday, day)),
      start: hhmm(sh, sm),
      end,
      title: title || 'Etkinlik',
    });
  }
  return { events, errors };
}
