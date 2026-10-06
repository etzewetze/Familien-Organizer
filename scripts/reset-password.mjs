import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync } from 'node:crypto';
if (!process.argv.includes('--confirm')) { console.error('Nur als Betreiber ausführen: node scripts/reset-password.mjs --confirm. Setzt das Familienpasswort neu und meldet alle Geräte ab.'); process.exit(1); }
const root = fileURLToPath(new URL('../', import.meta.url));
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));
const file = join(resolve(process.env.DATA_DIR || join(root, 'data')), 'family.sqlite');
if (!existsSync(file)) throw new Error('Keine Datenbank gefunden.');
const password = randomBytes(18).toString('base64url'), salt = randomBytes(16).toString('hex');
const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
const db = new DatabaseSync(file);
try { db.exec('BEGIN IMMEDIATE'); db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify({ salt, hash }), 'password'); db.exec('DELETE FROM sessions; COMMIT'); }
finally { db.close(); }
console.log('Neues Familienpasswort (privat aufbewahren, danach unter Einstellungen ändern):');
console.log(password);
