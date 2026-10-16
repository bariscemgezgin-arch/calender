// Google Takvim: tarayıcıdan doğrudan Google Identity Services + Calendar REST API.
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
let tokenClient = null;
let token = null;
let expiresAt = 0;

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Google giriş betiği yüklenemedi (internet?)'));
    document.head.appendChild(s);
  });
}

export const isConnected = () => !!token && Date.now() < expiresAt;

export async function connect(clientId) {
  if (!clientId) throw new Error('Önce Ayarlar\'dan Google Client ID gir');
  await loadGis();
  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (r) => {
        if (r.error) return reject(new Error(r.error_description || r.error));
        token = r.access_token;
        expiresAt = Date.now() + (r.expires_in - 60) * 1000;
        resolve();
      },
      error_callback: (e) => reject(new Error(e.message || e.type || 'Giriş iptal edildi')),
    });
    tokenClient.requestAccessToken({ prompt: token === null ? 'consent' : '' });
  });
}

async function call(url, opts = {}) {
  if (!isConnected()) throw new Error('Google Takvim bağlı değil');
  const r = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (r.status === 401) token = null;
  if (!r.ok) throw new Error(`Google Takvim hatası (${r.status})`);
  return r.json();
}

export async function listEvents(from, to) {
  const q = new URLSearchParams({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });
  const j = await call(`${API}?${q}`);
  return (j.items || []).map((e) => ({
    id: e.id,
    title: e.summary || '(başlıksız)',
    allDay: !!e.start.date,
    start: new Date(e.start.dateTime || e.start.date + 'T00:00:00'),
    end: new Date(e.end.dateTime || e.end.date + 'T00:00:00'),
  }));
}

export async function createEvent({ date, start, end, title }) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const body = {
    summary: title,
    start: { dateTime: `${date}T${start}:00`, timeZone: tz },
    end: { dateTime: `${date}T${end}:00`, timeZone: tz },
  };
  return call(API, { method: 'POST', body: JSON.stringify(body) });
}
