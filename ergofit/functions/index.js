import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { buildPrompt } from './summary.js';

initializeApp();
const db = getFirestore();
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

// firestore.rules ve js/firebase-config.js ile aynı ilk yönetici
const ADMIN_EMAIL = 'bariscemgezgin@gmail.com';
const MODEL = process.env.SUMMARY_MODEL || 'claude-sonnet-5-5';
const COOLDOWN_MS = 15000;

function ageText(birth) {
  if (!birth) return '';
  const b = new Date(birth), n = new Date();
  let m = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth();
  if (n.getDate() < b.getDate()) m--;
  if (m < 0) return '';
  return m < 12 ? `${m} aylık` : `${Math.floor(m / 12)} yaş${m % 12 ? ' ' + (m % 12) + ' ay' : ''}`;
}

export const generateSummary = onCall(
  { region: 'europe-west1', secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 60, maxInstances: 5 },
  async req => {
    const token = req.auth?.token;
    if (!token?.email || token.email_verified !== true) throw new HttpsError('unauthenticated', 'Giriş yapmalısın.');
    const email = token.email.toLowerCase();
    if (email !== ADMIN_EMAIL) {
      const m = await db.doc(`members/${email}`).get();
      if (!m.exists || !['admin', 'editor'].includes(m.data().role)) throw new HttpsError('permission-denied', 'Bu işlem için yetkin yok.');
    }
    const childId = req.data?.childId;
    if (typeof childId !== 'string' || !childId || childId.includes('/')) throw new HttpsError('invalid-argument', 'Geçersiz çocuk.');

    const ref = db.doc(`children/${childId}`);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Çocuk bulunamadı.');
    const c = snap.data();
    const last = c.summaryAt?.toMillis?.() || 0;
    if (Date.now() - last < COOLDOWN_MS) throw new HttpsError('resource-exhausted', 'Biraz sonra tekrar dene.');

    const notesSnap = await ref.collection('notes').orderBy('createdAt', 'desc').limit(25).get();
    const notes = notesSnap.docs.map(d => {
      const n = d.data(), t = n.createdAt?.toDate?.();
      return { text: n.text || '', date: t ? t.toISOString().slice(0, 10) : '' };
    });
    const focus = Object.values(c.focus || {}).sort((a, b) => (a.order || 0) - (b.order || 0)).map(f => ({ text: f.text, achieved: !!f.achieved }));
    if (!notes.length && !focus.length) throw new HttpsError('failed-precondition', 'Özet için önce not veya çalışma ekle.');

    const { system, user, noteCount } = buildPrompt({ name: c.name, age: ageText(c.birth), focus, notes });
    let summary;
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY.value(), 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: MODEL, max_tokens: 700, system, messages: [{ role: 'user', content: user }] })
      });
      if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 300)}`);
      const j = await r.json();
      summary = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
      if (!summary) throw new Error('Boş yanıt');
    } catch (e) {
      console.error(e);
      throw new HttpsError('internal', 'Özet şu an hazırlanamadı. Biraz sonra tekrar dene.');
    }
    await ref.update({ summary, summaryAt: FieldValue.serverTimestamp(), summaryBy: email, summaryNoteCount: noteCount });
    return { ok: true };
  }
);
