import * as S from './streak.js';
import { load, save, uid, exportJson, importJson } from './store.js';
import * as G from './gcal.js';
import { parsePlan } from './plan.js';

let data = load();
const ui = { tab: 'today', date: S.dateKey(new Date()), todayKey: S.dateKey(new Date()), pick: null, weekOff: 0, events: [], evKey: '', evErr: '', plan: '', preview: null };

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const today = () => S.parseKey(S.dateKey(new Date()));
const DAYS = [['Pzt', 1], ['Sal', 2], ['Çar', 3], ['Per', 4], ['Cum', 5], ['Cmt', 6], ['Paz', 0]];
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const fmtDate = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][d.getDay()]}`;
const fmtTime = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const persist = () => save(data);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}
const buzz = (n = 25) => navigator.vibrate?.(n);

// ---------- Google Takvim ----------
async function ensureEvents(monday) {
  if (!G.isConnected()) return;
  const key = S.dateKey(monday);
  if (ui.evKey === key) return;
  ui.evKey = key;
  try {
    ui.events = await G.listEvents(monday, S.addDays(monday, 7));
    ui.evErr = '';
  } catch (e) {
    ui.evErr = e.message;
    ui.evKey = '';
  }
  render();
}
const eventsOn = (d) =>
  ui.events.filter((e) => S.dateKey(e.start) === S.dateKey(d) || (e.allDay && e.start <= d && e.end > d));

// ---------- Küçük bileşenler ----------
function ring(p, label) {
  return `<div class="ring" style="--p:${Math.round(p * 100)}"><span>${label}</span></div>`;
}

function heatmap(weeks, selected) {
  const T = today();
  const first = S.addDays(S.weekStart(T), -7 * (weeks - 1));
  let cells = '';
  for (let w = 0; w < weeks; w++) {
    for (let i = 0; i < 7; i++) {
      const d = S.addDays(first, w * 7 + i);
      if (d > T) {
        cells += '<i class="cell future"></i>';
        continue;
      }
      const s = S.dayStats(data.habits, data.logs, d, T);
      const k = S.dateKey(d);
      cells += `<button class="cell ${s.level < 0 ? 'lvn' : 'lv' + s.level}${k === selected ? ' sel' : ''}" data-act="pick" data-date="${k}" title="${fmtDate(d)} — ${s.done}/${s.total}"></button>`;
    }
  }
  return `<div class="heat" style="--w:${weeks}">${cells}</div>
    <div class="legend">az <i class="cell lv0"></i><i class="cell lv1"></i><i class="cell lv2"></i><i class="cell lv3"></i><i class="cell lv4"></i> çok</div>`;
}

function levelBar(g) {
  return `<div class="xp"><b>Sv ${g.level}</b><div class="bar"><i style="width:${Math.min(100, (g.into / g.need) * 100)}%"></i></div><small>${g.xp} XP</small></div>`;
}

const byTime = (a, b) => (a.habit.time || '99:99').localeCompare(b.habit.time || '99:99') || a.habit.name.localeCompare(b.habit.name, 'tr');

// ---------- Bugün ----------
function todayView() {
  const T = today();
  const d = S.parseKey(ui.date);
  const st = S.dayStats(data.habits, data.logs, d, T);
  const g = S.gameStats(data.habits, data.logs, T);
  const isToday = ui.date === S.dateKey(T);
  const items = [...st.items].sort(byTime);
  const rows = items
    .map(({ habit: h, status }) => {
      const sk = S.computeStreak(h, data.logs, T);
      const meta = [h.time, h.once ? 'tek seferlik' : sk.current ? `🔥 ${sk.current}` : '', h.once ? '' : `es geç: ${sk.skipsLeft}/${S.MAX_SKIPS}`].filter(Boolean).join(' · ');
      return `<li class="task ${status}">
        <button class="check" data-act="toggle" data-id="${h.id}" aria-label="Tamamla">${status === 'done' ? '✓' : ''}</button>
        <div class="meta" data-act="edit" data-id="${h.id}"><b>${esc(h.emoji || '•')} ${esc(h.name)}</b><small>${esc(meta)}</small></div>
        <button class="skipbtn" data-act="skip" data-id="${h.id}" aria-label="Es geç" title="Es geç">${status === 'skip' ? '↩' : '⏭'}</button>
      </li>`;
    })
    .join('');
  const evs = eventsOn(d)
    .map((e) => `<li><time>${e.allDay ? 'Tüm gün' : fmtTime(e.start) + '–' + fmtTime(e.end)}</time> ${esc(e.title)}</li>`)
    .join('');
  const gcal = G.isConnected()
    ? `<section class="card"><h3>📅 Takvim</h3>${evs ? `<ul class="events">${evs}</ul>` : '<p class="muted">Bu gün için etkinlik yok.</p>'}${ui.evErr ? `<p class="err">${esc(ui.evErr)}</p>` : ''}</section>`
    : `<section class="card"><h3>📅 Takvim</h3><p class="muted">Google Takvim bağlı değil.</p><button class="btn" data-act="connect">Bağlan</button></section>`;
  return `
    <header class="top">
      <div class="nav"><button data-act="day" data-n="-1" aria-label="Önceki gün">‹</button>
        <div><h1>${isToday ? 'Bugün' : fmtDate(d).split(' ').slice(0, 2).join(' ')}</h1><small>${fmtDate(d)}</small></div>
        <button data-act="day" data-n="1" aria-label="Sonraki gün">›</button></div>
      ${ring(st.ratio, st.total ? `${st.done}/${st.total}` : '–')}
    </header>
    ${levelBar(g)}
    ${st.perfect ? `<div class="banner">🏆 Kusursuz gün! +${st.xp} XP <button class="btn sm" data-act="report" data-date="${ui.date}">Raporu gör</button></div>` : ''}
    <ul class="tasks">${rows || '<li class="empty">Bu gün için görev yok. ＋ ile ekle.</li>'}</ul>
    ${gcal}
    <button class="fab" data-act="add" aria-label="Görev ekle">＋</button>`;
}

// ---------- Rapor ----------
function reportView() {
  const T = today();
  const k = ui.pick || S.dateKey(T);
  const d = S.parseKey(k);
  const st = S.dayStats(data.habits, data.logs, d, T);
  const g = S.gameStats(data.habits, data.logs, T);
  const rank = S.rankOf(st);
  const rows = [...st.items]
    .sort(byTime)
    .map(({ habit: h, status }) => `<li>${{ done: '✅', skip: '⏭️', miss: '❌', pending: '⏳' }[status]} ${esc(h.emoji || '')} ${esc(h.name)}</li>`)
    .join('');
  const mon = S.weekStart(T);
  const habitRows = data.habits
    .filter((h) => !h.once && !h.archivedAt)
    .map((h) => {
      const sk = S.computeStreak(h, data.logs, T);
      const dots = Array.from({ length: 7 }, (_, i) => {
        const day = S.addDays(mon, i);
        if (!S.isActiveOn(h, day)) return '<i class="dot off"></i>';
        return `<i class="dot ${S.statusOf(data.logs, h.id, day, T)}"></i>`;
      }).join('');
      return `<li><div><b>${esc(h.emoji || '')} ${esc(h.name)}</b><small>🔥 ${sk.current} · rekor ${sk.best} · es geç ${sk.skipsLeft}/${S.MAX_SKIPS}</small></div><div class="dots">${dots}</div></li>`;
    })
    .join('');
  return `
    <header class="top"><div><h1>Rapor</h1><small>${fmtDate(d)}</small></div></header>
    <section class="card report">
      <div class="rank">${rank.emoji}</div>
      <h2>${rank.title}</h2>
      <p class="muted">${st.total ? `${st.done}/${st.total} görev · ${st.skipped} es geçildi · <b>+${st.xp} XP</b>` : 'Bu gün planlı görev yok'}</p>
      ${levelBar(g)}
      <p class="muted">Üst üste kusursuz gün: <b>${g.perfectStreak}</b></p>
      ${rows ? `<ul class="list">${rows}</ul>` : ''}
    </section>
    <section class="card"><h3>Isı haritası</h3>${heatmap(18, k)}</section>
    <section class="card"><h3>Bu hafta · streak'ler</h3>${habitRows ? `<ul class="streaks">${habitRows}</ul>` : '<p class="muted">Henüz tekrarlı görev yok.</p>'}
      <p class="muted sm">Haftada ${S.MAX_SKIPS} kez es geçebilirsin; ${S.MAX_SKIPS + 1}. kayıpta o görevin streak'i biter.</p></section>`;
}

