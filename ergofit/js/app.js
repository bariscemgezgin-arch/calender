import { firebaseConfig, bootstrapAdmin } from './firebase-config.js';
import { parseTable, mapChildren, keepColumns } from './csv.js';

const configured = !!(firebaseConfig.apiKey && firebaseConfig.projectId);
const demo = !configured || new URLSearchParams(location.search).has('demo');
const { backend } = await import(demo ? './backend-demo.js' : './backend-firebase.js');

const $app = document.getElementById('app');
const LOGO = 'assets/logo.svg';
const COLORS = ['#2a9a41', '#3a62b8', '#d63d17', '#c77a00'];

const S = {
  user: null, member: null,
  members: [], children: [], notes: [],
  q: '', filter: 'all',
  unsub: [], notesUnsub: null, notesFor: null
};

// ---------- yardımcılar ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tr = s => String(s).toLocaleLowerCase('tr');
const byName = (a, b) => a.name.localeCompare(b.name, 'tr');
const isAdmin = () => S.member?.role === 'admin';
const canEdit = () => S.member && S.member.role !== 'viewer';
const fmt = ms => ms ? new Date(ms).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'şimdi';
const initial = n => (n.trim()[0] || '?').toLocaleUpperCase('tr');
const color = n => COLORS[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const memberName = email => S.members.find(m => m.id === email)?.name || email || '—';
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function age(birth) {
  if (!birth) return '';
  const b = new Date(birth), n = new Date();
  let m = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth();
  if (n.getDate() < b.getDate()) m--;
  if (m < 0) return '';
  return m < 12 ? `${m} aylık` : `${Math.floor(m / 12)} yaş${m % 12 ? ' ' + (m % 12) + ' ay' : ''}`;
}
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3200);
}
async function run(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); return true; }
  catch (e) {
    console.error(e);
    toast(e.code === 'permission-denied' ? 'Bu işlem için yetkin yok.' : 'Kaydedilemedi: ' + (e.message || e));
    return false;
  }
}
function focusItems(c) {
  return Object.entries(c.focus || {}).map(([id, f]) => ({ id, ...f })).sort((a, b) => (a.order || 0) - (b.order || 0));
}
function openDialog(html, onSubmit) {
  const d = document.createElement('dialog');
  d.innerHTML = `<form method="dialog">${html}</form>`;
  document.body.appendChild(d);
  d.addEventListener('close', () => d.remove());
  d.querySelector('[data-cancel]')?.addEventListener('click', () => d.close());
  d.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.submitter; if (btn) btn.disabled = true;
    const ok = await onSubmit(Object.fromEntries(new FormData(e.target)), d);
    if (ok === false && btn) btn.disabled = false; else d.close();
  });
  d.showModal();
  return d;
}

// ---------- oturum ----------
function stop() { S.unsub.forEach(f => f()); S.unsub = []; S.notesUnsub?.(); S.notesUnsub = null; S.notesFor = null; }

backend.onUser(async u => {
  stop();
  S.user = u; S.member = null; S.children = []; S.members = []; S.error = null;
  if (!u) return render();
  S.loading = true; render();
  try {
    const m = await backend.loadMember(u.email);
    S.member = u.email === bootstrapAdmin ? { ...(m || {}), id: u.email, name: m?.name || u.name, role: 'admin' } : m;
  } catch (e) { console.error(e); S.error = e; }
  S.loading = false;
  if (S.member) {
    const onErr = e => { console.error(e); toast('Veri okunamadı: ' + (e.message || e)); };
    S.unsub.push(backend.watchChildren(list => { S.children = list; refresh(); }, onErr));
    S.unsub.push(backend.watchMembers(list => { S.members = list; refresh(); }, onErr));
  }
  render();
});

// ---------- yönlendirme ----------
const route = () => {
  const h = location.hash.replace(/^#\/?/, '');
  if (h.startsWith('child/')) return { page: 'child', id: decodeURIComponent(h.slice(6)) };
  if (h === 'admin') return { page: 'admin' };
  return { page: 'list' };
};
window.addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); });

// ---------- ekranlar ----------
function shell(inner, { title = '', back = false } = {}) {
  return `
  ${demo ? '<div class="demo">DEMO modu: kayıt tutulmaz. Gerçek kullanım için Firebase ayarını yap (README).</div>' : ''}
  <header class="top"><div class="wrap">
    ${back ? '<button class="iconbtn" data-act="back" aria-label="Geri">←</button>' : ''}
    <img class="logo" src="${LOGO}" alt="Ergofit">
    <div class="title">${esc(title)}</div>
    ${isAdmin() && !back ? '<a class="iconbtn" href="#/admin">Yönetim</a>' : ''}
    <button class="iconbtn" data-act="signout">Çıkış</button>
  </div></header>
  <main class="wrap">${inner}</main>`;
}

