// Excel'den kopyalanan (sekme ayraçlı) veya CSV metnini çocuk listesine çevirir.

export function parseTable(text) {
  text = String(text || '').replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/).find(l => l.trim()) || '';
  const delim = ['\t', ';', ','].map(d => [d, firstLine.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += c;
  }
  row.push(cell);
  rows.push(row);
  return rows.map(r => r.map(c => c.trim())).filter(r => r.some(c => c));
}

const norm = s => s.toLocaleLowerCase('tr').replace(/[^a-zçğıöşü0-9]/g, '');
const HEADERS = {
  name: ['ad', 'adi', 'adsoyad', 'isim', 'cocuk', 'çocuk', 'çocukadı', 'name', 'ad soyad'],
  birth: ['dogum', 'doğum', 'dogumtarihi', 'doğumtarihi', 'birth', 'birthdate'],
  therapist: ['terapist', 'ergoterapist', 'sorumlu', 'therapist'],
  focus: ['calisilan', 'çalışılan', 'hedef', 'hedefler', 'calisilanlar', 'çalışılanlar', 'focus'],
  summary: ['ozet', 'özet', 'summary']
};

export function parseDate(s) {
  s = String(s || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let y, mo, d;
  if (m) [, y, mo, d] = m;
  else if ((m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/))) [, d, mo, y] = m;
  else return '';
  y = +y; mo = +mo; d = +d;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return '';
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// rows -> { children: [{name, birth, therapist, focus:[], summary}], skipped: [satır no] }
export function mapChildren(rows) {
  if (!rows.length) return { children: [], skipped: [], hasHeader: false };
  const first = rows[0].map(norm);
  const col = {};
  for (const [key, names] of Object.entries(HEADERS)) {
    const i = first.findIndex(h => names.map(norm).includes(h));
    if (i >= 0) col[key] = i;
  }
  const hasHeader = col.name !== undefined;
  if (!hasHeader) col.name = 0;
  const body = hasHeader ? rows.slice(1) : rows;
  const children = [], skipped = [];
  body.forEach((r, idx) => {
    const name = (r[col.name] || '').trim();
    if (!name) { skipped.push(idx + 1 + (hasHeader ? 1 : 0)); return; }
    children.push({
      name,
      birth: col.birth !== undefined ? parseDate(r[col.birth]) : '',
      therapist: col.therapist !== undefined ? (r[col.therapist] || '').trim() : '',
      focus: col.focus !== undefined ? (r[col.focus] || '').split(/[|;\n]/).map(s => s.trim()).filter(Boolean) : [],
      summary: col.summary !== undefined ? (r[col.summary] || '').trim() : ''
    });
  });
  return { children, skipped, hasHeader };
}

// Yalnızca tanınan sütunları (ad, doğum, terapist, çalışılan) bırakır; TC, telefon, veli gibi sütunlar hiç okunmaz.
export function keepColumns(rows) {
  if (!rows.length) return rows;
  const first = rows[0].map(norm);
  const keep = first.map((h, i) => ['name', 'birth', 'therapist', 'focus'].some(k => HEADERS[k].map(norm).includes(h)) ? i : -1).filter(i => i >= 0);
  return keep.length ? rows.map(r => keep.map(i => r[i] ?? '')) : rows;
}
