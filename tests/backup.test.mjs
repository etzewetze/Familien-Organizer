import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../src/store.mjs';
test('Sicherung einer laufenden WAL-Datenbank erhält Daten und Entschlüsselungsschlüssel', t => {
  const directory = mkdtempSync(join(tmpdir(), 'family-backup-')), data = join(directory, 'data'), target = join(directory, 'backups');
  const store = new Store(data); store.put('notes', 'note', { title: 'Sicherung', body: 'WAL-Test' }); store.setMeta('secret', store.encrypt('test-secret'));
  store.put('birthdays', 'birthday', { name: 'Test Geburtstag', month: 10, day: 7, birthYear: 1990, leapDay: 'mar1', memberId: '', notes: '' });
  for (const folder of ['task-images','ui-images']) { mkdirSync(join(data,folder)); writeFileSync(join(data,folder,'fixture.png'), Buffer.from([137,80,78,71,13,10,26,10])); }
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  const result = spawnSync(process.execPath, ['scripts/backup.mjs', target], { cwd: new URL('../', import.meta.url), env: { ...process.env, DATA_DIR: data }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const backupFolder = join(target, readdirSync(target)[0]);
  assert.deepEqual(readFileSync(join(backupFolder, 'master.key')), readFileSync(join(data, 'master.key')));
  assert.ok(existsSync(join(backupFolder, 'backup.json')));
  assert.equal(JSON.parse(readFileSync(join(backupFolder,'backup.json'))).uiImagesIncluded, true);
  for (const folder of ['task-images','ui-images']) assert.deepEqual(readFileSync(join(backupFolder,folder,'fixture.png')),readFileSync(join(data,folder,'fixture.png')));
  const copy = new DatabaseSync(join(backupFolder, 'family.sqlite'), { readOnly: true });
  assert.equal(JSON.parse(copy.prepare('SELECT data FROM records WHERE id=?').get('note').data).body, 'WAL-Test');
  assert.equal(JSON.parse(copy.prepare('SELECT data FROM records WHERE kind=? AND id=?').get('birthdays', 'birthday').data).birthYear, 1990); copy.close();
});
