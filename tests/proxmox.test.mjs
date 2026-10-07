import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const repository = fileURLToPath(new URL('../', import.meta.url));
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'family-proxmox-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, 'project'), state = join(root, 'state'), bin = join(root, 'bin');
  for (const dir of [state, bin, join(root, 'work')]) mkdirSync(dir, { recursive: true });
  cpSync(repository, source, { recursive: true, filter: path => ! /^(?:\.git|data|backups|node_modules|test-results|\.sites-runtime)(?:\/|$)|^\.env$/.test(relative(repository, path)) });
  writeFileSync(join(source, '.env'), 'GOOGLE_CLIENT_SECRET=never-transfer-this\n');
  mkdirSync(join(source, 'data')); writeFileSync(join(source, 'data', 'master.key'), 'never-transfer-key');
  mkdirSync(join(source, '.git')); writeFileSync(join(source, '.git', 'config'), 'credential-secret');
  const shell = (name, code) => writeFileSync(join(bin, name), '#!/usr/bin/env bash\n' + code + '\n', { mode: 0o755 });
  const js = (name, code) => writeFileSync(join(bin, name), '#!/usr/bin/env node\n' + code + '\n', { mode: 0o755 });
  shell('id', 'printf "0\\n"');
  shell('uname', 'printf "x86_64\\n"');
  shell('pveversion', 'printf "pve-manager/%s.1.0/abcdef\\n" "${MOCK_PVE_MAJOR:-9}"');
  shell('sleep', 'exit 0');
  shell('ip', 'printf "3: vmbr0: <BROADCAST,MULTICAST,UP> mtu 1500\\n4: vmbr1: <BROADCAST,MULTICAST,UP> mtu 1500\\n"');
  js('pvesm', `
const args=process.argv.slice(2); if(args[0]!=='status'||!args.includes('--enabled')) process.exit(90);
console.log('Name Type Status Total Used Available %');
if(args[args.indexOf('--content')+1]==='vztmpl') console.log('local dir active 134217728 1048576 133169152 1%');
else if(process.env.MOCK_AMBIGUOUS==='yes') {console.log('pool-a zfspool active 134217728 1048576 133169152 1%');console.log('pool-b zfspool active 134217728 1048576 133169152 1%');}
else console.log('local-lvm lvmthin active 134217728 1048576 '+(process.env.MOCK_DISK_FREE||'133169152')+' 1%');
`);
  js('pvesh', `
const fs=require('node:fs'),path=require('node:path'),args=process.argv.slice(2);
if(args[0]!=='get'||args[1]!=='/cluster/nextid') process.exit(90);
const requested=args.includes('--vmid')?args[args.indexOf('--vmid')+1]:'101';
if(requested===process.env.MOCK_BUSY_ID||fs.existsSync(path.join(process.env.MOCK_STATE,'ct-'+requested))) {console.error('VMID already exists');process.exit(1);}
console.log(requested);
`);
  js('pveam', `
const fs=require('node:fs'),path=require('node:path'),args=process.argv.slice(2),root=process.env.MOCK_STATE;
fs.appendFileSync(path.join(root,'pveam'),JSON.stringify(args)+'\\n');
if(args[0]==='available') {console.log('system debian-12-standard_12.7-1_amd64.tar.zst');console.log('system debian-13-standard_13.0-1_amd64.tar.zst');console.log('system debian-13-standard_13.1-2_amd64.tar.zst');console.log('system ubuntu-24.04-standard_24.04-2_amd64.tar.zst');console.log('system debian-13-standard_13.1-2_arm64.tar.zst');}
if(args[0]==='list') {console.log('NAME SIZE');if(process.env.MOCK_CACHED==='yes') console.log('local:vztmpl/debian-13-standard_13.1-2_amd64.tar.zst 100MiB');}
`);
  js('pct', `
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const args=process.argv.slice(2),root=process.env.MOCK_STATE,command=args[0],id=args[1];
fs.appendFileSync(path.join(root,'pct'),JSON.stringify(args)+'\\n');
if(command==='create') fs.writeFileSync(path.join(root,'ct-'+id),JSON.stringify(args));
if(command==='start') fs.writeFileSync(path.join(root,'started'),'yes');
if(command==='set') fs.writeFileSync(path.join(root,'autostart'),'yes');
if(command==='push') {if(process.env.MOCK_PUSH_FAIL==='yes') process.exit(1); fs.copyFileSync(args[2],path.join(root,'source.tar.gz'));}
if(command==='exec') {
  const cmd=args.slice(3);
  if(cmd[0]==='getent'&&process.env.MOCK_NETWORK_FAIL==='yes') process.exit(1);
  if(cmd[0]==='test'&&cmd[1]==='-f') process.exit(fs.existsSync(path.join(root,'unpacked','scripts','install-lxc.sh'))?0:1);
  if(cmd[0]==='hostname') console.log('192.0.2.42');
  if(cmd[0]==='bash') {
    const archive=path.join(root,'source.tar.gz'), checksum=args[args.length-2];
    const actual=crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
    if(actual!==checksum) process.exit(33);
    const target=path.join(root,'unpacked');fs.mkdirSync(target,{recursive:true});
    cp.execFileSync('tar',['-xzf',archive,'-C',target]);
    if(process.env.MOCK_INSTALL_FAIL==='yes') process.exit(2);
    fs.writeFileSync(path.join(root,'installed'),'yes');
  }
}
if(command==='destroy'||command==='delete') process.exit(99);
`);
  const driver = join(root, 'driver.sh');
  writeFileSync(driver, `#!/usr/bin/env bash
source "$MOCK_PROJECT/scripts/create-proxmox-lxc.sh"
configure_proxmox
work_prefix="$MOCK_ROOT/work/install.XXXXXXXX"
lock_file="$MOCK_ROOT/install.lock"
main_proxmox "$@"
`);
  const env = { ...process.env, PATH: bin + ':' + process.env.PATH, MOCK_ROOT: root, MOCK_PROJECT: source, MOCK_STATE: state };
  function run(args = [], extra = {}) { return spawnSync('bash', [driver, ...args], { env: { ...env, ...extra }, encoding: 'utf8', timeout: 30000 }); }
  function calls(name) { const file = join(state, name); return existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : []; }
  return { root, source, state, bin, run, calls };
}
function passed(result) { assert.equal(result.status, 0, result.stdout + '\n' + result.stderr); }
function option(call, name) { return call[call.indexOf(name) + 1]; }

