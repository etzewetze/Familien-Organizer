import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import vm from 'node:vm';
import { Store } from '../src/store.mjs';
import { seed } from '../src/seed.mjs';
import { birthdaysOnDate, nextBirthday } from '../public/birthdays.js';
import { eventMembers, layoutTimedEvents, mealSlots, parsePlannerDrag, timeScale, hourScale } from '../public/planner.js';
import { appearanceDefaults, appearanceFor, eventColor, calendarColumns, isImageFile, themeProperties } from '../public/appearance.js';

// Ausführung der Ansichtslogik ohne echten Browser. Ersetzt keine visuelle QA.
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'family-ui-')), store = new Store(directory);
  store.setMeta('settings', { familyName: 'Familie Test', timezone: 'Europe/Berlin', photoInterval: 15, photoFit: 'contain', remoteManifestUrl: '', immichUrl: '' });
  seed(store, ['Anna', 'Ben', 'Mia', 'Leo'], true, store.state().serverDate);
  const elements = new Map(), listeners = new Map(), styleValues = new Map(), stored = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { innerHTML: '', open: false, dataset: {}, classList: { add() {}, toggle() {} }, append() {}, remove() {}, addEventListener() {}, querySelector: s => element(s), showModal() { this.open = true; }, close() { this.open = false; } });
    return elements.get(id);
  };
  const context = vm.createContext({
    document: { querySelector: s => element(s), querySelectorAll: () => [], createElement: s => element(s), addEventListener(name, handler) { const list = listeners.get(name) || []; list.push(handler); listeners.set(name, list); }, documentElement: { style: { setProperty: (key, value) => styleValues.set(key, value) } }, activeElement: null },
    location: { hash: '#home' }, localStorage: { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) }, innerWidth: 1440,
    addEventListener() {}, setInterval() {}, setTimeout() {}, clearInterval() {},
    Intl, Date, console, URL, birthdaysOnDate, nextBirthday, eventMembers, layoutTimedEvents, mealSlots, parsePlannerDrag, timeScale, hourScale, appearanceDefaults, appearanceFor, eventColor, calendarColumns, isImageFile, themeProperties, initialState: store.state(),
    FormData: class { constructor(form) { this.fields = form.fields; } get(key) { return this.fields[key] ?? null; } getAll(key) { return [].concat(this.fields[key] || []); } *[Symbol.iterator]() { for (const [key, value] of Object.entries(this.fields)) for (const item of [].concat(value)) yield [key, item]; } },
  });
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8').replace(/^import [^\n]+\n/gm, '').replace('void boot();', '');
  vm.runInContext(source + '\nS=initialState; status={googleConfigured:false}; cursor=S.serverDate;', context);
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  return { context, elements, listeners, styleValues, stored, run: source => vm.runInContext(source, context) };
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
  assert.ok(elements.get('#editor').innerHTML.includes('event-edit-form'));
  assert.ok(!elements.get('#editor').innerHTML.includes('wizard-progress'));
});

