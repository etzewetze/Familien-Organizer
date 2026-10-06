import { mkdirSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join, extname, relative, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppError, check, networkUrl } from './model.mjs';

const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif' };
export class Photos {
  constructor(store, directory) { this.store = store; this.directory = resolve(directory); mkdirSync(this.directory, { recursive: true, mode: 0o700 }); }
  inventory() {
    const files = [];
    const visit = (dir, depth) => {
      if (depth > 6 || files.length >= 2000) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) continue;
        const path = join(dir, entry.name);
        if (entry.isDirectory()) visit(path, depth + 1);
        else if (entry.isFile() && TYPES[extname(entry.name).toLowerCase()] && files.length < 2000) files.push({ id: relative(this.directory, path), name: entry.name, url: '/api/photos/file?file=' + encodeURIComponent(relative(this.directory, path)) });
      }
    };
    visit(this.directory, 0);
    return files;
  }
  file(name) {
    const path = resolve(this.directory, name);
    check(path.startsWith(this.directory + sep), 'Ungültiger Bildpfad.', 404);
    let real;
    try { real = realpathSync(path); } catch { throw new AppError('Bild nicht gefunden.', 404); }
    check(real.startsWith(realpathSync(this.directory) + sep) && statSync(real).isFile() && TYPES[extname(real).toLowerCase()], 'Bild nicht gefunden.', 404);
    return { path: real, type: TYPES[extname(real).toLowerCase()] };
  }
  upload(bytes) {
    const type = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? '.jpg'
      : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? '.png'
      : ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString()) ? '.gif'
      : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP' ? '.webp' : '';
    check(type, 'Bitte ein JPEG-, PNG-, GIF- oder WebP-Bild auswählen.');
    const name = randomUUID() + type;
    writeFileSync(join(this.directory, name), bytes, { mode: 0o600, flag: 'wx' });
    return { name, url: '/api/photos/file?file=' + encodeURIComponent(name) };
  }
  async boundedFetch(url, headers = {}, max = 20 * 1024 * 1024) {
    let response;
    try { response = await fetch(url, { headers, signal: AbortSignal.timeout(20000), redirect: 'error' }); }
    catch { throw new AppError('Die Bildquelle ist nicht erreichbar. Adresse und Verbindung vom Server prüfen.', 502); }
    check(response.ok, `Bildquelle antwortet mit HTTP ${response.status}.`, 502);
    check(!response.headers.get('content-length') || Number(response.headers.get('content-length')) <= max, 'Datei ist zu groß.', 413);
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > max) { await response.body.cancel().catch(() => {}); throw new AppError('Datei ist zu groß.', 413); }
      chunks.push(chunk);
    }
    return { bytes: Buffer.concat(chunks), type: response.headers.get('content-type')?.split(';')[0] || '' };
  }
  async remoteInventory() {
    const url = this.store.meta('settings').remoteManifestUrl;
    check(url, 'Zuerst die Adresse der Bilderliste in den Einstellungen eintragen.');
    const result = await this.boundedFetch(url, {}, 2 * 1024 * 1024);
    let data;
    try { data = JSON.parse(result.bytes.toString()); } catch { throw new AppError('Die Netzwerkadresse muss eine JSON-Bilderliste liefern.'); }
    const list = Array.isArray(data) ? data : data.images;
    check(Array.isArray(list) && list.length <= 2000, 'Bilderliste muss ein Array mit höchstens 2000 Einträgen sein.');
    const origin = new URL(url).origin;
    return list.map((item, i) => {
      check(typeof item === 'string' || item && typeof item === 'object' && typeof item.url === 'string', 'Die Bilderliste enthält einen ungültigen Eintrag.');
      const address = networkUrl(new URL(typeof item === 'string' ? item : item.url, url).toString(), false);
      check(new URL(address).origin === origin, 'Netzwerkbilder müssen unter derselben Adresse wie die Bilderliste liegen.');
      return { id: String(i), name: (typeof item === 'object' ? item.name : '') || `Bild ${i + 1}`, url: '/api/photos/remote?url=' + encodeURIComponent(address) };
    });
  }
  async remoteFile(url) {
    const configured = this.store.meta('settings').remoteManifestUrl;
    check(configured && new URL(networkUrl(url, false)).origin === new URL(configured).origin, 'Diese Bildquelle ist nicht eingerichtet.', 403);
    const result = await this.boundedFetch(url);
    check(Object.values(TYPES).includes(result.type), 'Die Quelle liefert kein unterstütztes Bild.', 415);
    return result;
  }
  immichConfig() {
    const base = this.store.meta('settings').immichUrl;
    const secret = this.store.meta('immichSecret');
    check(base && secret, 'Immich-Adresse und API-Schlüssel zuerst in den Einstellungen hinterlegen.');
    return { base: base.replace(/\/$/, '').replace(/\/api$/, ''), headers: { 'x-api-key': this.store.decrypt(secret) } };
  }
  async immich(path, binary = false) {
    const { base, headers } = this.immichConfig();
    const result = await this.boundedFetch(base + '/api' + path, headers, binary ? 20 * 1024 * 1024 : 10 * 1024 * 1024);
    if (binary) { check(Object.values(TYPES).includes(result.type), 'Immich liefert kein unterstütztes Bild.', 415); return result; }
    try { return JSON.parse(result.bytes.toString()); } catch { throw new AppError('Immich hat keine gültige API-Antwort geliefert.', 502); }
  }
  async albums() { return (await this.immich('/albums')).map(a => ({ id: a.id, name: a.albumName, count: a.assetCount || 0 })); }
  async album(id) {
    check(/^[a-zA-Z0-9-]{1,100}$/.test(id), 'Ungültige Albumkennung.');
    const data = await this.immich('/albums/' + id);
    return (data.assets || []).filter(a => a.type === 'IMAGE').map(a => ({ id: a.id, name: a.originalFileName || 'Foto', url: '/api/photos/immich?asset=' + encodeURIComponent(a.id) }));
  }
  async thumbnail(id) {
    check(/^[a-zA-Z0-9-]{1,100}$/.test(id), 'Ungültige Bildkennung.');
    return this.immich('/assets/' + id + '/thumbnail?size=preview', true);
  }
}
