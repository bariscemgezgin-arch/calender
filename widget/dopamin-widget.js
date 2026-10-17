// Dopamin Döngüsü — Scriptable widget. Uygulamadaki Ayarlar > "Scriptable kodunu kopyala" ile adresler otomatik doldurulur.
const DATA_URL = '__SYNC_URL__';
const GH_REPO = '__GH_REPO__';
const GH_TOKEN = '__GH_TOKEN__';
const APP_URL = '__APP_URL__';
const C = { bg: '#0f1220', track: '#2a3052', green: '#39d98a', text: '#eef0fa', muted: '#8f96b8', accent: '#7c8cff' };
const HEAT = { n: '#1d2240', '0': '#3a2430', '1': '#14532d', '2': '#1f8f4d', '3': '#2fbf71', '4': '#5cf0a6' };

async function load() {
  const fm = FileManager.local();
  const path = fm.joinPath(fm.cacheDirectory(), 'dopamin.json');
  try {
    const req = GH_REPO ? new Request('https://api.github.com/repos/' + GH_REPO + '/contents/dopamin.json') : new Request(DATA_URL);
    if (GH_REPO) req.headers = { Authorization: 'Bearer ' + GH_TOKEN, Accept: 'application/vnd.github.raw+json' };
    req.timeoutInterval = 15;
    const j = await req.loadJSON();
    if (j && j.v === 1) {
      fm.writeString(path, JSON.stringify(j));
      return j;
    }
  } catch (e) {}
  return fm.fileExists(path) ? JSON.parse(fm.readString(path)) : null;
}

function todayKey() {
  const d = new Date();
  const p = (n) => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function text(dc, str, x, y, w, h, size, color, bold, align) {
  dc.setFont(bold ? Font.boldSystemFont(size) : Font.systemFont(size));
  dc.setTextColor(new Color(color));
  if (align === 'c') dc.setTextAlignedCenter();
  else dc.setTextAlignedLeft();
  dc.drawTextInRect(str, new Rect(x, y, w, h));
}

function ring(dc, cx, cy, r, ratio, thick) {
  const n = 72;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / n) * 2 * Math.PI;
    dc.setFillColor(new Color(i / n < ratio ? C.green : C.track));
    dc.fillEllipse(new Rect(cx + r * Math.cos(a) - thick / 2, cy + r * Math.sin(a) - thick / 2, thick, thick));
  }
}

function build(d, family) {
  const key = todayKey();
  let items = d.date === key ? d.items : ((d.next && d.next[key]) || []).map((x) => ({ n: x.n, e: x.e, t: x.t, s: 'pending' }));
  const total = items.length;
  const done = items.filter((i) => i.s === 'done').length;
  const left = items.filter((i) => i.s === 'pending');
  const ratio = total ? done / total : 0;
  const small = family === 'small';
  const W = small ? 340 : 720;
  const H = 340;
  const dc = new DrawContext();
  dc.size = new Size(W, H);
  dc.opaque = true;
  dc.respectScreenScale = true;
  dc.setFillColor(new Color(C.bg));
  dc.fillRect(new Rect(0, 0, W, H));

  ring(dc, 100, 105, 62, ratio, 16);
  text(dc, total ? done + '/' + total : '–', 40, 82, 120, 44, 34, C.text, true, 'c');
  text(dc, 'Sv ' + d.level + ' · ' + d.xp + ' XP', 20, 190, 220, 34, 26, C.accent, true);
  text(dc, d.streak ? '🔥 ' + d.streak.n + ' ' + d.streak.name : 'Streak başlat!', 20, 228, small ? 310 : 190, 34, 24, C.muted, false);
  if (small) {
    text(dc, total && !left.length ? '🏆 Hepsi tamam' : left.length + ' görev kaldı', 20, 280, 310, 34, 24, C.text, true);
    return dc.getImage();
  }
  const list = left.slice(0, 5);
  if (!list.length) text(dc, total ? '🏆 Hepsi tamam!' : 'Bugün görev yok', 250, 40, 220, 40, 28, C.text, true);
  list.forEach((it, i) => {
    text(dc, (it.e ? it.e + ' ' : '') + it.n, 250, 28 + i * 50, 215, 40, 26, C.text, false);
  });
  const cell = 20;
  const gap = 4;
  const x0 = 480;
  const y0 = 44;
  for (let w = 0; w < 10; w++) {
    for (let i = 0; i < 7; i++) {
      const ch = d.heat[w * 7 + i];
      if (!ch || ch === 'f') continue;
      dc.setFillColor(new Color(HEAT[ch]));
      dc.fillRect(new Rect(x0 + w * (cell + gap), y0 + i * (cell + gap), cell, cell));
    }
  }
  return dc.getImage();
}

const w = new ListWidget();
w.setPadding(0, 0, 0, 0);
w.backgroundColor = new Color(C.bg);
w.url = APP_URL;
w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
const data = await load();
if (data) {
  w.backgroundImage = build(data, config.widgetFamily || 'medium');
} else {
  const t = w.addText('Veri yok — uygulamayı açıp bir görev tikle');
  t.textColor = new Color(C.text);
  t.font = Font.systemFont(14);
}
if (config.runsInWidget) Script.setWidget(w);
else await w.presentMedium();
Script.complete();
