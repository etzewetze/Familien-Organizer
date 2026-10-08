import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, cpSync, statSync, renameSync, readlinkSync, symlinkSync, chmodSync, chownSync, rmSync, appendFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

export const UPDATE_REPOSITORY = 'https://github.com/etzewetze/Familien-Organizer.git';
const runningPhases = new Set(['backup', 'downloading', 'installing', 'rollback']);
const versionParts = version => /^\d+\.\d+\.\d+$/.test(version) ? version.split('.').map(Number) : null;
const older = (a, b) => { const x = versionParts(a), y = versionParts(b); return x.some((n, i) => n !== y[i] && x.slice(0, i).every((v, j) => v === y[j]) && n < y[i]); };

export function runUpdateCommand(command, args, { cwd, env, onLine, log, timeout = 1200000 } = {}) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, args, { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', tail = '', timedOut = false, forceTimer;
    const receive = chunk => {
      const value = chunk.toString(); if (log) appendFileSync(log, value, { mode: 0o600 });
      output = (output + value).slice(-32768); tail += value;
      let end; while ((end = tail.indexOf('\n')) >= 0) { onLine?.(tail.slice(0, end)); tail = tail.slice(end + 1); }
      if (tail.length > 8192) tail = tail.slice(-8192);
    };
    child.stdout.on('data', receive); child.stderr.on('data', receive);
    const timer = setTimeout(() => {
      timedOut = true;
      try { process.kill(-child.pid, 'SIGTERM'); } catch {}
      forceTimer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }, 120000);
    }, timeout);
    child.on('error', error => { clearTimeout(timer); clearTimeout(forceTimer); reject(error); });
    child.on('close', code => { clearTimeout(timer); clearTimeout(forceTimer); if (tail) onLine?.(tail); resolveResult({ code: code ?? 1, output, timedOut }); });
  });
}

