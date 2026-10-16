import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.mjs';
import { Model } from '../src/model.mjs';
import { GoogleSync } from '../src/google.mjs';
import { createApp } from '../server.mjs';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'family-duplicate-')), store = new Store(directory), model = new Model(store);
  store.setMeta('settings', { timezone: 'Europe/Berlin' });
  const member = model.save('members', '', { name: 'Anna', color: '#123456' });
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  return { store, model, member };
}
test('Terminkopie behält Details und Tagesabstand über Monats- und Zeitumstellungsgrenzen; Wiederholung bleibt eindeutig', t => {
  const { model, store, member } = fixture(t);
  const source = model.save('events', '', { title: 'Reise', description: 'Mit Familie', location: 'Berlin', startDate: '2026-10-24', endDate: '2026-10-26', startTime: '09:00', endTime: '18:00', memberIds: [member.id], emoji: '🚆', imageFile: '12345678-1234-1234-1234-123456789012.png' });
  const input = { startDate: '2026-12-31', _rev: source._rev, requestId: 'duplicate-rich-123456' }, copy = model.duplicateEvent(source.id, input);
  assert.notEqual(copy.id, source.id); assert.equal(copy.startDate, '2026-12-31'); assert.equal(copy.endDate, '2027-01-02');
  for (const key of ['title','description','location','startTime','endTime','emoji','imageFile']) assert.equal(copy[key], source[key]);
  assert.deepEqual(copy.memberIds, [member.id]); assert.deepEqual(store.get('events', source.id), source);
  assert.equal(model.duplicateEvent(source.id, input).id, copy.id); assert.equal(store.all('events').length, 2);
  const edited = model.save('events', copy.id, { ...copy, title: 'Eigene Kopie', startDate: '2027-01-03', endDate: '2027-01-05', duplicateRequest: { forged: true } });
  assert.deepEqual(edited.duplicateRequest, copy.duplicateRequest);
  assert.equal(model.duplicateEvent(source.id, input).title, 'Eigene Kopie'); assert.equal(store.all('events').length, 2);
  assert.throws(() => model.duplicateEvent(source.id, { ...input, startDate: '2027-02-01' }), { status: 409 });
});
test('Ganztag, Nachtdienst, feste Startzeit und eigene Farbe behalten ihre Bedeutung beim Duplizieren', t => {
  const { model } = fixture(t);
  for (const [index, times] of [
    { allDay: true, endDate: '2026-12-31' },
    { allDay: false, startTime: '22:00', endTime: '06:00', endDate: '2026-12-31' },
    { allDay: false, startOnly: true, startTime: '16:15', endDate: '2026-12-30' },
  ].entries()) {
    const source = model.save('events', '', { title: 'Beispiel', startDate: '2026-12-30', color: '#cc6633', ...times });
    const copy = model.duplicateEvent(source.id, { startDate: '2028-02-28', _rev: source._rev, requestId: `duplicate-times-${index}-123456` });
    assert.equal(copy.endDate, source.startOnly ? '2028-02-28' : '2028-02-29');
    assert.equal(copy.allDay, source.allDay); assert.equal(copy.startOnly, source.startOnly); assert.equal(copy.startTime, source.startTime); assert.equal(copy.endTime, source.endTime); assert.equal(copy.color, '#cc6633');
  }
});
test('Schreibgeschützte Quellen können lokal kopiert werden; fremde IDs und ungeprüfte Kopierfelder werden nicht übernommen', t => {
  const { model, store, member } = fixture(t);
  const source = store.put('events', 'read-only', { title: 'Nur lesen', startDate: '2026-10-16', endDate: '2026-10-16', allDay: true, memberId: member.id, googleReadOnly: true, googleAccountId: 'readonly-account', calendarId: 'external', googleEventId: 'external-id' });
  const copy = model.duplicateEvent(source.id, { startDate: '2026-10-17', _rev: source._rev, requestId: 'duplicate-readonly-123456', title: 'Ungeprüft', googleEventId: 'external-id', id: source.id });
  assert.equal(copy.title, source.title); assert.equal(copy.googleAccountId, ''); assert.equal(copy.calendarId, ''); assert.equal(copy.googleEventId, ''); assert.equal(copy.googleReadOnly, false);
  assert.deepEqual(copy.memberIds, [member.id]); assert.equal(store.state().pendingSync.length, 0); assert.deepEqual(store.get('events', source.id), source);
});
test('Importierte ICS-Termine sind als unabhängige Termine kopierbar; Ferien und Arbeitstage sind keine Terminquelle', t => {
  const { model, store, member } = fixture(t);
  const imported = model.save('calendarEntries', '', { title:'Import', category:'event', memberId:member.id, startDate:'2026-10-16', endDate:'2026-10-17', allDay:false, startTime:'22:00', endTime:'06:00', importKey:'a'.repeat(64), source:'ICS-Import' });
  const input = { sourceKind:'calendarEntries', startDate:'2026-10-23', _rev:imported._rev, requestId:'duplicate-import-123456' }, copy = model.duplicateEvent(imported.id,input);
  assert.equal(copy.startDate,'2026-10-23'); assert.equal(copy.endDate,'2026-10-24'); assert.equal(copy.startTime,'22:00'); assert.equal(copy.endTime,'06:00'); assert.deepEqual(copy.memberIds,[member.id]);
  assert.equal(copy.importKey,undefined); assert.deepEqual(store.get('calendarEntries',imported.id),imported); assert.equal(model.duplicateEvent(imported.id,input).id,copy.id);
  for (const category of ['vacation','holiday','workday']) {
    const other=model.save('calendarEntries','',{ title:category,category,startDate:'2026-10-16' });
    assert.throws(() => model.duplicateEvent(other.id,{ ...input,_rev:other._rev,requestId:'duplicate-'+category+'-123456' }),/Nur Termine/);
  }
  assert.throws(() => model.duplicateEvent(imported.id,{ ...input,sourceKind:'notes' }),/Terminquelle/);
  assert.equal(store.all('events').length,1);
});
test('Duplizieren prüft Quelle, Revision, Datum und Zielkalender ohne Teilkopien', t => {
  const { model, store } = fixture(t), source = model.save('events', '', { title: 'Original', startDate: '2026-10-16', allDay: true });
  const input = { startDate: '2026-10-17', _rev: source._rev, requestId: 'duplicate-invalid-123456' };
  assert.throws(() => model.duplicateEvent('missing', input), { status: 404 });
  for (const extra of [{ startDate: '2026-02-30' }, { requestId: '../bad' }, { googleAccountId: 'missing', calendarId: 'missing' }, { calendarId: 'missing' }]) assert.throws(() => model.duplicateEvent(source.id, { ...input, ...extra }), { status: 400 });
  model.save('events', source.id, { ...source, title: 'Geändert' });
  assert.throws(() => model.duplicateEvent(source.id, input), { status: 409 }); assert.equal(store.all('events').length, 1);
});
test('Google erhält eine unabhängige Kopie; Wiederholungskennung bleibt nach Abgleich und Bearbeitung erhalten', async t => {
  const { model, store } = fixture(t), calendar = { id: 'primary', title: 'Familie', selected: true, accessRole: 'owner' };
  store.db.prepare('INSERT INTO google_accounts VALUES (?,?,?,?)').run('account', 'test@example.com', store.encrypt({ access_token: 'test', expires_at: Date.now() + 3600000 }), JSON.stringify({ calendars: [calendar] }));
  const account = store.publicAccounts()[0], google = new GoogleSync(store, model, {}), calls = [];
  google.request = async (_, path, options) => { calls.push({ path, method: options.method, payload: JSON.parse(options.body) }); return {}; };
  const created = model.save('events', '', { title: 'Google', startDate: '2026-10-16', allDay: true, googleAccountId: account.id, calendarId: calendar.id });
  await google.pushOutbox(); const source = store.get('events', created.id); calls.length = 0;
  const input = { startDate: '2026-10-18', _rev: source._rev, requestId: 'duplicate-google-123456', googleAccountId: account.id, calendarId: calendar.id };
  const copy = model.duplicateEvent(source.id, input); assert.equal(copy.googleEventId, ''); assert.equal(store.state().pendingSync.length, 1);
  await google.pushOutbox(); assert.equal(calls.length, 1); assert.equal(calls[0].method, 'POST');
  const current = store.get('events', copy.id); assert.notEqual(current.googleEventId, source.googleEventId);
  assert.ok(!JSON.stringify(calls[0].payload).includes('duplicateRequest'));
  const incoming = google.fromRemote(account, calendar, { ...calls[0].payload, id: current.googleEventId, summary: 'Extern geändert' });
  assert.deepEqual(incoming.duplicateRequest, copy.duplicateRequest); store.put('events', incoming.id, incoming);
  assert.equal(model.duplicateEvent(source.id, input).title, 'Extern geändert'); assert.equal(store.all('events').length, 2); assert.equal(store.state().pendingSync.length, 0);
  assert.deepEqual(store.get('events', source.id), source);
});
test('HTTP: Duplizieren ist geschützt, revisionsgeprüft, wiederholbar und auf beiden Geräten sichtbar', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'family-duplicate-http-')), app = createApp({ DATA_DIR: directory });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => app.server.close(resolve)); app.store.close(); rmSync(directory, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${app.server.address().port}`, request = (path, data, cookie = '', headers = {}) => fetch(base + '/api' + path, { method: data ? 'POST' : 'GET', headers: { 'X-Family-Request': '1', 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers }, ...(data ? { body: JSON.stringify(data) } : {}) });
  assert.equal((await request('/events/missing/duplicate', {})).status, 401);
  const setup = await request('/setup', { password: 'duplicate-password-fixture', names: ['Anna'] }), cookie = setup.headers.get('set-cookie').split(';')[0];
  const login = await request('/login', { password: 'duplicate-password-fixture' }), other = login.headers.get('set-cookie').split(';')[0];
  const source = await (await request('/records/events', { title: 'Termin', startDate: '2026-10-16', startTime: '09:00', endTime: '10:00' }, cookie)).json();
  const input = { startDate: '2026-10-18', _rev: source._rev, requestId: 'duplicate-http-123456' }, path = `/events/${source.id}/duplicate`;
  assert.equal((await request(path, input, cookie, { Origin: 'https://foreign.example' })).status, 403);
  assert.equal((await request(path, { ...input, _rev: -1 }, cookie)).status, 409);
  assert.equal((await request(path, { ...input, startDate: 'bad' }, cookie)).status, 400);
  const response = await request(path, input, cookie); assert.equal(response.status, 201); const copy = await response.json();
  const repeated = await (await request(path, input, other)).json(); assert.equal(repeated.id, copy.id);
  const state = await (await request('/state', null, other)).json(); assert.equal(state.events.length, 2);
  assert.equal(state.events.find(event => event.id === copy.id).startDate, '2026-10-18'); assert.deepEqual(state.events.find(event => event.id === source.id), source);
  assert.equal((await request(path, { ...input, startDate: '2026-10-19' }, cookie)).status, 409);
});
