import { createHash, randomBytes } from 'node:crypto';
import { AppError, check, addDays, text } from './model.mjs';

const hash = s => createHash('sha256').update(s).digest('hex');
const GOOGLE_API = 'https://www.googleapis.com/calendar/v3';
export class GoogleSync {
  constructor(store, model, env = process.env) { this.store = store; this.model = model; this.env = env; this.running = null; }
  get configured() { return !!(this.env.GOOGLE_CLIENT_ID && this.env.GOOGLE_CLIENT_SECRET && this.env.APP_URL); }
  get redirectUri() { return this.env.APP_URL.replace(/\/$/, '') + '/api/google/callback'; }
  async http(url, options = {}) {
    let response;
    try { response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000), redirect: 'error' }); }
    catch { throw new AppError('Google ist gerade nicht erreichbar. Beim nächsten Abgleich wird es erneut versucht.', 502); }
    const value = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new AppError(`Google-Anfrage fehlgeschlagen (HTTP ${response.status}).`, 502); error.remoteStatus = response.status; throw error; }
    return value;
  }
  authorization(sessionHash) {
    check(this.configured, 'Google zuerst über GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET und APP_URL in der Serverkonfiguration einrichten.');
    const state = randomBytes(32).toString('base64url');
    this.store.db.prepare('DELETE FROM oauth_states WHERE expires<?').run(Date.now());
    this.store.db.prepare('INSERT INTO oauth_states VALUES (?,?,?)').run(hash(state), sessionHash, Date.now() + 600000);
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({ client_id: this.env.GOOGLE_CLIENT_ID, redirect_uri: this.redirectUri, response_type: 'code', scope: 'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly', access_type: 'offline', prompt: 'consent', state }).toString();
    return { url: url.toString() };
  }
  async callback(params, sessionHash) {
    const state = this.store.db.prepare('SELECT * FROM oauth_states WHERE hash=?').get(hash(params.get('state') || ''));
    check(state && state.expires > Date.now() && state.session_hash === sessionHash, 'Die Google-Verbindung ist abgelaufen. Bitte erneut starten.');
    this.store.db.prepare('DELETE FROM oauth_states WHERE hash=?').run(state.hash);
    check(!params.get('error') && params.get('code'), 'Google-Verbindung wurde abgebrochen.');
    const token = await this.http('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: this.env.GOOGLE_CLIENT_ID, client_secret: this.env.GOOGLE_CLIENT_SECRET, redirect_uri: this.redirectUri, code: params.get('code'), grant_type: 'authorization_code' }) });
    check(token.access_token, 'Google hat keinen Zugriff gewährt.');
    const user = await this.http('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` } });
    const id = hash(user.id || user.email).slice(0, 24);
    const previous = this.store.db.prepare('SELECT * FROM google_accounts WHERE id=?').get(id);
    const oldToken = previous ? this.store.decrypt(previous.secret) : {};
    check(token.refresh_token || oldToken.refresh_token, 'Kein dauerhafter Zugriff erhalten. Google-Freigabe entfernen und erneut verbinden.');
    const secret = { ...oldToken, ...token, expires_at: Date.now() + token.expires_in * 1000 };
    this.store.db.prepare('INSERT INTO google_accounts VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,secret=excluded.secret').run(id, text(user.email, 250, true), this.store.encrypt(secret), JSON.stringify({ calendars: [], lastSync: '', error: '' }));
    await this.refreshCalendars(id);
    this.store.bump();
  }
  async accessToken(accountId) {
    const account = this.store.db.prepare('SELECT secret FROM google_accounts WHERE id=?').get(accountId);
    check(account, 'Google-Konto nicht mehr verbunden.');
    let token = this.store.decrypt(account.secret);
    if (!token.expires_at || token.expires_at < Date.now() + 60000) {
      const refreshed = await this.http('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: this.env.GOOGLE_CLIENT_ID, client_secret: this.env.GOOGLE_CLIENT_SECRET, refresh_token: token.refresh_token, grant_type: 'refresh_token' }) });
      token = { ...token, ...refreshed, expires_at: Date.now() + refreshed.expires_in * 1000 };
      this.store.db.prepare('UPDATE google_accounts SET secret=? WHERE id=?').run(this.store.encrypt(token), accountId);
    }
    return token.access_token;
  }
  async request(accountId, path, options = {}) {
    const token = await this.accessToken(accountId);
    return this.http(GOOGLE_API + path, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers } });
  }
  updateAccount(id, changes) {
    const row = this.store.db.prepare('SELECT data FROM google_accounts WHERE id=?').get(id);
    if (!row) return;
    this.store.db.prepare('UPDATE google_accounts SET data=? WHERE id=?').run(JSON.stringify({ ...JSON.parse(row.data), ...changes }), id);
    this.store.bump();
  }
  async refreshCalendars(id) {
    const old = this.store.publicAccounts().find(a => a.id === id);
    const calendars = [];
    let pageToken = '';
    do {
      const response = await this.request(id, '/users/me/calendarList?' + new URLSearchParams({ maxResults: '250', ...(pageToken ? { pageToken } : {}) }));
      for (const calendar of response.items || []) {
        const prior = old?.calendars?.find(c => c.id === calendar.id);
        calendars.push({ id: calendar.id, title: calendar.summaryOverride || calendar.summary || calendar.id, color: calendar.backgroundColor || '#6366f1', accessRole: calendar.accessRole, selected: prior?.selected || false, memberId: prior?.memberId || '' });
      }
      pageToken = response.nextPageToken || '';
    } while (pageToken);
    this.updateAccount(id, { calendars });
  }
  selectCalendars(id, entries) {
    const account = this.store.publicAccounts().find(a => a.id === id);
    check(account && Array.isArray(entries), 'Google-Konto nicht gefunden.');
    const calendars = account.calendars.map(c => {
      const selected = entries.find(e => e.id === c.id);
      return { ...c, selected: !!selected?.selected, memberId: this.model.member(selected?.memberId, true) };
    });
    this.store.transaction(() => {
      for (const calendar of calendars.filter(c => !c.selected)) {
        check(!this.store.db.prepare('SELECT data FROM outbox').all().some(r => { const e = JSON.parse(r.data); return e.googleAccountId === id && e.calendarId === calendar.id; }), 'Für diesen Kalender sind noch Änderungen offen. Zuerst synchronisieren.');
        for (const event of this.store.all('events').filter(e => e.googleAccountId === id && e.calendarId === calendar.id)) this.store.remove('events', event.id);
      }
      this.updateAccount(id, { calendars });
    });
  }
  disconnect(id) {
    this.store.transaction(() => {
      for (const row of this.store.db.prepare('SELECT record_id,data FROM outbox').all()) if (JSON.parse(row.data).googleAccountId === id) this.store.db.prepare('DELETE FROM outbox WHERE record_id=?').run(row.record_id);
      for (const event of this.store.all('events').filter(e => e.googleAccountId === id)) this.store.put('events', event.id, { ...event, googleAccountId: '', calendarId: '', googleEventId: '', googleReadOnly: false });
      this.store.db.prepare('DELETE FROM google_accounts WHERE id=?').run(id);
      this.store.bump();
    });
  }
  async pushOutbox() {
    for (const row of this.store.db.prepare('SELECT * FROM outbox').all()) {
      const event = JSON.parse(row.data);
      try {
        const remoteId = event.googleEventId || hash(event.id).slice(0, 32);
        const path = `/calendars/${encodeURIComponent(event.calendarId)}/events`;
        if (row.operation === 'delete') {
          try { await this.request(event.googleAccountId, path + '/' + encodeURIComponent(remoteId), { method: 'DELETE' }); }
          catch (e) { if (![404, 410].includes(e.remoteStatus)) throw e; }
        } else {
          const timezone = this.store.meta('settings').timezone || 'Europe/Berlin';
          const minute = Number(event.startTime?.slice(0, 2)) * 60 + Number(event.startTime?.slice(3, 5)) + 15;
          const pointEnd = { dateTime: `${minute >= 1440 ? addDays(event.startDate, 1) : event.startDate}T${String(Math.floor(minute % 1440 / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:00`, timeZone: timezone };
          const payload = {
            summary: event.title, description: event.description, location: event.location,
            start: event.allDay ? { date: event.startDate } : { dateTime: `${event.startDate}T${event.startTime}:00`, timeZone: timezone },
            end: event.allDay ? { date: addDays(event.endDate, 1) } : event.startOnly ? pointEnd : { dateTime: `${event.endDate}T${event.endTime}:00`, timeZone: timezone },
            extendedProperties: { private: { familyOrganizerId: event.id, familyStartOnly: event.startOnly ? '1' : '0', familyMemberIds: JSON.stringify(event.memberIds || (event.memberId ? [event.memberId] : [])) } },
          };
          if (event.googleEventId) await this.request(event.googleAccountId, path + '/' + encodeURIComponent(remoteId), { method: 'PATCH', body: JSON.stringify(payload) });
          else {
            try { await this.request(event.googleAccountId, path, { method: 'POST', body: JSON.stringify({ ...payload, id: remoteId }) }); }
            catch (e) { if (e.remoteStatus !== 409) throw e; await this.request(event.googleAccountId, path + '/' + remoteId, { method: 'PATCH', body: JSON.stringify(payload) }); }
          }
          const current = this.store.get('events', event.id);
          if (current && !current.googleEventId) this.store.put('events', event.id, { ...current, googleEventId: remoteId });
        }
        // Nur genau die gesendete Version quittieren; neue Geräteänderungen bleiben in der Warteschlange.
        this.store.db.prepare('DELETE FROM outbox WHERE record_id=? AND data=? AND operation=?').run(row.record_id, row.data, row.operation);
        this.store.bump();
      } catch (error) {
        this.store.db.prepare('UPDATE outbox SET error=?,attempts=attempts+1 WHERE record_id=? AND data=?').run(error.message, row.record_id, row.data);
        this.store.bump();
      }
    }
  }
  fromRemote(account, calendar, event, existingIndex) {
    if (!event.start || !event.end || event.status === 'cancelled') return null;
    const allDay = !!event.start.date;
    const timezone = this.store.meta('settings').timezone || 'Europe/Berlin';
    const part = value => {
      if (value.date) return { date: value.date, time: '' };
      const d = new Date(value.dateTime);
      return { date: new Intl.DateTimeFormat('sv-SE', { timeZone: timezone }).format(d), time: new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d) };
    };
    const start = part(event.start), end = part(event.end);
    const existing = existingIndex ? existingIndex.get(event.id) : this.store.all('events').find(e => e.googleAccountId === account.id && e.calendarId === calendar.id && e.googleEventId === event.id);
    const ownId = event.extendedProperties?.private?.familyOrganizerId;
    const ownRecord = ownId ? this.store.get('events', ownId) : null;
    const validOwnId = ownRecord && ownRecord.googleAccountId === account.id && ownRecord.calendarId === calendar.id && (!ownRecord.googleEventId || ownRecord.googleEventId === event.id);
    const id = existing?.id || (validOwnId && !event.recurringEventId ? ownId : 'g-' + hash(account.id + calendar.id + event.id).slice(0, 32));
    let memberIds = calendar.memberId ? [calendar.memberId] : existing?.memberIds || (existing?.memberId ? [existing.memberId] : []);
    if (validOwnId) {
      try { const selected = JSON.parse(event.extendedProperties.private.familyMemberIds); if (Array.isArray(selected) && selected.length <= 20 && selected.every(m => this.store.get('members', m))) memberIds = [...new Set(selected)]; } catch {}
    }
    const startOnly = !allDay && !!validOwnId && event.extendedProperties?.private?.familyStartOnly === '1';
    return { id, title: (event.summary || 'Ohne Titel').slice(0, 160), startDate: start.date, endDate: startOnly ? start.date : allDay ? addDays(end.date, -1) : end.date, startTime: start.time, endTime: startOnly ? '' : end.time, allDay, startOnly, memberIds, memberId: memberIds[0] || '', location: (event.location || '').slice(0, 300), description: (event.description || '').slice(0, 5000), googleAccountId: account.id, calendarId: calendar.id, googleEventId: event.id, googleReadOnly: !['owner', 'writer'].includes(calendar.accessRole) };
  }
  async pullCalendar(account, calendar) {
    const date = this.store.state().serverDate;
    const remoteEvents = [];
    let pageToken = '';
    do {
      const query = new URLSearchParams({ singleEvents: 'true', showDeleted: 'false', maxResults: '2500', timeMin: addDays(date, -90) + 'T00:00:00Z', timeMax: addDays(date, 366) + 'T00:00:00Z', ...(pageToken ? { pageToken } : {}) });
      const response = await this.request(account.id, `/calendars/${encodeURIComponent(calendar.id)}/events?${query}`);
      remoteEvents.push(...response.items || []);
      pageToken = response.nextPageToken || '';
    } while (pageToken);
    const currentAccount = this.store.publicAccounts().find(a => a.id === account.id);
    const currentCalendar = currentAccount?.calendars.find(c => c.id === calendar.id && c.selected);
    if (!currentCalendar) return;
    const pendingRows = this.store.db.prepare('SELECT record_id,data FROM outbox').all();
    const pending = new Set(pendingRows.map(r => r.record_id));
    const pendingRemoteIds = new Set(pendingRows.map(r => JSON.parse(r.data)).filter(e => e.googleAccountId === account.id && e.calendarId === calendar.id).map(e => e.googleEventId || hash(e.id).slice(0, 32)));
    const existingIndex = new Map(this.store.all('events').filter(e => e.googleAccountId === account.id && e.calendarId === calendar.id).map(e => [e.googleEventId, e]));
    this.store.transaction(() => {
      const seen = new Set();
      for (const remote of remoteEvents) {
        if (pendingRemoteIds.has(remote.id)) continue;
        const event = this.fromRemote(currentAccount, currentCalendar, remote, existingIndex);
        if (!event) continue;
        seen.add(event.id);
        if (pending.has(event.id)) continue;
        const existing = this.store.get('events', event.id);
        if (!existing || Object.entries(event).some(([key, value]) => JSON.stringify(existing[key]) !== JSON.stringify(value))) this.store.put('events', event.id, event);
      }
      for (const old of this.store.all('events').filter(e => e.googleAccountId === account.id && e.calendarId === calendar.id)) {
        // Außerhalb des Abruffensters werden importierte Termine nicht gelöscht.
        if (!seen.has(old.id) && !pending.has(old.id) && old.endDate >= addDays(date, -90) && old.startDate < addDays(date, 366)) this.store.remove('events', old.id);
      }
    });
  }
  async sync() {
    if (this.running) return this.running;
    this.running = (async () => {
      await this.pushOutbox();
      for (const account of this.store.publicAccounts()) {
        try {
          for (const calendar of account.calendars.filter(c => c.selected)) await this.pullCalendar(account, calendar);
          this.updateAccount(account.id, { lastSync: new Date().toISOString(), error: '' });
        } catch (error) { this.updateAccount(account.id, { error: error.message }); }
      }
      return { pending: this.store.db.prepare('SELECT COUNT(*) n FROM outbox').get().n };
    })();
    try { return await this.running; } finally { this.running = null; }
  }
}
