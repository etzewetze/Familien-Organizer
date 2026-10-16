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
import { appearanceDefaults, appearanceFor, eventProperties, calendarColumns, isImageFile, themeProperties } from '../public/appearance.js';
import { VERSION } from '../public/releases.js';
import { emojis, emojiCategories, findEmojis, isEmoji } from '../public/symbols.js';
import { weatherCode, weatherValue, weatherTime, rainOutlook } from '../public/weather.js';
import { deviceConfig, idleAction } from '../public/device-mode.js';
import { schoolDays, periodCounts, defaultPeriods, scheduleWindows, yearMonths, matchTaskTemplates, navigationOrder } from '../public/schedules.js';
import { calendarCategories, calendarOptionDefaults, isDayOffCategory, germanStates, planCaption, calendarEntriesOnDate } from '../public/calendar-data.js';

// Ausführung der Ansichtslogik ohne echten Browser. Ersetzt keine visuelle QA.
function fixture(t, preferences = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'family-ui-')), store = new Store(directory);
  store.setMeta('settings', { familyName: 'Familie Test', timezone: 'Europe/Berlin', photoInterval: 15, photoFit: 'contain', remoteManifestUrl: '', immichUrl: '' });
  seed(store, ['Anna', 'Ben', 'Mia', 'Leo'], true, store.state().serverDate);
  const elements = new Map(), listeners = new Map(), styleValues = new Map(), stored = new Map(Object.entries(preferences));
  const element = id => {
    if (!elements.has(id)) elements.set(id, { innerHTML: '', open: false, dataset: {}, classList: { add() {}, toggle() {} }, append() {}, remove() {}, addEventListener() {}, setAttribute() {}, querySelector: s => element(s), querySelectorAll: () => [], showModal() { this.open = true; }, close() { this.open = false; } });
    return elements.get(id);
  };
  const context = vm.createContext({
    document: { querySelector: s => element(s), querySelectorAll: () => [], createElement: s => element(s), addEventListener(name, handler) { const list = listeners.get(name) || []; list.push(handler); listeners.set(name, list); }, documentElement: { style: { setProperty: (key, value) => styleValues.set(key, value) } }, activeElement: null },
    location: { hash: '#home' }, localStorage: { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) }, innerWidth: 1440, innerHeight: 900,
    addEventListener() {}, setInterval() {}, setTimeout() {}, clearInterval() {},
    Intl, Date, console, URL, birthdaysOnDate, nextBirthday, eventMembers, layoutTimedEvents, mealSlots, parsePlannerDrag, timeScale, hourScale, appearanceDefaults, appearanceFor, eventProperties, calendarColumns, isImageFile, themeProperties, initialState: store.state(),
    calendarCategories, calendarOptionDefaults, isDayOffCategory, germanStates, planCaption, calendarEntriesOnDate, schoolDays, periodCounts, defaultPeriods, scheduleWindows, yearMonths, matchTaskTemplates, navigationOrder, structuredClone, crypto, clearTimeout, requestAnimationFrame() {},
    VERSION, emojis, emojiCategories, findEmojis, isEmoji, weatherCode, weatherValue, weatherTime, rainOutlook, deviceConfig, idleAction,
    FormData: class { constructor(form) { this.fields = form.fields; } get(key) { return this.fields[key] ?? null; } getAll(key) { return [].concat(this.fields[key] || []); } *[Symbol.iterator]() { for (const [key, value] of Object.entries(this.fields)) for (const item of [].concat(value)) yield [key, item]; } },
  });
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8').replace(/^import [^\n]+\n/gm, '').replace('void boot();', '');
  vm.runInContext(source + '\nS=initialState; status={googleConfigured:false}; cursor=S.serverDate;', context);
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  return { context, elements, listeners, styleValues, stored, run: source => vm.runInContext(source, context) };
}
test('Alle zehn Ansichten und Kalenderdarstellungen erzeugen HTML ohne Laufzeitfehler', t => {
  const { run } = fixture(t);
  for (const view of ['calendarDataPage', 'schedulesPage', 'homePage', 'calendarPage', 'birthdaysPage', 'tasksPage', 'rewardsPage', 'mealsPage', 'listsPage', 'notesPage', 'photosPage', 'settingsPage']) {
    const html = run(`${view}()`); assert.ok(html.includes('page-head')); assert.ok(!html.includes('undefined')); assert.ok(!html.includes('NaN'));
  }
  for (const mode of ['week', 'month', 'year', 'agenda']) { const html = run(`calendarMode='${mode}';calendarPage()`); assert.ok(html.length > 500); }
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
test('Monat bündelt Geburtstage und Feiertage, hält ihre Bearbeitung erreichbar und lässt Termine stehen', async t => {
  const { run,elements,listeners } = fixture(t), click = listeners.get('click')[0];
  run(`cursor='2026-10-07';S.serverDate=cursor;S.events=[{id:'appointment',title:'Arzt',allDay:false,startDate:cursor,endDate:cursor,startTime:'10:00',endTime:'11:00',memberIds:[]}];
    S.birthdays=[{id:'b1',name:'Anna <script>',day:7,month:10,birthYear:1990},{id:'b2',name:'Ben',day:7,month:10,birthYear:1992}];
    S.calendarEntries=[{id:'h1',category:'holiday',title:'Feiertag <b>',startDate:cursor,endDate:cursor,allDay:true},{id:'h2',category:'holiday',title:'Zweiter Feiertag',startDate:cursor,endDate:cursor,allDay:true}];`);
  const html = run('monthCell(cursor)');
  assert.ok(html.includes('holiday-day')); assert.ok(html.includes('🎂 2 Geburtstage')); assert.ok(html.includes('🎉 2 Feiertage'));
  assert.equal((html.match(/class="event-card /g) || []).length,1); assert.ok(html.includes('data-edit="events" data-id="appointment"'));
  assert.ok(html.includes('Anna &lt;script&gt;')); assert.ok(!html.includes('<script>')); assert.ok(!html.includes('birthday-event'));
  await click({ target:{ closest:() => ({ dataset:{ action:'day-details',dayKind:'birthday',date:'2026-10-07' } }) } });
  assert.ok(elements.get('#editor').innerHTML.includes('36 Jahre')); assert.ok(elements.get('#editor').innerHTML.includes('34 Jahre'));
  for (const id of ['b1','b2']) assert.ok(elements.get('#editor').innerHTML.includes(`data-edit="birthdays" data-id="${id}"`));
  await click({ target:{ closest:() => ({ dataset:{ edit:'birthdays',id:'b2' } }) } });
  assert.ok(elements.get('#editor').innerHTML.includes('value="Ben"'));
  run("showDayDetails('holiday',cursor)");
  assert.ok(elements.get('#editor').innerHTML.includes('Feiertag &lt;b&gt;')); assert.ok(elements.get('#editor').innerHTML.includes('data-edit="calendarEntries" data-id="h2"'));
  run("calendarMode='week'"); const week = run('calendarPage()');
  assert.ok(week.includes('birthday-event')); assert.ok(week.includes('data-edit="calendarEntries" data-id="h1"')); assert.ok(!week.includes('holiday-day'));
});
test('Feiertagsflächen in Monat und Jahr folgen Sichtbarkeit und Personenfilter; die Farbe ist einstellbar', t => {
  const { run,styleValues } = fixture(t);
  run(`cursor='2026-10-07';S.serverDate=cursor;S.events=[];S.birthdays=[];
    S.calendarEntries=[{id:'holiday',category:'holiday',title:'Familientag',memberId:S.members[0].id,startDate:cursor,endDate:cursor,allDay:true}];
    S.settings.holidayColor='#112233';applyAppearance(S.settings);`);
  assert.equal(styleValues.get('--holiday-color'),'#112233'); assert.equal(styleValues.get('--holiday-ink'),'#ffffff');
  assert.ok(run('appearanceSettingsPanel()').includes('name="holidayColor"'));
  assert.ok(run('monthCell(cursor)').includes('holiday-day'));
  const year = run('yearCalendar()');
  assert.match(year, /class="year-day today holiday-day" data-year-date="2026-10-07"/);
  const day = year.match(/<button[^>]+data-year-date="2026-10-07"[\s\S]*?<\/button>/)[0]; assert.ok(!day.includes('<i style='));
  run('filter=S.members[1].id'); assert.ok(!run('monthCell(cursor)').includes('holiday-day')); assert.ok(!run('yearCalendar()').includes('holiday-day'));
  run("filter='';S.calendarOptions.holiday=false"); assert.ok(!run('monthCell(cursor)').includes('holiday-day')); assert.ok(!run('yearCalendar()').includes('holiday-day'));
  run('S.calendarOptions.holiday=true;S.calendarEntries[0].enabled=false'); assert.ok(!run('monthCell(cursor)').includes('holiday-day'));
});
test('Arbeitstage stehen als Tageskennzeichnung außerhalb der Termine und beachten die Personenauswahl', t => {
  const { run } = fixture(t);
  run(`cursor='2026-10-16';S.events=[];S.birthdays=[];S.calendarEntries=[{id:'shift',category:'workday',title:'Nacht <b>',memberId:S.members[0].id,startDate:cursor,endDate:'2026-10-17',startTime:'22:00',endTime:'06:00',allDay:false,enabled:true}];`);
  assert.equal(run('visibleEvents(cursor).length'),0);
  for (const mode of ['week','month','agenda','year']) {
    const html = run(`calendarMode='${mode}';calendarPage()`);
    assert.ok(html.includes(mode === 'year' ? 'year-workday' : 'workday-marker')); assert.ok(html.includes('Nacht &lt;b&gt;')); assert.ok(html.includes('22:00–06:00 (+1 Tag)'));
    assert.ok(!html.includes('class="time-event ')); assert.ok(!html.includes('class="event-card '));
  }
  assert.ok(run('monthCell(cursor)').includes('data-edit="calendarEntries" data-id="shift"'));
  run('filter=S.members[1].id'); assert.ok(!run('monthCell(cursor)').includes('workday-marker'));
  run("filter='';S.calendarOptions.workday=false"); assert.ok(!run('monthCell(cursor)').includes('workday-marker')); assert.ok(!run('yearCalendar()').includes('year-workday'));
});
test('Dienstplan kann im Import gewählt und als zeitgebundener Arbeitstag bearbeitet werden', async t => {
  const { run,elements,context } = fixture(t), requests = [];
  run("openCalendarImport('ics')"); assert.ok(elements.get('#editor').innerHTML.includes('value="workday"')); assert.ok(elements.get('#editor').innerHTML.includes('Arbeitstage / Dienstplan'));
  run("editRecord('calendarEntries','',{category:'workday',allDay:false,startTime:'06:00',endTime:'14:00'})");
  elements.get('[name=category]').value='workday'; elements.get('[name=entryAllDay]').checked=false; elements.get('[name=entryStartOnly]').checked=false;
  run('updateCalendarEntryFields()');
  assert.equal(elements.get('[name=entryAllDay]').disabled,false); assert.equal(elements.get('[name=pauseSchedules]').disabled,true);
  assert.equal(elements.get('[name=startTime]').required,true); assert.equal(elements.get('[name=endTime]').required,true);
  context.fetch=async (url,options) => { requests.push({ url,options }); return { ok:true,json:async () => url === '/api/state' ? context.initialState : {} }; };
  context.form={ fields:{ title:'Frühdienst',category:'workday',memberId:run('S.members[0].id'),startDate:'2026-10-16',endDate:'2026-10-16',startTime:'06:00',endTime:'14:00',entryEnabled:'on',pauseSchedules:'on' } };
  await run('saveEditor(form)');
  const data=JSON.parse(requests.find(request => request.url === '/api/records/calendarEntries').options.body);
  assert.equal(data.allDay,false); assert.equal(data.pauseSchedules,false); assert.equal(data.startTime,'06:00'); assert.equal(data.category,'workday');
  elements.get('[name=category]').value='holiday'; run('updateCalendarEntryFields()');
  assert.equal(elements.get('[name=entryAllDay]').disabled,true); assert.equal(elements.get('[name=entryAllDay]').checked,true); assert.equal(elements.get('[name=pauseSchedules]').disabled,false);
});
test('Termin duplizieren bietet Datum und Zielkalender, auch bei einer schreibgeschützten Quelle', async t => {
  const { run,elements,listeners } = fixture(t), click = listeners.get('click')[0];
  run("S.events=[{id:'original',_rev:7,title:'Kopie <script>',startDate:'2026-10-16',endDate:'2026-10-17',startTime:'22:00',endTime:'06:00',memberIds:[]}];editRecord('events','original')");
  assert.ok(elements.get('#editor').innerHTML.includes('data-action="duplicate-event"'));
  await click({ target:{ closest:() => ({ dataset:{ action:'duplicate-event' } }) } });
  let html = elements.get('#editor').innerHTML;
  assert.ok(html.includes('event-duplicate-form')); assert.ok(html.includes('name="startDate" type="date" value="2026-10-17"'));
  assert.ok(html.includes('Kopie &lt;script&gt;')); assert.ok(!html.includes('<script>')); assert.ok(html.includes('22:00–06:00'));
  assert.ok(html.includes('Kalender für das Duplikat')); assert.equal(run('editing.old.startDate'),'2026-10-16');
  run("S.google=[{id:'account',email:'test@example.com',calendars:[{id:'writer',title:'Familie',selected:true,accessRole:'writer'},{id:'reader',title:'Nur lesen',selected:true,accessRole:'reader'}]}];S.events[0].googleAccountId='account';S.events[0].calendarId='writer';openEventEditor(S.events[0]);openEventDuplicate()");
  html = elements.get('#editor').innerHTML; assert.ok(html.includes('value="[&quot;account&quot;,&quot;writer&quot;]" selected')); assert.ok(!html.includes('Nur lesen'));
  run("S.events[0].googleReadOnly=true;S.events[0].calendarId='reader';openEventEditor(S.events[0]);openEventDuplicate()");
  html = elements.get('#editor').innerHTML; assert.ok(html.includes('value="" selected')); assert.ok(html.includes('Nur Familienkalender'));
});
test('Importierte Termine bieten Duplizieren und einen Rückweg zum ursprünglichen Kalenderformular', async t => {
  const { run,elements,listeners }=fixture(t), click=listeners.get('click')[0];
  run("S.calendarEntries=[{id:'import',_rev:3,title:'Aus ICS',category:'event',startDate:'2026-10-16',endDate:'2026-10-16',allDay:true}];editRecord('calendarEntries','import')");
  assert.ok(elements.get('#editor').innerHTML.includes('data-action="duplicate-event"'));
  await click({ target:{closest:() => ({dataset:{action:'duplicate-event'}})} }); assert.equal(run('editing.sourceKind'),'calendarEntries'); assert.ok(elements.get('#editor').innerHTML.includes('event-duplicate-form'));
  await click({ target:{closest:() => ({dataset:{action:'duplicate-event-back'}})} }); assert.ok(elements.get('#editor').innerHTML.includes('record-form')); assert.equal(run('editing.kind'),'calendarEntries');
  run("S.calendarEntries[0].category='holiday';editRecord('calendarEntries','import')"); assert.ok(!elements.get('#editor').innerHTML.includes('data-action="duplicate-event"'));
});
test('Duplizieren sendet Datum und Quellrevision, behält beim Wiederholen die Kennung und zeigt den neuen Tag', async t => {
  const { run,context,elements } = fixture(t), requests = []; let fail = true;
  run("editRecord('events',S.events[0].id);openEventDuplicate()");
  const sourceId = run('editing.old.id'), rev = run('editing.old._rev'), requestId = run('editing.requestId');
  context.fetch = async (url,options) => {
    if (url.endsWith('/duplicate')) { requests.push({ url,body:JSON.parse(options.body) }); if (fail) throw new Error('Netzfehler'); return { ok:true,json:async () => ({id:'copied',startDate:'2026-10-21'}) }; }
    return { ok:true,json:async () => context.initialState };
  };
  context.form = { fields:{ startDate:'2026-10-21',googleTarget:'' } };
  await assert.rejects(run('saveEventDuplicate(form)'),/nicht erreichbar/); assert.equal(elements.get('#editor').open,true); assert.equal(run('editing.requestId'),requestId);
  fail = false; await run('saveEventDuplicate(form)');
  assert.equal(requests.length,2); assert.deepEqual(requests[0],requests[1]);
  assert.equal(requests[0].url,`/api/events/${sourceId}/duplicate`); assert.equal(requests[0].body._rev,rev); assert.equal(requests[0].body.startDate,'2026-10-21'); assert.equal(requests[0].body.requestId,requestId);
  assert.equal(requests[0].body.googleAccountId,''); assert.equal(run('cursor'),'2026-10-21'); assert.equal(run('location.hash'),'calendar'); assert.equal(elements.get('#editor').open,false);
});
test('Eine verspätete Duplikatantwort schließt keinen inzwischen geöffneten Dialog', async t => {
  const { run,context,elements } = fixture(t); let finish;
  run("editRecord('events',S.events[0].id);openEventDuplicate()"); const before = run('cursor');
  context.fetch = async url => url.endsWith('/duplicate') ? new Promise(resolve => { finish = resolve; }) : { ok:true,json:async () => context.initialState };
  context.form = { fields:{ startDate:'2026-10-21',googleTarget:'' } };
  const pending = run('saveEventDuplicate(form)'); run("editRecord('notes')"); const note = elements.get('#editor').innerHTML;
  finish({ ok:true,json:async () => ({id:'copy',startDate:'2026-10-21'}) }); await pending;
  assert.equal(elements.get('#editor').innerHTML,note); assert.equal(elements.get('#editor').open,true); assert.equal(run('cursor'),before);
});
test('Einkaufsmodus hakt nur bei Doppeltipp ab, öffnet wieder und lässt Reihenfolge, Mengen und Kategorien bestehen', async t => {
  const { run,context,listeners,stored } = fixture(t), click = listeners.get('click')[0], requests = [];
  run("route='lists';activeList='shopping';S.items=[{id:'milk',_rev:1,title:'Milch <b>',listId:'shopping',category:'Kühlung',quantity:2,unit:'l',checked:false},{id:'yogurt',_rev:2,title:'Joghurt',listId:'shopping',category:'Kühlung',quantity:3,unit:'Becher',checked:false}]");
  assert.ok(run('listsPage()').includes('data-check-item="milk"')); assert.ok(!run('listsPage()').includes('data-shopping-item'));
  await click({ target:{ closest:() => ({ dataset:{ action:'shopping-mode' } }) } });
  assert.deepEqual(JSON.parse(stored.get('shoppingLists')),['shopping']); let html = run('listsPage()');
  assert.ok(html.includes('Doppeltippen zum Abhaken')); assert.ok(html.includes('Milch &lt;b&gt;')); assert.ok(!html.includes('data-check-item')); assert.ok(!html.includes('data-edit="items"')); assert.ok(html.includes('2 l')); assert.ok(html.includes('Kühlung'));
  context.fetch = async (url,options) => {
    if (url.startsWith('/api/records/items/')) { const payload=JSON.parse(options.body); requests.push(payload); const index=context.initialState.items.findIndex(item => item.id === payload.id); context.initialState.items[index]={ ...payload,_rev:payload._rev+1 }; }
    return { ok:true,json:async () => url === '/api/state' ? context.initialState : {} };
  };
  const tap = id => click({ detail:1,target:{ closest:() => ({ dataset:{ shoppingItem:id } }) } });
  await tap('milk'); assert.equal(requests.length,0); await tap('milk'); assert.equal(requests.length,1); assert.equal(requests[0].checked,true); assert.equal(requests[0]._rev,1);
  html = run('listsPage()'); assert.ok(html.includes('class="shopping-item done" data-shopping-item="milk"')); assert.ok(html.indexOf('data-shopping-item="milk"') < html.indexOf('data-shopping-item="yogurt"'));
  await tap('milk'); await tap('milk'); assert.equal(requests.length,2); assert.equal(requests[1].checked,false); assert.equal(requests[1]._rev,2);
  await tap('milk'); await tap('yogurt'); assert.equal(requests.length,2);
  run('lastShoppingTap.at=Date.now()-500'); await tap('yogurt'); assert.equal(requests.length,2); await tap('yogurt'); assert.equal(requests.length,3);
});
test('Einkaufsmodus wird pro Liste gemerkt; beschädigte lokale Einstellungen verhindern den Listenstart nicht', t => {
  const { run,stored } = fixture(t,{ shoppingLists:'["shopping"]' });
  assert.ok(run('listsPage()').includes('class="panel shopping-mode"'));
  run("S.lists.push({id:'custom',title:'Zweiter Einkauf'});activeList='custom'"); assert.ok(!run('listsPage()').includes('class="panel shopping-mode"'));
  run('toggleShoppingMode()'); assert.deepEqual(JSON.parse(stored.get('shoppingLists')),['shopping','custom']);
  run("activeList='shopping';toggleShoppingMode()"); assert.deepEqual(JSON.parse(stored.get('shoppingLists')),['custom']); assert.ok(run('listsPage()').includes('data-check-item='));
  const broken=fixture(t,{ shoppingLists:'kaputtes JSON' }); assert.ok(broken.run('listsPage()').includes('Listenmodus')); assert.ok(!broken.run('listsPage()').includes('data-shopping-item'));
});
test('Einkaufsmodus bleibt bei Schreibfehlern unverändert und erlaubt Tastaturbedienung ohne Doppeltipp', async t => {
  const { run,context,listeners } = fixture(t), click=listeners.get('click')[0], requests=[];
  run("S.items=[{id:'milk',_rev:1,title:'Milch',listId:'shopping',category:'Kühlung',quantity:1,unit:'l',checked:false}];shoppingLists.add('shopping')");
  context.tile={ dataset:{ shoppingItem:'milk' } }; let fail=true;
  context.fetch=async (url,options) => {
    if(url.includes('/records/items/')) { const payload=JSON.parse(options.body); requests.push(payload); if(fail) return { ok:false,status:409,json:async () => ({error:'Auf anderem Gerät geändert'}) }; context.initialState.items[0]={ ...payload,_rev:2 }; }
    return {ok:true,json:async () => url === '/api/state' ? context.initialState : {}};
  };
  await run('tapShoppingItem(tile)'); await run('tapShoppingItem(tile)'); assert.equal(requests.length,1); assert.equal(run('S.items[0].checked'),false); assert.equal(run('busy'),false);
  await run('tapShoppingItem(tile)'); assert.equal(requests.length,1);
  run('online=false'); await run('tapShoppingItem(tile,true)'); assert.equal(requests.length,1);
  run("online=true;activeList='other'"); await run('tapShoppingItem(tile,true)'); assert.equal(requests.length,1);
  run("activeList='shopping'"); fail=false;
  await click({ detail:0,target:{ closest:() => context.tile } }); assert.equal(requests.length,2); assert.equal(run('S.items[0].checked'),true);
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
  assert.ok(run('tasksPage()').includes('responsive-board')); assert.ok(run('headerMembers()').includes('data-task-drop=')); assert.equal(run('taskBoard'), target.dataset.filter);
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

test('Drei Personenfarben erscheinen gemeinsam in Übersicht, Woche, Monat und Liste, auch bei einem Starttermin', t => {
  const {run}=fixture(t);
  run("S.serverDate='2026-10-07';cursor=S.serverDate;S.members[0].color='#ff0000';S.members[1].color='#00ff00';S.members[2].color='#0000ff';S.events=[{id:'shared',title:'Gemeinsam',startDate:cursor,endDate:cursor,startTime:'07:00',endTime:'09:00',memberIds:S.members.slice(0,3).map(m=>m.id),allDay:false}]");
  const marker='--event-marker:linear-gradient(to bottom,#ff0000 0%,#00ff00 50%,#0000ff 100%)';
  for(const mode of ['week','month','agenda']) assert.ok(run(`calendarMode='${mode}';calendarPage()`).includes(marker));
  assert.ok(run('homePage()').includes(marker));
  run("S.events[0].allDay=true;calendarMode='week'"); assert.ok(run('calendarPage()').includes(marker));
  run("S.events[0].allDay=false;S.events[0].startOnly=true;S.events[0].endTime=''");
  const point=run('calendarPage()'); assert.ok(point.includes('time-event start-only')); assert.ok(point.includes(marker));
  assert.ok(point.includes('--event-background:linear-gradient(to bottom,#ffcccc 0%,#ccffcc 50%,#ccccff 100%)'));
  run('filter=S.members[1].id');assert.ok(run('calendarPage()').includes(marker));
  run("S.members[1].color='#ffff00'");assert.ok(run('calendarPage()').includes('#ffff00 50%'));
  run("filter='';S.events[0].memberIds=[S.members[0].id]");const single=run('calendarPage()');assert.ok(!single.includes('--event-marker:'));assert.ok(single.includes('--person:#ff0000'));
});
test('Terminsymbole erscheinen in allen Kalenderansichten; ohne Symbol wird kein Platzhalter erzeugt', t => {
  const { run } = fixture(t);
  run("S.events=[{id:'symbol',title:'Fitness',startDate:cursor,endDate:cursor,startTime:'10:00',endTime:'11:00',memberIds:[],emoji:'🏋️',imageFile:'12345678-1234-1234-1234-123456789012.png'}]");
  for (const mode of ['week', 'month', 'agenda']) {
    const html = run(`calendarMode='${mode}';calendarPage()`); assert.ok(html.includes('🏋️')); assert.ok(html.includes('data-record-image')); assert.ok(html.includes('/api/images/ui?file='));
  }
  assert.ok(run('homePage()').includes('🏋️'));
  assert.equal(run('recordSymbols({})'), ''); assert.equal(run("recordSymbols({emoji:'<img src=x>',imageFile:'../secret'})"), '');
  run("S.tasks[0].emoji='🧹'"); assert.ok(run('taskRow(S.tasks[0],cursor)').includes('🧹'));
  assert.ok(run("emojiField('🎂')").includes('Emoji auswählen')); assert.ok(run("emojiChoices('geburtstag')").includes('🎂')); assert.ok(!run("emojiChoices('<script>')").includes('<script>'));
});
test('Terminwizard behält Bild und Emoji beim Zurückgehen und lädt das Bild erst vor dem Speichern hoch', async t => {
  const { context, run, elements } = fixture(t), requests = [];
  context.symbolFile = Object.assign(new Blob(['png'], { type: 'image/png' }), { name: 'mein-bild.png' });
  context.fetch = async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => url === '/api/images/ui' ? { imageFile: '12345678-1234-1234-1234-123456789012.png' } : url === '/api/state' ? context.initialState : { ok: true } }; };
  run("editRecord('events','',{startDate:cursor,fixedDate:true})");
  await run("advanceEventWizard({fields:{'event-person':'all'}})");
  run("previewEventImage({id:'event-image-input',files:[symbolFile]})");
  await run("advanceEventWizard({fields:{title:'Fitness',description:'Sport',location:'Halle',emoji:'🏋️',useDefaultColor:'on'}})");
  assert.equal(requests.length, 0); assert.equal(run('editing.symbol.file === symbolFile'), true);
  run('editing.index--;renderEventWizard()'); assert.ok(elements.get('#editor').innerHTML.includes('mein-bild.png')); assert.ok(elements.get('#editor').innerHTML.includes('🏋️'));
  await run("advanceEventWizard({fields:{title:'Fitness',description:'Sport',location:'Halle',emoji:'🏋️',useDefaultColor:'on'}})");
  await run("advanceEventWizard({fields:{timeMode:'span',startTime:'10:00',endTime:'11:00',endDate:cursor}})");
  assert.deepEqual(requests.map(r => r.url), ['/api/images/ui', '/api/records/events', '/api/state']);
  const saved = JSON.parse(requests[1].options.body); assert.equal(saved.emoji, '🏋️'); assert.equal(saved.imageFile, '12345678-1234-1234-1234-123456789012.png'); assert.equal(saved.title, 'Fitness');
});
test('Ein verzögerter Terminsymbol-Upload speichert keinen inzwischen geschlossenen oder ersetzten Dialog', async t => {
  const { context, run } = fixture(t), requests = []; let release;
  context.symbolFile = new Blob(['png'], { type: 'image/png' });
  context.fetch = (url, options) => { requests.push({ url, options }); return new Promise(resolve => { release = resolve; }); };
  run("openEventEditor(S.events[0]);editing.symbol.file=symbolFile");
  const pending = run("saveEventEditor({fields:{'event-person':'all',title:'Familie',wizardAllDay:'on',startDate:cursor,endDate:cursor,useDefaultColor:'on',emoji:'🎉'}})");
  run("editRecord('notes')"); release({ ok: true, json: async () => ({ imageFile: '12345678-1234-1234-1234-123456789012.png' }) }); await pending;
  assert.equal(requests.length, 1); assert.equal(run('editing.kind'), 'notes');
});
test('Wetter bleibt ohne Menüeintrag erreichbar, maskiert Ortsnamen und zeigt alle 14 Tage mit fehlenden Werten', async t => {
  const { context, run, elements } = fixture(t);
  run("S.weather={locations:[{id:'berlin',name:'<img src=x>',region:'Berlin',country:'Deutschland'}],primaryId:'berlin'};weatherActiveId='berlin'");
  context.weatherFixture = { timezone: 'Europe/Berlin', fetchedAt: '2026-10-09T08:00:00Z', stale: false, current: { time: 1791532800, temperature_2m: 18, weather_code: 0, is_day: 1 }, hourly: [], daily: Array.from({ length: 14 }, (_, i) => ({ time: 1791496800 + i * 86400, weather_code: 2, temperature_2m_max: 20, temperature_2m_min: 10, sunrise: null, sunset: null, sunshine_duration: null, daylight_duration: null })) };
  context.fetch = async () => ({ ok: true, json: async () => context.weatherFixture });
  await run("loadWeather('berlin')");
  const html = run("route='weather';weatherPage()"); assert.equal((html.match(/panel weather-day/g) || []).length, 14); assert.ok(html.includes('&lt;img src=x&gt;')); assert.ok(!html.includes('<img src=x>')); assert.ok(!html.includes('NaN')); assert.ok(!html.includes('undefined')); assert.ok(html.includes('14-Tage-Vorhersage')); assert.ok(html.includes('Weitere Wetterdaten'));
  assert.ok(!run('navigation()').includes('data-nav="weather"')); assert.ok(run('weatherHeader()').includes('18 °C'));
  run('render()'); assert.ok(elements.get('#app').innerHTML.includes('id="weather-content"'));
});
test('Änderungsübersicht wird erst beim Schließen quittiert und kann später wieder geöffnet werden', async t => {
  const { context, run, elements, stored } = fixture(t);
  context.fetch = async () => ({ ok: true, json: async () => ({ version: '0.6.0', changeId: '0.6.0:fixture', releases: [{ version: '0.6.0', title: '<b>Neu</b>', date: '2026-10-09', changes: ['Wetter <script>'] }] }) });
  await run('showChangelog()'); assert.ok(elements.get('#editor').open); assert.ok(elements.get('#editor').innerHTML.includes('&lt;b&gt;Neu&lt;/b&gt;')); assert.equal(stored.has('lastChangelog'), false);
  run('acknowledgeChangelog();editor.close()'); assert.equal(stored.get('lastChangelog'), '0.6.0:fixture');
  await run('showChangelog()'); assert.equal(elements.get('#editor').open, false);
  await run('showChangelog(true)'); assert.equal(elements.get('#editor').open, true);
});
test('Update-Abmeldung entfernt private Dialoge und Anzeigezustand und stellt das Login dar', async t => {
  const { context, run, elements } = fixture(t);
  context.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: 'Bitte anmelden.', code: 'SESSION_EXPIRED', version: VERSION }) });
  run("editRecord('notes');photoItems=[{id:'private',url:'/api/photos/private'}];displayMode='photos';weatherCache.set('private',{data:{private:true}})");
  await assert.rejects(run("api('/state')"), /Bitte anmelden/);
  assert.equal(run('S'), null); assert.equal(elements.get('#editor').open, false); assert.equal(elements.get('#editor').innerHTML, ''); assert.equal(run('photoItems.length'), 0); assert.equal(run('weatherCache.size'), 0); assert.equal(run('displayMode'), 'active'); assert.ok(elements.get('#app').innerHTML.includes('auth-form'));
});
test('Dunkler Ruhemodus beendet sich beim ersten Tippen und verschluckt dabei die Aktion darunter', async t => {
  const { run, elements } = fixture(t);
  run("displayConfig=deviceConfig({enabled:true,timeout:30});lastActivity=Date.now()-31000");
  await run('checkDeviceIdle()'); assert.equal(run('displayMode'), 'sleep'); assert.equal(elements.get('#display-rest').hidden, false);
  run("let prevented=false,stopped=false;deviceActivity({type:'pointerdown',preventDefault(){prevented=true},stopImmediatePropagation(){stopped=true}})");
  assert.equal(run('prevented && stopped'), true); assert.equal(run('displayMode'), 'active'); assert.equal(elements.get('#display-rest').hidden, true); assert.ok(run('suppressWakeClickUntil>Date.now()'));
  run("lastActivity=Date.now()-31000;editor.open=true"); await run('checkDeviceIdle()'); assert.equal(run('displayMode'), 'active');
});
test('Automatischer Bilderrahmen wartet auf Fotos, wird durch Aktivität abgebrochen und kann erneut starten', async t => {
  const { context, run } = fixture(t); let release;
  run("displayConfig=deviceConfig({enabled:true,timeout:30,action:'photos'});photoSource='server';photoLoaded=false;lastActivity=Date.now()-31000");
  context.fetch = () => new Promise(resolve => { release = resolve; });
  const pending = run('checkDeviceIdle()'); run("deviceActivity({type:'pointermove'})");
  release({ ok: true, json: async () => [{ id: 'one', name: 'Foto', url: '/api/photos/one' }] }); await pending; assert.equal(run('displayMode'), 'active'); assert.equal(run('displayLoading'), false);
  run('lastActivity=Date.now()-31000'); await run('checkDeviceIdle()'); assert.equal(run('displayMode'), 'photos'); assert.equal(run('slideActive'), true);
  run("deviceActivity({type:'keydown',preventDefault(){},stopImmediatePropagation(){}})"); assert.equal(run('displayMode'), 'active'); assert.equal(run('slideActive'), false);
  run('photoItems=[];photoLoaded=true;lastActivity=Date.now()-31000'); await run('checkDeviceIdle()'); assert.equal(run('displayMode'), 'sleep');
});
test('Wake Lock wird im Ruhemodus freigegeben; ein verspätetes Ergebnis hält das schlafende Gerät nicht wach', async t => {
  const { context, run } = fixture(t); let resolve, released = 0;
  context.isSecureContext = true; context.navigator = { wakeLock: { request: () => new Promise(r => { resolve = r; }) } };
  run('displayConfig=deviceConfig({enabled:true});displayMode="active"'); const pending = run('syncWakeLock()'); run('enterDisplayRest()');
  resolve({ release: async () => { released++; }, addEventListener() {} }); await pending; assert.equal(released, 1); assert.equal(run('wakeLock'), null);
  context.navigator.wakeLock.request = async () => ({ release: async () => { released++; }, addEventListener() {} });
  run('displayMode="active"'); await run('syncWakeLock()'); assert.ok(run('wakeLock')); run('enterDisplayRest()'); await Promise.resolve(); assert.equal(released, 2);
  context.navigator.wakeLock.request = async () => { throw new Error('denied'); }; run('displayMode="active"'); await run('syncWakeLock()'); assert.match(run('wakeStatus'), /nicht erlaubt/);
});

test('Geburtstagssuche steht zwischen Titel und Hinzufügen und filtert Namen ohne Groß-/Kleinschreibung', t => {
  const { run } = fixture(t);
  run("S.birthdays=[{id:'anna',name:'Anna <script>',day:2,month:1},{id:'ben',name:'Ben',day:4,month:3}];birthdaySearch='ANNA'");
  const html = run('birthdaysPage()');
  assert.ok(html.indexOf('Unsere Geburtstage') < html.indexOf('id="birthday-search"'));
  assert.ok(html.indexOf('id="birthday-search"') < html.indexOf('data-edit="birthdays"'));
  assert.ok(html.includes('Anna &lt;script&gt;')); assert.ok(!html.includes('<h2>Ben</h2>'));
  run("birthdaySearch='unbekannt'"); assert.ok(run('birthdaysPage()').includes('Kein passender Geburtstag'));
});
test('Jahreskalender zeigt zwölf Monate, Schaltjahr und Geburtstag; ein Tag öffnet dessen Liste', async t => {
  const { run, listeners } = fixture(t);
  run("route='calendar';calendarMode='year';cursor='2028-02-01';S.birthdays=[{id:'leap',name:'Anna',month:2,day:29,birthYear:2000}]");
  const html = run('calendarPage()');
  assert.equal((html.match(/class="year-month"/g) || []).length, 12);
  assert.equal((html.match(/data-year-date=/g) || []).length, 366); assert.ok(html.includes('🎂 Anna · 28 Jahre'));
  await listeners.get('click')[0]({ target: { closest: () => ({ dataset: { yearDate: '2028-02-29' } }) } });
  assert.equal(run('cursor'), '2028-02-29'); assert.equal(run('calendarMode'), 'agenda');
});
test('Vorlagen haben Nummern, private Bildsymbole und Bearbeitungsmodus; Zuweisen nutzt eine eigene Kennung', async t => {
  const { run, context, elements } = fixture(t), requests = [];
  run("S.taskTemplates=[{id:'template-one',_rev:2,title:'Küche <b>',points:5,code:20,emoji:'🧹',imageFile:'12345678-1234-1234-1234-123456789012.png'}]");
  let html = run('tasksPage()'); assert.ok(html.includes('data-drag-kind="template"')); assert.ok(html.includes('class="task-code">20')); assert.ok(html.includes('/api/tasks/image?file='));
  run('templateEditing=true'); html = run('templateTile(S.taskTemplates[0])'); assert.ok(!html.includes('draggable="true"')); assert.ok(html.includes('template-pencil'));
  run("editRecord('taskTemplates','template-one')"); assert.ok(elements.get('#editor').innerHTML.includes('Aufgabennummer')); assert.ok(elements.get('#editor').innerHTML.includes('Küche &lt;b&gt;'));
  context.fetch = async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => url === '/api/state' ? context.initialState : {} }; };
  await run("assignTemplateTo('template-one',S.members[0].id,'fixture1234567890')");
  assert.equal(requests[0].url, '/api/task-templates/template-one/assign'); const payload = JSON.parse(requests[0].options.body);
  assert.equal(payload._rev, 2); assert.equal(payload.requestId, 'fixture1234567890'); assert.equal(payload.memberId, run('S.members[0].id'));
});
test('Aufgabensymbol zeigt Titel beim ersten Tippen und erledigt / öffnet erst beim Doppeltippen', async t => {
  const { run, context } = fixture(t), label = { hidden: true }, requests = [];
  run("S.tasks[0].memberId=S.members[0].id;S.tasks[0].emoji='🧹'");
  context.tile = { dataset: { taskTile: run('S.tasks[0].id'), date: run('cursor') }, parentElement: { querySelector: () => label } };
  context.fetch = async (url, options) => {
    if (url.endsWith('/complete')) {
      const payload = JSON.parse(options.body); requests.push(payload);
      context.initialState.completions = payload.done ? [{ task_id: context.tile.dataset.taskTile, day: run("S.tasks[0].repeat==='none'?'once':cursor") }] : [];
    }
    return { ok: true, json: async () => url === '/api/state' ? context.initialState : {} };
  };
  await run('tapTask(tile)'); assert.equal(label.hidden, false); assert.equal(requests.length, 0);
  await run('tapTask(tile)'); assert.equal(requests.length, 1); assert.equal(requests[0].done, true);
  assert.ok(run('assignedTaskTile(S.tasks[0],cursor)').includes('task-tile completed'));
  await run('tapTask(tile)'); await run('tapTask(tile)'); assert.equal(requests.length, 2); assert.equal(requests[1].done, false);
  run("S.tasks[0].emoji='';S.tasks[0].imageFile=''"); assert.ok(run('assignedTaskTile(S.tasks[0],cursor)').includes('task-text-icon'));
});
test('Stunden- und Kitaplanformulare behalten Fächer beim Wechsel der Stundenzahl und zeigen Pausen', t => {
  const { run, elements } = fixture(t);
  run("openScheduleEditor(null,{type:'school'});scheduleDraft.entries=[{weekday:1,period:8,title:'Sport'}];resizeSchedule(8)");
  assert.ok(elements.get('#editor').innerHTML.includes('value="Sport"'));
  assert.equal((elements.get('#editor').innerHTML.match(/class="school-break"/g) || []).length, 3);
  run('resizeSchedule(6);resizeSchedule(8)'); assert.ok(elements.get('#editor').innerHTML.includes('value="Sport"'));
  run("openScheduleEditor(null,{type:'kita'})"); assert.ok(elements.get('#editor').innerHTML.includes('Bringen')); assert.ok(elements.get('#editor').innerHTML.includes('Abholen')); assert.ok(!elements.get('#editor').innerHTML.includes('school-table'));
});
test('Unterkalender bleiben schmale nebeneinanderliegende Spuren und respektieren den Personenfilter', t => {
  const { run } = fixture(t);
  run("cursor='2026-10-12';S.schedules=S.members.slice(0,3).map((person,index)=>({id:'plan-'+index,title:'Kita <b>',type:'kita',memberId:person.id,showInCalendar:true,entries:[{weekday:1,startTime:'07:30',endTime:'16:00'}]}))");
  const html = run('timeWeek(cursor)'); assert.equal((html.match(/class="schedule-bar"/g) || []).length, 3); assert.ok(html.includes('left:53px')); assert.ok(html.includes('07:30')); assert.ok(html.includes('16:00')); assert.ok(html.includes('Kita &lt;b&gt;'));
  assert.ok(run('scheduleToggles()').includes('data-schedule-chip="plan-0"'));
  run('filter=S.members[1].id'); assert.equal((run('scheduleToggles()').match(/data-schedule-chip=/g) || []).length, 1);
  run('S.schedules=[]'); assert.equal(run('scheduleToggles()'), '');
});
test('Unterkalender-Einführung erlaubt OK erst nach fünf Sekunden und wird nach Löschen aller Pläne zurückgesetzt', async t => {
  const { run, context, elements, stored } = fixture(t); let clock = 10000;
  context.Date = class extends Date { static now() { return clock; } };
  run("route='calendar';scheduleGuide={id:'plan-one',readyAt:15000}");
  elements.set('[data-schedule-chip="plan-one"]', { getBoundingClientRect: () => ({ top: 200, left: 300, width: 150, height: 40, bottom: 240 }) });
  elements.set('.guide-spotlight', { style: {} }); elements.set('.guide-card', { style: {} });
  run('positionScheduleGuide()'); assert.equal(elements.get('[data-action=schedule-guide-ok]').disabled, true);
  clock = 15000; run('positionScheduleGuide()'); assert.equal(elements.get('[data-action=schedule-guide-ok]').disabled, false);
  run('finishScheduleGuide()'); assert.equal(stored.get('scheduleGuideSeen'), 'true');
  context.fetch = async () => ({ ok: true, json: async () => ({ ...context.initialState, schedules: [] }) });
  await run('refresh(false)'); assert.equal(stored.has('scheduleGuideSeen'), false);
});
test('Navigation lässt sich einklappen und sortieren; ungültige gespeicherte Reihenfolge verliert keine Reiter', async t => {
  const { run, listeners, stored } = fixture(t), click = listeners.get('click')[0];
  await click({ target: { closest: () => ({ dataset: { action: 'collapse-nav' } }) } });
  assert.equal(stored.get('navCollapsed'), 'true'); assert.ok(run('navigation()').includes('rail collapsed'));
  await click({ target: { closest: () => ({ dataset: { navMove: 'tasks', direction: '-1' } }) } });
  assert.ok(JSON.parse(stored.get('navOrder')).indexOf('tasks') < JSON.parse(stored.get('navOrder')).indexOf('birthdays'));
  assert.ok(run('navigation()').includes('data-nav="schedules"')); assert.ok(!run('navigation()').includes('Später'));
});

