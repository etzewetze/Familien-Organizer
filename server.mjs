import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { Store } from './src/store.mjs';
import { Model, AppError, check, text, number, networkUrl, appearanceSettings } from './src/model.mjs';
import { GoogleSync } from './src/google.mjs';
import { Photos } from './src/photos.mjs';
import { importRecipe } from './src/recipe-import.mjs';
import { UpdaterClient } from './src/updater-client.mjs';
import { seed } from './src/seed.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const hash = value => createHash('sha256').update(value).digest('hex');
const VERSION = '0.5.0';
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };
function passwordHash(password, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex') };
}
function validPassword(value) { check(typeof value === 'string' && value.length >= 12 && value.length <= 200, 'Das Familienpasswort braucht 12 bis 200 Zeichen.'); return value; }

export function createApp(env = process.env, services = {}) {
  const store = new Store(env.DATA_DIR || join(ROOT, 'data'));
  const model = new Model(store), google = new GoogleSync(store, model, env);
  const photos = new Photos(store, env.PHOTO_DIR || join(store.directory, 'photos'));
  const taskPhotos = new Photos(store, join(store.directory, 'task-images'));
  const uiPhotos = new Photos(store, join(store.directory, 'ui-images'));
  const updater = services.updater || new UpdaterClient(env.UPDATER_SOCKET);
  const loadRecipe = services.importRecipe || importRecipe;
  let activeRecipeImports = 0;
  const failures = new Map();
  const parentFailures = new Map();
  function verifyPassword(stored, value) {
    const attempt = passwordHash(typeof value === 'string' ? value.slice(0, 200) : '', stored?.salt || 'not-configured');
    return !!stored && timingSafeEqual(Buffer.from(attempt.hash, 'hex'), Buffer.from(stored.hash, 'hex'));
  }
  function verifyParent(req, password) {
    check(store.meta('parentPassword'), 'Zuerst ein Elternpasswort in den Einstellungen anlegen.', 403);
    const address = req.socket.remoteAddress;
    const entry = parentFailures.get(address) || { attempts: 0, start: Date.now() };
    if (Date.now() - entry.start > 600000) { entry.attempts = 0; entry.start = Date.now(); }
    check(entry.attempts < 10, 'Zu viele Versuche. Bitte in 10 Minuten erneut versuchen.', 429);
    if (!verifyPassword(store.meta('parentPassword'), password)) { entry.attempts++; parentFailures.set(address, entry); throw new AppError('Das Elternpasswort stimmt nicht.', 403); }
    parentFailures.delete(address);
  }
  const cookie = token => `family_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${env.COOKIE_SECURE === 'true' || env.APP_URL?.startsWith('https:') ? '; Secure' : ''}`;
  function newSession(response) {
    const token = randomBytes(32).toString('base64url');
    store.db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
    store.db.prepare('INSERT INTO sessions VALUES (?,?)').run(hash(token), Date.now() + 30 * 86400000);
    response.setHeader('Set-Cookie', cookie(token));
  }
  function session(req) {
    const token = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('family_session='))?.slice(15);
    if (!token || token.length > 100) return null;
    const tokenHash = hash(token);
    return store.db.prepare('SELECT hash FROM sessions WHERE hash=? AND expires>?').get(tokenHash, Date.now())?.hash || null;
  }
  function secureHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    res.setHeader('Cache-Control', 'no-store');
  }
  function json(res, value, status = 200) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); }
  async function body(req, raw = false, max = raw ? 20 * 1024 * 1024 : 1024 * 1024) {
    check(!req.headers['content-length'] || Number(req.headers['content-length']) <= max, 'Datei oder Anfrage ist zu groß.', 413);
    const chunks = []; let size = 0;
    for await (const part of req) { size += part.length; check(size <= max, 'Anfrage ist zu groß.', 413); chunks.push(part); }
    const bytes = Buffer.concat(chunks);
    if (raw) return bytes;
    check(req.headers['content-type']?.startsWith('application/json'), 'JSON-Anfrage erwartet.', 415);
    try { const value = JSON.parse(bytes.toString()); check(value && typeof value === 'object' && !Array.isArray(value), 'Ungültige Anfrage.'); return value; }
    catch (error) { if (error instanceof AppError) throw error; throw new AppError('Ungültige JSON-Anfrage.'); }
  }
  function protectWrite(req) {
    if (['GET', 'HEAD'].includes(req.method)) return;
    check(req.headers['x-family-request'] === '1', 'Ungültige Anfragequelle.', 403);
    check(req.headers['sec-fetch-site'] !== 'cross-site', 'Anfragen von fremden Seiten sind gesperrt.', 403);
    if (req.headers.origin) {
      const origin = new URL(req.headers.origin);
      const expected = env.APP_URL ? new URL(env.APP_URL) : null;
      check(expected ? origin.origin === expected.origin : origin.host === req.headers.host, 'Anfragen von fremden Seiten sind gesperrt.', 403);
    }
  }
  function today() { return new Intl.DateTimeFormat('sv-SE', { timeZone: store.meta('settings', {}).timezone || 'Europe/Berlin' }).format(new Date()); }
  const server = createServer(async (req, res) => {
    secureHeaders(res);
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;
      if (path === '/api/health' && req.method === 'GET') return json(res, { ok: true, version: VERSION });
      if (path === '/api/status' && req.method === 'GET') return json(res, { configured: !!store.meta('password'), authenticated: !!session(req), version: VERSION, googleConfigured: google.configured });
      if (path.startsWith('/api/')) protectWrite(req);
      if (path === '/api/setup' && req.method === 'POST') {
        check(!store.meta('password'), 'Diese Familienzentrale ist bereits eingerichtet.', 409);
        const data = await body(req);
        const password = validPassword(data.password);
        const familyName = text(data.familyName || 'Unsere Familie', 60, true);
        check(Array.isArray(data.names) && data.names.length >= 1 && data.names.length <= 20, 'Bitte 1 bis 20 Familienmitglieder anlegen.');
        const names = data.names.map(n => text(n, 50, true));
        const encoded = passwordHash(password);
        store.transaction(() => {
          check(!store.meta('password'), 'Die Einrichtung wurde bereits abgeschlossen.', 409);
          store.setMeta('password', encoded);
          store.setMeta('settings', { familyName, timezone: 'Europe/Berlin', photoInterval: 15, photoFit: 'contain', remoteManifestUrl: '', immichUrl: '', immichAlbumId: '' });
          seed(store, names, !!data.demo, today());
        });
        newSession(res);
        return json(res, { ok: true }, 201);
      }
      if (path === '/api/login' && req.method === 'POST') {
        const address = req.socket.remoteAddress;
        const entry = failures.get(address) || { attempts: 0, start: Date.now() };
        if (Date.now() - entry.start > 600000) { entry.attempts = 0; entry.start = Date.now(); }
        check(entry.attempts < 10, 'Zu viele Anmeldeversuche. Bitte in 10 Minuten erneut versuchen.', 429);
        const data = await body(req), stored = store.meta('password');
        const attempt = passwordHash(typeof data.password === 'string' ? data.password.slice(0, 200) : '', stored?.salt || 'not-configured');
        if (!stored || !timingSafeEqual(Buffer.from(attempt.hash, 'hex'), Buffer.from(stored.hash, 'hex'))) {
          entry.attempts++; failures.set(address, entry);
          throw new AppError('Das Passwort stimmt nicht.', 401);
        }
        failures.delete(address); newSession(res); return json(res, { ok: true });
      }
      if (path.startsWith('/api/')) {
        const sessionHash = session(req);
        check(sessionHash, 'Bitte anmelden.', 401);
        if (path === '/api/logout' && req.method === 'POST') {
          store.db.prepare('DELETE FROM sessions WHERE hash=?').run(sessionHash);
          res.setHeader('Set-Cookie', 'family_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
          return json(res, { ok: true });
        }
        if (path === '/api/state' && req.method === 'GET') return json(res, store.state());
        if (path === '/api/export' && req.method === 'GET') {
          res.setHeader('Content-Disposition', `attachment; filename="familien-daten-${today()}.json"`);
          return json(res, { format: 'familien-organisierer-export', version: VERSION, exportedAt: new Date().toISOString(), ...store.state() });
        }
        if (path === '/api/password' && req.method === 'POST') {
          const data = await body(req), old = store.meta('password');
          const attempt = passwordHash(text(data.currentPassword, 200), old.salt);
          check(timingSafeEqual(Buffer.from(attempt.hash, 'hex'), Buffer.from(old.hash, 'hex')), 'Das bisherige Passwort stimmt nicht.', 401);
          store.setMeta('password', passwordHash(validPassword(data.newPassword)));
          store.db.prepare('DELETE FROM sessions').run(); newSession(res); return json(res, { ok: true });
        }
        if (path === '/api/parent-password' && req.method === 'PUT') {
          const data = await body(req);
          check(verifyPassword(store.meta('password'), data.familyPassword), 'Das Familienpasswort stimmt nicht.', 403);
          if (store.meta('parentPassword')) verifyParent(req, data.currentPassword);
          check(typeof data.newPassword === 'string' && data.newPassword.length >= 8 && data.newPassword.length <= 200, 'Das Elternpasswort braucht 8 bis 200 Zeichen.');
          check(data.newPassword === data.confirmPassword, 'Die neuen Passwörter stimmen nicht überein.');
          store.transaction(() => { store.setMeta('parentPassword', passwordHash(data.newPassword)); store.bump(); });
          return json(res, { ok: true });
        }
        if (path === '/api/points/award' && req.method === 'POST') {
          const data = await body(req); verifyParent(req, data.password);
          return json(res, model.awardPoints(data), 201);
        }
        if (path === '/api/updates/status' && req.method === 'GET') return json(res, { ...await updater.status(), currentVersion: VERSION });
        if (path === '/api/updates/start' && req.method === 'POST') {
          const data = await body(req); verifyParent(req, data.password);
          return json(res, await updater.start(), 202);
        }
        if (path === '/api/settings' && req.method === 'PUT') {
          const data = await body(req), current = store.meta('settings');
          check(data._revision === store.meta('revision'), 'Die Einstellungen wurden zwischenzeitlich geändert. Bitte neu laden.', 409);
          const timezone = text(data.timezone || 'Europe/Berlin', 60, true);
          try { new Intl.DateTimeFormat('de-DE', { timeZone: timezone }).format(new Date()); } catch { throw new AppError('Ungültige Zeitzone.'); }
          const settings = { familyName: text(data.familyName, 60, true), timezone, photoInterval: number(data.photoInterval, 3, 300, true), photoFit: data.photoFit === 'cover' ? 'cover' : 'contain', remoteManifestUrl: networkUrl(data.remoteManifestUrl), immichUrl: networkUrl(data.immichUrl), immichAlbumId: text(data.immichAlbumId, 100), ...appearanceSettings(data, current) };
          store.transaction(() => {
            if (data.immichKey) store.setMeta('immichSecret', store.encrypt(text(data.immichKey, 500, true)));
            if (current.immichUrl !== settings.immichUrl && !data.immichKey) store.setMeta('immichSecret', null);
            store.setMeta('settings', settings); store.bump();
          });
          return json(res, settings);
        }
        if (path === '/api/recipes/import' && req.method === 'POST') {
          const data = await body(req);
          check(activeRecipeImports < 2, 'Es werden bereits Rezepte geladen. Bitte kurz warten.', 429);
          activeRecipeImports++;
          try {
            const result = await loadRecipe(text(data.url, 2048, true));
            const recipe = model.validate('recipes', result.recipe), warnings = [...result.warnings];
            if (result.image) {
              try {
                check(Buffer.isBuffer(result.image) && result.image.length <= 5 * 1024 * 1024, 'Das Rezeptbild ist zu groß.');
                recipe.imageFile = uiPhotos.upload(result.image).name;
              } catch { warnings.push('Das Rezeptbild konnte nicht gespeichert werden. Du kannst ein eigenes Bild hinzufügen.'); }
            }
            return json(res, { recipe, warnings });
          } finally { activeRecipeImports--; }
        }
        const recordRoute = path.match(/^\/api\/records\/([a-z]+)(?:\/([a-zA-Z0-9-]{1,100}))?$/);
        if (recordRoute) {
          const [, kind, id] = recordRoute;
          if (req.method === 'POST' && !id || req.method === 'PUT' && id) {
            const value = model.save(kind, id, await body(req));
            if (kind === 'events' && value.googleAccountId) void google.sync().catch(() => {});
            return json(res, value, id ? 200 : 201);
          }
          if (req.method === 'DELETE' && id) {
            const data = await body(req); model.delete(kind, id, data._rev);
            if (kind === 'events') void google.sync().catch(() => {});
            return json(res, { ok: true });
          }
        }
        const completeRoute = path.match(/^\/api\/tasks\/([a-zA-Z0-9-]+)\/complete$/);
        if (completeRoute && req.method === 'POST') { model.complete(completeRoute[1], await body(req), today()); return json(res, { ok: true }); }
        const assignRoute = path.match(/^\/api\/tasks\/([a-zA-Z0-9-]+)\/assign$/);
        if (assignRoute && req.method === 'POST') return json(res, model.assignTask(assignRoute[1], await body(req)));
        const redeemRoute = path.match(/^\/api\/rewards\/([a-zA-Z0-9-]+)\/redeem$/);
        if (redeemRoute && req.method === 'POST') { const data = await body(req); model.redeem(redeemRoute[1], data.memberId, data.requestId); return json(res, { ok: true }); }
        if (path === '/api/shopping/generate' && req.method === 'POST') return json(res, model.generateShopping((await body(req)).week));
        if (path === '/api/google/authorize' && req.method === 'POST') return json(res, google.authorization(sessionHash));
        if (path === '/api/google/callback' && req.method === 'GET') {
          try { await google.callback(url.searchParams, sessionHash); res.writeHead(303, { Location: '/?google=connected#settings' }); }
          catch { res.writeHead(303, { Location: '/?google=error#settings' }); }
          return res.end();
        }
        if (path === '/api/google/sync' && req.method === 'POST') return json(res, await google.sync());
        const accountRoute = path.match(/^\/api\/google\/accounts\/([a-zA-Z0-9-]+)(?:\/(calendars|refresh))?$/);
        if (accountRoute) {
          const [, id, action] = accountRoute;
          if (action === 'calendars' && req.method === 'PUT') { google.selectCalendars(id, (await body(req)).calendars); void google.sync().catch(() => {}); return json(res, { ok: true }); }
          if (action === 'refresh' && req.method === 'POST') { await google.refreshCalendars(id); return json(res, { ok: true }); }
          if (!action && req.method === 'DELETE') { google.disconnect(id); return json(res, { ok: true }); }
        }
        if (path === '/api/photos' && req.method === 'GET') return json(res, photos.inventory());
        if (path === '/api/photos/upload' && req.method === 'POST') return json(res, photos.upload(await body(req, true)), 201);
        if (path === '/api/images/ui' && req.method === 'POST') return json(res, { imageFile: uiPhotos.upload(await body(req, true, 5 * 1024 * 1024)).name }, 201);
        if (path === '/api/images/ui' && req.method === 'GET') {
          const file = uiPhotos.file(url.searchParams.get('file') || '');
          res.writeHead(200, { 'Content-Type': file.type }); createReadStream(file.path).on('error', () => res.destroy()).pipe(res); return;
        }
        if (path === '/api/tasks/image' && req.method === 'POST') {
          check(!req.headers['content-length'] || Number(req.headers['content-length']) <= 5 * 1024 * 1024, 'Das Aufgabenbild darf höchstens 5 MB groß sein.', 413);
          const bytes = await body(req, true); check(bytes.length <= 5 * 1024 * 1024, 'Das Aufgabenbild darf höchstens 5 MB groß sein.', 413);
          return json(res, { imageFile: taskPhotos.upload(bytes).name }, 201);
        }
        if (path === '/api/tasks/image' && req.method === 'GET') {
          const file = taskPhotos.file(url.searchParams.get('file') || '');
          res.writeHead(200, { 'Content-Type': file.type }); createReadStream(file.path).on('error', () => res.destroy()).pipe(res); return;
        }
        if (path === '/api/photos/file' && req.method === 'GET') {
          const file = photos.file(url.searchParams.get('file') || '');
          res.writeHead(200, { 'Content-Type': file.type }); createReadStream(file.path).on('error', () => res.destroy()).pipe(res); return;
        }
        if (path === '/api/photos/remote-list' && req.method === 'GET') return json(res, await photos.remoteInventory());
        if (path === '/api/photos/remote' && req.method === 'GET') {
          const file = await photos.remoteFile(url.searchParams.get('url')); res.writeHead(200, { 'Content-Type': file.type }); return res.end(file.bytes);
        }
        if (path === '/api/immich/albums' && req.method === 'GET') return json(res, await photos.albums());
        const albumRoute = path.match(/^\/api\/immich\/albums\/([a-zA-Z0-9-]+)$/);
        if (albumRoute && req.method === 'GET') return json(res, await photos.album(albumRoute[1]));
        if (path === '/api/photos/immich' && req.method === 'GET') {
          const file = await photos.thumbnail(url.searchParams.get('asset')); res.writeHead(200, { 'Content-Type': file.type }); return res.end(file.bytes);
        }
        throw new AppError('Funktion nicht gefunden.', 404);
      }
      check(['GET', 'HEAD'].includes(req.method), 'Methode nicht erlaubt.', 405);
      const filename = path === '/' ? 'index.html' : decodeURIComponent(path).replace(/^\/+/, '');
      const file = resolve(PUBLIC, filename);
      check(file.startsWith(PUBLIC + sep) && existsSync(file) && statSync(file).isFile() && MIME[extname(file)], 'Seite nicht gefunden.', 404);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] });
      if (req.method === 'HEAD') return res.end();
      createReadStream(file).on('error', () => res.destroy()).pipe(res);
    } catch (error) {
      if (res.headersSent || res.destroyed) return;
      const status = error instanceof AppError ? error.status : 500;
      if (status === 500) console.error('Anfrage fehlgeschlagen:', error.name, error.message);
      json(res, { error: status === 500 ? 'Ein Serverfehler ist aufgetreten. Bitte erneut versuchen.' : error.message }, status);
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  const syncTimer = setInterval(() => { if (google.configured) void google.sync().catch(() => {}); }, 300000);
  syncTimer.unref();
  const cleanupTimer = setInterval(() => { for (const map of [failures, parentFailures]) for (const [key, entry] of map) if (Date.now() - entry.start > 600000) map.delete(key); }, 600000);
  cleanupTimer.unref();
  server.on('close', () => { clearInterval(syncTimer); clearInterval(cleanupTimer); });
  return { server, store, model, google, photos };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env'));
  const app = createApp();
  const port = Number(process.env.PORT || 8080), host = process.env.HOST || '0.0.0.0';
  app.server.listen(port, host, () => { console.log(`Familien Organisierer ${VERSION} läuft auf ${host}:${port}`); if (app.google.configured) void app.google.sync().catch(() => {}); });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { app.server.close(() => { app.store.close(); process.exit(0); }); setTimeout(() => process.exit(1), 10000).unref(); });
}
