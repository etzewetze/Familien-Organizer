import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.mjs';
import { Model, taskDue } from '../src/model.mjs';
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'family-test-'));
  const store = new Store(directory), model = new Model(store);
  store.setMeta('settings', { timezone: 'Europe/Berlin' });
  const member = model.save('members', '', { name: 'Kind', color: '#6366f1', role: 'child' });
  store.put('lists', 'shopping', { title: 'Einkaufsliste' });
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  return { store, model, member };
}
test('Erledigung ist idempotent und vergibt täglich exakt einmal Punkte', t => {
  const { store, model, member } = fixture(t);
  const task = model.save('tasks', '', { title: 'Aufräumen', memberId: member.id, points: 10, repeat: 'daily', startDate: '2026-10-05' });
  model.complete(task.id, { date: '2026-10-05', done: true }, '2026-10-06');
  model.complete(task.id, { date: '2026-10-05', done: true }, '2026-10-06');
  assert.equal(store.balance(member.id).available, 10);
  model.complete(task.id, { date: '2026-10-06', done: true }, '2026-10-06');
  assert.equal(store.balance(member.id).available, 20);
  model.complete(task.id, { date: '2026-10-05', done: false }, '2026-10-06');
  assert.equal(store.balance(member.id).available, 10);
  assert.throws(() => model.complete(task.id, { date: '2026-10-07', done: true }, '2026-10-06'), /erst am jeweiligen Tag/);
});
test('Einmalige Aufgabe zählt unabhängig vom angezeigten Tag nur einmal', t => {
  const { store, model, member } = fixture(t);
  const task = model.save('tasks', '', { title: 'Bücher', memberId: member.id, points: 5, repeat: 'none', startDate: '2026-10-01' });
  model.complete(task.id, { date: '2026-10-05', done: true }, '2026-10-06');
  model.complete(task.id, { date: '2026-10-06', done: true }, '2026-10-06');
  assert.equal(store.balance(member.id).earned, 5);
  model.delete('tasks', task.id, task._rev);
  assert.equal(store.balance(member.id).earned, 5);
});
test('Belohnungen verhindern doppelte Buchungen, Überziehung und unzulässiges Rücknehmen', t => {
  const { store, model, member } = fixture(t);
  const task = model.save('tasks', '', { title: 'Test', memberId: member.id, points: 10, repeat: 'none' });
  model.complete(task.id, { date: '2026-10-05', done: true }, '2026-10-05');
  const reward = model.save('rewards', '', { title: 'Eis', cost: 10 });
  const key = '12345678901234567890';
  model.redeem(reward.id, member.id, key); model.redeem(reward.id, member.id, key);
  assert.equal(store.balance(member.id).available, 0);
  assert.equal(store.state().redemptions.length, 1);
  assert.throws(() => model.redeem(reward.id, member.id, 'abcdefghijklmnopqrst'), /fehlen noch Punkte/);
  assert.throws(() => model.complete(task.id, { date: '2026-10-05', done: false }, '2026-10-05'), /bereits eingelöst/);
  assert.equal(store.balance(member.id).earned, 10);
});
test('Gleichzeitige Geräteänderungen werden als Konflikt erkannt', t => {
  const { model } = fixture(t);
  const note = model.save('notes', '', { title: 'Info', body: 'Erste Version' });
  const next = model.save('notes', note.id, { ...note, body: 'Zweite Version' });
  assert.throws(() => model.save('notes', note.id, { ...note, body: 'Veralteter Stand' }), { status: 409 });
  assert.throws(() => model.delete('notes', note.id, note._rev), { status: 409 });
  assert.equal(next.body, 'Zweite Version');
});
test('Zutaten werden skaliert, zusammengeführt und bei erneutem Übernehmen nicht verdoppelt', t => {
  const { store, model } = fixture(t);
  const recipe = model.save('recipes', '', { title: 'Pasta', servings: 4, ingredients: [{ name: 'Nudeln', quantity: 500, unit: 'g' }, { name: 'Salz', quantity: 1, unit: 'TL' }] });
  model.save('meals', '', { date: '2026-10-05', recipeId: recipe.id, servings: 2 });
  model.save('meals', '', { date: '2026-10-06', recipeId: recipe.id, servings: 4 });
  model.generateShopping('2026-10-05'); model.generateShopping('2026-10-05');
  const items = store.all('items'); assert.equal(items.length, 2); assert.equal(items.find(i => i.title === 'Nudeln').quantity, 750);
  assert.throws(() => model.delete('recipes', recipe.id, recipe._rev), /noch im Essensplan/);
  assert.throws(() => model.save('meals', '', { date: '2026-10-05', recipeId: recipe.id }), { status: 409 });
  const meal = store.get('meals', '2026-10-06'); model.delete('meals', meal.id, meal._rev); model.generateShopping('2026-10-05');
  assert.equal(store.all('items').find(i => i.title === 'Nudeln').quantity, 250);
});
test('Routine folgt Startdatum, Wochentagen und wöchentlichem Rhythmus', () => {
  assert.equal(taskDue({ repeat: 'weekdays', startDate: '2026-10-05' }, '2026-10-04'), false);
  assert.equal(taskDue({ repeat: 'weekdays', startDate: '2026-10-05' }, '2026-10-10'), false);
  assert.equal(taskDue({ repeat: 'weekly', startDate: '2026-10-05' }, '2026-10-12'), true);
  assert.equal(taskDue({ repeat: 'weekly', startDate: '2026-10-05' }, '2026-10-13'), false);
});
test('Zugangsgeheimnisse werden verschlüsselt und nicht im Familienexport ausgegeben', t => {
  const { store } = fixture(t);
  const secret = store.encrypt('a-private-key'); assert.equal(store.decrypt(secret), 'a-private-key'); assert.ok(!secret.includes('a-private-key'));
  store.setMeta('immichSecret', secret); store.setMeta('password', { salt: 'salt', hash: 'hash' });
  const exported = JSON.stringify(store.state()); assert.ok(!exported.includes('a-private-key')); assert.ok(!exported.includes(secret)); assert.equal(store.state().immichConfigured, true);
});
test('Fehlerhafte Eingaben und fremde Referenzen werden abgelehnt', t => {
  const { model } = fixture(t);
  assert.throws(() => model.save('events', '', { title: 'Falsch', startDate: '2026-02-30' }), /Datum/);
  assert.throws(() => model.save('tasks', '', { title: 'Falsch', memberId: 'missing', points: -1 }), /Familienmitglied/);
  assert.throws(() => model.save('rewards', '', { title: 'Falsch', cost: 0 }), /Zahl/);
  assert.throws(() => model.save('recipes', '', { title: 'Falsch', ingredients: [], sourceUrl: 'javascript:alert(1)' }), /HTTP/);
});

