// Isolierte Entwicklungsdemo. Dieser Prozess verwendet nie den echten DATA_DIR.
// npm start startet dagegen den normalen Server mit Anmeldung und echten Daten.
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { createApp } from '../server.mjs';
import { seed } from '../src/seed.mjs';
const root = resolve('.sites-runtime'); mkdirSync(root, { recursive: true });
const directory = mkdtempSync(join(root, 'demo-'));
const app = createApp({ DATA_DIR: directory });
app.store.setMeta('password', { salt: 'demo-unused', hash: 'demo-unused' });
app.store.setMeta('settings', { familyName: 'Familie Sonnenschein', timezone: 'Europe/Berlin', photoInterval: 15, photoFit: 'contain', remoteManifestUrl: '', immichUrl: '', immichAlbumId: '' });
seed(app.store, ['Anna', 'Ben', 'Mia', 'Leo'], true, new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date()));
const token = randomBytes(32).toString('base64url');
app.store.db.prepare('INSERT INTO sessions VALUES (?,?)').run(createHash('sha256').update(token).digest('hex'), Date.now() + 86400000);
app.server.prependListener('request', req => { req.headers.cookie = `family_session=${token}`; });
const portArgument = process.argv.indexOf('--port');
const port = Number(portArgument > 0 ? process.argv[portArgument + 1] : process.env.PORT || 4173);
app.server.listen(port, '0.0.0.0', () => console.log(`Entwicklungsdemo mit Wegwerfdaten auf Port ${port}. Nicht produktiv verwenden.`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => app.server.close(() => { app.store.close(); rmSync(directory, { recursive: true, force: true }); process.exit(0); }));