// ---------- Takvim ----------
function calendarView() {
  const T = today();
  const mon = S.addDays(S.weekStart(T), ui.weekOff * 7);
  ensureEvents(mon);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = S.addDays(mon, i);
    const s = S.dayStats(data.habits, data.logs, d, T);
    const ev = eventsOn(d)
      .map((e) => `<li><time>${e.allDay ? 'Tüm gün' : fmtTime(e.start)}</time> ${esc(e.title)}</li>`)
      .join('');
    return `<section class="card day${S.dateKey(d) === S.dateKey(T) ? ' now' : ''}">
      <div class="dh"><b>${fmtDate(d)}</b>${s.level >= 0 ? `<i class="cell lv${s.level}"></i><small>${s.done}/${s.total}</small>` : ''}</div>
      ${ev ? `<ul class="events">${ev}</ul>` : '<p class="muted sm">—</p>'}</section>`;
  }).join('');
  const prev = ui.preview;
  return `
    <header class="top"><div class="nav"><button data-act="week" data-n="-1">‹</button><div><h1>Hafta</h1><small>${fmtDate(mon).split(' ').slice(0, 2).join(' ')} – ${fmtDate(S.addDays(mon, 6)).split(' ').slice(0, 2).join(' ')}</small></div><button data-act="week" data-n="1">›</button></div></header>
    ${G.isConnected() ? '' : '<section class="card"><p class="muted">Etkinlikleri görmek için Google Takvim\'e bağlan.</p><button class="btn" data-act="connect">Bağlan</button></section>'}
    ${ui.evErr ? `<p class="err">${esc(ui.evErr)}</p>` : ''}
    ${days}
    <section class="card"><h3>📝 Haftalık program yapıştır</h3>
      <p class="muted sm">Her satır: <code>Pazartesi 09:00-10:30 Ders</code> (ya da gün başlığı + altında <code>14:00 Spor</code>). Hafta başında yapıştır, Google Takvim'e toplu eklensin. Hafta: ${fmtDate(mon)} –</p>
      <textarea id="plan" rows="7" placeholder="Pazartesi 09:00-10:30 Ders&#10;Salı&#10;14:00-15:00 Spor">${esc(ui.plan)}</textarea>
      <button class="btn" data-act="preview">Önizle</button>
      ${prev ? `<ul class="events">${prev.events.map((e) => `<li><time>${e.date.slice(5)} ${e.start}–${e.end}</time> ${esc(e.title)}</li>`).join('')}</ul>
        ${prev.errors.length ? `<p class="err sm">Anlaşılmayan satırlar: ${prev.errors.map(esc).join(' | ')}</p>` : ''}
        ${prev.events.length ? `<button class="btn primary" data-act="sendplan">${prev.events.length} etkinliği Google Takvim'e ekle</button>` : ''}` : ''}
    </section>`;
}

