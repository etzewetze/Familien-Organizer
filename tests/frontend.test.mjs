import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import vm from 'node:vm';
import { Store } from '../src/store.mjs';
import { seed } from '../src/seed.mjs';

// Ausführung der Ansichtslogik ohne echten Browser. Ersetzt keine visuelle QA.
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'family-ui-')), store = new Store(directory);
  store.setMeta('settings', { familyName: 'Familie Test', timezone: 'Europe/Berlin', photoInterval: 15, photoFit: 'contain', remoteManifestUrl: '', immichUrl: '' });
  seed(store, ['Anna', 'Ben', 'Mia', 'Leo'], true, store.state().serverDate);
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { innerHTML: '', open: false, dataset: {}, classList: { add() {}, toggle() {} }, addEventListener() {}, querySelector: s => element(s), showModal() { this.open = true; }, close() { this.open = false; } });
    return elements.get(id);
  };
  const context = vm.createContext({
    document: { querySelector: s => element(s), querySelectorAll: () => [], addEventListener() {}, activeElement: null },
    location: { hash: '#home' }, localStorage: { getItem: () => null }, innerWidth: 1440,
    addEventListener() {}, setInterval() {}, setTimeout() {}, clearInterval() {},
    Intl, Date, console, initialState: store.state(),
  });
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8').replace('void boot();', '');
  vm.runInContext(source + '\nS=initialState; status={googleConfigured:false}; cursor=S.serverDate;', context);
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  return { context, elements, run: source => vm.runInContext(source, context) };
}
test('Alle acht Ansichten und Kalenderdarstellungen erzeugen HTML ohne Laufzeitfehler', t => {
  const { run } = fixture(t);
  for (const view of ['homePage', 'calendarPage', 'tasksPage', 'mealsPage', 'listsPage', 'notesPage', 'photosPage', 'settingsPage']) {
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
  for (const kind of ['events', 'tasks', 'recipes', 'lists', 'items', 'notes', 'rewards', 'members']) { run(`editRecord('${kind}')`); assert.ok(elements.get('#editor').innerHTML.includes('record-form')); }
  run("filter=S.members[0].id;const familyEvent=S.events.find(e=>!e.memberId);editRecord('events',familyEvent.id)");
  assert.ok(elements.get('#editor').innerHTML.includes('value="" selected>Für alle'));
});
