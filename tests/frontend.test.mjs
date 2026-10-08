import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import vm from 'node:vm';
import { Store } from '../src/store.mjs';
import { seed } from '../src/seed.mjs';
import { birthdaysOnDate, nextBirthday } from '../public/birthdays.js';
import { eventMembers, layoutTimedEvents, mealSlots, parsePlannerDrag } from '../public/planner.js';

// Ausführung der Ansichtslogik ohne echten Browser. Ersetzt keine visuelle QA.
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'family-ui-')), store = new Store(directory);
  store.setMeta('settings', { familyName: 'Familie Test', timezone: 'Europe/Berlin', photoInterval: 15, photoFit: 'contain', remoteManifestUrl: '', immichUrl: '' });
  seed(store, ['Anna', 'Ben', 'Mia', 'Leo'], true, store.state().serverDate);
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { innerHTML: '', open: false, dataset: {}, classList: { add() {}, toggle() {} }, append() {}, remove() {}, addEventListener() {}, querySelector: s => element(s), showModal() { this.open = true; }, close() { this.open = false; } });
    return elements.get(id);
  };
  const context = vm.createContext({
    document: { querySelector: s => element(s), querySelectorAll: () => [], createElement: s => element(s), addEventListener() {}, activeElement: null },
    location: { hash: '#home' }, localStorage: { getItem: () => null }, innerWidth: 1440,
    addEventListener() {}, setInterval() {}, setTimeout() {}, clearInterval() {},
    Intl, Date, console, birthdaysOnDate, nextBirthday, eventMembers, layoutTimedEvents, mealSlots, parsePlannerDrag, initialState: store.state(),
    FormData: class { constructor(form) { this.fields = form.fields; } get(key) { return this.fields[key] ?? null; } getAll(key) { return [].concat(this.fields[key] || []); } },
  });
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8').replace(/^import [^\n]+\n/gm, '').replace('void boot();', '');
  vm.runInContext(source + '\nS=initialState; status={googleConfigured:false}; cursor=S.serverDate;', context);
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  return { context, elements, run: source => vm.runInContext(source, context) };
}
test('Alle zehn Ansichten und Kalenderdarstellungen erzeugen HTML ohne Laufzeitfehler', t => {
  const { run } = fixture(t);
  for (const view of ['homePage', 'calendarPage', 'birthdaysPage', 'tasksPage', 'rewardsPage', 'mealsPage', 'listsPage', 'notesPage', 'photosPage', 'settingsPage']) {
    const html = run(`${view}()`); assert.ok(html.includes('page-head')); assert.ok(!html.includes('undefined')); assert.ok(!html.includes('NaN'));
  }
  for (const mode of ['week', 'month', 'agenda']) { const html = run(`calendarMode='${mode}';calendarPage()`); assert.ok(html.length > 500); }
  assert.doesNotThrow(() => run('render()'));
});
test('Gespeicherte Texte werden in Hauptansichten und Dialogen sicher maskiert', t => {
  const { run, elements } = fixture(t);
  run("S.notes=[{id:'test',title:'<img src=x onerror=alert(1)>',body:'<script>alert(1)</script>',pinned:true}]");
  const html = run('notesPage()'); assert.ok(!html.includes('<script>')); assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('&lt;img'));
  run("editRecord('notes','test')"); assert.ok(!elements.get('#editor').innerHTML.includes('<script>'));
});
test('Formulardialoge aller Bereiche sind verfügbar und unzugeordnete Termine bleiben für alle', t => {
  const { run, elements } = fixture(t);
  for (const kind of ['events', 'birthdays', 'tasks', 'recipes', 'lists', 'items', 'notes', 'rewards', 'members']) { run(`editRecord('${kind}')`); assert.ok(elements.get('#editor').innerHTML.includes(kind === 'events' ? 'event-wizard-form' : 'record-form')); }
  run("filter=S.members[0].id;const familyEvent=S.events.find(e=>!e.memberId);editRecord('events',familyEvent.id)");
  assert.ok(elements.get('#editor').innerHTML.includes('value="all" checked'));
});