test('Geburtstage erscheinen in allen Kalenderansichten und öffnen den Geburtstagseintrag', t => {
  const { run, elements } = fixture(t);
  run("S.serverDate='2026-10-07';cursor=S.serverDate;S.birthdays=[{id:'birthday-one',_rev:1,name:'Anna <b>Test</b>',month:10,day:7,birthYear:1990,memberId:'',leapDay:'mar1',notes:'Kuchen'}]");
  for (const mode of ['week', 'month', 'agenda']) {
    const html = run(`calendarMode='${mode}';calendarPage()`);
    assert.ok(html.includes('🎂 Anna &lt;b&gt;Test&lt;/b&gt;')); assert.ok(html.includes('36 Jahre'));
    assert.ok(html.includes('data-edit="birthdays" data-id="birthday-one"')); assert.ok(!html.includes('data-id="birthday-birthday-one-2026"'));
  }
  assert.ok(run('homePage()').includes('🎂 Anna &lt;b&gt;Test&lt;/b&gt; · 36 Jahre'));
  run('S.birthdays[0].birthYear=null');
  for (const mode of ['week', 'month', 'agenda']) { const html = run(`calendarMode='${mode}';calendarPage()`); assert.ok(html.includes('🎂 Anna &lt;b&gt;Test&lt;/b&gt;')); assert.ok(!html.includes('36 Jahre')); }
  run('S.birthdays[0].birthYear=1990');
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
  assert.ok(html.includes('record-form')); assert.ok(html.includes('200 | g | Nudeln | Vorrat')); assert.ok(html.includes('Rezeptimport · Vorschau')); assert.ok(html.includes('&lt;script&gt;Test&lt;/script&gt;')); assert.ok(!html.includes('<img src=x onerror=alert(1)>')); assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
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
  const grid = elements.get('.time-scroll'); grid.dataset.week = '2026-10-05'; grid.dataset.hourHeights = elements.get('#app').innerHTML.match(/data-hour-heights="([^"]+)"/)[1]; grid.scrollTop = 240; grid.scrollLeft = 210;
  run('render()'); assert.equal(grid.scrollTop, 240); assert.equal(grid.scrollLeft, 210);
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

test('Profile zeigen private Bilder mit Initialen als Rückfall; zusätzliche Personenleisten entfallen', t => {
  const { run, styleValues } = fixture(t);
  run("S.members[0].avatarImage='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png';S.settings.headerColor='#112233';S.settings.allColor='#dd7700';render()");
  const header = run('headerMembers()'); assert.ok(header.includes('/api/images/ui?file=aaaaaaaa')); assert.ok(header.includes('data-profile-image')); assert.ok(header.includes('--person:#dd7700'));
  for (const view of ['homePage', 'birthdaysPage', 'tasksPage']) { const html = run(`${view}()`); assert.ok(!html.includes('family-filters')); assert.ok(!html.includes('task-tabs')); }
  assert.equal(styleValues.get('--header'), '#112233'); assert.equal(styleValues.get('--header-ink'), '#ffffff');
  run("S.members[0].avatarImage='../master.key'"); assert.ok(!run('avatar(S.members[0].id)').includes('<img'));
  run("editRecord('members',S.members[0].id)"); assert.ok(run("editor.innerHTML").includes('member-image-input'));
});
test('Headerfilter steuert Aufgaben; Allgemein bleibt erreichbar und die Essensausrichtung wird gemerkt', async t => {
  const { run, listeners, stored } = fixture(t);
  const click = listeners.get('click')[0];
  run("route='tasks';render()");
  const target = { dataset: { filter: run('S.members[1].id') } };
  await click({ target: { closest: () => target } });
  assert.ok(run('tasksPage()').includes('single-column')); assert.ok(run('headerMembers()').includes('data-task-drop=')); assert.equal(run('taskBoard'), target.dataset.filter);
  target.dataset = { taskBoard: '' }; await click({ target: { closest: () => target } }); assert.equal(run('taskBoard'), ''); assert.equal(run('filter'), '');
  assert.ok(run('tasksPage()').includes('Allgemein'));
  run("route='meals';setMealLayout('vertical')"); assert.equal(stored.get('mealLayout'), 'vertical'); assert.ok(run('mealsPage()').includes('meal-plan vertical'));
  run("setMealLayout('horizontal')"); assert.ok(run('mealsPage()').includes('meal-plan horizontal')); assert.equal(stored.get('mealLayout'), 'horizontal');
});
test('Bestehender Termin zeigt alle Angaben und speichert Startzeit, Personen, eigene Farbe und Revision gemeinsam', async t => {
  const { context, run, elements } = fixture(t), calls = [];
  context.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => url === '/api/state' ? context.initialState : {} }; };
  run("editRecord('events',S.events[0].id)"); const html = elements.get('#editor').innerHTML;
  for (const name of ['title', 'description', 'location', 'startDate', 'endDate', 'startTime', 'endTime', 'event-person', 'eventColor']) assert.ok(html.includes(`name="${name}"`));
  assert.ok(html.includes('event-edit-form')); assert.ok(!html.includes('wizard-progress'));
  const revision = run('editing.old._rev');
  await run("saveEventEditor({fields:{'event-person':['all'],title:'Gemeinsam',description:'Details',location:'Adresse',startDate:S.serverDate,timeMode:'point',startTime:'16:00',eventColor:'#aabbcc'}})");
  const sent = JSON.parse(calls.find(call => call.url.startsWith('/api/records/events/')).options.body);
  assert.equal(sent._rev, revision); assert.equal(sent.startOnly, true); assert.equal(sent.endDate, sent.startDate); assert.equal(sent.endTime, ''); assert.deepEqual(sent.memberIds, []); assert.equal(sent.color, '#aabbcc'); assert.equal(sent.location, 'Adresse');
});
test('Profilbild-Upload ist vor der Personenspeicherung abgeschlossen und wird als Referenz gespeichert', async t => {
  const { context, run, elements } = fixture(t), calls = [], image = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png';
  context.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => url === '/api/state' ? context.initialState : { imageFile: image } }; };
  run("editRecord('members',S.members[0].id)");
  elements.set('#member-image-input', { files: [{ size: 20, type: 'image/png' }] });
  await run("saveEditor({fields:{name:'Anna',color:'#123456',role:'adult'}})");
  assert.equal(calls[0].url, '/api/images/ui'); assert.equal(calls[0].options.headers['X-Family-Request'], '1');
  assert.equal(JSON.parse(calls[1].options.body).avatarImage, image); assert.ok(calls[1].url.startsWith('/api/records/members/'));
});

