import { createHash } from 'node:crypto';
import { AppError, check, text, day, number } from './model.mjs';
import { germanStates } from '../public/calendar-data.js';

const label = names => Array.isArray(names) ? (names.find(name => name.language?.toUpperCase() === 'DE') || names[0])?.text || '' : '';
const key = value => createHash('sha256').update(value).digest('hex');
export class Holidays {
  constructor({ fetchFn = fetch, now = Date.now } = {}) { this.fetch = fetchFn; this.now = now; this.cache = new Map(); this.pending = new Map(); this.requests = []; }
  async json(path, params) {
    const url = new URL(path, 'https://openholidaysapi.org'); url.search = new URLSearchParams({ countryIsoCode: 'DE', languageIsoCode: 'DE', ...params });
    const cacheKey = url.toString(), cached = this.cache.get(cacheKey);
    if (cached && this.now() - cached.at < 6 * 3600000) return cached.value;
    if (this.pending.has(cacheKey)) return this.pending.get(cacheKey);
    this.requests = this.requests.filter(at => this.now() - at < 60000);
    check(this.requests.length < 20, 'Zu viele Ferienabfragen. Bitte in einer Minute erneut versuchen.', 429); this.requests.push(this.now());
    const pending = (async () => {
      try {
        const response = await this.fetch(url, { redirect: 'error', signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
        check(response.ok, 'Der Ferien-/Feiertagsdienst ist gerade nicht erreichbar. Eigene Einträge und ICS-Dateien funktionieren weiterhin.', 503);
        check(!response.headers.get('content-length') || Number(response.headers.get('content-length')) <= 1024 * 1024, 'Die Ferienantwort ist zu groß.', 502);
        const reader = response.body.getReader(), chunks = []; let size = 0;
        try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; check(size <= 1024 * 1024, 'Die Ferienantwort ist zu groß.', 502); chunks.push(Buffer.from(value)); } }
        finally { await reader.cancel().catch(() => {}); }
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); check(Array.isArray(value) && value.length <= 2000, 'Ungültige Ferienantwort.', 502);
        this.cache.set(cacheKey, { at: this.now(), value }); while (this.cache.size > 32) this.cache.delete(this.cache.keys().next().value);
        return value;
      } catch (error) { if (error instanceof AppError) throw error; throw new AppError('Ferien-/Feiertagsdaten konnten nicht geladen werden. Bitte später erneut versuchen oder eine ICS-Datei verwenden.', 503); }
      finally { this.pending.delete(cacheKey); }
    })();
    this.pending.set(cacheKey, pending); return pending;
  }
  state(code) { check(germanStates.some(([id]) => id === code), 'Bitte ein Bundesland auswählen.'); return code; }
  async groups(state) {
    this.state(state);
    const flatten = rows => rows.flatMap(row => [...(row.children?.length ? flatten(row.children) : [{ code: text(row.code, 100, true), name: text(label(row.name), 160, true) }])]);
    return flatten(await this.json('/Groups', { subdivisionCode: state }));
  }
  async preview(data) {
    const state = this.state(data.state), year = number(data.year, 2020, 2100, true);
    check(data.vacations === true || data.holidays === true, 'Bitte Ferien und/oder Feiertage auswählen.');
    const params = { subdivisionCode: state, validFrom: `${year}-01-01`, validTo: `${year}-12-31` }, entries = [], warnings = [];
    if (data.vacations) {
      const groups = await this.groups(state), group = text(data.group, 100);
      check(!groups.length || groups.some(item => item.code === group), 'Für dieses Bundesland bitte die passende Schulart/Feriengruppe auswählen.');
      const rows = await this.json('/SchoolHolidays', { ...params, ...(group ? { groupCode: group } : {}) });
      for (const row of rows.filter(row => row.type === 'School')) entries.push(this.entry(row, 'vacation', state));
      if (!rows.some(row => row.type === 'School')) warnings.push('Für die Auswahl wurden keine Schulferien geliefert. Eventuell ist das Jahr noch nicht veröffentlicht.');
    }
    if (data.holidays) {
      const rows = await this.json('/PublicHolidays', params);
      for (const row of rows.filter(row => row.type === 'Public')) entries.push(this.entry(row, 'holiday', state));
      if (!rows.some(row => row.type === 'Public')) warnings.push('Für die Auswahl wurden keine gesetzlichen Feiertage geliefert.');
    }
    warnings.push('Regionale Ausnahmen, bewegliche Ferientage und Kita-Schließtage bitte in der Vorschau prüfen und bei Bedarf selbst ergänzen.');
    return { entries, warnings, source: 'OpenHolidays API' };
  }
  entry(row, category, state) {
    const startDate = day(row.startDate), endDate = day(row.endDate); check(endDate >= startDate, 'Ungültiger Ferienzeitraum vom Dienst.', 502);
    const description = [label(row.comment), row.regionalScope === 'Local' ? 'Gilt nur örtlich; bitte prüfen.' : '', row.groups?.length ? 'Feriengruppe: ' + row.groups.map(group => group.shortName || group.code).join(', ') : ''].filter(Boolean).join('\n');
    return { title: text(label(row.name), 160, true), category, startDate, endDate, allDay: true, enabled: true, pauseSchedules: true, description: text(description, 5000), location: '', source: 'OpenHolidays API · ' + state, importKey: key(`openholidays|${category}|${text(row.id,100,true)}`) };
  }
}
