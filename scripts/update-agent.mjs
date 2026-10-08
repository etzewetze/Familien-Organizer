import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync, existsSync, unlinkSync, chmodSync, lstatSync } from 'node:fs';
import { UpdateRunner } from '../src/update-runner.mjs';

export function createUpdateServer(runner, { loadRunner } = {}) {
  const server = createServer((req, res) => {
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    if (req.url === '/status' && req.method === 'GET') return send(200, runner.status());
    if (req.url === '/start' && req.method === 'POST' && (!req.headers['content-length'] || req.headers['content-length'] === '0') && !req.headers['transfer-encoding']) {
      try { if (!runner.running && loadRunner) runner = loadRunner(); send(202, runner.start()); runner.pending.catch(error => console.error('Updatejob:', error.message)); }
      catch (error) { send(error.status || 500, { error: error.message }); }
      return;
    }
    send(400, { error: 'Unzulässiger Updateauftrag.' });
  });
  server.requestTimeout = 5000; server.headersTimeout = 5000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.getuid?.() !== 0) throw new Error('Der Updatedienst muss als root im LXC laufen.');
  process.umask(0o077);
  const configPath = process.argv[2] || '/etc/familien-organisierer-updater.json';
  const loadRunner = () => new UpdateRunner(JSON.parse(readFileSync(configPath, 'utf8')));
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const runner = loadRunner();
  const socket = config.socket || '/run/familien-organisierer-update/control.sock';
  if (existsSync(socket)) { if (!lstatSync(socket).isSocket()) throw new Error('Der Update-Socketpfad ist bereits belegt.'); unlinkSync(socket); }
  const server = createUpdateServer(runner, { loadRunner });
  server.listen(socket, () => chmodSync(socket, 0o660));
}