test('Rezeptbilder bleiben bei älteren Formularen erhalten, sind entfernbar und akzeptieren keine fremden Pfade', t => {
  const { model, store } = fixture(t), imageFile = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png';
  const recipe = model.save('recipes', '', { title: 'Pasta', servings: 4, minutes: 0, ingredients: [], imageFile });
  assert.equal(recipe.imageFile, imageFile); assert.equal(recipe.minutes, 0);
  const { imageFile: omitted, ...oldForm } = recipe;
  const updated = model.save('recipes', recipe.id, { ...oldForm, title: 'Pasta mit Bild' });
  assert.equal(updated.imageFile, imageFile); assert.equal(store.state().recipes[0].imageFile, imageFile);
  assert.throws(() => model.save('recipes', recipe.id, { ...recipe, imageFile: '' }), { status: 409 });
  for (const imageFile of ['../master.key', 'https://fremd.example/bild.jpg', 'bild.svg', 'data:image/png;base64,test']) {
    assert.throws(() => model.save('recipes', recipe.id, { ...updated, imageFile }), /Rezeptbild/);
  }
  assert.equal(model.save('recipes', recipe.id, { ...updated, imageFile: '' }).imageFile, '');
  assert.equal(model.save('recipes', '', { title: 'Altes Rezept', ingredients: [] }).imageFile, '');
});