test('Geburtstage erscheinen in allen Kalenderansichten und öffnen den Geburtstagseintrag', t => {
  const { run, elements } = fixture(t);
  run("S.serverDate='2026-10-07';cursor=S.serverDate;S.birthdays=[{id:'birthday-one',_rev:1,name:'Anna <b>Test</b>',month:10,day:7,birthYear:1990,memberId:'',leapDay:'mar1',notes:'Kuchen'}]");
  for (const mode of ['week', 'month', 'agenda']) {
    const html = run(`calendarMode='${mode}';calendarPage()`);
    assert.ok(html.includes('Anna &lt;b&gt;Test&lt;/b&gt;')); assert.ok(html.includes('36 Jahre'));
    assert.ok(html.includes('data-edit="birthdays" data-id="birthday-one"')); assert.ok(!html.includes('data-id="birthday-birthday-one-2026"'));
  }
  assert.ok(run('birthdaysPage()').includes('Heute!'));
  run("cursor='2030-10-07';calendarMode='week'"); assert.ok(run('calendarPage()').includes('40 Jahre'));
  run("editRecord('birthdays','birthday-one')"); assert.ok(elements.get('#editor').innerHTML.includes('value="1990"')); assert.ok(elements.get('#editor').innerHTML.includes('name="leapDay"'));
});
test('Rezeptimport öffnet eine maskierte editierbare Vorschau und überschreibt keinen neuen Dialog', async t => {
  const { context, run, elements } = fixture(t), requests = [];
  context.fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ recipe: { title: '<img src=x onerror=alert(1)>', servings: 2, minutes: 20, ingredients: [{ name: 'Nudeln', quantity: 200, unit: 'g', category: 'Vorrat' }], instructions: 'Kochen', sourceUrl: 'https://rezepte.example/pasta' }, warnings: ['<script>Test</script>'] }) };
  };
  run('openRecipeImport()'); assert.ok(elements.get('#editor').innerHTML.includes('recipe-import-form'));
  await run("loadRecipeImport('https://rezepte.example/pasta')");
  const html = elements.get('#editor').innerHTML;
  assert.ok(html.includes('record-form')); assert.ok(html.includes('200 | g | Nudeln | Vorrat')); assert.ok(html.includes('Rezeptimport · Vorschau')); assert.ok(html.includes('&lt;script&gt;Test&lt;/script&gt;')); assert.ok(!html.includes('<img'));
  assert.equal(requests.length, 1); assert.equal(requests[0].url, '/api/recipes/import');
  assert.equal(run('S.recipes.length'), 3);
  let release;
  context.fetch = () => new Promise(resolve => { release = resolve; });
  run('openRecipeImport()'); const loading = run("loadRecipeImport('https://rezepte.example/pasta')");
  run("editRecord('notes')"); const notesDialog = elements.get('#editor').innerHTML;
  release({ ok: true, json: async () => ({ recipe: { title: 'Pasta' }, warnings: [] }) }); await loading;
  assert.equal(elements.get('#editor').innerHTML, notesDialog);
});
test('Kalender zeigt ausgeschriebene Tage, vollständige Daten, Zeitraster und ausblendende Starttermine', t => {
  const { run, elements } = fixture(t);
  run("cursor='2026-10-05';calendarMode='week';S.events=[{id:'point',startDate:cursor,endDate:cursor,title:'Abholen',startTime:'16:00',endTime:'',startOnly:true,memberIds:[S.members[0].id,S.members[1].id]}]");
  const html = run('calendarPage()');
  assert.ok(html.includes('Montag')); assert.ok(html.includes('5. Oktober 2026')); assert.ok(html.includes('00:00')); assert.ok(html.includes('24:00'));
  assert.ok(html.includes('time-event start-only')); assert.ok(html.includes('16:00 Abholen')); assert.ok(html.includes('Anna, Ben'));
  const header = run('headerMembers()'); assert.ok(header.includes('header-person')); assert.ok(header.includes('Anna')); assert.ok(header.includes('--person:#'));
  run("route='calendar';render()");
  const grid = elements.get('.time-scroll'); grid.dataset.week = '2026-10-05'; grid.scrollTop = 1260; grid.scrollLeft = 210;
  run('render()'); assert.equal(grid.scrollTop, 1260); assert.equal(grid.scrollLeft, 210);
});
test('Terminassistent führt über Personen und Details zum Datum; Tages-Plus überspringt die Datumseingabe', t => {
  const { run, elements } = fixture(t);
  run("cursor='2026-10-05';editRecord('events')"); assert.ok(elements.get('#editor').innerHTML.includes('Für wen ist der Termin?')); assert.equal(run('editing.steps.length'), 4);
  run("collectEventStep({fields:{'event-person':[S.members[0].id,S.members[1].id]}});editing.index++;renderEventWizard()");
  assert.ok(elements.get('#editor').innerHTML.includes('Überschrift')); assert.ok(elements.get('#editor').innerHTML.includes('Adresse'));
  run("collectEventStep({fields:{title:'Fitness',description:'Trainieren',location:'Sportplatz'}});editing.index++;renderEventWizard()");
  assert.ok(elements.get('#editor').innerHTML.includes('An welchem Tag?'));
  run("collectEventStep({fields:{startDate:'2026-10-06'}});editing.index++;renderEventWizard()");
  assert.ok(elements.get('#editor').innerHTML.includes('6. Oktober 2026')); assert.ok(elements.get('#editor').innerHTML.includes('Feste Zeit ohne Ende'));
  run("collectEventStep({fields:{timeMode:'point',startTime:'16:00',googleTarget:''}})");
  assert.equal(run('editing.draft.startOnly'), true); assert.equal(run('editing.draft.endTime'), ''); assert.equal(run('editing.draft.memberIds.length'), 2);
  run("editRecord('events','',{startDate:'2026-10-07',fixedDate:true});editing.index=2;renderEventWizard()");
  assert.equal(run('editing.steps.length'), 3); assert.ok(elements.get('#editor').innerHTML.includes('7. Oktober 2026')); assert.ok(!elements.get('#editor').innerHTML.includes('An welchem Tag?'));
});
test('Aufgaben zeigen alle Personen und Allgemein; drei Mahlzeiten sind Drop-Ziele und Belohnungen eigenständig', t => {
  const { run } = fixture(t), tasks = run('tasksPage()'), meals = run('mealsPage()');
  for (const name of ['Anna', 'Ben', 'Mia', 'Leo', 'Allgemein']) assert.ok(tasks.includes(name));
  assert.ok(tasks.includes('data-task-drop=""')); assert.ok(tasks.includes('Punkte')); assert.ok(tasks.includes('draggable="true"'));
  for (const slot of ['breakfast', 'lunch', 'dinner']) assert.equal(meals.split(`data-meal-slot="${slot}"`).length - 1, 7);
  assert.ok(run('navigation()').includes('Belohnungen')); assert.ok(run('rewardsPage()').includes('Punkte vergeben'));
  assert.ok(run('settingsPage()').includes('Elternpasswort')); assert.ok(run('settingsPage()').includes('software-update-button'));
});
test('Drag-and-drop sendet die ursprüngliche Aufgabenrevision und plant das Rezept im ausgewählten Mahlzeiten-Slot', async t => {
  const { run, context } = fixture(t), calls = [];
  context.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => url === '/api/state' ? context.initialState : {} }; };
  await run("applyPlannerDrop({kind:'task',id:S.tasks[0].id,rev:S.tasks[0]._rev},{dataset:{taskDrop:S.members[1].id}})");
  const assigned = calls.find(c => c.url.includes('/assign')); assert.ok(assigned); assert.equal(JSON.parse(assigned.options.body).memberId, context.initialState.members[1].id);
  calls.length = 0;
  await run("applyPlannerDrop({kind:'recipe',id:S.recipes[0].id,rev:S.recipes[0]._rev},{dataset:{mealDate:S.serverDate,mealSlot:'breakfast'}})");
  const planned = calls.find(c => c.url === '/api/records/meals'); assert.ok(planned); assert.equal(JSON.parse(planned.options.body).slot, 'breakfast');
  calls.length = 0;
  await run("applyPlannerDrop({kind:'recipe',id:S.recipes[0].id,rev:-1},{dataset:{mealDate:S.serverDate,mealSlot:'lunch'}})");
  assert.equal(calls.length, 0);
});
