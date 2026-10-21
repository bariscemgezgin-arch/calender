import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, deleteField,
  onSnapshot, query, orderBy, serverTimestamp, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig, summaryEndpoint } from './firebase-config.js';
import { buildPrompt } from './summary.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

const ms = t => (t && t.toMillis ? t.toMillis() : null);
const clean = (d, extra) => {
  const o = { ...d.data(), id: d.id, ...extra };
  for (const k of ['updatedAt', 'createdAt', 'editedAt', 'summaryAt']) if (k in o) o[k] = ms(o[k]);
  return o;
};
const stamp = () => {
  const u = auth.currentUser;
  return { updatedAt: serverTimestamp(), updatedBy: u.email.toLowerCase(), updatedByName: u.displayName || u.email };
};
const me = () => {
  const u = auth.currentUser;
  return { email: u.email.toLowerCase(), name: u.displayName || u.email };
};

export const backend = {
  mode: 'firebase',
  DELETE: deleteField(),

  onUser(cb) {
    return onAuthStateChanged(auth, u => cb(u && { email: u.email.toLowerCase(), name: u.displayName || u.email, photo: u.photoURL }));
  },
  async signIn() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try { await signInWithPopup(auth, provider); }
    catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') await signInWithRedirect(auth, provider);
      else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') throw e;
    }
  },
  signOut: () => signOut(auth),

  async loadMember(email) {
    const s = await getDoc(doc(db, 'members', email));
    return s.exists() ? clean(s) : null;
  },
  watchMembers(cb, err) {
    return onSnapshot(collection(db, 'members'), s => cb(s.docs.map(d => clean(d))), err);
  },
  async setMember(email, data) {
    await setDoc(doc(db, 'members', email), { ...data, addedBy: me().email, addedAt: serverTimestamp() }, { merge: true });
  },
  removeMember: email => deleteDoc(doc(db, 'members', email)),

  watchChildren(cb, err) {
    return onSnapshot(collection(db, 'children'), s => cb(s.docs.map(d => clean(d))), err);
  },
  async createChild(data) {
    const r = await addDoc(collection(db, 'children'), { ...data, focus: data.focus || {}, createdAt: serverTimestamp(), ...stamp() });
    return r.id;
  },
  // patch'te 'focus.abc' gibi noktalı yollar ve backend.DELETE kullanılabilir
  updateChild: (id, patch) => updateDoc(doc(db, 'children', id), { ...patch, ...stamp() }),
  async deleteChild(id) {
    const notes = await getDocs(collection(db, 'children', id, 'notes'));
    await Promise.all(notes.docs.map(n => deleteDoc(n.ref)));
    await deleteDoc(doc(db, 'children', id));
  },
  async importChildren(list) {
    for (let i = 0; i < list.length; i += 400) {
      const batch = writeBatch(db);
      for (const c of list.slice(i, i + 400)) {
        batch.set(doc(collection(db, 'children')), { ...c, createdAt: serverTimestamp(), ...stamp() });
      }
      await batch.commit();
    }
  },

  // input: { name, age, focus, notes }. Ad ve kişisel veriler istem hazırlanırken temizlenir; Worker'a yalnızca temizlenmiş metin gider.
  async generateSummary(childId, input) {
    if (!summaryEndpoint) throw new Error('Özet servisi kurulmamış (README: "Yapay zeka özeti").');
    const { system, user, noteCount } = buildPrompt(input);
    let res;
    try {
      res = await fetch(summaryEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${await auth.currentUser.getIdToken()}` },
        body: JSON.stringify({ system, user })
      });
    } catch { throw new Error('Özet servisine ulaşılamadı.'); }
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || 'Özet hazırlanamadı.');
    await updateDoc(doc(db, 'children', childId), { summary: j.summary, summaryAt: serverTimestamp(), summaryBy: me().email, summaryNoteCount: noteCount });
  },

  watchNotes(childId, cb, err) {
    const q = query(collection(db, 'children', childId, 'notes'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, s => cb(s.docs.map(d => clean(d))), err);
  },
  addNote(childId, text) {
    const u = me();
    return addDoc(collection(db, 'children', childId, 'notes'), { text, authorEmail: u.email, authorName: u.name, createdAt: serverTimestamp() });
  },
  updateNote(childId, noteId, text) {
    const u = me();
    return updateDoc(doc(db, 'children', childId, 'notes', noteId), { text, editedAt: serverTimestamp(), editedBy: u.email, editedByName: u.name });
  },
  deleteNote: (childId, noteId) => deleteDoc(doc(db, 'children', childId, 'notes', noteId))
};