function render() {
  if (S.loading) { $app.innerHTML = `<div class="center"><img src="${LOGO}" alt="Ergofit"><p>Yükleniyor…</p></div>`; return; }
  if (!S.user) return renderLogin();
  if (!S.member) return renderNoAccess();
  const r = route();
  if (r.page === 'child') return renderChild(r.id);
  if (r.page === 'admin' && isAdmin()) return renderAdmin();
  renderList();
}
// veri değişince yalnızca ilgili kısmı yenile (yazarken odak kaybolmasın)
function refresh() {
  if (!S.member) return;
  const r = route();
  if (r.page === 'list') updateList();
  else if (r.page === 'child') updateChild(r.id);
  else if (r.page === 'admin') renderAdmin(true);
}

function renderLogin() {
  $app.innerHTML = `<div class="center">
    <img src="${LOGO}" alt="Ergofit">
    <h1>Çocuk Takip</h1>
    <p>Yalnızca yöneticinin tanımladığı e-posta adresleriyle giriş yapılabilir.</p>
    <button class="btn" data-act="signin">Google ile giriş yap</button>
    <div class="error" id="loginErr"></div>
  </div>`;
}
function renderNoAccess() {
  $app.innerHTML = `<div class="center">
    <img src="${LOGO}" alt="Ergofit">
    <h2>Erişim yok</h2>
    <p>${esc(S.user.email)} adresi tanımlı değil. Yöneticiden bu adresi eklemesini iste.</p>
    ${S.error ? `<p class="error">${esc(S.error.message)}</p>` : ''}
    <button class="btn ghost" data-act="signout">Başka hesapla giriş yap</button>
  </div>`;
}

// --- liste ---
function renderList() {
  $app.innerHTML = shell(`
    <div class="tools">
      <input type="search" id="q" class="grow" placeholder="Çocuk ara…" value="${esc(S.q)}" aria-label="Çocuk ara">
      ${canEdit() ? '<button class="btn" data-act="addchild">+ Çocuk ekle</button>' : ''}
    </div>
    <div class="chips" id="chips"></div>
    <ul class="kids" id="kids"></ul>`, { title: 'Çocuklar' });
  document.getElementById('q').addEventListener('input', e => { S.q = e.target.value; updateList(); });
  updateList();
}
function updateList() {
  const chips = document.getElementById('chips'), ul = document.getElementById('kids');
  if (!chips || !ul) return;
  const F = [['all', 'Tümü'], ['mine', 'Benim çocuklarım'], ['inactive', 'Pasif / ayrılan']];
  chips.innerHTML = F.map(([k, l]) => `<button class="chip" data-filter="${k}" aria-pressed="${S.filter === k}">${l}</button>`).join('');
  const q = tr(S.q.trim());
  const list = S.children.filter(c => {
    if (S.filter === 'inactive' ? (c.status || 'active') === 'active' : (c.status || 'active') !== 'active') return false;
    if (S.filter === 'mine' && c.therapistEmail !== S.user.email) return false;
    return !q || tr(c.name).includes(q);
  }).sort(byName);
  if (!list.length) {
    ul.innerHTML = `<li class="empty">${S.children.length ? 'Eşleşen çocuk yok.' : 'Henüz çocuk eklenmemiş.'}</li>`;
    return;
  }
  const recent = Date.now() - 48 * 3600e3;
  ul.innerHTML = list.map(c => {
    const now = focusItems(c).filter(f => !f.achieved).map(f => f.text);
    const changed = c.updatedBy && c.updatedBy !== S.user.email && c.updatedAt > recent;
    return `<li><button class="kid" data-open="${esc(c.id)}">
      <span class="avatar" style="background:${color(c.name)}">${esc(initial(c.name))}</span>
      <span class="grow">
        <strong>${esc(c.name)}</strong>
        ${changed ? `<span class="badge blue">${esc(c.updatedByName || 'Biri')} güncelledi</span>` : ''}
        <div class="meta">${[age(c.birth), c.therapistEmail ? memberName(c.therapistEmail) : 'Terapist atanmadı'].filter(Boolean).map(esc).join(' · ')}</div>
        ${now.length ? `<div class="now">Şu an: ${esc(now.join(' · '))}</div>` : ''}
      </span></button></li>`;
  }).join('');
}

