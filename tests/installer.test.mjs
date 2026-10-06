import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync, existsSync, readdirSync, readlinkSync, statSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../src/store.mjs';
import { installConfiguration } from '../scripts/lxc-config.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'family-lxc-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, 'source'), bin = join(root, 'bin'), opt = join(root, 'opt'), state = join(root, 'state');
  for (const path of [bin, opt, state, join(root, 'systemd'), join(root, 'etc'), join(root, 'lock')]) mkdirSync(path, { recursive: true });
  cpSync(repository, source, { recursive: true, filter: path => ! /^(?:\.git|data|backups|node_modules|test-results|\.sites-runtime)(?:\/|$)|^\.env$/.test(relative(repository, path)) });
  const app = join(opt, 'app'), data = join(root, 'data'), runtimeRoot = join(opt, 'runtime'), runtimeLink = join(opt, 'node'), backups = join(root, 'backups'), unit = join(root, 'etc', 'family.service');
  writeFileSync(join(root, 'os-release'), 'ID=debian\nVERSION_ID=13\n');
  writeFileSync(join(source, '.env.example'), `HOST=0.0.0.0\nPORT=8080\nDATA_DIR=${data}\nPHOTO_DIR=\n`);
  const shell = (name, body) => writeFileSync(join(bin, name), '#!/usr/bin/env bash\n' + body + '\n', { mode: 0o755 });
  const javascript = (name, body) => writeFileSync(join(bin, name), '#!/usr/bin/env node\n' + body + '\n', { mode: 0o755 });
  shell('id', 'printf "0\\n"');
  shell('systemd-detect-virt', 'printf "%s\\n" "${MOCK_VIRT:-lxc}"');
  shell('getent', 'exit 0');
  shell('chown', 'exit 0');
  shell('useradd', 'exit 0');
  shell('apt-get', 'printf "%s\\n" "$*" >> "$MOCK_STATE/apt"');
  shell('sleep', 'exit 0');
  shell('hostname', 'printf "192.0.2.12\\n"');
  javascript('install', `const {spawnSync}=require('node:child_process'); const args=process.argv.slice(2), keep=[]; for(let i=0;i<args.length;i++){if(args[i]==='-o'||args[i]==='-g'){i++;continue;}keep.push(args[i]);} const result=spawnSync('/usr/bin/install',keep,{stdio:'inherit'}); process.exit(result.status ?? 1);`);
  javascript('systemctl', `
const fs=require('node:fs'), path=require('node:path'), {DatabaseSync}=require('node:sqlite');
const root=process.env.MOCK_STATE, args=process.argv.slice(2), command=args[0];
fs.appendFileSync(path.join(root,'systemctl'),JSON.stringify(args)+'\\n');
const active=path.join(root,'active'), enabled=path.join(root,'enabled');
if(command==='is-active') process.exit(fs.existsSync(active)?0:3);
if(command==='is-enabled') process.exit(fs.existsSync(enabled)?0:1);
if(command==='stop') {
  if(fs.existsSync(path.join(root,'fail-stop')) && fs.existsSync(path.join(process.env.MOCK_APP,'src','FAIL_HEALTH'))) process.exit(1);
  fs.rmSync(active,{force:true});
}
if(command==='disable') fs.rmSync(enabled,{force:true});
if(command==='enable') fs.writeFileSync(enabled,'yes');
if(command==='start') {
  fs.writeFileSync(active,'yes');
  if(fs.existsSync(path.join(process.env.MOCK_APP,'src','FAIL_HEALTH')) && fs.existsSync(path.join(process.env.MOCK_DATA,'family.sqlite'))) {
    const db=new DatabaseSync(path.join(process.env.MOCK_DATA,'family.sqlite'));
    db.prepare('DELETE FROM records WHERE id=?').run('safe'); db.close();
  }
}
`);
  javascript('curl', `
const fs=require('node:fs'),path=require('node:path'); const args=process.argv.slice(2), output=args[args.indexOf('-o')+1], url=args.find(value=>/^https?:/.test(value));
fs.appendFileSync(path.join(process.env.MOCK_STATE,'curl'),url+'\\n');
if(url.endsWith('/api/health')) {
  if(fs.existsSync(path.join(process.env.MOCK_APP,'src','FAIL_HEALTH'))) process.exit(7);
  const version=JSON.parse(fs.readFileSync(path.join(process.env.MOCK_APP,'package.json'),'utf8')).version;
  fs.writeFileSync(output,JSON.stringify({ok:true,version}));
} else {
  if(!url.startsWith('https://nodejs.org/dist/')) process.exit(99);
  fs.copyFileSync(path.join(process.env.MOCK_DOWNLOAD,path.basename(url)),output);
}
`);
  const driver = join(root, 'driver.sh');
  writeFileSync(driver, `#!/usr/bin/env bash
source "$MOCK_SOURCE/scripts/install-lxc.sh"
configure
app_dir="$MOCK_APP"
runtime_root="$MOCK_RUNTIME_ROOT"
runtime_link="$MOCK_RUNTIME_LINK"
backup_root="$MOCK_BACKUPS"
unit_file="$MOCK_UNIT"
lock_file="$MOCK_ROOT/lock/install.lock"
os_release="$MOCK_ROOT/os-release"
systemd_directory="$MOCK_ROOT/systemd"
main "$@"
`);
  const download = join(root, 'download'); mkdirSync(download);
  function release(version = 'v24.19.0') {
    rmSync(download, { recursive: true, force: true }); mkdirSync(download);
    const directory = `node-${version}-linux-x64`, archive = directory + '.tar.xz';
    mkdirSync(join(download, directory, 'bin'), { recursive: true });
    writeFileSync(join(download, directory, 'bin', 'node'), `#!/usr/bin/env bash\nif [ "\${1:-}" = --version ]; then printf '%s\\n' '${version}'; else exec "$MOCK_NODE" "$@"; fi\n`, { mode: 0o755 });
    execFileSync('tar', ['-cJf', join(download, archive), '-C', download, directory]);
    const checksum = createHash('sha256').update(readFileSync(join(download, archive))).digest('hex');
    writeFileSync(join(download, 'SHASUMS256.txt'), `${checksum}  ${archive}\n`);
  }
  release();
  const env = { ...process.env, PATH: bin + ':' + process.env.PATH, MOCK_NODE: process.execPath, MOCK_ROOT: root, MOCK_SOURCE: source, MOCK_APP: app, MOCK_DATA: data, MOCK_RUNTIME_ROOT: runtimeRoot, MOCK_RUNTIME_LINK: runtimeLink, MOCK_BACKUPS: backups, MOCK_UNIT: unit, MOCK_STATE: state, MOCK_DOWNLOAD: download };
  function run(args = [], extra = {}) { return spawnSync('bash', [driver, ...args], { env: { ...env, ...extra }, encoding: 'utf8', timeout: 30000 }); }
  function seed() {
    const store = new Store(data); store.put('notes', 'safe', { title: 'Erhalten', body: 'Familiennotiz' }); store.setMeta('secret', store.encrypt('original-key-test')); store.close();
    mkdirSync(join(data, 'photos'), { recursive: true }); writeFileSync(join(data, 'photos', 'foto.jpg'), 'test-photo');
  }
  function noteExists() { const db = new DatabaseSync(join(data, 'family.sqlite')); const present = !!db.prepare('SELECT id FROM records WHERE id=?').get('safe'); db.close(); return present; }
  return { root, source, app, data, runtimeLink, backups, state, unit, download, bin, run, seed, release, noteExists };
}
function passed(result) { assert.equal(result.status, 0, result.stdout + '\n' + result.stderr); }

