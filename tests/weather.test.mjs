import test from 'node:test';
import assert from 'node:assert/strict';
import { Weather, weatherLocation, weatherLocations, normalizeForecast } from '../src/weather.mjs';
import { weatherCode, weatherValue, weatherTime, rainOutlook } from '../public/weather.js';

const place = weatherLocation({ name: 'Berlin', latitude: 52.52, longitude: 13.405, region: 'Berlin', country: 'Deutschland', timezone: 'Europe/Berlin' });
const now = Date.UTC(2026, 9, 9, 8);
function forecast() {
  const times = Array.from({ length: 14 }, (_, i) => Date.UTC(2026, 9, 8 + i, 22) / 1000);
  return { timezone: 'Europe/Berlin', current: { time: now / 1000, temperature_2m: 16.2, weather_code: 1, is_day: 1 },
    hourly: { time: [now / 1000, now / 1000 + 3600, now / 1000 + 7200], temperature_2m: [16, 17, 18], precipitation_probability: [10, 70, 80], precipitation: [0, 0.4, 1], weather_code: [1, 61, 63] },
    daily: { time: times, temperature_2m_max: times.map(() => 18), temperature_2m_min: times.map(() => 9), weather_code: times.map(() => 2), sunrise: times.map(t => t + 7 * 3600), sunset: times.map(t => t + 19 * 3600) } };
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
test('Wetterorte prüfen Koordinaten, Duplikate, Ortsanzahl und Kopfzeilenauswahl', () => {
  assert.equal(weatherLocations({ locations: [place] }).primaryId, place.id);
  assert.deepEqual(weatherLocations({ locations: [] }), { locations: [], primaryId: '' });
  assert.throws(() => weatherLocation({ ...place, latitude: '52.52' }));
  assert.throws(() => weatherLocation({ ...place, longitude: Infinity }));
  assert.throws(() => weatherLocation({ ...place, latitude: 91 }));
  assert.throws(() => weatherLocations({ locations: [place, place] }), /schon gespeichert/);
  assert.throws(() => weatherLocations({ locations: [place], primaryId: 'foreign' }));
  assert.throws(() => weatherLocations({ locations: Array(9).fill(place) }));
  assert.equal(weatherLocation({ ...place, timezone: 'not/a/timezone' }).timezone, 'UTC');
});
test('Ortsuche nutzt nur den festen HTTPS-Dienst, deutsche Namen und einen begrenzten Cache', async () => {
  const calls = [];
  const weather = new Weather({ now: () => now, fetchFn: async (url, options) => { calls.push({ url, options }); return json({ results: [{ name: '<b>Berlin</b>', latitude: 52.52, longitude: 13.405, admin1: 'Berlin', country: 'Deutschland', timezone: 'Europe/Berlin' }, { name: 'Ungültig', latitude: 200, longitude: 0 }] }); } });
  const results = await weather.search('Berlin'); assert.equal(results.length, 1); assert.equal(results[0].region, 'Berlin');
  await weather.search('BERLIN'); assert.equal(calls.length, 1);
  assert.equal(calls[0].url.origin, 'https://geocoding-api.open-meteo.com'); assert.equal(calls[0].url.searchParams.get('language'), 'de'); assert.equal(calls[0].options.redirect, 'error');
  await weather.search('https://127.0.0.1/private'); assert.equal(calls[1].url.hostname, 'geocoding-api.open-meteo.com'); assert.equal(calls[1].url.searchParams.get('name'), 'https://127.0.0.1/private');
  assert.throws(() => weather.search('x'), /zwei Zeichen/);
});
test('14-Tage-Abruf verwendet feste Einheiten und Unixzeiten, bündelt parallele Geräte und erneuert erst nach 15 Minuten', async () => {
  let clock = now, calls = 0, requested;
  const weather = new Weather({ now: () => clock, fetchFn: async url => { calls++; requested = url; return json(forecast()); } });
  const [a, b] = await Promise.all([weather.forecast(place), weather.forecast(place)]);
  assert.strictEqual(a, b); assert.equal(calls, 1); assert.equal(a.daily.length, 14); assert.equal(a.current.temperature_2m, 16.2); assert.equal(a.current.pressure_msl, null);
  assert.equal(requested.origin, 'https://api.open-meteo.com'); assert.equal(requested.searchParams.get('forecast_days'), '14'); assert.equal(requested.searchParams.get('timeformat'), 'unixtime'); assert.equal(requested.searchParams.get('timezone'), 'auto'); assert.equal(requested.searchParams.get('wind_speed_unit'), 'kmh');
  clock += 14 * 60000; await weather.forecast(place); assert.equal(calls, 1);
  clock += 2 * 60000; await weather.forecast(place); assert.equal(calls, 2);
});
test('Wetterausfälle liefern gekennzeichneten alten Stand für maximal sechs Stunden und versuchen nicht ständig neu', async () => {
  let clock = now, fails = false, calls = 0;
  const weather = new Weather({ now: () => clock, fetchFn: async () => { calls++; if (fails) throw new Error('offline'); return json(forecast()); } });
  const original = await weather.forecast(place); fails = true; clock += 16 * 60000;
  const stale = await weather.forecast(place); assert.equal(stale.stale, true); assert.equal(stale.fetchedAt, original.fetchedAt); assert.equal(calls, 2);
  await weather.forecast(place); assert.equal(calls, 2);
  clock += 61000; await weather.forecast(place); assert.equal(calls, 3);
  clock = now + 6 * 3600000; await assert.rejects(weather.forecast(place), /nicht geladen/);
});
test('Unvollständige, übergroße und fehlerhafte Wetterantworten werden abgefangen', async () => {
  assert.throws(() => normalizeForecast({}, place, new Date(now).toISOString()));
  assert.throws(() => normalizeForecast({ ...forecast(), daily: { time: [] } }, place, 'now'));
  for (const response of [json({}, 429), new Response('{invalid'), new Response('{}', { headers: { 'content-length': String(3 * 1024 * 1024) } }), new Response(' '.repeat(2 * 1024 * 1024 + 1))]) {
    const weather = new Weather({ fetchFn: async () => response }); await assert.rejects(weather.forecast(place));
  }
  const clean = normalizeForecast({ ...forecast(), current: { ...forecast().current, temperature_2m: 'hot', precipitation: null } }, place, 'now');
  assert.equal(clean.current.temperature_2m, null); assert.equal(clean.current.precipitation, null);
});
test('Abfragen bleiben bei wechselnden Suchbegriffen begrenzt', async () => {
  const weather = new Weather({ now: () => now, fetchFn: async () => json({ results: [] }) });
  for (let i = 0; i < 20; i++) await weather.search('Ort ' + i);
  await assert.rejects(weather.search('Ort 21'), /Zu viele Wetterabfragen/);
});
test('Deutsche Wetterlagen, Nacht, fehlende Werte und lokale Zeiten einschließlich Zeitumstellung', () => {
  assert.equal(weatherCode(0).label, 'Sonnig'); assert.equal(weatherCode(0, false).label, 'Klar'); assert.equal(weatherCode(45).label, 'Nebel'); assert.equal(weatherCode(3).label, 'Bewölkt'); assert.equal(weatherCode(null).label, 'Keine Wetterangabe');
  assert.equal(weatherValue(null, '°'), '–'); assert.equal(weatherValue(0, ' °C'), '0 °C'); assert.equal(weatherValue(1.25, ' mm', 1), '1,3 mm');
  assert.equal(weatherTime(Date.UTC(2026, 9, 25, 1, 30) / 1000, 'Europe/Berlin'), '02:30');
  assert.match(weatherTime(Date.UTC(2026, 9, 8, 22) / 1000, 'Europe/Berlin', true), /9\. Oktober/);
  const data = normalizeForecast(forecast(), place, 'now'); assert.match(rainOutlook(data, now), /11:00.*70 %/); assert.equal(rainOutlook(data, now + 4 * 3600000), '');
});