// --- çocuk detayı ---
function renderChild(id) {
  const c = S.children.find(x => x.id === id);
  if (!c) { $app.innerHTML = shell('<p class="empty">Çocuk bulunamadı.</p>', { back: true }); return; }
  if (S.notesFor !== id) {
    S.notesUnsub?.(); S.notes = []; S.notesFor = id;
    S.notesUnsub = backend.watchNotes(id, list => { S.notes = list; updateNotes(id); }, e => toast('Notlar okunamadı: ' + e.message));
  }
  const ed = canEdit();
  $app.innerHTML = shell(`
    <div class="hero"><span class="avatar" id="hAv"></span><div class="grow"><h1 id="hName"></h1><div class="meta hint" id="hMeta"></div></div>
      ${ed ? '<button class="btn ghost small" data-act="editchild">Düzenle</button>' : ''}</div>

    <section class="card"><h2><span class="dot" style="background:var(--orange)"></span>Şu an çalışılanlar</h2>
      <p class="hint">Aileye "şu an bunu çalışıyoruz" derken buraya bak.</p>
      <ul class="focus" id="focus"></ul>
      ${ed ? `<form class="row" id="focusForm" style="margin-top:10px"><input type="text" name="t" class="grow" placeholder="Yeni çalışma / hedef ekle" maxlength="200" required aria-label="Yeni çalışma"><button class="btn">Ekle</button></form>` : ''}
    </section>

    <section class="card"><h2><span class="dot" style="background:var(--blue)"></span>Aileye kısa özet <span class="badge blue">Yapay zeka</span></h2>
      <p class="hint">Seans notlarından yapay zeka hazırlar; elle yazılmaz. Aileye iletmeden önce göz at.</p>
      <div class="summary" id="summary"></div>
      <div class="row" style="margin-top:10px">
        ${ed ? '<button class="btn small" id="sumBtn" data-act="summarize">Özeti yenile</button>' : ''}
        <span class="saved grow" id="saved"></span>
      </div>
    </section>

    <section class="card"><h2><span class="dot" style="background:var(--lime)"></span>Seans notları</h2>
      ${ed ? `<form id="noteForm"><textarea name="t" placeholder="Bugünkü seansta neler oldu?" maxlength="4000" required aria-label="Yeni not"></textarea>
        <div class="row end" style="margin-top:8px"><button class="btn">Not ekle</button></div></form>` : ''}
      <ul class="notes" id="notes"></ul>
    </section>`, { title: c.name, back: true });

  document.getElementById('focusForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const t = e.target.t.value.trim(); if (!t) return;
    e.target.reset();
    run(() => backend.updateChild(id, { ['focus.' + rid()]: { text: t, achieved: false, order: Date.now() } }));
  });
  document.getElementById('noteForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const t = e.target.t.value.trim(); if (!t) return;
    if (await run(() => backend.addNote(id, t), 'Not eklendi')) e.target.reset();
  });
  updateChild(id);
  updateNotes(id);
}
function updateChild(id) {
  const c = S.children.find(x => x.id === id);
  if (!c) { if (route().page === 'child') render(); return; }
  if (!document.getElementById('hName')) return render();
  const av = document.getElementById('hAv');
  av.textContent = initial(c.name); av.style.background = color(c.name);
  document.getElementById('hName').textContent = c.name;
  const st = { paused: 'Ara verdi', ended: 'Ayrıldı' }[c.status];
  document.getElementById('hMeta').innerHTML = [
    esc(age(c.birth)), esc(c.therapistEmail ? 'Terapist: ' + memberName(c.therapistEmail) : 'Terapist atanmadı'), st && `<span class="badge">${st}</span>`
  ].filter(Boolean).join(' · ');
  const ed = canEdit();
  document.getElementById('focus').innerHTML = focusItems(c).map(f => `
    <li class="${f.achieved ? 'done' : ''}">
      <input type="checkbox" data-focus="${esc(f.id)}" ${f.achieved ? 'checked' : ''} ${ed ? '' : 'disabled'} aria-label="Hedefe ulaşıldı">
      <span class="txt">${esc(f.text)}</span>
      ${ed ? `<button class="iconbtn" data-rmfocus="${esc(f.id)}" aria-label="Sil">✕</button>` : ''}
    </li>`).join('') || '<li class="hint" style="background:none">Henüz bir çalışma eklenmemiş.</li>';
  renderSummary(c);
}
function renderSummary(c) {
  const box = document.getElementById('summary'), info = document.getElementById('saved');
  if (!box) return;
  box.textContent = c.summary || 'Henüz özet hazırlanmadı. Not ekledikten sonra "Özeti yenile"ye bas.';
  box.classList.toggle('empty-sum', !c.summary);
  const latest = Math.max(0, ...S.notes.map(n => Math.max(n.createdAt || 0, n.editedAt || 0)));
  const stale = c.summary && c.summaryAt && latest > c.summaryAt;
  info.innerHTML = c.summaryAt ? `Hazırlanma: ${esc(fmt(c.summaryAt))}${stale ? ' · <b style="color:var(--red)">Yeni notlar var, özeti yenile</b>' : ''}` : '';
}
function updateNotes(id) {
  const ul = document.getElementById('notes');
  if (!ul || S.notesFor !== id) return;
  const c = S.children.find(x => x.id === id);
  if (c) renderSummary(c);
  ul.innerHTML = S.notes.map(n => `
    <li class="note"><div class="who">${esc(n.authorName)} · ${fmt(n.createdAt)}${n.editedAt ? ` · düzenledi: ${esc(n.editedByName || '')}` : ''}</div>
      <div class="body">${esc(n.text)}</div>
      ${canEdit() ? `<div class="acts row"><button class="iconbtn" data-editnote="${esc(n.id)}">Düzenle</button>
        ${n.authorEmail === S.user.email || isAdmin() ? `<button class="iconbtn" style="color:var(--red)" data-rmnote="${esc(n.id)}">Sil</button>` : ''}</div>` : ''}
    </li>`).join('') || '<li class="hint">Henüz not yok.</li>';
}