test('Gedrückthalten öffnet Entfernen, Bewegung bricht die Haltegeste ab und Rechtsklick bleibt erreichbar', t => {
  const { run, listeners, context, elements } = fixture(t); let pending, cancelled = 0;
  context.setTimeout = callback => { pending = callback; return 1; }; context.clearTimeout = () => { cancelled++; };
  const tile = { dataset: { taskTile: run('S.tasks[0].id') } }, down = listeners.get('pointerdown')[0], move = listeners.get('pointermove')[0];
  down({ button: 0, pointerId: 1, clientX: 0, clientY: 0, target: { closest: () => tile } });
  move({ pointerId: 1, clientX: 6, clientY: 0 }); assert.equal(cancelled, 1); assert.equal(run('taskHold'), null);
  down({ button: 0, pointerId: 1, clientX: 0, clientY: 0, target: { closest: () => tile } }); pending();
  assert.ok(elements.get('#editor').innerHTML.includes('Aus verteilter Liste entfernen')); assert.ok(run('suppressTaskClickUntil>Date.now()'));
  run('suppressTaskClickUntil=0'); let prevented = false;
  listeners.get('contextmenu')[0]({ target: { closest: () => tile }, preventDefault() { prevented = true; } }); assert.equal(prevented, true);
});
test('Eine Kitaplananlage speichert Zeiten und startet nur beim ersten Plan die Einführung', async t => {
  const { run, context, stored } = fixture(t), requests = [];
  run("openScheduleEditor(null,{type:'kita'})");
  context.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url === '/api/records/schedules') { const plan = JSON.parse(options.body); context.initialState.schedules.push({ ...plan, id: 'saved-kita', _rev: 40 }); return { ok: true, json: async () => context.initialState.schedules[0] }; }
    return { ok: true, json: async () => context.initialState };
  };
  context.form = { fields: { title: 'Kita', memberId: run('S.members[0].id'), showInCalendar: 'on', 'day-1': 'on', 'from-1': '07:15', 'until-1': '16:45', 'note-1': 'Turnbeutel' } };
  await run('saveSchedule(form)'); assert.equal(requests[0].url, '/api/records/schedules');
  const payload = JSON.parse(requests[0].options.body); assert.equal(payload.entries.length, 1); assert.equal(payload.entries[0].startTime, '07:15');
  assert.equal(run('scheduleGuide.id'), 'saved-kita'); assert.equal(run('displayBlocked()'), true); assert.equal(run('location.hash'), 'calendar');
  run('finishScheduleGuide()'); assert.equal(stored.get('scheduleGuideSeen'), 'true');
  run("openScheduleEditor(null,{type:'kita'})"); await run('saveSchedule(form)'); assert.equal(run('scheduleGuide'), null);
});