test('Proxmox-Vorprüfung zeigt Mindestwerte und verändert weder Template-Katalog noch Container', t => {
  const f = fixture(t), result = f.run(['--dry-run']); passed(result);
  assert.match(result.stdout, /1024 MiB RAM/); assert.match(result.stdout, /8 GiB Disk/); assert.match(result.stdout, /Debian 13/);
  assert.equal(f.calls('pct').length, 0); assert.equal(f.calls('pveam').length, 0); assert.equal(existsSync(join(f.root, 'install.lock')), false);
});

test('Belegte clusterweite ID, fehlende Bridge und unzureichender Speicher verhindern Erstellung', t => {
  const f = fixture(t);
  const busy = f.run(['--vmid', '120'], { MOCK_BUSY_ID: '120' }); assert.notEqual(busy.status, 0); assert.match(busy.stderr, /bereits belegt/);
  const bridge = f.run(['--bridge', 'vmbr9']); assert.notEqual(bridge.status, 0); assert.match(bridge.stderr, /nicht vorhanden/);
  const disk = f.run([], { MOCK_DISK_FREE: '1024' }); assert.notEqual(disk.status, 0); assert.match(disk.stderr, /weniger als 8 GiB/);
  assert.equal(f.calls('pct').length, 0); assert.equal(f.calls('pveam').length, 0);
});

test('Ressourcen unter Mindestwerten und ungültiges Netzwerk werden vor Änderungen abgewiesen', t => {
  const f = fixture(t);
  for (const args of [['--memory','512'],['--disk','4'],['--cores','0'],['--ip4','999.1.1.1/24','--gateway','192.0.2.1'],['--ip4','192.0.2.7./24','--gateway','192.0.2.1'],['--ip4','192.0.2.7/24'],['--vmid','x;echo bad'],['--vlan','4095']]) {
    assert.notEqual(f.run(args).status, 0, args.join(' '));
  }
  assert.equal(f.calls('pct').length, 0); assert.equal(f.calls('pveam').length, 0);
});

test('Erstellung lädt aktuelles passendes Debian-Template und installiert mit Mindestwerten ohne Geheimnisse', t => {
  const f = fixture(t), result = f.run(); passed(result); assert.match(result.stdout, /http:\/\/192\.0\.2\.42:8080/);
  const calls = f.calls('pct'), create = calls.find(c => c[0] === 'create');
  assert.equal(create[1], '101'); assert.equal(create[2], 'local:vztmpl/debian-13-standard_13.1-2_amd64.tar.zst');
  for (const [key, value] of [['--cores','1'],['--memory','1024'],['--swap','512'],['--rootfs','local-lvm:8'],['--unprivileged','1'],['--onboot','0'],['--cmode','shell'],['--features','nesting=1']]) assert.equal(option(create, key), value);
  assert.equal(option(create, '--net0'), 'name=eth0,bridge=vmbr0,ip=dhcp,firewall=1');
  assert.equal(calls.some(c => c[0] === 'destroy'), false); assert.ok(calls.find(c => c[0] === 'set' && option(c, '--onboot') === '1'));
  assert.ok(f.calls('pveam').find(c => c[0] === 'download'));
  const project = join(f.state, 'unpacked'); assert.ok(existsSync(join(project, 'scripts', 'install-lxc.sh'))); assert.ok(existsSync(join(project, '.env.example')));
  assert.equal(existsSync(join(project, '.git')), false); assert.equal(existsSync(join(project, '.env')), false); assert.equal(existsSync(join(project, 'data')), false);
  assert.equal(readdirSync(join(f.root, 'work')).length, 0);
});

