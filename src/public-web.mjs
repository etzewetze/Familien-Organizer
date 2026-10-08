import { lookup as lookupHost } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP } from 'node:net';
import { gunzipSync, inflateSync, brotliDecompressSync } from 'node:zlib';
import { AppError, check, networkUrl } from './model.mjs';

const MAX_BYTES = 2 * 1024 * 1024;
const blocked = new BlockList(), globalV6 = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
]) blocked.addSubnet(address, prefix, 'ipv4');
globalV6.addSubnet('2000::', 3, 'ipv6');
for (const [address, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16]]) blocked.addSubnet(address, prefix, 'ipv6');

export function isPublicAddress(address) {
  const family = isIP(address);
  return family === 4 ? !blocked.check(address, 'ipv4') : family === 6 && globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
}

function publicUrl(value) {
  check(typeof value === 'string' && value.length <= 2048, 'Bitte einen vollständigen öffentlichen Rezeptlink eingeben.');
  const url = new URL(networkUrl(value.trim(), false));
  check(!url.port || url.protocol === 'https:' && url.port === '443' || url.protocol === 'http:' && url.port === '80', 'Bitte einen öffentlichen HTTP- oder HTTPS-Rezeptlink ohne besondere Portnummer verwenden.');
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
  check(hostname !== 'localhost' && !hostname.endsWith('.localhost') && !hostname.endsWith('.local'), 'Bitte einen öffentlichen Rezeptlink verwenden.');
  if (isIP(hostname)) check(isPublicAddress(hostname), 'Lokale und private Adressen sind für den Rezeptimport nicht erlaubt.');
  url.hash = '';
  return { url, hostname };
}

function untilAborted(work, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new AppError('Der Rezeptabruf dauert zu lange. Bitte später erneut versuchen.', 504));
    if (signal.aborted) { Promise.resolve(work).catch(() => {}); abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(work).then(value => { signal.removeEventListener('abort', abort); resolve(value); }, error => { signal.removeEventListener('abort', abort); reject(error); });
  });
}

export function requestPinnedPage(url, address, { signal, transport = url.protocol === 'https:' ? httpsRequest : httpRequest } = {}) {
  return new Promise((resolve, reject) => {
    const req = transport(url, {
      method: 'GET', agent: false, family: address.family, autoSelectFamily: false, signal,
      lookup: (hostname, options, callback) => options.all ? callback(null, [address]) : callback(null, address.address, address.family),
      headers: { 'User-Agent': 'Familien-Organizer/0.4.0 (private recipe import)', Accept: 'text/html,application/xhtml+xml,application/ld+json,application/json;q=0.8', 'Accept-Encoding': 'identity' },
    }, async response => {
      if (response.statusCode !== 200) {
        const result = { status: response.statusCode, headers: response.headers, bytes: Buffer.alloc(0) };
        response.destroy(); resolve(result); return;
      }
      try {
        check(!response.headers['content-length'] || Number(response.headers['content-length']) <= MAX_BYTES, 'Die Rezeptseite ist zu groß.', 413);
        const parts = []; let size = 0;
        for await (const part of response) {
          size += part.length;
          check(size <= MAX_BYTES, 'Die Rezeptseite ist zu groß.', 413);
          parts.push(part);
        }
        resolve({ status: response.statusCode, headers: response.headers, bytes: Buffer.concat(parts) });
      } catch (error) { response.destroy(); req.destroy(); reject(error); }
    });
    req.on('error', reject); req.end();
  });
}

export async function fetchPublicRecipePage(value, { lookup = lookupHost, load = requestPinnedPage, timeout = 18000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout); timer.unref?.();
  try {
    let current = value;
    for (let redirects = 0; redirects <= 4; redirects++) {
      const { url, hostname } = publicUrl(current);
      const literalFamily = isIP(hostname);
      const addresses = literalFamily ? [{ address: hostname, family: literalFamily }] : await untilAborted(lookup(hostname, { all: true, verbatim: true }), controller.signal);
      check(Array.isArray(addresses) && addresses.length > 0 && addresses.every(a => isPublicAddress(a.address) && a.family === isIP(a.address)), 'Die Rezeptadresse ist nicht als öffentliche Webseite erreichbar.');
      // Die geprüfte IP wird für diese Verbindung fest verwendet, auch nach DNS-Änderungen.
      const address = addresses.find(a => a.family === 4) || addresses[0];
      const response = await untilAborted(load(url, address, { signal: controller.signal }), controller.signal);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        check(redirects < 4 && typeof response.headers.location === 'string', 'Die Webseite leitet zu oft oder ohne gültiges Ziel weiter.', 502);
        const next = new URL(response.headers.location, url);
        check(url.protocol !== 'https:' || next.protocol === 'https:', 'Die Webseite leitet auf eine unverschlüsselte Adresse weiter.', 502);
        current = next.toString(); continue;
      }
      check(response.status === 200, `Die Rezeptseite antwortet mit HTTP ${response.status}. Sie lässt sich derzeit nicht automatisch importieren.`, 502);
      const type = response.headers['content-type'] || '';
      check(/^(?:text\/html|application\/(?:xhtml\+xml|ld\+json|json))(?:;|$)/i.test(type), 'Der Link liefert keine unterstützte Rezeptseite.', 415);
      check(Buffer.isBuffer(response.bytes) && response.bytes.length <= MAX_BYTES, 'Die Rezeptseite ist zu groß.', 413);
      let bytes = response.bytes;
      const encoding = (response.headers['content-encoding'] || '').trim().toLowerCase();
      if (encoding && encoding !== 'identity') {
        const decompress = { gzip: gunzipSync, deflate: inflateSync, br: brotliDecompressSync }[encoding];
        check(decompress, 'Die Webseite liefert ein nicht unterstütztes Datenformat.', 415);
        try { bytes = decompress(bytes, { maxOutputLength: MAX_BYTES }); }
        catch { throw new AppError('Die Rezeptseite ist beschädigt oder zu groß.', 413); }
      }
      const charset = type.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1] || 'utf-8';
      let decoder;
      try { decoder = new TextDecoder(charset); } catch { decoder = new TextDecoder('utf-8'); }
      return { html: decoder.decode(bytes), sourceUrl: url.toString() };
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Die Rezeptseite ist vom Server aus nicht erreichbar. Bitte den Link prüfen oder später erneut versuchen.', 502);
  } finally { clearTimeout(timer); }
}
