import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync, chmodSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomBytes, randomUUID, createCipheriv, createDecipheriv } from 'node:crypto';

export const KINDS = ['members', 'events', 'birthdays', 'tasks', 'recipes', 'meals', 'lists', 'items', 'notes', 'rewards', 'pointAwards'];
export class Store {
  constructor(directory) {
    this.directory = resolve(directory);
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    chmodSync(this.directory, 0o700);
    const keyPath = join(this.directory, 'master.key');
    if (!existsSync(keyPath)) writeFileSync(keyPath, randomBytes(32), { mode: 0o600, flag: 'wx' });
    this.key = readFileSync(keyPath);
    if (this.key.length !== 32) throw new Error('master.key ist beschädigt. Originalschlüssel aus Sicherung wiederherstellen.');
    this.db = new DatabaseSync(join(this.directory, 'family.sqlite'));
    const schemaVersion = this.db.prepare('PRAGMA user_version').get().user_version;
    if (schemaVersion > 1) { this.db.close(); throw new Error('Diese Datenbank stammt aus einer neueren Version. Bitte eine passende Programmversion verwenden.'); }
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA foreign_keys=ON;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS records (
        kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, rev INTEGER NOT NULL,
        PRIMARY KEY(kind,id)
      );
      CREATE TABLE IF NOT EXISTS completions (
        task_id TEXT NOT NULL, day TEXT NOT NULL, member_id TEXT NOT NULL, points INTEGER NOT NULL,
        title TEXT NOT NULL, completed_at TEXT NOT NULL, PRIMARY KEY(task_id,day)
      );
      CREATE INDEX IF NOT EXISTS idx_completions_member ON completions(member_id);
      CREATE TABLE IF NOT EXISTS redemptions (
        id TEXT PRIMARY KEY, member_id TEXT NOT NULL, reward_id TEXT NOT NULL,
        title TEXT NOT NULL, cost INTEGER NOT NULL, redeemed_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_redemptions_member ON redemptions(member_id);
      CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS google_accounts (id TEXT PRIMARY KEY, email TEXT NOT NULL, secret TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS oauth_states (hash TEXT PRIMARY KEY, session_hash TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS outbox (record_id TEXT PRIMARY KEY, operation TEXT NOT NULL, data TEXT NOT NULL, error TEXT NOT NULL DEFAULT '', attempts INTEGER NOT NULL DEFAULT 0);
      PRAGMA user_version=1;
    `);
    this.db.prepare("INSERT OR IGNORE INTO meta VALUES ('revision','0')").run();
    chmodSync(join(this.directory, 'family.sqlite'), 0o600);
  }
  meta(key, fallback = null) {
    const row = this.db.prepare('SELECT value FROM meta WHERE key=?').get(key);
    return row ? JSON.parse(row.value) : fallback;
  }
  setMeta(key, value) {
    this.db.prepare('INSERT INTO meta VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(value));
  }
  bump() {
    const revision = this.meta('revision', 0) + 1;
    this.setMeta('revision', revision);
    return revision;
  }
  all(kind) {
    return this.db.prepare('SELECT id,data,rev FROM records WHERE kind=? ORDER BY rowid').all(kind).map(r => ({ ...JSON.parse(r.data), id: r.id, _rev: r.rev }));
  }
  get(kind, id) {
    const row = this.db.prepare('SELECT data,rev FROM records WHERE kind=? AND id=?').get(kind, id);
    return row ? { ...JSON.parse(row.data), id, _rev: row.rev } : null;
  }
  put(kind, id, value) {
    const { id: ignoredId, _rev: ignoredRev, ...data } = value;
    const rev = this.bump();
    this.db.prepare('INSERT INTO records VALUES (?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data,rev=excluded.rev').run(kind, id, JSON.stringify(data), rev);
    return { ...data, id, _rev: rev };
  }
  remove(kind, id) {
    this.db.prepare('DELETE FROM records WHERE kind=? AND id=?').run(kind, id);
    this.bump();
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const value = fn(); this.db.exec('COMMIT'); return value; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  balance(memberId) {
    const earned = this.db.prepare('SELECT COALESCE(SUM(points),0) n FROM completions WHERE member_id=?').get(memberId).n
      + this.all('pointAwards').filter(a => a.memberId === memberId).reduce((sum, a) => sum + a.points, 0);
    const spent = this.db.prepare('SELECT COALESCE(SUM(cost),0) n FROM redemptions WHERE member_id=?').get(memberId).n;
    return { earned, spent, available: earned - spent };
  }
  publicAccounts() {
    return this.db.prepare('SELECT id,email,data FROM google_accounts').all().map(a => ({ id: a.id, email: a.email, ...JSON.parse(a.data) }));
  }
  state() {
    const data = Object.fromEntries(KINDS.map(k => [k, this.all(k)]));
    const settings = this.meta('settings', {});
    return {
      ...data, revision: this.meta('revision'), settings,
      serverDate: new Intl.DateTimeFormat('sv-SE', { timeZone: settings.timezone || 'Europe/Berlin' }).format(new Date()),
      completions: this.db.prepare('SELECT * FROM completions').all(),
      redemptions: this.db.prepare('SELECT * FROM redemptions ORDER BY redeemed_at DESC LIMIT 100').all(),
      points: Object.fromEntries(data.members.map(m => [m.id, this.balance(m.id)])),
      google: this.publicAccounts(),
      pendingSync: this.db.prepare('SELECT record_id,operation,error,attempts FROM outbox').all(),
      immichConfigured: !!this.meta('immichSecret'),
      parentPasswordConfigured: !!this.meta('parentPassword'),
    };
  }
  encrypt(value) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
  }
  decrypt(secret) {
    const bytes = Buffer.from(secret, 'base64');
    const cipher = createDecipheriv('aes-256-gcm', this.key, bytes.subarray(0, 12));
    cipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString());
  }
  id() { return randomUUID(); }
  close() { this.db.close(); }
}
