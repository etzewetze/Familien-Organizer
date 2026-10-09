import { createHash } from 'node:crypto';
import { AppError, check, text, number } from './model.mjs';

const CURRENT = ['temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'is_day', 'precipitation', 'weather_code', 'cloud_cover', 'pressure_msl', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m'];
const HOURLY = ['temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'precipitation_probability', 'precipitation', 'weather_code', 'wind_speed_10m'];
const DAILY = ['weather_code', 'temperature_2m_max', 'temperature_2m_min', 'apparent_temperature_max', 'apparent_temperature_min', 'precipitation_sum', 'precipitation_probability_max', 'rain_sum', 'snowfall_sum', 'wind_speed_10m_max', 'wind_gusts_10m_max', 'wind_direction_10m_dominant', 'uv_index_max', 'sunrise', 'sunset', 'sunshine_duration', 'daylight_duration'];
const numeric = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const epoch = value => Number.isInteger(value) && value > 0 && value < 1e11 ? value : null;
function timezone(value) { try { new Intl.DateTimeFormat('de', { timeZone: value }).format(); return typeof value === 'string' && value.length <= 80 ? value : 'UTC'; } catch { return 'UTC'; } }
export function weatherLocation(data) {
  check(data && typeof data === 'object' && !Array.isArray(data), 'Ungültiger Wetterort.');
  check(typeof data.latitude === 'number' && typeof data.longitude === 'number', 'Ungültige Ortskoordinaten.');
  const latitude = number(data.latitude, -90, 90), longitude = number(data.longitude, -180, 180);
  const id = createHash('sha256').update(`${latitude.toFixed(5)},${longitude.toFixed(5)}`).digest('hex').slice(0, 20);
  return { id, name: text(data.name, 100, true), region: text(data.region, 100), country: text(data.country, 100), latitude, longitude, timezone: timezone(data.timezone) };
}
export function weatherLocations(data) {
  check(Array.isArray(data.locations) && data.locations.length <= 8, 'Bis zu acht Wetterorte können gespeichert werden.');
  const locations = data.locations.map(weatherLocation);
  check(new Set(locations.map(place => place.id)).size === locations.length, 'Dieser Ort ist schon gespeichert.');
  const primaryId = text(data.primaryId, 20) || locations[0]?.id || '';
  check(!primaryId || locations.some(place => place.id === primaryId), 'Den Wetterort für den Header bitte aus den gespeicherten Orten auswählen.');
  return { locations, primaryId };
}
export function normalizeForecast(data, location, fetchedAt) {
  check(data && typeof data === 'object' && epoch(data.current?.time) && Array.isArray(data.daily?.time), 'Der Wetterdienst hat unvollständige Daten geliefert.', 502);
  const current = { time: epoch(data.current.time), ...Object.fromEntries(CURRENT.map(key => [key, numeric(data.current[key])])) };
  const rows = (source, fields, maximum) => (Array.isArray(source?.time) ? source.time.slice(0, maximum) : []).flatMap((time, i) => epoch(time) ? [{ time, ...Object.fromEntries(fields.map(key => [key, ['sunrise', 'sunset'].includes(key) ? epoch(source[key]?.[i]) : numeric(source[key]?.[i])])) }] : []);
  const daily = rows(data.daily, DAILY, 14);
  check(daily.length, 'Der Wetterdienst hat keine Tagesvorhersage geliefert.', 502);
  return { location, timezone: timezone(data.timezone), fetchedAt, stale: false, current, hourly: rows(data.hourly, HOURLY, 14 * 24 + 24), daily };
}
export class Weather {
  constructor({ fetchFn = fetch, now = Date.now } = {}) { this.fetch = fetchFn; this.now = now; this.cache = new Map(); this.pending = new Map(); this.requests = []; }
  async json(url) {
    this.requests = this.requests.filter(time => this.now() - time < 60000);
    check(this.requests.length < 20, 'Zu viele Wetterabfragen. Bitte in einer Minute erneut versuchen.', 429);
    this.requests.push(this.now());
    try {
      const response = await this.fetch(url, { redirect: 'error', signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
      check(response.ok, response.status === 429 ? 'Der Wetterdienst ist ausgelastet. Bitte später erneut versuchen.' : 'Der Wetterdienst ist gerade nicht erreichbar.', 503);
      check(!response.headers.get('content-length') || Number(response.headers.get('content-length')) <= 2 * 1024 * 1024, 'Die Wetterantwort ist zu groß.', 502);
      const reader = response.body.getReader(), parts = []; let size = 0;
      try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; check(size <= 2 * 1024 * 1024, 'Die Wetterantwort ist zu groß.', 502); parts.push(Buffer.from(value)); } }
      finally { await reader.cancel().catch(() => {}); }
      return JSON.parse(Buffer.concat(parts).toString('utf8'));
    } catch (error) { if (error instanceof AppError) throw error; throw new AppError('Wetterdaten konnten nicht geladen werden. Bitte später erneut versuchen.', 503); }
  }
  async cached(key, ttl, load, allowStale = false) {
    const old = this.cache.get(key), age = this.now() - (old?.time || 0);
    if (old && (age < ttl || allowStale && age < 6 * 3600000 && old.retryAt > this.now())) return old.retryAt ? { ...old.value, stale: true } : old.value;
    if (this.pending.has(key)) return this.pending.get(key);
    const request = (async () => {
      try {
        const value = await load();
        this.cache.delete(key); this.cache.set(key, { time: this.now(), value });
        while (this.cache.size > 48) this.cache.delete(this.cache.keys().next().value);
        return value;
      } catch (error) {
        if (allowStale && old && age < 6 * 3600000) { old.retryAt = this.now() + 60000; return { ...old.value, stale: true }; }
        throw error;
      } finally { this.pending.delete(key); }
    })();
    this.pending.set(key, request); return request;
  }
  search(query) {
    const q = text(query, 100, true); check(q.length >= 2, 'Bitte mindestens zwei Zeichen für die Ortssuche eingeben.');
    return this.cached('search:' + q.toLocaleLowerCase('de'), 30 * 60000, async () => {
      const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
      url.search = new URLSearchParams({ name: q, count: '8', language: 'de', format: 'json' });
      const data = await this.json(url);
      check(!data.error, 'Der Wetterdienst konnte den Ort nicht suchen.', 503);
      return (Array.isArray(data.results) ? data.results.slice(0, 8) : []).flatMap(result => {
        try { return [weatherLocation({ ...result, region: result.admin1 || '' })]; } catch { return []; }
      });
    });
  }
  forecast(location) {
    const place = weatherLocation(location);
    return this.cached('forecast:' + place.id, 15 * 60000, async () => {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.search = new URLSearchParams({ latitude: String(place.latitude), longitude: String(place.longitude), timezone: 'auto', forecast_days: '14', timeformat: 'unixtime', temperature_unit: 'celsius', wind_speed_unit: 'kmh', precipitation_unit: 'mm', current: CURRENT.join(','), hourly: HOURLY.join(','), daily: DAILY.join(',') });
      return normalizeForecast(await this.json(url), place, new Date(this.now()).toISOString());
    }, true);
  }
}
