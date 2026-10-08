import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.mjs';
import { Model, appearanceSettings } from '../src/model.mjs';
import { appearanceDefaults, appearanceFor, eventColor, calendarColumns, contrastText, themeProperties } from '../public/appearance.js';

const image = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png';
test('Alte Einstellungen erhalten Darstellungsdefaults; Farben und Bildreferenzen werden geprüft', () => {
  assert.deepEqual(appearanceSettings({}, {}), appearanceDefaults);
  const saved = appearanceSettings({ allColor: '#123456', backgroundImage: image, calendarHourSize: '52', calendarAutoWidth: false }, {});
  assert.equal(saved.allColor, '#123456'); assert.equal(saved.backgroundImage, image); assert.equal(saved.calendarHourSize, 52);
  assert.deepEqual(appearanceSettings({}, saved), saved);
  for (const bad of [{ headerColor: 'red;display:none' }, { backgroundImage: '../master.key' }, { backgroundImage: 'https://foreign.example/image.png' }, { calendarHourSize: 1 }, { calendarAutoWidth: 'true' }]) assert.throws(() => appearanceSettings(bad));
  assert.equal(appearanceFor({ backgroundImage: 'javascript:evil', allColor: 'bad', calendarHourSize: 0 }).backgroundImage, '');
  assert.equal(appearanceFor({ allColor: 'bad' }).allColor, appearanceDefaults.allColor);
});
test('Profilbilder bleiben bei alten Bearbeitungsanfragen erhalten; Terminfarben gelten für Alle', t => {
  const directory = mkdtempSync(join(tmpdir(), 'family-appearance-')), store = new Store(directory), model = new Model(store);
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  const member = model.save('members', '', { name: 'Anna', color: '#123456', avatarImage: image });
  const preserved = model.save('members', member.id, { name: member.name, color: member.color, _rev: member._rev }); assert.equal(preserved.avatarImage, image);
  assert.throws(() => model.save('members', member.id, { ...preserved, avatarImage: '../master.key' }));
  const date = store.state().serverDate;
  const all = model.save('events', '', { title: 'Familie', startDate: date, allDay: true, color: '#ff7700' });
  assert.equal(eventColor(all, [member], {}), '#ff7700');
  const person = model.save('events', all.id, { ...all, memberIds: [member.id] }); assert.equal(person.color, ''); assert.equal(eventColor(person, [member], {}), '#123456');
  assert.equal(eventColor({ memberIds: [] }, [], { allColor: '#7700ff' }), '#7700ff');
  assert.throws(() => model.save('events', '', { title: 'Ungültig', startDate: date, allDay: true, color: 'bad' }));
});
test('Leere Kalendertage sind schmaler; belegte Tage und einheitliche Breiten bleiben verfügbar', () => {
  const automatic = calendarColumns([[], [{}], [], [], [], [], []]);
  assert.ok(automatic.template.includes('minmax(128px,.7fr)')); assert.ok(automatic.template.includes('minmax(160px,1.3fr)'));
  const uniform = calendarColumns([[], [{}], [], [], [], [], []], false); assert.ok(uniform.minimum > automatic.minimum); assert.ok(!uniform.template.includes('128px'));
  assert.equal(calendarColumns([[], [], [], [], [], [], []]).minimum, 948);
});
test('Darstellung liefert geprüfte Farben und lesbare Header-/Akzenttexte ohne fremde CSS-Werte', () => {
  const theme = themeProperties({ headerColor: '#000000', accentColor: '#ffff00', surfaceColor: '#333333', textColor: '#ffffff', bad: 'url(evil)' });
  assert.equal(theme['--header-ink'], '#ffffff'); assert.equal(theme['--primary-ink'], '#111827'); assert.equal(theme['--surface'], '#333333');
  assert.equal(contrastText('#ffffff'), '#111827'); assert.equal(contrastText('#000000'), '#ffffff');
  assert.ok(Object.values(theme).every(value => /^#[a-f0-9]{6}$/i.test(value))); assert.ok(!Object.values(theme).includes('url(evil)'));
});
