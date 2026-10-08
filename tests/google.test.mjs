import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.mjs';
import { Model } from '../src/model.mjs';
import { GoogleSync } from '../src/google.mjs';
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'family-google-')), store = new Store(directory), model = new Model(store);
  store.setMeta('settings', { timezone: 'Europe/Berlin' });
  const calendar = { id: 'primary', title: 'Familie', selected: true, memberId: '', accessRole: 'owner' };
  store.db.prepare('INSERT INTO google_accounts VALUES (?,?,?,?)').run('account', 'test@example.com', store.encrypt({ access_token: 'test', expires_at: Date.now() + 3600000 }), JSON.stringify({ calendars: [calendar] }));
  const google = new GoogleSync(store, model, {});
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  return { store, model, google, calendar, account: store.publicAccounts()[0] };
}
test('Google-Übertragung erhält mehrere Personen und eine feste Startzeit über private Metadaten', async t => {
  const { store, model, google, account, calendar } = fixture(t), date = '2026-10-05';
  const a = model.save('members', '', { name: 'Anna', color: '#ff9900' }), b = model.save('members', '', { name: 'Ben', color: '#3399ff' });
  const event = model.save('events', '', { title: 'Treffen', startDate: date, startTime: '23:55', startOnly: true, memberIds: [a.id, b.id], googleAccountId: account.id, calendarId: calendar.id });
  let payload; google.request = async (_, path, options) => { payload = JSON.parse(options.body); return {}; }; await google.pushOutbox();
  assert.equal(payload.end.dateTime, '2026-10-06T00:10:00'); assert.equal(payload.extendedProperties.private.familyStartOnly, '1');
  const current = store.get('events', event.id); const remote = { id: current.googleEventId, ...payload, start: { dateTime: date + 'T21:55:00Z' }, end: { dateTime: '2026-10-05T22:10:00Z' } };
  const imported = google.fromRemote(account, calendar, remote); assert.deepEqual(imported.memberIds, [a.id, b.id]); assert.equal(imported.startOnly, true); assert.equal(imported.endTime, ''); assert.equal(imported.endDate, date);
});
test('Google-Abgleich: Zeitzonen, ganztägige Enddaten und stabile Revisionen', async t => {
  const { google, store, account, calendar } = fixture(t), today = store.state().serverDate;
  const response = { items: [{ id: 'remote1', summary: 'Test', start: { dateTime: today + 'T08:00:00Z' }, end: { dateTime: today + 'T09:00:00Z' } }, { id: 'remote2', summary: 'Ganztag', start: { date: today }, end: { date: today.replace(/.$/, String(Number(today.slice(-1)) + 1)) } }] };
  // Ganztägiges Ende ohne Annahme über Monatsgrenzen berechnen.
  const end = new Date(today + 'T12:00:00Z'); end.setUTCDate(end.getUTCDate() + 1); response.items[1].end.date = end.toISOString().slice(0, 10);
  google.request = async () => response;
  await google.pullCalendar(account, calendar);
  const events = store.all('events'), rev = events[0]._rev;
  const expectedHour = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(today + 'T08:00:00Z'));
  assert.equal(events.find(e => e.googleEventId === 'remote1').startTime, expectedHour);
  assert.equal(events.find(e => e.googleEventId === 'remote2').endDate, today);
  await google.pullCalendar(account, calendar); assert.equal(store.all('events')[0]._rev, rev);
});
test('Fehlgeschlagene Google-Schreibvorgänge bleiben in Warteschlange und werden erneut gesendet', async t => {
  const { google, model, store } = fixture(t), today = store.state().serverDate;
  const event = model.save('events', '', { title: 'Neu', startDate: today, endDate: today, startTime: '09:00', endTime: '10:00', googleAccountId: 'account', calendarId: 'primary' });
  google.request = async () => { throw new Error('Nicht erreichbar'); };
  await google.pushOutbox(); assert.equal(store.state().pendingSync.length, 1); assert.equal(store.state().pendingSync[0].attempts, 1);
  const calls = []; google.request = async (a, path, options) => { calls.push({ path, options }); return { id: 'inserted' }; };
  await google.pushOutbox(); assert.equal(store.state().pendingSync.length, 0); assert.equal(calls[0].options.method, 'POST'); assert.ok(store.get('events', event.id).googleEventId);
});
test('Änderung während laufendem Google-Versand wird nicht versehentlich quittiert', async t => {
  const { google, model, store } = fixture(t), today = store.state().serverDate;
  const event = model.save('events', '', { title: 'Vorher', startDate: today, endDate: today, startTime: '09:00', endTime: '10:00', googleAccountId: 'account', calendarId: 'primary' });
  google.request = async () => { const current = store.get('events', event.id); model.save('events', current.id, { ...current, title: 'Währenddessen geändert' }); return {}; };
  await google.pushOutbox(); assert.equal(store.state().pendingSync.length, 1); assert.equal(JSON.parse(store.db.prepare('SELECT data FROM outbox').get().data).title, 'Währenddessen geändert');
});
test('Abgewählter Kalender wird nach bereits begonnenem Abruf nicht erneut importiert', async t => {
  const { google, store, account, calendar } = fixture(t), today = store.state().serverDate;
  google.request = async () => { google.selectCalendars('account', []); return { items: [{ id: 'test', start: { date: today }, end: { date: '2026-12-31' } }] }; };
  await google.pullCalendar(account, calendar); assert.equal(store.all('events').length, 0);
});
test('Private Google-Metadaten überschreiben keine unabhängigen lokalen Termine', t => {
  const { google, model, account, calendar, store } = fixture(t), today = store.state().serverDate;
  const local = model.save('events', '', { title: 'Lokal', startDate: today, endDate: today, startTime: '09:00', endTime: '10:00' });
  const imported = google.fromRemote(account, calendar, { id: 'foreign', summary: 'Fremd', start: { date: today }, end: { date: '2026-12-31' }, extendedProperties: { private: { familyOrganizerId: local.id } } });
  assert.notEqual(imported.id, local.id);
});
test('Noch nicht übertragene Löschung taucht beim Google-Nachladen nicht erneut auf', async t => {
  const { google, model, store, account, calendar } = fixture(t), today = store.state().serverDate;
  const event = store.put('events', store.id(), { title: 'Zu löschen', startDate: today, endDate: today, startTime: '09:00', endTime: '10:00', allDay: false, memberId: '', location: '', description: '', googleAccountId: 'account', calendarId: 'primary', googleEventId: 'remote-delete', googleReadOnly: false });
  model.delete('events', event.id, event._rev);
  google.request = async () => ({ items: [{ id: 'remote-delete', summary: 'Zu löschen', start: { dateTime: today + 'T09:00:00+02:00' }, end: { dateTime: today + 'T10:00:00+02:00' }, extendedProperties: { private: { familyOrganizerId: event.id } } }] });
  await google.pullCalendar(account, calendar); assert.equal(store.all('events').length, 0); assert.equal(store.state().pendingSync.length, 1);
});