test('Darstellung speichern lädt das Hintergrundbild zuerst und erhält die Einstellungenrevision', async t => {
  const { context, run, elements } = fixture(t), calls = [], image = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png';
  context.fetch = async (url, options) => { calls.push({url,options}); return {ok:true,json:async()=>url==='/api/state'?context.initialState:{imageFile:image}}; };
  run("route='settings';render()"); elements.set('#background-image-input',{files:[{size:20,type:'image/png'}]});
  const revision = run('S.revision');
  await run("saveAppearance({fields:{headerColor:'#224466',calendarHourSize:'52',calendarAutoWidth:'on'},dataset:{revision:S.revision}}, {})");
  const writes = calls.filter(call => call.options.method !== 'GET');
  assert.equal(writes[0].url,'/api/images/ui'); assert.equal(writes[1].url,'/api/settings');
  const sent = JSON.parse(writes[1].options.body); assert.equal(sent.backgroundImage,image); assert.equal(sent.headerColor,'#224466'); assert.equal(sent._revision,revision); assert.equal(sent.calendarHourSize,52); assert.equal(sent.calendarAutoWidth,true);
});

test('Rezeptauswahl zeigt sichere Bildkarten und wählt beim Bearbeiten das geplante Rezept vor', async t => {
  const { run, elements, context, listeners } = fixture(t), calls = [];
  context.fetch = async (url, options) => { calls.push({ url, options }); return { ok:true,json:async()=>url==='/api/state'?context.initialState:{} }; };
  run("S.recipes[1].imageFile='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png';S.recipes[1].title='Pasta <script>Test</script>';S.meals=[{id:'planned',_rev:9,date:S.serverDate,slot:'lunch',recipeId:S.recipes[1].id,servings:3}];openMeal(S.serverDate,'lunch')");
  const html = elements.get('#editor').innerHTML, id = run('S.recipes[1].id');
  assert.ok(html.includes('recipe-picker')); assert.ok(html.includes('type="radio"')); assert.ok(!html.includes('<select'));
  assert.ok(html.includes(`value="${id}" checked`)); assert.equal((html.match(/ checked/g)||[]).length,1);
  assert.ok(html.includes('/api/images/ui?file=aaaaaaaa')); assert.ok(html.includes('Pasta &lt;script&gt;Test&lt;/script&gt;')); assert.ok(!html.includes('<script>')); assert.ok(html.includes('Kein Bild'));
  for(const view of ['mealsPage()','viewRecipe(S.recipes[1].id);editor.innerHTML']) assert.ok(run(view).includes('/api/images/ui?file=aaaaaaaa'));
  run("openMeal(S.serverDate,'lunch')");
  await listeners.get('submit')[0]({target:{id:'meal-form',fields:{recipeId:id,servings:'5'},querySelector:()=>({disabled:false})},preventDefault(){}});
  const sent=JSON.parse(calls.find(c=>c.url==='/api/records/meals/planned').options.body);
  assert.equal(sent.recipeId,id); assert.equal(sent.servings,'5'); assert.equal(sent.slot,'lunch'); assert.equal(sent._rev,9); assert.equal(sent.date,run('S.serverDate'));
  run("S.recipes[0].imageFile='https://fremd.example/bild.jpg'"); assert.ok(!run('recipePicture(S.recipes[0])').includes('<img'));
});

