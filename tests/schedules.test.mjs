import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.mjs';
import { Model } from '../src/model.mjs';
import { defaultPeriods, scheduleWindows, yearMonths, navigationOrder, matchTaskTemplates } from '../public/schedules.js';
import { parsePlannerDrag } from '../public/planner.js';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'family-schedules-')), store = new Store(directory), model = new Model(store);
  const anna = model.save('members', '', { name: 'Anna', color: '#ff8800' }), ben = model.save('members', '', { name: 'Ben', color: '#3388ff' });
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  const school = { title: 'Schule', type: 'school', memberId: anna.id, periodCount: 6, periods: defaultPeriods(), showInCalendar: true, entries: [{ weekday: 1, period: 1, title: 'Mathe' }, { weekday: 1, period: 6, title: 'Sport' }] };
  return { directory, store, model, anna, ben, school };
}
test('Stundenpläne speichern 6/8/10/12 Stunden, Freistunden und frei wählbare Uhrzeiten ohne normale Termine', t => {
  const { model, store, school } = fixture(t);
  for (const count of [6, 8, 10, 12]) {
    const plan = model.save('schedules', '', { ...school, periodCount: count, periods: defaultPeriods(count) });
    assert.equal(plan.periods.length, count); assert.equal(plan.entries.length, 2);
  }
  const plan = store.all('schedules')[0], monday = '2026-10-12';
  const [interval] = scheduleWindows([plan], monday);
  assert.equal(interval.startTime, '08:00'); assert.equal(interval.endTime, '13:00');
  assert.deepEqual(scheduleWindows([plan], '2026-10-13'), []);
  assert.deepEqual(scheduleWindows([plan], '2026-10-17'), []); assert.equal(store.all('events').length, 0);
});
test('Kitapläne erlauben lange Tage, getrennte Kinderspuren, Gültigkeit und zuschaltbare Anzeige', t => {
  const { model, anna, ben, school } = fixture(t);
  const kita = model.save('schedules', '', { title: 'Kita', type: 'kita', memberId: ben.id, showInCalendar: true, validFrom: '2026-10-01', validUntil: '2026-10-31', entries: [{ weekday: 1, startTime: '07:15', endTime: '16:45' }] });
  const plan = model.save('schedules', '', school), windows = scheduleWindows([plan, kita], '2026-10-12');
  assert.equal(windows.length, 2); assert.equal(windows[1].end - windows[1].start, 570);
  assert.equal(scheduleWindows([plan, kita], '2026-10-12', { memberId: anna.id }).length, 1);
  assert.equal(scheduleWindows([plan, kita], '2026-10-12', { selected: { [plan.id]: false } })[0].id, kita.id);
  assert.equal(scheduleWindows([kita], '2026-11-02').length, 0);
  assert.equal(scheduleWindows([{ ...kita, showInCalendar: false }], '2026-10-12').length, 0);
});
test('Ungültige Pläne und konkurrierende Änderungen werden vor dem Speichern abgelehnt', t => {
  const { model, school } = fixture(t);
  for (const data of [
    { ...school, memberId: 'unknown' }, { ...school, periodCount: 7 }, { ...school, periods: [] },
    { ...school, periods: defaultPeriods().map((period, index) => index === 1 ? { startTime: '08:00', endTime: '09:00' } : period) },
    { ...school, entries: [{ weekday: 6, period: 1, title: 'Test' }] },
    { ...school, entries: [{ weekday: 1, period: 12, title: 'Test' }] },
    { ...school, entries: [school.entries[0], school.entries[0]] },
    { ...school, validFrom: '2026-11-01', validUntil: '2026-10-01' },
    { ...school, type: 'kita', entries: [{ weekday: 1, startTime: '16:00', endTime: '07:00' }] },
    { ...school, type: 'kita', entries: [{ weekday: 1, startTime: '24:00', endTime: '25:00' }] },
  ]) assert.throws(() => model.save('schedules', '', data));
  const plan = model.save('schedules', '', school);
  model.save('schedules', plan.id, { ...plan, title: 'Neu' });
  assert.throws(() => model.save('schedules', plan.id, plan), { status: 409 });
  assert.throws(() => model.delete('schedules', plan.id, plan._rev), { status: 409 });
});
test('Nummerierte Aufgabenvorlagen sind eindeutig und verteilen unabhängige idempotente Momentaufnahmen', t => {
  const { model, store, anna, ben } = fixture(t), date = '2026-10-12';
  let template = model.save('taskTemplates', '', { title: 'Zimmer aufräumen', code: 20, points: 5, emoji: '🧹' });
  assert.throws(() => model.save('taskTemplates', '', { title: 'Nummer doppelt', code: '020' }), { status: 409 });
  for (const code of ['abc', -1, 0, 1.5]) assert.throws(() => model.save('taskTemplates', '', { title: 'Ungültig', code }));
  const request = { memberId: anna.id, date, _rev: template._rev, requestId: '0123456789abcdef' };
  const first = model.assignTemplate(template.id, request), repeated = model.assignTemplate(template.id, request);
  assert.equal(first.id, repeated.id); assert.equal(store.all('tasks').length, 1);
  assert.throws(() => model.assignTemplate(template.id, { ...request, memberId: ben.id }), { status: 409 });
  const second = model.assignTemplate(template.id, { ...request, memberId: ben.id, requestId: 'abcdef0123456789' });
  template = model.save('taskTemplates', template.id, { ...template, title: 'Neue Vorlage', points: 15 });
  assert.equal(store.get('tasks', first.id).title, 'Zimmer aufräumen'); assert.equal(store.get('tasks', second.id).points, 5);
  assert.throws(() => model.assignTemplate(template.id, { ...request, requestId: 'different12345678' }), { status: 409 });
  model.complete(first.id, { date, done: true }, date); model.complete(first.id, { date, done: true }, date);
  assert.equal(store.balance(anna.id).available, 5); assert.equal(store.balance(ben.id).available, 0);
  model.complete(first.id, { date, done: false }, date); assert.equal(store.balance(anna.id).available, 0);
  model.complete(first.id, { date, done: true }, date); model.delete('tasks', first.id, first._rev);
  assert.equal(store.balance(anna.id).available, 5); assert.equal(store.all('taskTemplates').length, 1);
  model.delete('taskTemplates', template.id, template._rev); assert.ok(store.get('tasks', second.id));
});
test('Alte Aufgaben werden einmalig als deduplizierte Vorlagen übernommen; historische Erledigungen bleiben', t => {
  const { model, store, directory, anna } = fixture(t);
  const task = model.save('tasks', '', { title: 'Aufräumen', points: 4, memberId: anna.id });
  model.save('tasks', '', { title: 'Aufräumen', points: 4 });
  model.complete(task.id, { date: '2026-10-12', done: true }, '2026-10-12');
  store.db.prepare("DELETE FROM meta WHERE key='taskTemplateMigration'").run();
  const upgraded = new Store(directory);
  assert.equal(upgraded.all('tasks').length, 2); assert.equal(upgraded.all('taskTemplates').length, 1);
  assert.equal(upgraded.balance(anna.id).available, 4); const revision = upgraded.meta('revision'); upgraded.close();
  const again = new Store(directory); assert.equal(again.meta('revision'), revision); assert.equal(again.all('taskTemplates').length, 1); again.close();
});
test('Jahresansicht ist schaltjahrfest und Nummernsuche findet exakt 20; Navigation übersteht neue Reiter', () => {
  const leap = yearMonths(2028), normal = yearMonths(2026);
  assert.equal(leap.length, 12); assert.equal(leap[1].dates.length, 29); assert.equal(normal[1].dates.length, 28);
  assert.equal(normal[0].offset, 3); assert.equal(normal.at(-1).dates.at(-1), '2026-12-31');
  const templates = [{ title: 'Küche', code: 20 }, { title: 'Zimmer', code: 200 }, { title: 'Bad', code: null }];
  assert.deepEqual(matchTaskTemplates(templates, '020'), [templates[0]]);
  assert.deepEqual(matchTaskTemplates(templates, 'KÜ'), [templates[0]]); assert.equal(matchTaskTemplates(templates, 'xyz').length, 0);
  assert.deepEqual(navigationOrder(['tasks','tasks','unknown'], ['home','calendar','tasks','schedules']), ['tasks','home','calendar','schedules']);
  assert.deepEqual(parsePlannerDrag('{"kind":"template","id":"one","rev":2}'), { kind: 'template', id: 'one', rev: 2 });
});
