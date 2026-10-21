// Firebase kurulmadan arayüzü denemek için bellekte çalışan sahte arka uç. Hiçbir şey kaydedilmez.
const DELETE = Symbol('delete');
const ME = { email: 'demo@ergofit.test', name: 'Demo Yönetici', photo: null };
const now = Date.now();
const mk = (n, d, t, focus, summary) => ({
  id: 'c' + n, name: d.name, birth: d.birth, therapistEmail: t, status: 'active', summary,
  focus: Object.fromEntries(focus.map(([text, achieved], i) => ['f' + n + i, { text, achieved, order: i }])),
  updatedAt: now - n * 3600e3, updatedByName: 'Demo Ergoterapist', createdAt: now - 864e5
});

const state = {
  members: [
    { id: ME.email, name: ME.name, role: 'admin' },
    { id: 'ayse@ergofit.test', name: 'Ayşe (demo)', role: 'editor' },
    { id: 'mehmet@ergofit.test', name: 'Mehmet (demo)', role: 'editor' }
  ],
  children: [
    mk(1, { name: 'Ada Demo', birth: '2019-03-05' }, 'ayse@ergofit.test', [['Kalem tutma', false], ['Makasla düz çizgi kesme', false], ['Düğme ilikleme', true]], ''),
    mk(2, { name: 'Bora Demo', birth: '2020-11-20' }, 'mehmet@ergofit.test', [['Denge tahtasında yürüme', false], ['Duyusal diyet: fırça uygulaması', false]], ''),
    mk(3, { name: 'Cem Demo', birth: '2017-07-14' }, 'ayse@ergofit.test', [['Yazı yazarken oturuş', false]], '')
  ],
  notes: {
    c1: [{ id: 'n1', text: 'Makasla 5 dakika çalıştı, destek istemeden 3 çizgi kesti.', authorEmail: 'ayse@ergofit.test', authorName: 'Ayşe (demo)', createdAt: now - 2 * 864e5 }]
  }
};
const subs = { members: new Set(), children: new Set(), notes: new Set() };
const fire = k => subs[k].forEach(f => f());
let uid = 100;

function setPath(obj, path, val) {
  const parts = path.split('.');
  let o = obj;
  parts.slice(0, -1).forEach(p => { o = o[p] = o[p] || {}; });
  const last = parts[parts.length - 1];
  if (val === DELETE) delete o[last]; else o[last] = val;
}
const stamp = () => ({ updatedAt: Date.now(), updatedByName: ME.name });
const watch = (set, cb, get) => { const f = () => cb(get()); set.add(f); f(); return () => set.delete(f); };

export const backend = {
  mode: 'demo',
  DELETE,
  onUser(cb) { setTimeout(() => cb(ME), 0); return () => {}; },
  signIn: async () => {},
  signOut: async () => location.reload(),
  loadMember: async email => state.members.find(m => m.id === email) || null,
  watchMembers: (cb) => watch(subs.members, cb, () => structuredClone(state.members)),
  async setMember(email, data) {
    const m = state.members.find(x => x.id === email);
    if (m) Object.assign(m, data); else state.members.push({ id: email, ...data });
    fire('members');
  },
  async removeMember(email) { state.members = state.members.filter(m => m.id !== email); fire('members'); },
  watchChildren: (cb) => watch(subs.children, cb, () => structuredClone(state.children)),
  async createChild(data) {
    const id = 'c' + ++uid;
    state.children.push({ id, focus: {}, ...data, createdAt: Date.now(), ...stamp() });
    fire('children');
    return id;
  },
  async updateChild(id, patch) {
    const c = state.children.find(x => x.id === id);
    for (const [k, v] of Object.entries({ ...patch, ...stamp() })) setPath(c, k, v);
    fire('children');
  },
  async deleteChild(id) { state.children = state.children.filter(c => c.id !== id); fire('children'); },
  async importChildren(list) {
    list.forEach(c => state.children.push({ id: 'c' + ++uid, createdAt: Date.now(), ...c, ...stamp() }));
    fire('children');
  },
  async generateSummary(childId) {
    await new Promise(r => setTimeout(r, 600));
    const c = state.children.find(x => x.id === childId);
    const notes = state.notes[childId] || [];
    const open = Object.values(c.focus || {}).filter(f => !f.achieved).map(f => f.text.toLowerCase());
    c.summary = `[Demo özeti] Şu an ${open.join(', ') || 'belirli bir hedef'} üzerinde çalışıyoruz. ${notes.length} seans notuna göre çocuğunuz çalışmalara katılıyor. Gerçek kullanımda bu metni yapay zeka notlardan üretir.`;
    c.summaryAt = Date.now(); c.summaryNoteCount = notes.length;
    fire('children');
  },
  watchNotes(childId, cb) {
    return watch(subs.notes, cb, () => structuredClone((state.notes[childId] || []).slice().sort((a, b) => b.createdAt - a.createdAt)));
  },
  async addNote(childId, text) {
    (state.notes[childId] = state.notes[childId] || []).push({ id: 'n' + ++uid, text, authorEmail: ME.email, authorName: ME.name, createdAt: Date.now() });
    fire('notes');
  },
  async updateNote(childId, noteId, text) {
    Object.assign(state.notes[childId].find(n => n.id === noteId), { text, editedAt: Date.now(), editedByName: ME.name });
    fire('notes');
  },
  async deleteNote(childId, noteId) { state.notes[childId] = state.notes[childId].filter(n => n.id !== noteId); fire('notes'); }
};
