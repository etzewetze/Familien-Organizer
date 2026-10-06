import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.mjs';
import { Photos } from '../src/photos.mjs';
test('Netzwerkbilder und Immich verwenden geprüfte URLs und serverseitige Schlüssel', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'family-photo-')), store = new Store(directory), photos = new Photos(store, join(directory, 'photos'));
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yG90AAAAASUVORK5CYII=', 'base64');
  const calls = [];
  const mock = createServer((req, res) => {
    calls.push({ path: req.url, key: req.headers['x-api-key'] });
    const result = req.url === '/photos.json' ? { images: [{ name: 'Foto', url: 'photo.png' }] }
      : req.url === '/api/albums' ? [{ id: 'album-1', albumName: 'Familie', assetCount: 2 }]
      : req.url === '/api/albums/album-1' ? { assets: [{ id: 'image-1', type: 'IMAGE', originalFileName: 'urlaub.jpg' }, { id: 'video-1', type: 'VIDEO' }] } : null;
    if (result) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(result)); }
    else { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(image); }
  });
  await new Promise(r => mock.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${mock.address().port}`;
  store.setMeta('settings', { remoteManifestUrl: base + '/photos.json', immichUrl: base }); store.setMeta('immichSecret', store.encrypt('secret-immich-key'));
  t.after(async () => { await new Promise(r => mock.close(r)); store.close(); rmSync(directory, { recursive: true, force: true }); });
  const remote = await photos.remoteInventory(); assert.equal(remote.length, 1); assert.ok(remote[0].url.startsWith('/api/photos/remote?'));
  const fetched = await photos.remoteFile(base + '/photo.png'); assert.equal(fetched.type, 'image/png');
  await assert.rejects(() => photos.remoteFile('http://different.invalid/photo.png'), { status: 403 });
  assert.equal((await photos.albums())[0].name, 'Familie');
  const album = await photos.album('album-1'); assert.equal(album.length, 1); assert.equal(album[0].name, 'urlaub.jpg');
  assert.ok(!JSON.stringify(album).includes('secret-immich-key'));
  assert.equal((await photos.thumbnail('image-1')).type, 'image/png');
  assert.ok(calls.filter(c => c.path.startsWith('/api/')).every(c => c.key === 'secret-immich-key'));
  assert.throws(() => photos.upload(Buffer.from('<svg><script/></svg>')), /JPEG/);
});