// ---------- Ayarlar ----------
function settingsView() {
  return `
    <header class="top"><div><h1>Ayarlar</h1></div></header>
    <section class="card"><h3>Google Takvim</h3>
      <label>OAuth Client ID<input id="clientId" value="${esc(data.settings.clientId)}" placeholder="xxxx.apps.googleusercontent.com" autocomplete="off"></label>
      <button class="btn" data-act="connect">${G.isConnected() ? 'Yeniden bağlan' : 'Bağlan'}</button>
      <p class="muted sm">Client ID'yi nasıl alacağın README'de. Bağlantı tarayıcıda tutulur; sunucuya hiçbir şey gönderilmez.</p></section>
    <section class="card"><h3>Veri</h3>
      <button class="btn" data-act="export">Yedek indir (JSON)</button>
      <label class="btn file">Yedekten yükle<input type="file" id="import" accept="application/json" hidden></label>
      <p class="muted sm">Veriler bu cihazın tarayıcısında saklanır. Telefon değiştirirsen yedek al.</p></section>
    <section class="card"><h3>Widget</h3>
      <p class="muted sm">Uygulamayı ana ekrana ekle. Mini görünüm için: <a href="#widget">#widget</a>. Rozet sayısı kalan görev sayısını gösterir.</p></section>`;
}

