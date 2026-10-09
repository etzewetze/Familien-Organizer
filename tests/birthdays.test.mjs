import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../src/store.mjs';
import { Model } from '../src/model.mjs';
import { birthdayOccurrence, birthdaysOnDate, nextBirthday } from '../public/birthdays.js';

const birthday = { id: 'anna', name: 'Anna', month: 10, day: 7, birthYear: 1990, memberId: 'member', leapDay: 'mar1', notes: 'Kuchen' };
test('Geburtstage erscheinen jährlich mit Alter und ohne begrenzten Zeitraum', () => {
  for (const year of [2026, 2027, 2032, 2050]) {
    const event = birthdayOccurrence(birthday, year);
    assert.equal(event.startDate, `${year}-10-07`); assert.equal(event.endDate, event.startDate);
    assert.equal(event.age, year - 1990); assert.equal(event.allDay, true); assert.equal(event.memberId, 'member');
    assert.equal(event.birthdayId, birthday.id); assert.match(event.title, new RegExp(String(year - 1990)));
    assert.equal(event.title, `🎂 Anna · ${year - 1990} Jahre`);
    assert.equal(birthdaysOnDate([birthday], event.startDate).length, 1);
    assert.equal(birthdaysOnDate([birthday], `${year}-10-08`).length, 0);
  }
  assert.equal(birthdayOccurrence(birthday, 1989), null);
  assert.equal(birthdayOccurrence({ ...birthday, birthYear: null }, 2026).age, null);
  assert.equal(birthdayOccurrence({ ...birthday, birthYear: null }, 2026).title, '🎂 Anna');
  assert.equal(birthdayOccurrence(birthday, 1990).title, '🎂 Anna · 0 Jahre');
  assert.equal(birthdayOccurrence(birthday, 1991).title, '🎂 Anna · 1 Jahr');
});
test('29. Februar berücksichtigt Schaltjahre und wählbare Ersatztermine', () => {
  const leap = { ...birthday, month: 2, day: 29, birthYear: null };
  for (const year of [2000, 2028]) assert.equal(birthdayOccurrence(leap, year).startDate, `${year}-02-29`);
  for (const year of [1900, 2026, 2100]) {
    assert.equal(birthdayOccurrence(leap, year).startDate, `${year}-03-01`);
    assert.equal(birthdayOccurrence({ ...leap, leapDay: 'feb28' }, year).startDate, `${year}-02-28`);
  }
});
test('Nächster Geburtstag behandelt den heutigen Tag und Jahreswechsel', () => {
  assert.equal(nextBirthday(birthday, '2026-10-07').startDate, '2026-10-07');
  assert.equal(nextBirthday(birthday, '2026-10-08').startDate, '2027-10-07');
  assert.equal(nextBirthday({ ...birthday, month: 1, day: 1 }, '2026-12-31').startDate, '2027-01-01');
});
test('Geburtstagsdaten sind geprüft, geräteübergreifend gespeichert und konfliktgeschützt', t => {
  const directory = mkdtempSync(join(tmpdir(), 'family-birthday-'));
  let store = new Store(directory), model = new Model(store);
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  store.setMeta('settings', { timezone: 'Europe/Berlin' });
  const member = model.save('members', '', { name: 'Anna', color: '#123456' });
  const saved = model.save('birthdays', '', { name: 'Anna', month: '2', day: '29', birthYear: '', memberId: member.id });
  assert.equal(saved.birthYear, null); assert.equal(saved.leapDay, 'mar1'); assert.equal(store.state().events.length, 0);
  assert.equal(store.state().birthdays.length, 1); assert.equal(store.db.prepare('PRAGMA user_version').get().user_version, 1);
  for (const data of [{ month: 4, day: 31 }, { month: 13 }, { day: 0 }, { name: '' }, { birthYear: 9999 }, { birthYear: 2001 }, { memberId: 'missing' }, { leapDay: 'missing' }]) assert.throws(() => model.save('birthdays', '', { ...saved, ...data }));
  const updated = model.save('birthdays', saved.id, { ...saved, birthYear: 2000, leapDay: 'feb28' });
  assert.throws(() => model.save('birthdays', saved.id, saved), { status: 409 });
  assert.throws(() => model.delete('birthdays', saved.id, saved._rev), { status: 409 });
  store.close(); store = new Store(directory); model = new Model(store);
  assert.equal(store.state().birthdays[0].birthYear, 2000); assert.equal(store.state().birthdays[0].memberId, member.id);
  model.delete('birthdays', updated.id, updated._rev);
  assert.equal(birthdaysOnDate(store.state().birthdays, '2030-02-28').length, 0);
});
