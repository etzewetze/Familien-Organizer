import { request } from 'node:http';
import { AppError } from './model.mjs';

export class UpdaterClient {
  constructor(socket = '/run/familien-organisierer-update/control.sock', { requestFn = request } = {}) { this.socket = socket; this.request = requestFn; }
  async call(action) {
    return new Promise((resolve, reject) => {
      const req = this.request({ socketPath: this.socket, path: action === 'start' ? '/start' : '/status', method: action === 'start' ? 'POST' : 'GET', timeout: 3000 }, res => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { text += chunk; if (text.length > 16384) req.destroy(new Error('Oversized updater response')); });
        res.on('end', () => {
          try { const data = JSON.parse(text); if (res.statusCode !== 200 && res.statusCode !== 202) reject(new AppError(data.error || 'Der Updatedienst konnte nicht starten.', res.statusCode)); else resolve(data); }
          catch { reject(new AppError('Der Updatedienst hat ungültig geantwortet.', 502)); }
        });
      });
      req.on('timeout', () => req.destroy(new Error('Updater timeout')));
      req.on('error', () => action === 'status' ? resolve({ supported: false, phase: 'unavailable', message: 'Der Updatedienst ist noch nicht eingerichtet. Einmalig den aktuellen LXC-Installer ausführen.' }) : reject(new AppError('Der Updatedienst ist nicht erreichbar. Bitte den LXC-Installer und den Dienst prüfen.', 503)));
      req.end();
    });
  }
  status() { return this.call('status'); }
  start() { return this.call('start'); }
}
