import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../server.mjs';

async function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(),'family-calendar-api-')); let clock = Date.now(), loads = 0;
  const services = { now:() => clock, holidays:{ groups:async () => [], preview:async () => { loads++; return { source:'Fixture',warnings:[],entries:[{ title:'Ferien',category:'vacation',allDay:true,startDate:'2026-10-12',endDate:'2026-10-16',source:'Testquelle',importKey:'a'.repeat(64) }] }; } } };
  const app = createApp({ DATA_DIR:directory },services); await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve));
  t.after(async () => { await new Promise(resolve => app.server.close(resolve)); app.store.close(); rmSync(directory,{ recursive:true,force:true }); });
  const base = `http://127.0.0.1:${app.server.address().port}`, request = (path,method='GET',data,cookie='',extra={}) => fetch(base+'/api'+path,{ method,headers:{ 'X-Family-Request':'1','Content-Type':'application/json',...(cookie?{ Cookie:cookie }:{}),...extra },...(data?{ body:JSON.stringify(data) }:{}) });
  const setup = await request('/setup','POST',{ password:'calendar-password-fixture',familyName:'Test',names:['Anna','Ben'] }), cookie = setup.headers.get('set-cookie').split(';')[0];
  const otherLogin = await request('/login','POST',{ password:'calendar-password-fixture' }), other = otherLogin.headers.get('set-cookie').split(';')[0];
  const state = await (await request('/state','GET',null,cookie)).json();
  return { app,request,cookie,other,state,get loads(){return loads;},advance(){clock+=11*60000;} };
}
test('HTTP: Kalenderimport benötigt Anmeldung, CSRF-Schutz, eigene Vorschau und gültige Auswahl', async t => {
  const f = await fixture(t), input = { mode:'holidays',state:'DE-BW',year:2026,vacations:true,memberId:f.state.members[0].id };
  assert.equal((await f.request('/calendar/import/preview','POST',input)).status,401); assert.equal(f.loads,0);
  assert.equal((await f.request('/calendar/holiday-groups?state=DE-BW')).status,401);
  assert.equal((await f.request('/calendar/import/preview','POST',input,f.cookie,{ Origin:'https://foreign.example' })).status,403);
  const previewResponse = await f.request('/calendar/import/preview','POST',input,f.cookie); assert.equal(previewResponse.status,200); const preview = await previewResponse.json();
  assert.equal(f.app.store.all('calendarEntries').length,0);
  const commit = { token:preview.token,selected:[0],memberId:f.state.members[1].id };
  assert.equal((await f.request('/calendar/import/commit','POST',commit,f.other)).status,409);
  for (const selected of [[],[0,0],[-1],[100],['0']]) assert.equal((await f.request('/calendar/import/commit','POST',{ ...commit,selected },f.cookie)).status,400);
  assert.equal((await f.request('/calendar/import/commit','POST',{ ...commit,memberId:'missing' },f.cookie)).status,400);
  const imported = await (await f.request('/calendar/import/commit','POST',commit,f.cookie)).json(); assert.deepEqual(imported,{ imported:1,skipped:0 });
  const repeated = await (await f.request('/calendar/import/commit','POST',commit,f.cookie)).json(); assert.deepEqual(repeated,{ imported:0,skipped:1 });
  const entries = (await (await f.request('/state','GET',null,f.other)).json()).calendarEntries; assert.equal(entries[0].memberId,f.state.members[1].id);
  f.advance(); assert.equal((await f.request('/calendar/import/commit','POST',commit,f.cookie)).status,409);
});
test('HTTP: Ferien-Schalter sind gemeinsam und revisionsgeschützt; Einträge bleiben bearbeitbar und exportierbar', async t => {
  const f = await fixture(t), state = f.state;
  assert.equal((await f.request('/calendar/options','PUT',{ vacation:false,holiday:true,event:true,_revision:state.revision })).status,401);
  const options = await f.request('/calendar/options','PUT',{ vacation:false,holiday:true,event:true,_revision:state.revision },f.cookie); assert.equal(options.status,200);
  assert.equal((await f.request('/calendar/options','PUT',{ vacation:true,holiday:true,event:true,_revision:state.revision },f.other)).status,409);
  const next = await (await f.request('/state','GET',null,f.other)).json(); assert.equal(next.calendarOptions.vacation,false);
  const created = await f.request('/records/calendarEntries','POST',{ title:'Kita geschlossen',category:'vacation',memberId:state.members[0].id,startDate:'2026-10-12',endDate:'2026-10-16' },f.cookie); assert.equal(created.status,201); const entry = await created.json();
  assert.equal((await f.request('/records/calendarEntries/'+entry.id,'PUT',{ ...entry,title:'Kita zu',enabled:false },f.other)).status,200);
  assert.equal((await f.request('/records/calendarEntries/'+entry.id,'PUT',entry,f.cookie)).status,409);
  const exported = await (await f.request('/export','GET',null,f.cookie)).json(); assert.equal(exported.calendarEntries[0].title,'Kita zu'); assert.equal(exported.calendarEntries[0].enabled,false); assert.equal(exported.calendarOptions.vacation,false);
});
test('HTTP: ICS bleibt bis zum Bestätigen Vorschau und wird mit der gewählten Person gespeichert', async t => {
  const f = await fixture(t), content = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:school\r\nDTSTART:20261012T080000\r\nDTEND:20261012T084500\r\nRRULE:FREQ=WEEKLY;COUNT=2\r\nSUMMARY:Mathe\r\nEND:VEVENT\r\nEND:VCALENDAR';
  const previewResponse = await f.request('/calendar/import/preview','POST',{ mode:'ics',content,from:'2026-10-01',until:'2026-12-31',category:'event',memberId:f.state.members[0].id },f.cookie); assert.equal(previewResponse.status,200);
  const preview = await previewResponse.json(); assert.equal(preview.entries.length,2); assert.equal(f.app.store.all('calendarEntries').length,0); assert.equal(f.loads,0);
  const commit = await f.request('/calendar/import/commit','POST',{ token:preview.token,selected:[1],memberId:f.state.members[0].id },f.cookie); assert.equal(commit.status,201);
  const entry = f.app.store.all('calendarEntries')[0]; assert.equal(entry.startDate,'2026-10-19'); assert.equal(entry.startTime,'08:00'); assert.equal(entry.endTime,'08:45'); assert.equal(entry.memberId,f.state.members[0].id);
});
