import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server.mjs';
import { VERSION } from '../public/releases.js';
import { weatherLocation } from '../src/weather.mjs';

async function fixture(t, services = {}, version = VERSION) {
  const directory = mkdtempSync(join(tmpdir(), 'family-session-')); let app, base;
  const open = async nextVersion => {
    app = createApp({ DATA_DIR: directory }, { updater: { status: async () => ({ supported: false }) }, ...services, version: nextVersion || version });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${app.server.address().port}`;
  };
  const close = async () => { if (app) { await new Promise(resolve => app.server.close(resolve)); app.store.close(); app = null; } };
  await open();
  t.after(async () => { await close(); rmSync(directory, { recursive: true, force: true }); });
  const request = (path, cookie = '', method = 'GET', data) => fetch(base + '/api' + path, { method, headers: { Cookie: cookie, 'X-Family-Request': '1', 'Content-Type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}) });
  const cookieOf = response => response.headers.get('set-cookie').split(';')[0];
  const setup = async () => cookieOf(await request('/setup', '', 'POST', { password: 'family-session-fixture', names: ['Anna'], familyName: 'Behalten' }));
  const login = async () => cookieOf(await request('/login', '', 'POST', { password: 'family-session-fixture' }));
  return { request, setup, login, open, close, get app() { return app; } };
}
test('Ein Versionswechsel meldet alle Geräte ab, behält Daten und Passwort und bietet die Änderungsübersicht nach Login', async t => {
  const f = await fixture(t, {}, '0.5.1'), cookie = await f.setup(), device2 = await f.login();
  await f.request('/records/notes', cookie, 'POST', { title: 'Wichtig', body: 'Behalten' });
  f.app.store.db.prepare('INSERT INTO oauth_states VALUES (?,?,?)').run('fixture', 'session', Date.now() + 60000);
  await f.close(); await f.open('0.6.0');
  for (const old of [cookie, device2]) {
    const response = await f.request('/state', old); assert.equal(response.status, 401); const result = await response.json(); assert.equal(result.code, 'SESSION_EXPIRED'); assert.equal(result.version, '0.6.0'); assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  }
  assert.equal(f.app.store.db.prepare('SELECT count(*) AS n FROM oauth_states').get().n, 0);
  assert.equal((await f.request('/changelog')).status, 401);
  const newCookie = await f.login(), state = await (await f.request('/state', newCookie)).json(); assert.equal(state.notes[0].body, 'Behalten'); assert.equal(state.settings.familyName, 'Behalten');
  const changelog = await (await f.request('/changelog', newCookie)).json(); assert.equal(changelog.previousVersion, '0.5.1'); assert.equal(changelog.version, '0.6.0'); assert.equal(changelog.releases[0].version, '0.6.0'); assert.ok(changelog.releases[0].changes.length >= 4);
  await f.close(); await f.open('0.6.0'); assert.equal((await f.request('/state', newCookie)).status, 200);
});
test('Upgrade einer älteren Datenbank ohne Versionsmarker beendet vorhandene Sitzungen', async t => {
  const f = await fixture(t), cookie = await f.setup();
  f.app.store.db.prepare("DELETE FROM meta WHERE key='appVersion'").run();
  await f.close(); await f.open(); assert.equal((await f.request('/state', cookie)).status, 401);
  assert.equal((await f.request('/state', await f.login())).status, 200);
});
test('Erfolgreiches Update gleicher Version beendet Sitzungen genau einmal, ein fehlgeschlagenes Update nicht', async t => {
  let clock = Date.now(), update = { supported: true, phase: 'idle' };
  const f = await fixture(t, { now: () => clock, updater: { status: async () => update } }), cookie = await f.setup();
  update = { supported: true, phase: 'failed', installedVersion: VERSION, finishedAt: '2026-10-09T12:00:00Z' }; clock += 5000;
  assert.equal((await f.request('/state', cookie)).status, 200);
  update = { ...update, phase: 'success' }; clock += 5000;
  assert.equal((await f.request('/state', cookie)).status, 401);
  const fresh = await f.login(), changelog = await (await f.request('/changelog', fresh)).json(); assert.match(changelog.changeId, /2026-10-09T12:00:00Z/);
  clock += 5000; assert.equal((await f.request('/state', fresh)).status, 200);
  await f.close(); await f.open(); assert.equal((await f.request('/state', fresh)).status, 200);
  update = { ...update, finishedAt: '2026-10-09T13:00:00Z' }; clock += 5000;
  assert.equal((await f.request('/updates/status', fresh)).status, 401);
});
test('Wetterorte und Vorhersagen sind angemeldet, revisionsgeschützt und vom übrigen Familienzustand getrennt', async t => {
  const berlin = weatherLocation({ name: 'Berlin', latitude: 52.52, longitude: 13.4, timezone: 'Europe/Berlin' }), calls = [];
  const f = await fixture(t, { weather: { search: async query => { calls.push(query); return [berlin]; }, forecast: async place => ({ location: place, current: { temperature_2m: 20 }, daily: [] }) } });
  assert.equal((await f.request('/weather/search?q=Berlin')).status, 401); assert.equal((await f.request('/weather/forecast?location=' + berlin.id)).status, 401); assert.equal(calls.length, 0);
  const cookie = await f.setup(), state = await (await f.request('/state', cookie)).json();
  assert.equal((await f.request('/weather/search?q=Berlin', cookie)).status, 200); assert.deepEqual(calls, ['Berlin']);
  const data = { _revision: state.revision, locations: [berlin], primaryId: berlin.id };
  assert.equal((await f.request('/weather/locations', cookie, 'PUT', data)).status, 200);
  assert.equal((await f.request('/weather/locations', cookie, 'PUT', data)).status, 409);
  const next = await (await f.request('/state', cookie)).json(); assert.deepEqual(next.weather.locations, [berlin]); assert.equal(next.settings.familyName, 'Behalten'); assert.deepEqual(next.members, state.members);
  assert.equal((await f.request('/weather/forecast?location=' + berlin.id, cookie)).status, 200);
  assert.equal((await f.request('/weather/forecast?location=https://127.0.0.1', cookie)).status, 404);
  assert.equal((await f.request('/weather/locations', cookie, 'PUT', { ...data, _revision: next.revision, locations: [{ ...berlin, latitude: 99 }] })).status, 400);
});