test('Proxmox 8 verwendet Debian 12 und vorhandenes Debian-13-Template wird auf Proxmox 9 wiederverwendet', t => {
  const f = fixture(t); passed(f.run([], { MOCK_PVE_MAJOR:'8' }));
  const debian12 = f.calls('pct').find(c => c[0] === 'create');
  assert.match(debian12[2], /debian-12-standard_/); assert.equal(debian12.includes('--features'), false);
  const g = fixture(t); passed(g.run([], { MOCK_CACHED:'yes' })); assert.equal(g.calls('pveam').some(c => c[0] === 'download'), false);
  assert.equal(option(g.calls('pct').find(c => c[0] === 'create'), '--features'), 'nesting=1');
  const h = fixture(t); assert.notEqual(h.run(['--debian','13'], { MOCK_PVE_MAJOR:'8' }).status, 0); assert.equal(h.calls('pct').length, 0);
});

test('Eigene ID, statische IPv4, VLAN und größere Ressourcen werden korrekt übernommen', t => {
  const f = fixture(t); passed(f.run(['--vmid','120','--hostname','familienwand','--cores','2','--memory','2048','--disk','16','--bridge','vmbr1','--ip4','192.0.2.60/24','--gateway','192.0.2.1','--vlan','20']));
  const create = f.calls('pct').find(c => c[0] === 'create'); assert.equal(create[1], '120'); assert.equal(option(create, '--hostname'), 'familienwand'); assert.equal(option(create, '--rootfs'), 'local-lvm:16');
  assert.equal(option(create, '--net0'), 'name=eth0,bridge=vmbr1,ip=192.0.2.60/24,firewall=1,gw=192.0.2.1,tag=20');
});

test('Eigener DNS-Server wird geprüft und übergeben; ohne Auswahl bleibt Proxmox-DNS erhalten', t => {
  const f = fixture(t); passed(f.run(['--nameserver', '192.0.2.53']));
  const create = f.calls('pct').find(c => c[0] === 'create'); assert.equal(option(create, '--nameserver'), '192.0.2.53');
  const g = fixture(t); passed(g.run()); assert.equal(g.calls('pct').find(c => c[0] === 'create').includes('--nameserver'), false);
  const h = fixture(t);
  for (const value of ['127.0.0.1', '0.0.0.0', '224.0.0.1', '999.1.1.1', '192.0.2.53;echo bad']) assert.notEqual(h.run(['--nameserver', value]).status, 0);
  assert.equal(h.calls('pct').length, 0); assert.equal(h.calls('pveam').length, 0);
});

test('Mehrdeutige Speicher verlangen Auswahl; ausgewählter Speicher wird benutzt', t => {
  const f = fixture(t), ambiguous = f.run(['--dry-run'], { MOCK_AMBIGUOUS:'yes' }); assert.notEqual(ambiguous.status, 0); assert.match(ambiguous.stderr, /rootfs-storage/);
  passed(f.run(['--rootfs-storage','pool-b'], { MOCK_AMBIGUOUS:'yes' })); assert.equal(option(f.calls('pct').find(c => c[0] === 'create'), '--rootfs'), 'pool-b:8');
});

test('Fehler bei Netzwerk, Übertragung oder Installation behalten neuen Container ohne Autostart und ohne Löschen', t => {
  for (const extra of [{MOCK_NETWORK_FAIL:'yes'}, {MOCK_PUSH_FAIL:'yes'}, {MOCK_INSTALL_FAIL:'yes'}]) {
    const f = fixture(t), result = f.run([], extra); assert.notEqual(result.status, 0); assert.match(result.stderr, /bleibt zur Diagnose erhalten/);
    if (extra.MOCK_INSTALL_FAIL) {
      assert.match(result.stderr, /pct exec 101 -- bash .*install-lxc.sh/); assert.match(result.stderr, /pct set 101 --onboot 1/);
    } else {
      assert.match(result.stderr, /Quellcode wurde noch nicht vollständig bereitgestellt/); assert.doesNotMatch(result.stderr, /pct exec 101 -- bash/);
    }
    const calls = f.calls('pct'); assert.ok(calls.find(c => c[0] === 'create')); assert.equal(calls.some(c => c[0] === 'set'), false); assert.equal(calls.some(c => c[0] === 'destroy'), false);
    assert.equal(readdirSync(join(f.root, 'work')).length, 0);
  }
});