// ---------- Widget (kompakt görünüm) ----------
function widgetView() {
  const T = today();
  const st = S.dayStats(data.habits, data.logs, T, T);
  const g = S.gameStats(data.habits, data.logs, T);
  const left = [...st.items].filter((i) => i.status !== 'done' && i.status !== 'skip').sort(byTime).slice(0, 4);
  const best = data.habits.filter((h) => !h.once && !h.archivedAt).map((h) => ({ h, s: S.computeStreak(h, data.logs, T) })).sort((a, b) => b.s.current - a.s.current)[0];
  return `<div class="widget">
    <div class="wtop">${ring(st.ratio, st.total ? `${st.done}/${st.total}` : '–')}
      <div><b>Sv ${g.level}</b> · ${g.xp} XP<br>${best && best.s.current ? `🔥 ${esc(best.h.name)} ${best.s.current}` : 'Streak başlat!'}</div></div>
    ${heatmap(10, null)}
    <ul class="tasks compact">${left.map(({ habit: h }) => `<li class="task pending"><button class="check" data-act="toggle" data-id="${h.id}"></button><div class="meta"><b>${esc(h.emoji || '')} ${esc(h.name)}</b></div></li>`).join('') || `<li class="empty">${st.total ? '🏆 Hepsi tamam!' : 'Bugün görev yok'}</li>`}</ul>
    <a class="muted sm" href="#">Uygulamayı aç</a></div>`;
}

// ---------- Kabuk ----------
function render() {
  const widget = location.hash === '#widget';
  const views = { today: todayView, report: reportView, calendar: calendarView, settings: settingsView };
  if (!widget && ui.tab === 'today') ensureEvents(S.weekStart(S.parseKey(ui.date)));
  const tabs = [['today', '✅', 'Bugün'], ['calendar', '📅', 'Hafta'], ['report', '🔥', 'Rapor'], ['settings', '⚙️', 'Ayarlar']];
  $('#app').innerHTML = widget
    ? widgetView()
    : `<main>${views[ui.tab]()}</main><nav class="tabs">${tabs.map(([k, i, l]) => `<button class="${ui.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}"><span>${i}</span>${l}</button>`).join('')}</nav>`;
  updateBadge();
}

function updateBadge() {
  const T = today();
  const left = S.dayStats(data.habits, data.logs, T, T).items.filter((i) => i.status === 'pending').length;
  try {
    if (left) navigator.setAppBadge?.(left);
    else navigator.clearAppBadge?.();
  } catch {}
}

// ---------- İşlemler ----------
function setStatus(id, want) {
  const T = today();
  const h = data.habits.find((x) => x.id === id);
  const before = S.computeStreak(h, data.logs, T).current;
  const gBefore = S.gameStats(data.habits, data.logs, T);
  const day = (data.logs[ui.date] ||= {});
  if (day[id] === want) delete day[id];
  else day[id] = want;
  if (!Object.keys(day).length) delete data.logs[ui.date];
  persist();
  const after = S.computeStreak(h, data.logs, T).current;
  const gAfter = S.gameStats(data.habits, data.logs, T);
  const st = S.dayStats(data.habits, data.logs, S.parseKey(ui.date), T);
  if (want === 'done' && day[id] === 'done') {
    buzz();
    if (gAfter.level > gBefore.level) toast(`🎉 Seviye atladın! Sv ${gAfter.level}`);
    else if (st.perfect) toast(`🏆 Kusursuz gün! +25 bonus XP`);
    else toast(`+10 XP${after > before && after > 1 ? ` · 🔥 ${after}` : ''}`);
  } else if (want === 'skip' && day[id] === 'skip') {
    toast(before > 0 && after === 0 ? `💔 ${h.name} streak'i bitti (haftada ${S.MAX_SKIPS} es geçme aşıldı)` : 'Es geçildi');
  }
  render();
}

