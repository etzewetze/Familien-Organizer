const codes = {
  0: ['Sonnig', '☀️'], 1: ['Überwiegend sonnig', '🌤️'], 2: ['Teilweise bewölkt', '⛅'], 3: ['Bewölkt', '☁️'],
  45: ['Nebel', '🌫️'], 48: ['Nebel mit Reif', '🌫️'],
  51: ['Leichter Nieselregen', '🌦️'], 53: ['Nieselregen', '🌧️'], 55: ['Starker Nieselregen', '🌧️'], 56: ['Gefrierender Nieselregen', '🌧️'], 57: ['Gefrierender Nieselregen', '🌧️'],
  61: ['Leichter Regen', '🌦️'], 63: ['Regen', '🌧️'], 65: ['Starker Regen', '🌧️'], 66: ['Gefrierender Regen', '🌧️'], 67: ['Starker gefrierender Regen', '🌧️'],
  71: ['Leichter Schnee', '🌨️'], 73: ['Schnee', '🌨️'], 75: ['Starker Schnee', '🌨️'], 77: ['Schneegriesel', '🌨️'],
  80: ['Regenschauer', '🌦️'], 81: ['Regenschauer', '🌧️'], 82: ['Starke Regenschauer', '🌧️'], 85: ['Schneeschauer', '🌨️'], 86: ['Starke Schneeschauer', '🌨️'],
  95: ['Gewitter', '⛈️'], 96: ['Gewitter mit Hagel', '⛈️'], 97: ['Starkes Gewitter', '⛈️'], 99: ['Starkes Gewitter mit Hagel', '⛈️'],
};
export function weatherCode(code, isDay = true) {
  const [label, icon] = codes[code] || ['Keine Wetterangabe', '🌡️'];
  return { label: code === 0 && !isDay ? 'Klar' : label, icon: code === 0 && !isDay ? '🌙' : icon };
}
export function weatherValue(value, suffix = '', decimals = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('de-DE', { maximumFractionDigits: decimals }).format(value) + suffix : '–';
}
export function weatherTime(epoch, timezone = 'Europe/Berlin', date = false) {
  if (!Number.isFinite(epoch)) return '–';
  try { return new Intl.DateTimeFormat('de-DE', { timeZone: timezone, ...(date ? { weekday: 'long', day: 'numeric', month: 'long' } : { hour: '2-digit', minute: '2-digit' }) }).format(new Date(epoch * 1000)); } catch { return '–'; }
}
export function rainOutlook(forecast, now = Date.now()) {
  const next = forecast?.hourly?.find(hour => hour.time * 1000 >= now && hour.time * 1000 <= now + 3 * 3600000 && hour.precipitation_probability >= 60 && hour.precipitation >= 0.1);
  return next ? `Niederschlag möglich ab ${weatherTime(next.time, forecast.timezone)} Uhr (${weatherValue(next.precipitation_probability, ' %')})` : '';
}