test('LXC-Prüfung verhindert Host-Installation und verändert bei --check nichts', t => {
  const f = fixture(t);
  const blocked = f.run([], { MOCK_VIRT: 'none' });
  assert.notEqual(blocked.status, 0); assert.match(blocked.stderr, /LXC-Container/); assert.equal(existsSync(join(f.state, 'apt')), false);
  writeFileSync(join(f.bin, 'pveversion'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  assert.match(f.run().stderr, /Proxmox-Host erkannt/); rmSync(join(f.bin, 'pveversion'));
  passed(f.run(['--check'])); assert.equal(existsSync(f.app), false); assert.equal(existsSync(f.backups), false); assert.equal(existsSync(join(f.state, 'apt')), false);
});

test('Falsche Node.js-Prüfsumme bricht vor Dienst- und Datenänderungen ab', t => {
  const f = fixture(t), manifest = join(f.download, 'SHASUMS256.txt');
  writeFileSync(manifest, readFileSync(manifest, 'utf8').replace(/^[a-f0-9]{64}/, '0'.repeat(64)));
  const result = f.run(); assert.notEqual(result.status, 0); assert.match(result.stderr, /Prüfsumme stimmt nicht/);
  assert.equal(existsSync(f.app), false); assert.equal(existsSync(f.data), false); assert.equal(existsSync(f.unit), false); assert.equal(existsSync(join(f.state, 'systemctl')), false);
});

test('Erstinstallation richtet Laufzeit, Dienst, private Konfiguration und HTTP-Prüfung ein', t => {
  const f = fixture(t); passed(f.run());
  assert.match(readlinkSync(f.runtimeLink), /node-v24\.19\.0-linux-x64$/);
  assert.equal(statSync(dirname(readlinkSync(f.runtimeLink))).mode & 0o777, 0o755);
  assert.equal(statSync(readlinkSync(f.runtimeLink)).mode & 0o777, 0o755);
  assert.equal(statSync(join(f.app, '.env')).mode & 0o777, 0o600);
  assert.equal(statSync(f.data).mode & 0o777, 0o700);
  assert.equal(statSync(f.backups).mode & 0o777, 0o700);
  const service = readFileSync(f.unit, 'utf8'); assert.ok(service.includes(`ExecStart=${f.runtimeLink}/bin/node ${f.app}/server.mjs`)); assert.ok(service.includes(`EnvironmentFile=-${f.app}/.env`));
  assert.equal(existsSync(join(f.app, '.git')), false); assert.equal(existsSync(join(f.app, 'data')), false);
  assert.ok(existsSync(join(f.state, 'active'))); assert.ok(existsSync(join(f.state, 'enabled')));
  const downloads = readFileSync(join(f.state, 'curl'), 'utf8'); assert.match(downloads, /https:\/\/nodejs\.org\/dist\/v24\.19\.0\/node-v24\.19\.0-linux-x64.tar.xz/); assert.match(downloads, /http:\/\/127.0.0.1:8080\/api\/health/);
});

test('Update behält Konfiguration, Notizen, Schlüssel und Fotos und entfernt alten Code', t => {
  const f = fixture(t); writeFileSync(join(f.source, 'src', 'obsolete.txt'), 'old'); passed(f.run()); f.seed();
  const key = readFileSync(join(f.data, 'master.key'));
  const env = readFileSync(join(f.app, '.env'), 'utf8') + 'GOOGLE_CLIENT_SECRET="privat-test"\n'; writeFileSync(join(f.app, '.env'), env);
  rmSync(join(f.source, 'src', 'obsolete.txt')); f.release('v24.20.0'); passed(f.run());
  assert.equal(readFileSync(join(f.app, '.env'), 'utf8'), env); assert.equal(f.noteExists(), true); assert.deepEqual(readFileSync(join(f.data, 'master.key')), key);
  assert.equal(readFileSync(join(f.data, 'photos', 'foto.jpg'), 'utf8'), 'test-photo'); assert.equal(existsSync(join(f.app, 'src', 'obsolete.txt')), false);
  assert.match(readlinkSync(f.runtimeLink), /v24\.20\.0/);
  const update = join(f.backups, 'updates', readdirSync(join(f.backups, 'updates'))[0]);
  assert.deepEqual(readFileSync(join(update, 'master.key')), key); assert.equal(readFileSync(join(update, '.env'), 'utf8'), env); assert.equal(readFileSync(join(update, 'photos', 'foto.jpg'), 'utf8'), 'test-photo');
});

test('Fehlgeschlagener Start stellt vorherigen Code, Laufzeit, Datenbank und Dienst wieder her', t => {
  const f = fixture(t); passed(f.run()); f.seed();
  const runtime = readlinkSync(f.runtimeLink), key = readFileSync(join(f.data, 'master.key')), env = readFileSync(join(f.app, '.env'), 'utf8'), unit = readFileSync(f.unit, 'utf8');
  writeFileSync(join(f.source, 'src', 'FAIL_HEALTH'), 'simulate failed migration/start'); f.release('v24.20.0');
  const result = f.run(); assert.notEqual(result.status, 0); assert.match(result.stderr, /Vorheriger Stand wiederhergestellt/);
  assert.equal(existsSync(join(f.app, 'src', 'FAIL_HEALTH')), false); assert.equal(readlinkSync(f.runtimeLink), runtime); assert.equal(f.noteExists(), true);
  assert.deepEqual(readFileSync(join(f.data, 'master.key')), key); assert.equal(readFileSync(join(f.app, '.env'), 'utf8'), env); assert.equal(readFileSync(f.unit, 'utf8'), unit); assert.ok(existsSync(join(f.state, 'active')));
  const failed = readdirSync(f.backups).find(name => name.startsWith('failed-database-'));
  const db = new DatabaseSync(join(f.backups, failed, 'family.sqlite')); assert.equal(db.prepare('SELECT id FROM records WHERE id=?').get('safe'), undefined); db.close();
  assert.equal(readdirSync(join(f.root, 'opt')).some(name => name.startsWith('.familien-organisierer-install.')), false);
});

test('Fehlende Schlüsseldatei verhindert Update und startet den bisherigen Dienst wieder', t => {
  const f = fixture(t); passed(f.run()); f.seed(); rmSync(join(f.data, 'master.key'));
  writeFileSync(join(f.source, 'src', 'new-code.txt'), 'new'); const result = f.run();
  assert.notEqual(result.status, 0); assert.equal(existsSync(join(f.app, 'src', 'new-code.txt')), false); assert.ok(existsSync(join(f.state, 'active'))); assert.equal(f.noteExists(), true);
});

test('Fehlgeschlagene Erstinstallation entfernt Dienst und Laufzeit-Verknüpfung und behält den Datenordner', t => {
  const f = fixture(t); writeFileSync(join(f.source, 'src', 'FAIL_HEALTH'), 'failed first start');
  const result = f.run(); assert.notEqual(result.status, 0); assert.match(result.stderr, /Erstinstallation zurückgenommen/);
  assert.equal(existsSync(f.app), false); assert.equal(existsSync(f.unit), false); assert.equal(existsSync(f.runtimeLink), false);
  assert.equal(existsSync(join(f.state, 'active')), false); assert.equal(existsSync(join(f.state, 'enabled')), false); assert.ok(existsSync(f.data));
});

test('Wiederherstellung kopiert keine Daten zurück, wenn der neue Dienst nicht gestoppt werden kann', t => {
  const f = fixture(t); passed(f.run()); f.seed(); writeFileSync(join(f.state, 'fail-stop'), 'simulate service stop failure');
  writeFileSync(join(f.source, 'src', 'FAIL_HEALTH'), 'failed start');
  const result = f.run(); assert.notEqual(result.status, 0); assert.match(result.stderr, /nicht sicher gestoppt/);
  assert.equal(f.noteExists(), false); assert.ok(existsSync(join(f.state, 'active')));
  assert.ok(readdirSync(join(f.root, 'opt')).some(name => name.startsWith('.familien-organisierer-install.')));
  const snapshot = join(f.backups, 'updates', readdirSync(join(f.backups, 'updates'))[0], 'family.sqlite');
  const db = new DatabaseSync(snapshot); assert.ok(db.prepare('SELECT id FROM records WHERE id=?').get('safe')); db.close();
});

test('LXC-Konfiguration prüft IPv6, Port, Pfadtrennung und echte Symlink-Ziele', t => {
  const f = fixture(t), file = join(f.root, 'config.env'), app = join(f.root, 'config-app'), runtime = join(f.root, 'config-runtime'), backups = join(f.root, 'config-backups');
  writeFileSync(file, `HOST=::\nPORT=8090\nDATA_DIR=${f.data}\nPHOTO_DIR=\nGOOGLE_CLIENT_SECRET="$(false)"\n`);
  const config = installConfiguration(file, app, runtime, backups); assert.equal(config.healthUrl, 'http://[::1]:8090/api/health');
  writeFileSync(file, `DATA_DIR=${f.data}\nPORT=70000\n`); assert.throws(() => installConfiguration(file, app, runtime, backups), /PORT/);
  writeFileSync(file, `DATA_DIR=${app}/data\n`); assert.throws(() => installConfiguration(file, app, runtime, backups), /getrennt/);
  mkdirSync(app); symlinkSync(app, join(f.root, 'alias'));
  writeFileSync(file, `DATA_DIR=${f.data}\nPHOTO_DIR=${f.root}/alias/photos\n`); assert.throws(() => installConfiguration(file, app, runtime, backups), /getrennt/);
});