function childDialog(c) {
  const therapists = S.members.filter(m => m.role !== 'viewer').sort(byName);
  const opt = (v, l, sel) => `<option value="${esc(v)}" ${sel ? 'selected' : ''}>${esc(l)}</option>`;
  const dlg = openDialog(`
    <h2>${c ? 'Çocuğu düzenle' : 'Çocuk ekle'}</h2>
    <label for="cn">Ad soyad</label><input id="cn" type="text" name="name" required maxlength="100" value="${esc(c?.name)}">
    <label for="cb">Doğum tarihi (isteğe bağlı)</label><input id="cb" type="date" name="birth" value="${esc(c?.birth)}">
    <label for="ct">Ergoterapist</label>
    <select id="ct" name="therapistEmail">${opt('', 'Atanmadı', !c?.therapistEmail)}${therapists.map(m => opt(m.id, m.name, m.id === c?.therapistEmail)).join('')}</select>
    <label for="cs">Durum</label>
    <select id="cs" name="status">${[['active', 'Seanslara devam ediyor'], ['paused', 'Ara verdi'], ['ended', 'Ayrıldı']].map(([v, l]) => opt(v, l, (c?.status || 'active') === v)).join('')}</select>
    <div class="row end" style="margin-top:16px">
      ${c && isAdmin() ? '<button type="button" class="btn danger small" data-del style="margin-right:auto">Sil</button>' : ''}
      <button type="button" class="btn ghost" data-cancel>Vazgeç</button><button class="btn">Kaydet</button>
    </div>`, async f => {
    const data = { name: f.name.trim(), birth: f.birth || '', therapistEmail: f.therapistEmail || '', status: f.status };
    return c ? run(() => backend.updateChild(c.id, data), 'Kaydedildi') : run(() => backend.createChild(data), 'Çocuk eklendi');
  });
  dlg.querySelector('[data-del]')?.addEventListener('click', async () => {
    if (!confirm(`${c.name} ve tüm notları kalıcı olarak silinsin mi? Geri alınamaz.`)) return;
    if (await run(() => backend.deleteChild(c.id), 'Silindi')) { dlg.close(); location.hash = '#/'; }
  });
}

