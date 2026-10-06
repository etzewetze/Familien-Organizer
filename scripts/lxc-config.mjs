import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { resolve, isAbsolute, dirname, basename, sep, join } from 'node:path';
import { parseEnv } from 'node:util';
import { isIP } from 'node:net';
import { pathToFileURL } from 'node:url';

function physicalPath(path) {
  if (existsSync(path)) return realpathSync(path);
  const parent = dirname(path);
  return parent === path ? path : join(physicalPath(parent), basename(path));
}
function contains(parent, child) { return child === parent || child.startsWith(parent + sep); }

// .env wird als Daten gelesen, niemals als Shellcode ausgeführt.
export function installConfiguration(file, appDirectory, runtimeDirectory, backupDirectory) {
  const env = parseEnv(readFileSync(file, 'utf8'));
  const data = env.DATA_DIR || '/var/lib/familien-organisierer';
  const photos = env.PHOTO_DIR || join(data, 'photos');
  for (const value of [data, photos]) {
    if (!isAbsolute(value) || /[\r\n\0]/.test(value)) throw new Error('DATA_DIR und PHOTO_DIR müssen absolute Pfade ohne Zeilenumbrüche sein.');
  }
  const dataDir = physicalPath(resolve(data)), photoDir = physicalPath(resolve(photos));
  const app = physicalPath(resolve(appDirectory)), runtime = physicalPath(resolve(runtimeDirectory));
  const backups = physicalPath(resolve(backupDirectory));
  for (const path of [dataDir, photoDir]) {
    if ([app, runtime, backups].some(other => contains(path, other) || contains(other, path))) {
      throw new Error('Daten und Fotos müssen getrennt von Quellcode, Laufzeit und Sicherungen liegen.');
    }
  }
  const host = env.HOST || '0.0.0.0', port = env.PORT || '8080';
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('PORT muss zwischen 1 und 65535 liegen.');
  if (!isIP(host) && host !== 'localhost') throw new Error('HOST muss localhost oder eine IPv4-/IPv6-Adresse sein.');
  let probeHost = host === '0.0.0.0' ? '127.0.0.1' : host === '::' ? '::1' : host;
  if (isIP(probeHost) === 6) probeHost = `[${probeHost}]`;
  const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version;
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Ungültige Projektversion.');
  return { dataDir, photoDir, healthUrl: `http://${probeHost}:${Number(port)}/api/health`, version };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 6) throw new Error('Konfiguration, App-, Laufzeit- und Sicherungspfad erforderlich.');
    const config = installConfiguration(...process.argv.slice(2));
    process.stdout.write([config.dataDir, config.photoDir, config.healthUrl, config.version].join('\n') + '\n');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
