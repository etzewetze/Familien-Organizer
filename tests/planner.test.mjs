import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.mjs';
import { Model } from '../src/model.mjs';
import { eventMembers, eventWindow, layoutTimedEvents, parsePlannerDrag } from '../public/planner.js';

function fixture(t) {
  const path = mkdtempSync(join(tmpdir(), 'family-planner-')), store = new Store(path), model = new Model(store);
  const anna = model.save('members', '', { name: 'Anna', color: '#ff8800' }), ben = model.save('members', '', { name: 'Ben', color: '#3388ff' });
  t.after(() => { store.close(); rmSync(path, { recursive: true, force: true }); });
  return { store, model, anna, ben };
}
test('Zeitraster streckt Termine nach Dauer, trennt Überlappungen und blendet feste Zeiten 15 Minuten aus', () => {
  const a = { id: 'a', startDate: '2026-10-05', endDate: '2026-10-05', startTime: '07:00', endTime: '08:00' };
  const b = { ...a, id: 'b', endTime: '09:00' }, point = { ...a, id: 'c', startOnly: true, startTime: '16:00', endTime: '' };
  const layout = layoutTimedEvents([b, point, a], a.startDate);
  assert.equal(layout.find(e => e.event.id === 'b').end - layout.find(e => e.event.id === 'b').start, 120);
  assert.equal(layout.find(e => e.event.id === 'a').end - layout.find(e => e.event.id === 'a').start, 60);
  assert.equal(layout.find(e => e.event.id === 'a').columns, 2);
  assert.notEqual(layout.find(e => e.event.id === 'a').column, layout.find(e => e.event.id === 'b').column);
  assert.equal(layout.find(e => e.event.id === 'c').columns, 1); assert.equal(layout.find(e => e.event.id === 'c').end, 975);
  assert.equal(eventWindow({ ...a, startTime: '23:55', startOnly: true }, a.startDate).end, 1440);
  assert.equal(eventWindow({ ...a, allDay: true }, a.startDate), null);
  assert.equal(eventWindow({ ...a, endDate: '2026-10-06', endTime: '01:00' }, '2026-10-06').start, 0);
  assert.equal(layoutTimedEvents([a, { ...a, id: 'next', startTime: '08:00', endTime: '09:00' }], a.startDate).every(e => e.columns === 1), true);
});
test('Termine unterstützen Alle, mehrere Personen und eine Startzeit ohne Ende; alte Zuordnungen bleiben lesbar', t => {
  const { model, anna, ben } = fixture(t);
  const event = model.save('events', '', { title: 'Fitness', startDate: '2026-10-05', startTime: '07:00', startOnly: true, memberIds: [anna.id, ben.id, anna.id] });
  assert.deepEqual(event.memberIds, [anna.id, ben.id]); assert.equal(event.endTime, ''); assert.equal(event.endDate, event.startDate);
  assert.deepEqual(eventMembers({ memberId: anna.id }), [anna.id]);
  assert.deepEqual(model.save('events', '', { title: 'Alle', startDate: '2026-10-05', allDay: true, memberIds: [] }).memberIds, []);
  assert.throws(() => model.save('events', '', { ...event, memberIds: ['missing'] }), /Familienmitglied/);
  assert.throws(() => model.save('events', '', { ...event, endDate: '2026-10-06' }), /Terminende/);
  assert.throws(() => model.save('events', event.id, { ...event, startTime: '24:00' }), /Uhrzeit/);
});
test('Aufgabenverteilung prüft Revisionen und Erledigungen; verdiente Punkte bleiben bei der ursprünglichen Person', t => {
  const { store, model, anna, ben } = fixture(t);
  const task = model.save('tasks', '', { title: 'Spülmaschine', points: 5, repeat: 'daily', startDate: '2026-10-05' });
  const assigned = model.assignTask(task.id, { memberId: anna.id, _rev: task._rev, date: '2026-10-05' });
  assert.throws(() => model.assignTask(task.id, { memberId: ben.id, _rev: task._rev, date: '2026-10-05' }), { status: 409 });
  model.complete(task.id, { date: '2026-10-05', done: true }, '2026-10-05');
  assert.throws(() => model.assignTask(task.id, { memberId: ben.id, _rev: assigned._rev, date: '2026-10-05' }), /Erledigte Aufgaben/);
  model.assignTask(task.id, { memberId: ben.id, _rev: assigned._rev, date: '2026-10-06' });
  assert.equal(store.balance(anna.id).available, 5); assert.equal(store.balance(ben.id).available, 0);
  assert.throws(() => model.save('tasks', '', { title: 'Bild', imageFile: '../master.key' }), /Aufgabenbild/);
});
test('Drei Mahlzeiten sind unabhängig, alte Pläne bleiben Abendbrot und alle Zutaten gehen in die Einkaufsliste', t => {
  const { store, model } = fixture(t), date = '2026-10-05';
  const recipe = model.save('recipes', '', { title: 'Müsli', servings: 1, ingredients: [{ name: 'Hafer', quantity: 100, unit: 'g' }] });
  store.put('meals', date, { date, recipeId: recipe.id, servings: 2 });
  model.save('meals', '', { date, slot: 'breakfast', recipeId: recipe.id, servings: 1 });
  model.save('meals', '', { date, slot: 'lunch', recipeId: recipe.id, servings: 3 });
  assert.equal(store.all('meals').length, 3);
  assert.throws(() => model.save('meals', '', { date, slot: 'dinner', recipeId: recipe.id }), { status: 409 });
  const old = store.get('meals', date); const updated = model.save('meals', date, { ...old, slot: 'dinner', servings: 4 }); assert.equal(updated.id, date);
  assert.throws(() => model.save('meals', date, { ...updated, slot: 'breakfast' }), { status: 409 });
  model.generateShopping(date); model.generateShopping(date);
  assert.equal(store.all('items').find(i => i.title === 'Hafer').quantity, 800);
  assert.throws(() => model.save('meals', '', { date: '2026-10-06', slot: 'snack', recipeId: recipe.id }), /Frühstück/);
});
test('Manuelle Punkte sind idempotente Buchungen mit Begründung und können als Belohnung eingelöst werden', t => {
  const { model, store, anna } = fixture(t), data = { memberId: anna.id, points: 20, reason: 'Besonders geholfen', requestId: '0123456789abcdef' };
  model.awardPoints(data); model.awardPoints(data); assert.equal(store.balance(anna.id).available, 20);
  assert.equal(store.state().pointAwards.length, 1);
  assert.throws(() => model.awardPoints({ ...data, points: 30 }), { status: 409 });
  assert.throws(() => model.delete('pointAwards', data.requestId, store.get('pointAwards', data.requestId)._rev), { status: 403 });
  const reward = model.save('rewards', '', { title: 'Kino', cost: 15 }); model.redeem(reward.id, anna.id, 'abcdef0123456789');
  assert.equal(store.balance(anna.id).available, 5);
});
test('Drag-Daten erlauben nur Aufgaben und Rezepte mit gültiger Kennung und Revision', () => {
  assert.deepEqual(parsePlannerDrag('{"kind":"task","id":"abc-123","rev":5}'), { kind: 'task', id: 'abc-123', rev: 5 });
  for (const data of ['garbage', '{"kind":"shell","id":"a","rev":1}', '{"kind":"recipe","id":"../a","rev":1}', '{"kind":"task","id":"a","rev":"2"}']) assert.equal(parsePlannerDrag(data), null);
});