// --- yönetim ---
let importDraft = null;
function renderAdmin(soft) {
  if (soft && !document.getElementById('memberList')) return;
  if (!soft) {
    $app.innerHTML = shell(`
      <section class="card"><h2>Erişimi olan e-postalar</h2>
        <p class="hint">Kişi, bu e-posta adresine bağlı Google hesabıyla giriş yapar (Gmail veya Google Workspace). <b>Yönetici</b> her şeyi yapar, <b>Düzenleyici</b> not ve çalışmaları günceller, <b>İzleyici</b> yalnızca okur.</p>
        <ul class="list" id="memberList"></ul>
        <form class="row" id="memberForm" style="margin-top:12px">
          <input type="email" name="email" class="grow" placeholder="ornek@gmail.com" required aria-label="E-posta">
          <input type="text" name="name" class="grow" placeholder="Görünecek ad (örn. Ayşe)" required maxlength="60" aria-label="Ad">
          <select name="role" aria-label="Rol" style="width:auto"><option value="editor">Düzenleyici</option><option value="viewer">İzleyici</option><option value="admin">Yönetici</option></select>
          <button class="btn">Ekle</button>
        </form></section>
      <section class="card"><h2>Çocuk listesini içe aktar</h2>
        <p class="hint">Excel dosyası (.xlsx) veya CSV seç, ya da Excel'den kopyalayıp yapıştır. İlk satır başlık olabilir: <i>Ad Soyad, Doğum Tarihi, Terapist, Çalışılan</i>. Yalnızca ad zorunlu; TC, telefon, veli gibi diğer sütunlar okunmaz. Terapist sütunu, yukarıdaki kişilerin adı veya e-postasıyla eşleşir.</p>
        <input type="file" id="csvFile" accept=".xlsx,.csv,.txt,.tsv" aria-label="Excel veya CSV dosyası">
        <textarea id="csvText" placeholder="Listeyi buraya yapıştır…" style="margin-top:8px"></textarea>
        <div class="row" style="margin-top:8px"><button class="btn ghost" id="csvPreview">Önizle</button><button class="btn" id="csvGo" disabled>İçe aktar</button></div>
        <div id="csvOut"></div></section>`, { title: 'Yönetim', back: true });
    document.getElementById('memberForm').addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target, email = f.email.value.trim().toLowerCase();
      run(() => backend.setMember(email, { name: f.name.value.trim(), role: f.role.value }), 'Eklendi').then(ok => ok && f.reset());
    });
    document.getElementById('csvFile').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      try { document.getElementById('csvText').value = /\.xlsx?$/i.test(file.name) ? await xlsxToText(file) : await file.text(); }
      catch (err) { toast('Dosya okunamadı: ' + err.message); }
    });
    document.getElementById('csvPreview').addEventListener('click', previewImport);
    document.getElementById('csvGo').addEventListener('click', runImport);
  }
  document.getElementById('memberList').innerHTML = [...S.members].sort(byName).map(m => `
    <li><span class="grow"><b>${esc(m.name)}</b><br><span class="meta hint">${esc(m.id)}</span></span>
      <select data-role="${esc(m.id)}" aria-label="Rol">${[['admin', 'Yönetici'], ['editor', 'Düzenleyici'], ['viewer', 'İzleyici']].map(([v, l]) => `<option value="${v}" ${m.role === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      ${m.id !== S.user.email ? `<button class="btn danger small" data-rmmember="${esc(m.id)}">Kaldır</button>` : ''}
    </li>`).join('');
}
async function xlsxToText(file) {
  if (!window.XLSX) {
    await new Promise((ok, fail) => {
      const sc = document.createElement('script');
      sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      sc.onload = ok; sc.onerror = () => fail(new Error('Excel okuyucu yüklenemedi (bağlantını kontrol et)'));
      document.head.appendChild(sc);
    });
  }
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
  const rows = raw.map(r => r.map(v => v instanceof Date ? new Date(v.getTime() + 12 * 3600e3).toISOString().slice(0, 10) : String(v).replace(/[\t\r\n]+/g, ' ').trim()));
  return keepColumns(rows).map(r => r.join('\t')).join('\n');
}
function previewImport() {
  const { children, skipped, hasHeader } = mapChildren(parseTable(document.getElementById('csvText').value));
  const emailOf = raw => {
    if (!raw) return '';
    const t = tr(raw);
    return S.members.find(m => tr(m.id) === t || tr(m.name) === t)?.id || '';
  };
  importDraft = children.map(c => ({
    name: c.name, birth: c.birth, therapistEmail: emailOf(c.therapist), status: 'active',
    focus: Object.fromEntries(c.focus.map((text, i) => [rid() + i, { text, achieved: false, order: Date.now() + i }])),
    _therapistRaw: c.therapist
  }));
  const dup = new Set(S.children.map(c => tr(c.name)));
  const unmatched = [...new Set(importDraft.filter(c => c._therapistRaw && !c.therapistEmail).map(c => c._therapistRaw))];
  document.getElementById('csvOut').innerHTML = `
    <p class="hint">${hasHeader ? 'Başlık satırı bulundu. ' : 'Başlık yok, ilk sütun ad kabul edildi. '}<b>${importDraft.length}</b> çocuk okundu${skipped.length ? `, ${skipped.length} satır adsız olduğu için atlandı` : ''}.</p>
    ${unmatched.length ? `<p class="error">Eşleşmeyen terapist adları (atanmadan eklenir): ${unmatched.map(esc).join(', ')}</p>` : ''}
    <div class="preview">${importDraft.map(c => `${esc(c.name)}${dup.has(tr(c.name)) ? ' <span class="badge">zaten var</span>' : ''}${c.therapistEmail ? ' · ' + esc(memberName(c.therapistEmail)) : ''}`).join('<br>')}</div>`;
  document.getElementById('csvGo').disabled = !importDraft.length;
}
async function runImport() {
  if (!importDraft?.length) return;
  const dup = new Set(S.children.map(c => tr(c.name)));
  const list = importDraft.filter(c => !dup.has(tr(c.name))).map(({ _therapistRaw, ...c }) => c);
  const skipped = importDraft.length - list.length;
  if (!list.length) return toast('Hepsi zaten listede.');
  if (!confirm(`${list.length} çocuk eklenecek${skipped ? ` (${skipped} tanesi zaten var, atlanacak)` : ''}. Devam edilsin mi?`)) return;
  if (await run(() => backend.importChildren(list), `${list.length} çocuk eklendi`)) {
    importDraft = null; document.getElementById('csvText').value = ''; document.getElementById('csvOut').innerHTML = ''; document.getElementById('csvGo').disabled = true;
  }
}

// ---------- olaylar ----------
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act],[data-open],[data-filter],[data-rmfocus],[data-editnote],[data-rmnote],[data-rmmember]');
  if (!el) return;
  const id = route().id, d = el.dataset;
  if (d.open) location.hash = '#/child/' + encodeURIComponent(d.open);
  else if (d.filter) { S.filter = d.filter; updateList(); }
  else if (d.act === 'back') { location.hash = '#/'; }
  else if (d.act === 'signin') {
    try { await backend.signIn(); } catch (err) { const x = document.getElementById('loginErr'); if (x) x.textContent = 'Giriş yapılamadı: ' + err.message; }
  }
  else if (d.act === 'summarize') {
    const btn = el; btn.disabled = true; btn.textContent = 'Hazırlanıyor…';
    await run(() => backend.generateSummary(id), 'Özet hazırlandı');
    btn.disabled = false; btn.textContent = 'Özeti yenile';
  }
  else if (d.act === 'signout') backend.signOut();
  else if (d.act === 'addchild') childDialog(null);
  else if (d.act === 'editchild') childDialog(S.children.find(c => c.id === id));
  else if (d.rmfocus) { if (confirm('Bu çalışma listeden silinsin mi?')) run(() => backend.updateChild(id, { ['focus.' + d.rmfocus]: backend.DELETE })); }
  else if (d.editnote) {
    const n = S.notes.find(x => x.id === d.editnote);
    openDialog(`<h2>Notu düzenle</h2><textarea name="t" required maxlength="4000" aria-label="Not">${esc(n.text)}</textarea>
      <div class="row end" style="margin-top:12px"><button type="button" class="btn ghost" data-cancel>Vazgeç</button><button class="btn">Kaydet</button></div>`,
      f => f.t.trim() ? run(() => backend.updateNote(id, n.id, f.t.trim()), 'Not güncellendi') : false);
  }
  else if (d.rmnote) { if (confirm('Bu not silinsin mi?')) run(() => backend.deleteNote(id, d.rmnote), 'Silindi'); }
  else if (d.rmmember) { if (confirm(d.rmmember + ' erişimi kaldırılsın mı?')) run(() => backend.removeMember(d.rmmember), 'Kaldırıldı'); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.focus) run(() => backend.updateChild(route().id, { [`focus.${t.dataset.focus}.achieved`]: t.checked }));
  else if (t.dataset.role) {
    const m = S.members.find(x => x.id === t.dataset.role);
    if (m.id === S.user.email && t.value !== 'admin' && !confirm('Kendi yönetici yetkini kaldırmak üzeresin. Emin misin?')) { t.value = m.role; return; }
    run(() => backend.setMember(m.id, { role: t.value }), 'Rol güncellendi');
  }
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !demo) navigator.serviceWorker.register('sw.js').catch(() => {});