export class UpdateRunner {
  constructor(config, { run = runUpdateCommand, health, now = () => new Date().toISOString() } = {}) {
    this.config = config; this.run = run; this.now = now; this.running = false; this.pending = null;
    for (const key of ['appDir', 'runtimeLink', 'backupRoot', 'stateRoot', 'dataDir', 'photoDir', 'unitFile']) {
      if (typeof config[key] !== 'string' || resolve(config[key]) !== config[key]) throw new Error(`Ungültiger Updatepfad: ${key}`);
    }
    mkdirSync(config.stateRoot, { recursive: true, mode: 0o700 }); chmodSync(config.stateRoot, 0o700);
    this.statusFile = join(config.stateRoot, 'status.json');
    this.health = health || (async version => {
      for (let attempt = 0; attempt < 5; attempt++) {
        try { const res = await fetch(config.healthUrl, { redirect: 'error', signal: AbortSignal.timeout(3000) }); const data = await res.json(); if (res.ok && data.ok === true && data.version === version) return true; } catch {}
        if (attempt < 4) await new Promise(resolveWait => setTimeout(resolveWait, 500));
      }
      return false;
    });
    try { this.current = JSON.parse(readFileSync(this.statusFile, 'utf8')); } catch { this.current = { phase: 'idle', message: 'Bereit für ein Update.', backupCreated: false }; }
    if (runningPhases.has(this.current.phase)) this.set({ phase: 'interrupted', message: 'Das letzte Update wurde unterbrochen. Bitte den Zustand des Dienstes prüfen, bevor du erneut aktualisierst.', restored: null });
  }
  set(value) {
    this.current = { ...this.current, ...value };
    const temporary = this.statusFile + '.tmp'; writeFileSync(temporary, JSON.stringify(this.current), { mode: 0o600 }); renameSync(temporary, this.statusFile);
  }
  status() { return { ...this.current, supported: true, active: this.running }; }
  start() {
    if (this.running) { const error = new Error('Ein Update läuft bereits.'); error.status = 409; throw error; }
    this.running = true;
    try { this.set({ phase: 'backup', message: 'Sicherung wird erstellt …', startedAt: this.now(), finishedAt: null, error: '', backupCreated: false, restored: null, targetVersion: null }); }
    catch { this.running = false; const error = new Error('Der Update-Status konnte nicht gespeichert werden. Bitte den freien Speicher prüfen.'); error.status = 503; throw error; }
    this.pending = this.perform().catch(error => {
      const value = { phase: 'failed', message: 'Der Updateauftrag konnte nicht abgeschlossen werden.', error: error.message.slice(0, 800), finishedAt: this.now() };
      try { this.set(value); } catch { this.current = { ...this.current, ...value }; }
    }).finally(() => { this.running = false; });
    return this.status();
  }
  async perform() {
    const c = this.config, work = mkdtempSync(join(c.stateRoot, 'job-'));
    const log = join(c.stateRoot, 'last-update.log'); writeFileSync(log, '', { mode: 0o600 });
    const environment = { PATH: `${c.runtimeLink}/bin:/usr/bin:/bin`, LANG: 'C.UTF-8', DATA_DIR: c.dataDir, PHOTO_DIR: c.photoDir, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
    const command = (name, args, options = {}) => this.run(name, args, { cwd: work, env: environment, log, ...options });
    let previous, backup, attempted = false, keep = false, installerRestored = false;
    try {
      previous = { version: JSON.parse(readFileSync(join(c.appDir, 'package.json'), 'utf8')).version, runtime: readlinkSync(c.runtimeLink), owner: statSync(c.dataDir) };
      cpSync(c.appDir, join(work, 'previous-app'), { recursive: true, dereference: false });
      cpSync(c.unitFile, join(work, 'previous.service'));
      const result = await command(`${c.runtimeLink}/bin/node`, [join(c.appDir, 'scripts/backup.mjs'), join(c.backupRoot, 'web-updates')]);
      if (result.code !== 0) throw new Error('Die Sicherung konnte nicht erstellt werden. Es wurde keine neue Version installiert.');
      backup = result.output.trim().split('\n').at(-1);
      if (!backup?.startsWith(join(c.backupRoot, 'web-updates') + '/') || !existsSync(join(backup, 'family.sqlite')) || !existsSync(join(backup, 'master.key'))) throw new Error('Die Sicherung ist unvollständig. Das Update wurde gestoppt.');
      this.set({ backupCreated: true, phase: 'downloading', message: 'Neue Software wird von GitHub geladen …' });
      const source = join(work, 'source');
      const download = await command('git', ['-c', 'credential.helper=', '-c', 'core.hooksPath=/dev/null', 'clone', '--depth', '1', '--single-branch', '--branch', 'main', UPDATE_REPOSITORY, source], { timeout: 300000 });
      if (download.code !== 0) throw new Error('Der Download von GitHub ist fehlgeschlagen. Verbindung und öffentliche Erreichbarkeit des Repositorys prüfen.');
      const candidate = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8')).version;
      if (!versionParts(candidate) || !versionParts(previous.version) || older(candidate, previous.version)) throw new Error('Die geladene Software enthält keine passende aktuelle Versionsnummer.');
      this.set({ phase: 'installing', targetVersion: candidate, message: `Version ${candidate} wird installiert …` }); attempted = true;
      const installed = await command('bash', [join(source, 'scripts/install-lxc.sh')], { onLine: line => {
        if (line.includes('vorherigen Stand wiederherstellen')) this.set({ phase: 'rollback', message: 'Das Update ist fehlgeschlagen. Die vorherige Version wird wiederhergestellt …' });
      } });
      installerRestored = installed.output.includes('Vorheriger Stand wiederhergestellt.');
      const innerBackup = installed.output.split('\n').filter(line => line.startsWith('Sicherung erstellt: ')).at(-1)?.slice('Sicherung erstellt: '.length);
      if (innerBackup?.startsWith(c.backupRoot + '/') && existsSync(join(innerBackup, 'family.sqlite')) && existsSync(join(innerBackup, 'master.key'))) backup = innerBackup;
      if (installed.code !== 0 || !await this.health(candidate)) {
        const lines = installed.output.split('\n').filter(line => /Fehler:|fehlgeschlagen|konnten nicht|konnte nicht|unvollständig|nicht erreicht|nicht gestartet|keine gültige/i.test(line));
        throw new Error(installed.timedOut ? 'Das Update hat das Zeitlimit überschritten.' : lines.slice(-3).join(' ').slice(0, 800) || 'Die neue Version hat die Startprüfung nicht bestanden.');
      }
      this.set({ phase: 'success', message: `Update auf Version ${candidate} erfolgreich. Die Sicherung wurde aufbewahrt.`, finishedAt: this.now(), installedVersion: candidate, restored: false });
    } catch (error) {
      let restored = false;
      if (attempted && previous && backup) {
        this.set({ phase: 'rollback', message: 'Die vorherige Version wird wiederhergestellt …' });
        try {
          if (installerRestored && await this.health(previous.version)) restored = true;
          else {
            const stopped = await command('systemctl', ['stop', 'familien-organisierer.service']);
            if (stopped.code !== 0) throw new Error('Der Dienst konnte nicht sicher gestoppt werden. Die Datenbank wurde nicht überschrieben.');
            const failed = join(c.backupRoot, 'web-failed-' + work.split('/').at(-1)); mkdirSync(failed, { mode: 0o700 });
            if (existsSync(c.appDir)) renameSync(c.appDir, join(dirname(c.appDir), '.failed-' + work.split('/').at(-1)));
            cpSync(join(work, 'previous-app'), c.appDir, { recursive: true, dereference: false });
            for (const file of ['family.sqlite', 'family.sqlite-wal', 'family.sqlite-shm', 'master.key']) if (existsSync(join(c.dataDir, file))) renameSync(join(c.dataDir, file), join(failed, file));
            for (const file of ['family.sqlite', 'master.key']) { cpSync(join(backup, file), join(c.dataDir, file)); chmodSync(join(c.dataDir, file), 0o600); chownSync(join(c.dataDir, file), previous.owner.uid, previous.owner.gid); }
            const link = c.runtimeLink + '.restore-' + work.split('/').at(-1); symlinkSync(previous.runtime, link); renameSync(link, c.runtimeLink);
            cpSync(join(work, 'previous.service'), c.unitFile);
            if ((await command('systemctl', ['daemon-reload'])).code !== 0 || (await command('systemctl', ['start', 'familien-organisierer.service'])).code !== 0 || !await this.health(previous.version)) throw new Error('Die vorherige Version konnte nicht wieder gestartet werden.');
            restored = true;
          }
        } catch (restoreError) { keep = true; error.message += ' ' + restoreError.message; }
      }
      this.set({ phase: keep ? 'rollback_failed' : 'failed', error: error.message.slice(0, 1200), restored, message: restored ? 'Update fehlgeschlagen. Die vorherige Version wurde wiederhergestellt.' : attempted ? 'Update fehlgeschlagen. Bitte den Dienst und die Sicherung prüfen.' : 'Update abgebrochen. Die vorhandene Installation wurde erhalten.', finishedAt: this.now() });
    } finally { if (!keep) rmSync(work, { recursive: true, force: true }); }
  }
}