test('Rezeptbilder bleiben aus der Importvorschau erhalten; Upload und Entfernen speichern die passende Referenz', async t => {
  const { run, elements, context } = fixture(t), calls = [], imageFile = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png';
  context.fetch = async (url, options) => { calls.push({url,options});return {ok:true,json:async()=>url==='/api/state'?context.initialState:{imageFile}}; };
  const fields = { title:'Pasta',servings:'4',minutes:'20',category:'Hauptgericht',ingredientsText:'400 | g | Nudeln | Vorrat',instructions:'Kochen',sourceUrl:'' };
  context.recipeFields=fields;
  run(`editRecord('recipes','',{imageFile:'${imageFile}',_imported:true})`);
  assert.ok(elements.get('#editor').innerHTML.includes('/api/images/ui?file=aaaaaaaa'));
  await run('saveEditor({fields:recipeFields})');
  assert.equal(calls[0].url,'/api/records/recipes'); assert.equal(JSON.parse(calls[0].options.body).imageFile,imageFile);
  calls.length=0;
  run("editRecord('recipes',S.recipes[0].id)"); const revision=run('editing.old._rev');
  elements.set('#recipe-image-input',{files:[{size:20,type:'image/png'}]});
  await run('saveEditor({fields:recipeFields})');
  assert.equal(calls[0].url,'/api/images/ui'); assert.equal(calls[0].options.headers['X-Family-Request'],'1'); assert.ok(calls[1].url.startsWith('/api/records/recipes/'));
  assert.equal(JSON.parse(calls[1].options.body).imageFile,imageFile); assert.equal(JSON.parse(calls[1].options.body)._rev,revision);
  calls.length=0;
  run("editRecord('recipes',S.recipes[0].id)");
  await run("saveEditor({fields:{...recipeFields,removeRecipeImage:'on'}})");
  assert.ok(calls[0].url.startsWith('/api/records/recipes/')); assert.equal(JSON.parse(calls[0].options.body).imageFile,'');
});

test('Rezeptbild-Vorschau lässt sich entfernen und fehlende Bilder zeigen den Platzhalter', async t => {
  const { run, context, elements, listeners }=fixture(t);
  context.imageFile=new Blob(['Eigenes Testbild'],{type:'image/png'});
  run("editRecord('recipes','',{imageFile:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png'})");
  run("previewRecipeImage({id:'recipe-image-input',files:[imageFile]})");
  assert.ok(elements.get('#recipe-image-preview').src.startsWith('blob:')); assert.equal(elements.get('#recipe-image-preview').hidden,false);
  elements.get('[name=removeRecipeImage]').checked=true;run("previewRecipeImage({name:'removeRecipeImage'})");assert.equal(elements.get('#recipe-image-preview').hidden,true);
  run("editRecord('notes')");assert.equal(run('recipePreviewUrl'),'');
  const image={hidden:false,matches:selector=>selector.includes('[data-recipe-image]')};
  listeners.get('error')[0]({target:image});assert.equal(image.hidden,true);
});

test('Ein abgeschlossener Rezeptbild-Upload überschreibt keinen inzwischen gewechselten Dialog', async t => {
  const { context, run, elements }=fixture(t), calls=[];let release;
  context.fetch=(url,options)=>{calls.push({url,options});return new Promise(resolve=>{release=resolve;});};
  run("editRecord('recipes')");elements.set('#recipe-image-input',{files:[{size:20,type:'image/png'}]});
  const saving=run("saveEditor({fields:{title:'Pasta',servings:'4',minutes:'20',ingredientsText:'400 | g | Nudeln'}})");
  run("editRecord('notes')");const nextDialog=elements.get('#editor').innerHTML;
  release({ok:true,json:async()=>({imageFile:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png'})});await saving;
  assert.equal(calls.length,1);assert.equal(calls[0].url,'/api/images/ui');assert.equal(elements.get('#editor').innerHTML,nextDialog);
});
