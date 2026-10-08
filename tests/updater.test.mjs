import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, rmSync, symlinkSync, readlinkSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { request } from 'node:http';
import { Store } from '../src/store.mjs';
import { UpdateRunner, runUpdateCommand, UPDATE_REPOSITORY } from '../src/update-runner.mjs';
import { createUpdateServer } from '../scripts/update-agent.mjs';
import { UpdaterClient } from '../src/updater-client.mjs';

function fixture(t, options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'family-updater-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const config = { appDir: join(root, 'app'), runtimeLink: join(root, 'node'), backupRoot: join(root, 'backups'), stateRoot: join(root, 'state'), dataDir: join(root, 'data'), photoDir: join(root, 'data/photos'), unitFile: join(root, 'family.service'), healthUrl: 'http://127.0.0.1:8080/api/health' };
  mkdirSync(join(config.appDir, 'scripts'), { recursive: true }); mkdirSync(config.photoDir, { recursive: true });
  cpSync(new URL('../scripts/backup.mjs', import.meta.url), join(config.appDir, 'scripts/backup.mjs'));
  writeFileSync(join(config.appDir, 'package.json'), JSON.stringify({ version: '0.3.0' }));
  writeFileSync(join(config.appDir, '.env'), 'GOOGLE_CLIENT_SECRET="private-fixture"\n', { mode: 0o600 });
  writeFileSync(config.unitFile, 'previous service'); symlinkSync(dirname(dirname(process.env.CODEX_PRIMARY_RUNTIME_NODE || process.execPath)), config.runtimeLink);
  const store = new Store(config.dataDir); store.put('notes', 'keep', { title: 'Behalten', body: 'Privat' }); store.close();
  writeFileSync(join(config.photoDir, 'photo.jpg'), 'photo');
  mkdirSync(join(config.dataDir, 'task-images')); writeFileSync(join(config.dataDir, 'task-images', 'task.jpg'), 'task-image');
  const key = readFileSync(join(config.dataDir, 'master.key')); const calls = []; let healthy = true;
  const run = async (command, args, settings) => {
    calls.push({ command, args });
    if (command.endsWith('/bin/node')) {
      if (options.backupFails) return { code: 1, output: 'no space' };
      return runUpdateCommand(command, args, settings);
    }
    if (command === 'git') {
      if (options.downloadFails) return { code: 1, output: 'network failure' };
      const source = args.at(-1); cpSync(config.appDir, source, { recursive: true });
      writeFileSync(join(source, 'package.json'), JSON.stringify({ version: options.downgrade ? '0.2.0' : '0.4.0' }));
      return { code: 0, output: '' };
    }
    if (command === 'bash') {
      if (options.pause) await options.pause();
      writeFileSync(join(config.appDir, 'package.json'), JSON.stringify({ version: '0.4.0' }));
      if (options.installFails) {
        const db = new Store(config.dataDir); db.remove('notes', 'keep'); db.close();
        writeFileSync(join(config.dataDir, 'master.key'), Buffer.alloc(32));
        writeFileSync(join(config.appDir, '.env'), 'changed'); writeFileSync(config.unitFile, 'changed');
        healthy = false;
        return { code: 1, output: 'Fehler: Die Startprüfung ist fehlgeschlagen.' };
      }
      return { code: 0, output: 'Installed' };
    }
    if (command === 'systemctl') {
      if (args[0] === 'stop' && options.stopFails) return { code: 1, output: 'cannot stop' };
      if (args[0] === 'start') healthy = true;
      return { code: 0, output: '' };
    }
    throw new Error('Unexpected command: ' + command);
  };
  const health = async version => healthy && JSON.parse(readFileSync(join(config.appDir, 'package.json'), 'utf8')).version === version;
  const runner = new UpdateRunner(config, { run, health });
  return { runner, config, calls, root, key };
}
test('Web-Update erstellt eine echte SQLite-/Schlüssel-/Bildsicherung vor dem Download und bleibt nach Neustart als Erfolg sichtbar', async t => {
  const f = fixture(t); const initial = f.runner.start(); assert.equal(initial.phase, 'backup'); assert.equal(initial.active, true);
  await f.runner.pending; const status = f.runner.status(); assert.equal(status.phase, 'success', JSON.stringify(status)); assert.equal(status.backupCreated, true); assert.equal(status.targetVersion, '0.4.0');
  assert.ok(f.calls[0].command.endsWith('/bin/node')); assert.equal(f.calls[1].command, 'git'); assert.ok(f.calls[1].args.includes(UPDATE_REPOSITORY));
  const backup = join(f.config.backupRoot, 'web-updates', readdirSync(join(f.config.backupRoot, 'web-updates'))[0]);
  assert.deepEqual(readFileSync(join(backup, 'master.key')), f.key); assert.equal(readFileSync(join(backup, 'task-images/task.jpg'), 'utf8'), 'task-image');
  assert.equal(readFileSync(join(backup, '.env'), 'utf8'), 'GOOGLE_CLIENT_SECRET="private-fixture"\n'); assert.equal(statSync(join(f.config.stateRoot, 'status.json')).mode & 0o777, 0o600);
  assert.equal(new UpdateRunner(f.config).status().phase, 'success');
});
test('Fehlgeschlagene Sicherung, Download oder Downgrade lassen den bisherigen Stand unverändert', async t => {
  for (const option of ['backupFails', 'downloadFails', 'downgrade']) {
    const f = fixture(t, { [option]: true }); f.runner.start(); await f.runner.pending;
    assert.equal(f.runner.status().phase, 'failed'); assert.equal(f.calls.some(c => c.command === 'bash'), false);
    assert.equal(JSON.parse(readFileSync(join(f.config.appDir, 'package.json'))).version, '0.3.0');
    if (option === 'backupFails') assert.equal(f.calls.some(c => c.command === 'git'), false);
  }
});
test('Fehlgeschlagenes Update setzt Code, Datenbank, Schlüssel, Konfiguration und Dienst auf den gesicherten Stand zurück', async t => {
  const f = fixture(t, { installFails: true }), runtime = readlinkSync(f.config.runtimeLink);
  f.runner.start(); await f.runner.pending;
  assert.equal(f.runner.status().phase, 'failed'); assert.equal(f.runner.status().restored, true); assert.match(f.runner.status().error, /Startprüfung/);
  assert.equal(JSON.parse(readFileSync(join(f.config.appDir, 'package.json'))).version, '0.3.0');
  assert.deepEqual(readFileSync(join(f.config.dataDir, 'master.key')), f.key); assert.equal(readlinkSync(f.config.runtimeLink), runtime);
  assert.equal(readFileSync(join(f.config.appDir, '.env'), 'utf8'), 'GOOGLE_CLIENT_SECRET="private-fixture"\n'); assert.equal(readFileSync(f.config.unitFile, 'utf8'), 'previous service');
  const db = new Store(f.config.dataDir); assert.ok(db.get('notes', 'keep')); db.close();
  assert.equal(readFileSync(join(f.config.dataDir, 'task-images/task.jpg'), 'utf8'), 'task-image');
  assert.ok(f.calls.some(c => c.command === 'systemctl' && c.args[0] === 'stop')); assert.ok(f.calls.some(c => c.command === 'systemctl' && c.args[0] === 'start'));
});
test('Bei nicht stoppbarem Dienst wird keine Datenbank überschrieben und ein Rücksetzfehler mit Sicherung gemeldet', async t => {
  const f = fixture(t, { installFails: true, stopFails: true }); f.runner.start(); await f.runner.pending;
  assert.equal(f.runner.status().phase, 'rollback_failed'); assert.equal(f.runner.status().restored, false); assert.match(f.runner.status().error, /nicht sicher gestoppt/);
  const db = new Store(f.config.dataDir); assert.equal(db.get('notes', 'keep'), null); db.close();
  assert.ok(readdirSync(f.config.stateRoot).some(n => n.startsWith('job-'))); assert.ok(existsSync(join(f.config.backupRoot, 'web-updates')));
});
test('Gleichzeitige Updates sind gesperrt und ein unterbrochener Auftrag wird nicht als Erfolg dargestellt', async t => {
  let release; const f = fixture(t, { pause: () => new Promise(resolve => { release = resolve; }) });
  f.runner.start(); assert.throws(() => f.runner.start(), { status: 409 });
  for (let i = 0; i < 100 && !release; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(release, JSON.stringify(f.runner.status()));
  assert.equal(new UpdateRunner(f.config).status().phase, 'interrupted');
  release(); await f.runner.pending; assert.equal(f.runner.status().phase, 'success');
});
test('Update-Protokoll erlaubt ausschließlich Status und festen Auftrag; Client sendet an den konfigurierten Socket', async t => {
  const root = mkdtempSync(join(tmpdir(), 'family-update-socket-')), socket = join(root, 'control.sock');
  let starts = 0, reloads = 0;
  const runner = { status: () => ({ supported: true, phase: 'idle' }), start: () => { starts++; return { supported: true, phase: 'backup', active: true }; }, pending: Promise.resolve() };
  // Der Executor sperrt AF_UNIX-Listen. Dasselbe HTTP-Protokoll hier über Loopback prüfen.
  const server = createUpdateServer(runner, { loadRunner: () => { reloads++; return runner; } }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); rmSync(root, { recursive: true, force: true }); });
  const requests = [], requestFn = (options, callback) => { requests.push(options); return request({ ...options, socketPath: undefined, host: '127.0.0.1', port: server.address().port }, callback); };
  const client = new UpdaterClient(socket, { requestFn }); assert.equal((await client.status()).phase, 'idle'); assert.equal((await client.start()).phase, 'backup');
  assert.equal(requests[0].socketPath, socket); assert.equal(requests[1].path, '/start');
  const response = await new Promise(resolve => { const req = request({ host: '127.0.0.1', port: server.address().port, path: '/start', method: 'POST', headers: { 'Content-Length': 15 } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); }); req.end('{"command":"x"}'); });
  assert.equal(response, 400); assert.equal(starts, 1); assert.equal(reloads, 1);
  assert.equal((await new UpdaterClient(join(root, 'absent')).status()).supported, false);
});