function openForm(id) {
  const h = data.habits.find((x) => x.id === id) || { days: [0, 1, 2, 3, 4, 5, 6], emoji: '', name: '', time: '' };
  const once = !!h.once;
  const dlg = $('#dlg');
  dlg.innerHTML = `<form method="dialog" id="form">
    <h3>${id ? 'Görevi düzenle' : 'Yeni görev'}</h3>
    <label>Ad<input name="name" required value="${esc(h.name)}" placeholder="Yatağı topla"></label>
    <div class="row"><label>Emoji<input name="emoji" maxlength="4" value="${esc(h.emoji)}" placeholder="🛏️"></label>
      <label>Saat<input name="time" type="time" value="${esc(h.time || '')}"></label></div>
    <label class="inline"><input type="checkbox" name="once" ${once ? 'checked' : ''}> Tek seferlik (streak yok)</label>
    <label class="onceDate">Tarih<input type="date" name="onceDate" value="${esc(h.once || ui.date)}"></label>
    <div class="chips" id="dayChips">${DAYS.map(([l, v]) => `<label><input type="checkbox" name="day" value="${v}" ${h.days.includes(v) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
    <div class="actions">
      ${id ? '<button type="button" class="btn danger" data-act="delete" data-id="' + id + '">Sil</button>' : ''}
      <button type="button" class="btn" data-act="close">Vazgeç</button>
      <button class="btn primary" value="save">Kaydet</button></div></form>`;
  const sync = () => {
    const on = dlg.querySelector('[name=once]').checked;
    dlg.querySelector('.onceDate').hidden = !on;
    dlg.querySelector('#dayChips').hidden = on;
  };
  dlg.querySelector('[name=once]').addEventListener('change', sync);
  sync();
  dlg.querySelector('#form').addEventListener('submit', (e) => {
    const f = new FormData(e.target);
    const isOnce = f.get('once') === 'on';
    const days = f.getAll('day').map(Number);
    if (!isOnce && !days.length) {
      e.preventDefault();
      toast('En az bir gün seç');
      return;
    }
    const patch = { name: f.get('name').trim(), emoji: f.get('emoji').trim(), time: f.get('time') || '', days: isOnce ? [] : days, once: isOnce ? f.get('onceDate') : undefined };
    if (id) Object.assign(data.habits.find((x) => x.id === id), patch);
    else data.habits.push({ id: uid(), createdAt: isOnce ? patch.once : ui.date, ...patch });
    persist();
    render();
  });
  dlg.showModal();
}

const actions = {
  tab: (el) => { ui.tab = el.dataset.tab; ui.pick = null; render(); scrollTo(0, 0); },
  day: (el) => { ui.date = S.dateKey(S.addDays(S.parseKey(ui.date), +el.dataset.n)); render(); },
  week: (el) => { ui.weekOff += +el.dataset.n; render(); },
  toggle: (el) => setStatus(el.dataset.id, 'done'),
  skip: (el) => setStatus(el.dataset.id, 'skip'),
  add: () => openForm(null),
  edit: (el) => openForm(el.dataset.id),
  close: () => $('#dlg').close(),
  delete: (el) => {
    const h = data.habits.find((x) => x.id === el.dataset.id);
    if (h.once || !Object.values(data.logs).some((d) => d[h.id])) data.habits = data.habits.filter((x) => x !== h);
    else h.archivedAt = S.dateKey(today()); // geçmiş kayıtlar ısı haritasında kalsın
    persist();
    $('#dlg').close();
    render();
  },
  pick: (el) => { ui.pick = el.dataset.date; render(); },
  report: (el) => { ui.tab = 'report'; ui.pick = el.dataset.date; render(); },
  connect: async () => {
    try {
      await G.connect(data.settings.clientId);
      ui.evKey = '';
      toast('Google Takvim bağlandı');
      render();
    } catch (e) { toast(e.message); }
  },
  preview: () => {
    ui.plan = $('#plan').value;
    ui.preview = parsePlan(ui.plan, S.addDays(S.weekStart(today()), ui.weekOff * 7));
    render();
  },
  sendplan: async () => {
    if (!G.isConnected()) return toast('Önce Google Takvim\'e bağlan');
    let n = 0;
    try {
      for (const e of ui.preview.events) { await G.createEvent(e); n++; }
      toast(`${n} etkinlik eklendi`);
      ui.plan = ''; ui.preview = null; ui.evKey = '';
    } catch (e) { toast(`${n} eklendi, sonra hata: ${e.message}`); }
    render();
  },
  export: () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportJson(data)], { type: 'application/json' }));
    a.download = `dopamin-yedek-${S.dateKey(new Date())}.json`;
    a.click();
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el && actions[el.dataset.act]) actions[el.dataset.act](el);
});
document.addEventListener('change', async (e) => {
  if (e.target.id === 'clientId') { data.settings.clientId = e.target.value.trim(); persist(); }
  if (e.target.id === 'import' && e.target.files[0]) {
    try {
      data = importJson(await e.target.files[0].text());
      persist(); toast('Yedek yüklendi'); render();
    } catch (err) { toast(err.message); }
  }
});
window.addEventListener('hashchange', render);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  const now = S.dateKey(new Date());
  if (ui.date === ui.todayKey) ui.date = now; // gece yarısı geçtiyse yeni güne geç
  ui.todayKey = now;
  render();
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
render();
