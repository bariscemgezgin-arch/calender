const KEY = 'dopamin-loop:v1';
const empty = () => ({ v: 1, habits: [], logs: {}, settings: { clientId: '' } });

export function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.v === 1) return { ...empty(), ...d, settings: { ...empty().settings, ...d.settings } };
  } catch {}
  return empty();
}
export function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
}
export const uid = () => Math.random().toString(36).slice(2, 9);

export function exportJson(data) {
  return JSON.stringify({ ...data, settings: { ...data.settings, clientId: '', syncToken: '' } }, null, 2);
}
export function importJson(text) {
  const d = JSON.parse(text);
  if (!d || d.v !== 1 || !Array.isArray(d.habits) || typeof d.logs !== 'object') throw new Error('Geçersiz yedek dosyası');
  return { ...empty(), ...d };
}
