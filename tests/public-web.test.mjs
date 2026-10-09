import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { isPublicAddress, fetchPublicRecipePage, fetchPublicRecipeImage, requestPinnedPage } from '../src/public-web.mjs';

const page = '<html><title>Eigenes Testrezept</title></html>';
const ok = { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, bytes: Buffer.from(page) };
const publicDns = async () => [{ address: '8.8.8.8', family: 4 }];
test('Rezeptabruf sperrt lokale, reservierte und eingebettete private IP-Adressen', async () => {
  for (const address of ['0.0.0.0', '127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.178.1', '169.254.169.254', '100.64.0.1', '192.0.2.1', '198.18.0.1', '224.0.0.1', '255.255.255.255', '::', '::1', '::ffff:192.168.178.1', 'fc00::1', 'fe80::1', '2001:db8::1', '2002:7f00:1::1', 'ff02::1']) assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress('8.8.8.8'), true); assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
  let calls = 0;
  for (const url of ['http://127.0.0.1/', 'http://2130706433/', 'http://0x7f000001/', 'http://[::ffff:127.0.0.1]/', 'http://localhost/', 'http://fritz.local/', 'https://user:secret@rezepte.example/', 'file:///etc/passwd', 'http://rezepte.example:8080/']) {
    await assert.rejects(fetchPublicRecipePage(url, { lookup: async () => { calls++; return []; }, load: async () => { calls++; return ok; } }));
  }
  assert.equal(calls, 0);
});
test('Alle DNS-Adressen werden geprüft, bevor eine Verbindung aufgebaut wird', async () => {
  let connections = 0;
  for (const addresses of [[{ address: '127.0.0.1', family: 4 }], [{ address: '8.8.8.8', family: 4 }, { address: '192.168.178.1', family: 4 }], [{ address: '::1', family: 6 }]]) {
    await assert.rejects(fetchPublicRecipePage('https://rezepte.example/', { lookup: async () => addresses, load: async () => { connections++; return ok; } }));
  }
  assert.equal(connections, 0);
});
test('Weiterleitungen werden erneut geprüft und HTTPS wird nicht auf HTTP zurückgestuft', async () => {
  let connections = 0;
  await assert.rejects(fetchPublicRecipePage('https://rezepte.example/', { lookup: publicDns, load: async () => { connections++; return { status: 302, headers: { location: 'http://127.0.0.1/' } }; } }));
  assert.equal(connections, 1);
  connections = 0;
  await assert.rejects(fetchPublicRecipePage('https://rezepte.example/', { lookup: publicDns, load: async () => { connections++; return { status: 302, headers: { location: 'https://192.168.178.1/' } }; } }));
  assert.equal(connections, 1);
  const seen = [];
  const result = await fetchPublicRecipePage('https://rezepte.example/alt', { lookup: publicDns, load: async (url, address) => { seen.push({ url: url.toString(), address }); return seen.length === 1 ? { status: 301, headers: { location: '/neu' } } : ok; } });
  assert.equal(result.sourceUrl, 'https://rezepte.example/neu'); assert.equal(seen.length, 2); assert.equal(seen[1].address.address, '8.8.8.8');
});
test('Rezeptabruf begrenzt Umleitungen, Antwortgröße, Formate und Wartezeit', async () => {
  await assert.rejects(fetchPublicRecipePage('https://rezepte.example/', { lookup: publicDns, load: async () => ({ status: 302, headers: { location: '/again' } }) }), { status: 502 });
  await assert.rejects(fetchPublicRecipePage('https://rezepte.example/', { lookup: publicDns, load: async () => ({ ...ok, bytes: Buffer.alloc(2 * 1024 * 1024 + 1) }) }), { status: 413 });
  await assert.rejects(fetchPublicRecipePage('https://rezepte.example/', { lookup: publicDns, load: async () => ({ ...ok, headers: { 'content-type': 'application/pdf' } }) }), { status: 415 });
  await assert.rejects(fetchPublicRecipePage('https://rezepte.example/', { lookup: async () => { await new Promise(r => setTimeout(r, 40)); return publicDns(); }, load: async () => ok, timeout: 5 }), { status: 504 });
  await assert.rejects(fetchPublicRecipePage('https://rezepte.example/', { lookup: publicDns, load: async () => ({ status: 403, headers: {} }) }), { status: 502 });
});
test('Komprimierte Seiten werden begrenzt entpackt und korrekt gelesen', async () => {
  const result = await fetchPublicRecipePage('https://rezepte.example/', { lookup: publicDns, load: async () => ({ ...ok, headers: { 'content-type': 'text/html; charset=utf-8', 'content-encoding': 'gzip' }, bytes: gzipSync(Buffer.from(page)) }) });
  assert.equal(result.html, page);
  await assert.rejects(fetchPublicRecipePage('https://rezepte.example/', { lookup: publicDns, load: async () => ({ ...ok, headers: { 'content-type': 'text/html', 'content-encoding': 'gzip' }, bytes: gzipSync(Buffer.alloc(2 * 1024 * 1024 + 1)) }) }), { status: 413 });
});
test('HTTP-Verbindung verwendet die vorgeprüfte IP, Originalhost und keine Sitzungsdaten', async t => {
  let received;
  const server = createServer((req, res) => { received = req; res.writeHead(200, { 'content-type': 'text/html' }); res.end(page); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  // Nur der Transport wird hier direkt mit der Adresse des eigenen Testservers geprüft.
  const url = new URL(`http://recipe.test:${server.address().port}/rezept?portionen=4`);
  const response = await requestPinnedPage(url, { address: '127.0.0.1', family: 4 });
  assert.equal(response.status, 200); assert.equal(response.bytes.toString(), page);
  assert.equal(received.headers.host, url.host); assert.equal(received.url, '/rezept?portionen=4');
  assert.equal(received.headers.cookie, undefined); assert.equal(received.headers.authorization, undefined);
});
test('HTTP-Transport bricht übergroße angekündigte Seiten vor dem Lesen ab', async t => {
  const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html', 'content-length': 3 * 1024 * 1024 }); res.end('too big'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  await assert.rejects(requestPinnedPage(new URL(`http://recipe.test:${server.address().port}/`), { address: '127.0.0.1', family: 4 }), { status: 413 });
});

test('Rezeptbilder prüfen jedes Redirect und alle DNS-Adressen und begrenzen Format, Größe und Wartezeit', async () => {
  const image = {status:200,headers:{'content-type':'image/png'},bytes:Buffer.from([137,80,78,71,13,10,26,10])};
  let connected = 0;
  const load = async () => { connected++; return image; };
  await assert.rejects(fetchPublicRecipeImage('http://127.0.0.1/bild.png', {lookup:publicDns,load}));
  await assert.rejects(fetchPublicRecipeImage('https://cdn.example/bild.png', {lookup:async()=>[{address:'8.8.8.8',family:4},{address:'192.168.178.1',family:4}],load}));
  assert.equal(connected,0);
  await assert.rejects(fetchPublicRecipeImage('https://cdn.example/bild.png',{lookup:publicDns,load:async()=>({status:302,headers:{location:'https://127.0.0.1/bild.png'}})}));
  await assert.rejects(fetchPublicRecipeImage('https://cdn.example/bild.png',{lookup:publicDns,load:async()=>({...image,headers:{'content-type':'image/svg+xml'}})}),{status:415});
  await assert.rejects(fetchPublicRecipeImage('https://cdn.example/bild.png',{lookup:publicDns,load:async()=>({...image,bytes:Buffer.alloc(5*1024*1024+1)})}),{status:413});
  await assert.rejects(fetchPublicRecipeImage('https://cdn.example/bild.png',{lookup:publicDns,load:async()=>({...image,headers:{'content-type':'image/png','content-encoding':'gzip'},bytes:gzipSync(Buffer.alloc(5*1024*1024+1))})}),{status:413});
  await assert.rejects(fetchPublicRecipeImage('https://cdn.example/bild.png',{lookup:async()=>{await new Promise(r=>setTimeout(r,40));return publicDns();},load,timeout:5}),{status:504});
  const result=await fetchPublicRecipeImage('https://cdn.example/bild.png',{lookup:publicDns,load});
  assert.deepEqual(result.bytes,image.bytes);assert.equal(result.sourceUrl,'https://cdn.example/bild.png');
});

test('Bildtransport hält die 5-MB-Grenze bei angekündigten und gestreamten Antworten ein', async t => {
  const server=createServer((req,res)=>{
    res.writeHead(200,{'content-type':'image/png',...(req.url==='/announced'?{'content-length':6*1024*1024}:{})});
    if(req.url==='/announced')res.end('too big');
    else res.end(Buffer.alloc(5*1024*1024+(req.url==='/large'?1:0)));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const options={maxBytes:5*1024*1024,accept:'image/png'},address={address:'127.0.0.1',family:4};
  for(const path of ['/announced','/large'])await assert.rejects(requestPinnedPage(new URL(`http://image.test:${server.address().port}${path}`),address,options),{status:413});
  assert.equal((await requestPinnedPage(new URL(`http://image.test:${server.address().port}/ok`),address,options)).bytes.length,5*1024*1024);
});