test('Plannamen sind optional; namenlose Pläne zeigen die Person in Liste und Kalenderschalter', t => {
  const { run,elements } = fixture(t);
  run("openScheduleEditor(null,{type:'kita'})");
  const html = elements.get('#editor').innerHTML, title = html.match(/<input name="title"[^>]+>/)[0];
  assert.ok(!title.includes('required')); assert.ok(title.includes('value=""'));
  run("S.schedules=[{id:'kita',type:'kita',title:'',memberId:S.members[0].id,entries:[],showInCalendar:true}]");
  assert.ok(run('schedulesPage()').includes('<h2>Anna</h2>')); assert.ok(run('scheduleToggles()').includes('<span>Anna</span>'));
});
test('Ferien und Feiertage erscheinen in Kalenderansichten, sind abschaltbar und bleiben in der Verwaltung bearbeitbar', t => {
  const { run } = fixture(t);
  run("cursor='2026-10-12';S.calendarEntries=[{id:'ferien',_rev:3,title:'Herbst <script>',category:'vacation',startDate:cursor,endDate:cursor,allDay:true,enabled:true,memberId:'',source:'<b>Quelle</b>'}]");
  for (const mode of ['week','month','year','agenda']) { const html = run(`calendarMode='${mode}';calendarPage()`); assert.ok(html.includes('Herbst &lt;script&gt;')); assert.ok(html.includes('data-calendar-option="vacation"')); }
  run('S.calendarOptions.vacation=false'); assert.ok(!run('calendarPage()').includes('Herbst &lt;script&gt;'));
  const management = run('calendarDataPage()'); assert.ok(management.includes('Herbst &lt;script&gt;')); assert.ok(management.includes('&lt;b&gt;Quelle&lt;/b&gt;')); assert.ok(management.includes('data-edit="calendarEntries"'));
});
test('Ferienformular speichert Zuordnung, Aktivierung und Grenzen und lässt die Importkennung auf dem Server erhalten', async t => {
  const { run,context,elements } = fixture(t), requests = [];
  run("S.calendarEntries=[{id:'holiday',_rev:4,title:'Feiertag',category:'holiday',startDate:cursor,endDate:cursor,allDay:true,enabled:true,memberId:'',source:'Importquelle',importKey:'a'.repeat(64)}];editRecord('calendarEntries','holiday')");
  assert.ok(elements.get('#editor').innerHTML.includes('Ende (einschließlich)')); assert.ok(elements.get('#editor').innerHTML.includes('Importquelle'));
  context.fetch = async (url,options) => { requests.push({url,options}); return {ok:true,json:async () => url === '/api/state' ? context.initialState : {}}; };
  context.fields = { title:'Schließtag',category:'holiday',startDate:run('cursor'),endDate:run('cursor'),memberId:run('S.members[1].id'),entryAllDay:'on',pauseSchedules:'on' };
  await run('saveEditor({fields})'); const data = JSON.parse(requests[0].options.body);
  assert.equal(requests[0].url,'/api/records/calendarEntries/holiday'); assert.equal(data._rev,4); assert.equal(data.enabled,false); assert.equal(data.allDay,true); assert.equal(data.memberId,run('S.members[1].id'));
});
test('ICS-Auswahl lädt nur eine Vorschau; Bestätigen sendet ausgewählte Indizes und die Person', async t => {
  const { run,context,elements } = fixture(t), requests = [];
  run("openCalendarImport('ics')"); elements.set('#calendar-import-file',{}); elements.get('#calendar-import-file').files = [{ size:30,text:async () => 'BEGIN:VCALENDAR\nEND:VCALENDAR' }];
  context.fetch = async (url,options) => { requests.push({url,options}); return { ok:true,json:async () => url === '/api/calendar/import/preview' ? { token:'private-token',source:'ICS <b>',warnings:['Bitte <script> prüfen'],entries:[{title:'Sport <b>',category:'event',startDate:run('cursor'),endDate:run('cursor'),allDay:false,startTime:'16:00',endTime:'17:00'}] } : url === '/api/state' ? context.initialState : { imported:1,skipped:0 } }; };
  context.form = { querySelector:() => elements.get('#calendar-import-file'),fields:{memberId:run('S.members[0].id'),category:'event',from:'2026-01-01',until:'2026-12-31'} };
  await run('loadCalendarPreview(form,{...form.fields})'); assert.equal(requests.length,1); assert.equal(requests[0].url,'/api/calendar/import/preview');
  assert.ok(elements.get('#editor').innerHTML.includes('Sport &lt;b&gt;')); assert.ok(elements.get('#editor').innerHTML.includes('Bitte &lt;script&gt; prüfen'));
  context.confirmForm = { fields:{memberId:run('S.members[1].id'),'calendar-entry':['0']} };
  await run('commitCalendarImport(confirmForm,{memberId:confirmForm.fields.memberId})');
  const sent = JSON.parse(requests[1].options.body); assert.equal(requests[1].url,'/api/calendar/import/commit'); assert.equal(sent.token,'private-token'); assert.deepEqual(sent.selected,[0]); assert.equal(sent.memberId,run('S.members[1].id'));
});
test('Verspätete Ferien-Vorschau überschreibt keinen neuen Dialog', async t => {
  const { run,context,elements } = fixture(t); let resolve;
  run("openCalendarImport('holidays')"); context.fetch = () => new Promise(done => { resolve = done; });
  const pending = run("loadCalendarPreview({fields:{}},{state:'DE-BW',year:'2026',vacations:'on',holidays:'on',memberId:''})");
  run("editRecord('notes')"); resolve({ok:true,json:async () => ({token:'old',entries:[],warnings:[],source:'Alt'})}); await pending;
  assert.equal(run('editing.kind'),'notes'); assert.ok(elements.get('#editor').innerHTML.includes('record-form'));
});
