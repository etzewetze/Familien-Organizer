import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../src/store.mjs';
import { Model } from '../src/model.mjs';
import { Holidays } from '../src/holidays.mjs';
import { parseCalendar } from '../src/calendar-import.mjs';
import { calendarEntriesOnDate, planCaption, scheduleClosed } from '../public/calendar-data.js';
import { scheduleWindows, defaultPeriods } from '../public/schedules.js';

const file = (...events) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events.map(event => `BEGIN:VEVENT\r\n${event.join('\r\n')}\r\nEND:VEVENT`).join('\r\n')}\r\nEND:VCALENDAR`;
const options = { from: '2026-01-01', until: '2027-12-31', timezone: 'Europe/Berlin' };
const response = value => new Response(JSON.stringify(value), { headers: { 'Content-Type':'application/json' } });
function fixture(t) {
  const path = mkdtempSync(join(tmpdir(),'family-calendar-data-')), store = new Store(path), model = new Model(store);
  const anna = model.save('members','',{ name:'Anna', color:'#3388ff' }), ben = model.save('members','',{ name:'Ben',color:'#ee8800' });
  t.after(() => { store.close(); rmSync(path,{ recursive:true,force:true }); });
  return { store,model,anna,ben };
}
test('Leere Plannamen bleiben leer und verwenden in der Anzeige den Personennamen', t => {
  const { model,anna } = fixture(t), plan = model.save('schedules','',{ title:'  ',type:'kita',memberId:anna.id,entries:[],showInCalendar:true });
  assert.equal(plan.title,''); assert.equal(planCaption(plan,[anna]),'Anna');
  assert.equal(planCaption({ ...plan,title:'Meine Kita' },[anna]),'Meine Kita');
});
test('Ferien sind bearbeitbar und schalten nur die zugeordneten Schulpläne ab; Kita ist separat wählbar', t => {
  const { model,anna,ben } = fixture(t), date = '2026-10-12';
  const entry = model.save('calendarEntries','',{ title:'Ferien',category:'vacation',memberId:anna.id,startDate:date,endDate:'2026-10-16' });
  const school = { id:'school',type:'school',memberId:anna.id,showInCalendar:true,periods:defaultPeriods(),entries:[{ weekday:1,period:1,title:'Mathe' }] };
  const kita = { id:'kita',type:'kita',memberId:anna.id,showInCalendar:true,entries:[{ weekday:1,startTime:'07:00',endTime:'16:00' }] };
  assert.equal(scheduleClosed(school,date,[entry]),true); assert.equal(scheduleClosed({ ...school,memberId:ben.id },date,[entry]),false);
  assert.equal(scheduleWindows([school,kita],date,{ closures:[entry] }).length,1);
  assert.equal(scheduleClosed(kita,date,[entry]),false); assert.equal(scheduleClosed({ ...kita,pauseDuringVacations:true },date,[entry]),true);
  assert.equal(scheduleClosed(school,date,[entry],{ vacation:false }),false);
  const holiday = { ...entry,category:'holiday',memberId:'' }; assert.equal(scheduleClosed(kita,date,[holiday]),true);
  assert.equal(scheduleClosed({ ...kita,pauseOnHolidays:false },date,[holiday]),false);
  const changed = model.save('calendarEntries',entry.id,{ ...entry,enabled:false,title:'Ausgeschaltet' });
  assert.equal(calendarEntriesOnDate([changed],date).length,0); assert.equal(scheduleClosed(school,date,[changed]),false);
  assert.throws(() => model.save('calendarEntries',entry.id,entry),{ status:409 });
});
test('Importe sind transaktional, pro Person wiederholbar und bewahren nachträgliche Änderungen', t => {
  const { store,model,anna,ben } = fixture(t), record = { title:'Ferien',category:'vacation',startDate:'2026-10-12',endDate:'2026-10-16',importKey:'a'.repeat(64) };
  assert.deepEqual(model.importCalendar([record],anna.id),{ imported:1,skipped:0 });
  const first = store.all('calendarEntries')[0]; model.save('calendarEntries',first.id,{ ...first,title:'Eigene Ferien',endDate:'2026-10-18' });
  assert.deepEqual(model.importCalendar([record],anna.id),{ imported:0,skipped:1 }); assert.equal(store.get('calendarEntries',first.id).title,'Eigene Ferien');
  assert.deepEqual(model.importCalendar([record],ben.id),{ imported:1,skipped:0 });
  assert.throws(() => model.importCalendar([{ ...record,importKey:'b'.repeat(64) },{ ...record,category:'bad' }],anna.id)); assert.equal(store.all('calendarEntries').length,2);
  assert.throws(() => model.importCalendar([record],'missing'));
  assert.throws(() => model.save('calendarEntries','',{ ...record,enabled:'false' }));
});
test('ICS-Tagesende ist exklusiv; Escapes, Faltzeilen und Alarm-Unterblöcke verändern keine Daten', () => {
  const parsed = parseCalendar(file(['UID:ferien','DTSTART;VALUE=DATE:20261012','DTEND;VALUE=DATE:20261017','SUMMARY:Herbst\\, Ferien','DESCRIPTION:Zeile 1\\nZeile 2','LOCATION:Schule\\; Nord','BEGIN:VALARM','SUMMARY:Nicht als Titel verwenden','END:VALARM']),{ ...options,category:'vacation' });
  assert.equal(parsed.entries.length,1); const entry = parsed.entries[0];
  assert.equal(entry.endDate,'2026-10-16'); assert.equal(entry.title,'Herbst, Ferien'); assert.equal(entry.location,'Schule; Nord'); assert.equal(entry.description,'Zeile 1\nZeile 2');
  assert.equal(parseCalendar(file(['DTSTART;VALUE=DATE:20261012','SUMMARY:Langer\r\n Titel']),options).entries[0].title,'LangerTitel');
});
test('ICS-Zeitzonen werden in die Familienzeitzone umgerechnet; Uhrzeiten ohne Ende bleiben Starttermine', () => {
  const parsed = parseCalendar(file(['UID:utc','DTSTART:20261016T230000Z','DTEND:20261017T000000Z','SUMMARY:Spät'],['UID:point','DTSTART;TZID=Europe/Berlin:20261017T160000','SUMMARY:Abholen']),options);
  assert.equal(parsed.entries[0].startDate,'2026-10-17'); assert.equal(parsed.entries[0].startTime,'01:00'); assert.equal(parsed.entries[0].endTime,'02:00');
  assert.equal(parsed.entries[1].startOnly,true); assert.equal(parsed.entries[1].endTime,'');
  const invalid = parseCalendar(file(['DTSTART;TZID=Windows-Custom-Zone:20261017T160000','SUMMARY:Ungültig']),options);
  assert.equal(invalid.entries.length,0); assert.ok(invalid.warnings.some(warning => warning.includes('Zeitzone')));
});
test('Dienstplanimport erhält Nacht-, Serien- und Tagesdienste als Arbeitstage mit ihren Zeiten', () => {
  const content = file(
    ['UID:night','DTSTART;TZID=Europe/Berlin:20261016T220000','DTEND;TZID=Europe/Berlin:20261017T060000','RRULE:FREQ=WEEKLY;COUNT=2','SUMMARY:Nachtdienst'],
    ['UID:day','DTSTART;VALUE=DATE:20261020','DTEND;VALUE=DATE:20261021','SUMMARY:Arbeitstag'],
    ['UID:point','DTSTART:20261021T080000','SUMMARY:Offenes Ende']);
  const parsed = parseCalendar(content,{ ...options,category:'workday' });
  assert.deepEqual(parsed.warnings,[]); assert.equal(parsed.entries.length,4);
  const [night,next,day,point] = parsed.entries;
  assert.equal(night.category,'workday'); assert.equal(night.allDay,false); assert.equal(night.startTime,'22:00'); assert.equal(night.endTime,'06:00'); assert.equal(night.endDate,'2026-10-17');
  assert.equal(next.startDate,'2026-10-23'); assert.equal(next.endDate,'2026-10-24');
  assert.equal(day.allDay,true); assert.equal(day.endDate,'2026-10-20'); assert.equal(day.startTime,'');
  assert.equal(point.startOnly,true); assert.equal(point.startTime,'08:00'); assert.equal(point.endTime,'');
  assert.ok(parsed.entries.every(entry => entry.pauseSchedules === false));
  assert.notEqual(night.importKey,parseCalendar(content,options).entries[0].importKey);
  assert.deepEqual(parsed.entries.map(entry => entry.importKey),parseCalendar(content,{ ...options,category:'workday' }).entries.map(entry => entry.importKey));
});
test('Arbeitstage sind zugeordnet, bearbeitbar und lösen keine Schul- oder Kitapause aus', t => {
  const { model,store,anna } = fixture(t), date = '2026-10-12';
  const entry = model.save('calendarEntries','',{ title:'Frühdienst',category:'workday',memberId:anna.id,startDate:date,endDate:date,allDay:false,startTime:'06:00',endTime:'14:00',pauseSchedules:true });
  assert.equal(entry.allDay,false); assert.equal(entry.pauseSchedules,false); assert.equal(entry.memberId,anna.id);
  for (const type of ['school','kita']) assert.equal(scheduleClosed({ type,memberId:anna.id },date,[{ ...entry,allDay:true,pauseSchedules:true }]),false);
  assert.throws(() => model.save('calendarEntries',entry.id,{ ...entry,endTime:'05:00' }),/Ende/);
  const old = model.save('calendarEntries','',{ ...entry,category:'event',source:'ICS-Import',importKey:'c'.repeat(64) });
  const changed = model.save('calendarEntries',old.id,{ ...old,category:'workday' });
  assert.equal(changed.category,'workday'); assert.equal(changed.source,old.source); assert.equal(changed.importKey,old.importKey); assert.equal(changed.startTime,'06:00');
  assert.equal(store.state().calendarEntries.find(item => item.id === changed.id).category,'workday');
});
test('Arbeitstagsmarkierungen beachten Aktivierung und das exklusive Ende um Mitternacht', () => {
  const entry = { id:'work',category:'workday',memberId:'anna',startDate:'2026-10-12',endDate:'2026-10-13',allDay:false,startTime:'16:00',endTime:'00:00',enabled:true };
  const marked = calendarEntriesOnDate([entry],'2026-10-12');
  assert.equal(marked.length,1); assert.equal(marked[0].emoji,'💼'); assert.deepEqual(marked[0].memberIds,['anna']);
  assert.equal(calendarEntriesOnDate([entry],'2026-10-13').length,0);
  assert.equal(calendarEntriesOnDate([{ ...entry,endTime:'06:00' }],'2026-10-13').length,1);
  assert.equal(calendarEntriesOnDate([entry],'2026-10-12',{ workday:false }).length,0);
  assert.equal(calendarEntriesOnDate([{ ...entry,enabled:false }],'2026-10-12').length,0);
  assert.equal(calendarEntriesOnDate([{ ...entry,category:'event' }],'2026-10-13').length,1);
});
test('Wöchentliche ICS-Serien respektieren COUNT, EXDATE und zusätzliche RDATE; erneutes Lesen erhält die Kennungen', () => {
  const content = file(['UID:sport','DTSTART;TZID=Europe/Berlin:20261012T080000','DTEND;TZID=Europe/Berlin:20261012T090000','RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4','EXDATE;TZID=Europe/Berlin:20261014T080000','RDATE;TZID=Europe/Berlin:20261016T080000','SUMMARY:Sport']);
  const parsed = parseCalendar(content,options);
  assert.deepEqual(parsed.entries.map(entry => entry.startDate).sort(),['2026-10-12','2026-10-16','2026-10-19','2026-10-21']);
  assert.deepEqual(parseCalendar(content,options).entries.map(entry => entry.importKey),parsed.entries.map(entry => entry.importKey));
});
test('ICS-Ausnahmen ersetzen verschobene Wiederholungen und entfernen abgesagte Einzeltermine', () => {
  const parsed = parseCalendar(file(
    ['UID:serie','DTSTART:20261012T080000','DTEND:20261012T090000','RRULE:FREQ=WEEKLY;COUNT=3','SUMMARY:Original'],
    ['UID:serie','RECURRENCE-ID:20261019T080000','DTSTART:20261020T100000','DTEND:20261020T110000','SUMMARY:Verschoben'],
    ['UID:serie','RECURRENCE-ID:20261026T080000','DTSTART:20261026T080000','STATUS:CANCELLED','SUMMARY:Abgesagt']),options);
  assert.deepEqual(parsed.entries.map(entry => entry.startDate),['2026-10-12','2026-10-20']); assert.equal(parsed.entries[1].title,'Verschoben');
});
test('ICS-Jahres-/Monatsregeln, Schaltjahre und Tagesdauern werden innerhalb des Importzeitraums aufgelöst', () => {
  const parsed = parseCalendar(file(['UID:leap','DTSTART;VALUE=DATE:20240229','DURATION:P1D','RRULE:FREQ=YEARLY','SUMMARY:Schalttag']),{ ...options,until:'2028-12-31' });
  assert.deepEqual(parsed.entries.map(entry => entry.startDate),['2028-02-29']); assert.equal(parsed.entries[0].endDate,'2028-02-29');
  const monthly = parseCalendar(file(['DTSTART:20261026T090000','DURATION:PT45M','RRULE:FREQ=MONTHLY;BYDAY=-1MO;COUNT=2','SUMMARY:Letzter Montag']),options);
  assert.deepEqual(monthly.entries.map(entry => entry.startDate),['2026-10-26','2026-11-30']); assert.equal(monthly.entries[1].endTime,'09:45');
});
test('ICS meldet unlesbare Regeln und fehlerhafte Daten; Dateigröße, Zeitraum und Anzahl sind begrenzt', () => {
  assert.throws(() => parseCalendar('kein Kalender',options)); assert.throws(() => parseCalendar('x'.repeat(2*1024*1024+1),options));
  assert.throws(() => parseCalendar(file([]),{ ...options,until:'2035-01-01' }));
  const parsed = parseCalendar(file(['DTSTART;VALUE=DATE:20261012','RRULE:FREQ=MONTHLY;BYSETPOS=1;BYDAY=MO','SUMMARY:Regel'],['DTSTART;VALUE=DATE:20260230','SUMMARY:Kaputt']),options);
  assert.equal(parsed.entries.length,0); assert.ok(parsed.warnings.some(warning => warning.includes('Wiederholungsregel')));
  assert.throws(() => parseCalendar(file(['DTSTART;VALUE=DATE:20240101','RRULE:FREQ=DAILY','SUMMARY:Zu viele']),{ ...options,from:'2024-01-01',until:'2026-12-31' }),/1000/);
  assert.throws(() => parseCalendar(file(['DTSTART;VALUE=DATE:20261012','SUMMARY:Absage']).replace('VERSION:2.0','VERSION:2.0\r\nMETHOD:CANCEL'),options),/Absage/);
});
test('ICS-Seriendauer bleibt über die Zeitumstellung und unterschiedliche Start-/Endzeitzonen korrekt', () => {
  const parsed = parseCalendar(file(['UID:night','DTSTART;TZID=Europe/Berlin:20261018T010000','DTEND;TZID=Europe/Berlin:20261018T040000','RRULE:FREQ=WEEKLY;COUNT=2','SUMMARY:Nachts']),options);
  assert.equal(parsed.entries[1].startDate,'2026-10-25'); assert.equal(parsed.entries[1].endTime,'03:00');
  const mixed = parseCalendar(file(['UID:mixed','DTSTART;TZID=Europe/Berlin:20261012T080000','DTEND:20261012T070000Z','RRULE:FREQ=WEEKLY;COUNT=3','SUMMARY:Verschiedene Zonen']),options);
  assert.equal(mixed.entries.length,3); assert.equal(mixed.entries[2].endTime,'09:00');
});
test('Ferienabruf verwendet nur den festen HTTPS-Dienst, wählt Bundesland/Jahr und bündelt Wiederholungen', async () => {
  const calls = [], holiday = { id:'fixture',type:'School',name:[{ language:'DE',text:'Herbstferien' }],startDate:'2026-10-12',endDate:'2026-10-16',nationwide:false };
  const service = new Holidays({ fetchFn:async (url,request) => { calls.push({ url,request }); return response(url.pathname === '/Groups' ? [] : [{ ...holiday,type:url.pathname === '/SchoolHolidays' ? 'School' : 'Public' }]); } });
  const parsed = await service.preview({ state:'DE-BW',year:2026,vacations:true,holidays:true }); assert.equal(parsed.entries.length,2); assert.equal(parsed.entries[0].category,'vacation'); assert.equal(parsed.entries[1].category,'holiday');
  await service.preview({ state:'DE-BW',year:2026,vacations:true,holidays:true }); assert.equal(calls.length,3);
  for (const call of calls) { assert.equal(call.url.origin,'https://openholidaysapi.org'); assert.equal(call.request.redirect,'error'); assert.equal(call.url.searchParams.get('subdivisionCode'),'DE-BW'); }
  assert.equal(calls[1].url.searchParams.get('validTo'),'2026-12-31');
  await assert.rejects(service.preview({ state:'https://127.0.0.1',year:2026,vacations:true }));
});
test('Schulartgruppen sind erforderlich, Dienstausfälle und übergroße Antworten werden gemeldet', async () => {
  const service = new Holidays({ fetchFn:async url => response(url.pathname === '/Groups' ? [{ code:'group',name:[{language:'DE',text:'Allgemeinbildende Schulen'}] }] : []) });
  await assert.rejects(service.preview({ state:'DE-MV',year:2026,vacations:true }),/Schulart/);
  const result = await service.preview({ state:'DE-MV',year:2026,vacations:true,group:'group' }); assert.equal(result.entries.length,0); assert.ok(result.warnings.length);
  for (const item of [new Response('{}',{ status:503 }),new Response(' '.repeat(1024*1024+1)),new Response('bad json')]) {
    const failing = new Holidays({ fetchFn:async () => item }); await assert.rejects(failing.groups('DE-BW'));
  }
});
