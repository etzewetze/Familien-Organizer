import { createHash } from 'node:crypto';
import { AppError, check, day, addDays } from './model.mjs';
import { calendarCategories, isDayOffCategory } from '../public/calendar-data.js';

const hash = value => createHash('sha256').update(value).digest('hex');
const weekdays = ['SU','MO','TU','WE','TH','FR','SA'];
const dateNumber = value => Date.parse(value + 'T12:00:00Z') / 86400000;
const unescape = value => value.replace(/\\([nN,;\\])/g, (_, character) => /n/i.test(character) ? '\n' : character);
const formatters = new Map();
function parts(epoch, zone) {
  if (!formatters.has(zone)) {
    if (formatters.size >= 64) formatters.delete(formatters.keys().next().value);
    try { formatters.set(zone, new Intl.DateTimeFormat('sv-SE', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })); }
    catch { throw new AppError(`Die Zeitzone „${zone}“ wird nicht unterstützt. Bitte einen Export mit IANA-Zeitzonen oder UTC verwenden.`); }
  }
  const values = Object.fromEntries(formatters.get(zone).formatToParts(new Date(epoch)).map(part => [part.type,part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}`, seconds: values.second };
}
function toEpoch(stamp) {
  const target = Date.parse(`${stamp.date}T${stamp.time}:00Z`); let epoch = target;
  for (let attempt = 0; attempt < 4; attempt++) { const local = parts(epoch, stamp.zone), rendered = Date.parse(`${local.date}T${local.time}:00Z`), difference = target - rendered; if (!difference) return epoch; epoch += difference; }
  throw new AppError('Eine Uhrzeit in der Kalenderdatei liegt in einer Zeitumstellungslücke.');
}
function stamp(property, timezone) {
  check(property, 'Kalenderbeginn fehlt.');
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(property.value);
  check(match, 'Datum/Uhrzeit in der Kalenderdatei ist ungültig.');
  const date = day(`${match[1]}-${match[2]}-${match[3]}`), allDay = !match[4];
  const time = allDay ? '' : `${match[4]}:${match[5]}`;
  check(allDay || /^([01]\d|2[0-3]):[0-5]\d$/.test(time) && Number(match[6] || 0) < 60, 'Kalender-Uhrzeit ist ungültig.');
  const zone = match[7] ? 'UTC' : property.params.TZID || timezone;
  return { date, time, allDay, zone };
}
const identity = value => value.allDay ? value.date : String(toEpoch(value));
function property(line) {
  let colon = -1, quoted = false;
  for (let index = 0; index < line.length; index++) { if (line[index] === '"') quoted = !quoted; if (line[index] === ':' && !quoted) { colon = index; break; } }
  check(colon > 0, 'Ungültige Zeile in der Kalenderdatei.');
  const [name, ...parameters] = line.slice(0, colon).split(';'), params = {};
  for (const parameter of parameters) { const equals = parameter.indexOf('='); check(equals > 0, 'Ungültiger Kalenderparameter.'); params[parameter.slice(0, equals).toUpperCase()] = parameter.slice(equals + 1).replace(/^"|"$/g, ''); }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}
function parseEvents(input) {
  check(typeof input === 'string' && Buffer.byteLength(input) <= 2 * 1024 * 1024, 'Die ICS-Datei darf höchstens 2 MB groß sein.');
  const lines = input.replace(/^\uFEFF/, '').replace(/\r\n[ \t]|\n[ \t]/g, '').split(/\r?\n/).filter(Boolean);
  check(lines[0]?.toUpperCase() === 'BEGIN:VCALENDAR' && lines.at(-1)?.toUpperCase() === 'END:VCALENDAR', 'Bitte eine vollständige ICS-/iCalendar-Datei auswählen.');
  const events = [], stack = []; let current = null, method = '';
  for (const line of lines) {
    const item = property(line);
    if (item.name === 'BEGIN') { stack.push(item.value.toUpperCase()); if (item.value.toUpperCase() === 'VEVENT') { check(!current, 'Verschachtelte Termine sind ungültig.'); current = []; } continue; }
    if (item.name === 'END') { check(stack.pop() === item.value.toUpperCase(), 'Unvollständige Kalenderdatei.'); if (item.value.toUpperCase() === 'VEVENT') { events.push(current); current = null; check(events.length <= 1000, 'Maximal 1000 Termine je Datei.'); } continue; }
    if (current && stack.at(-1) === 'VEVENT') current.push(item);
    if (stack.length === 1 && item.name === 'METHOD') method = item.value.toUpperCase();
  }
  check(!stack.length && !current, 'Unvollständige Kalenderdatei.'); return { events,method };
}
function ruleDates(start, rule, through) {
  const values = Object.fromEntries(rule.split(';').map(part => { const [key,value,...extra] = part.split('='); check(key && value && !extra.length, 'Ungültige Wiederholungsregel.'); return [key,value]; }));
  check(Object.keys(values).every(key => ['FREQ','INTERVAL','COUNT','UNTIL','BYDAY','BYMONTH','BYMONTHDAY','WKST'].includes(key)), 'Diese Wiederholungsregel wird nicht unterstützt.');
  check(['DAILY','WEEKLY','MONTHLY','YEARLY'].includes(values.FREQ), 'Diese Wiederholungsregel wird nicht unterstützt.');
  const interval = Number(values.INTERVAL || 1), count = values.COUNT ? Number(values.COUNT) : Infinity;
  check(Number.isInteger(interval) && interval > 0 && interval <= 1000 && (count === Infinity || Number.isInteger(count) && count > 0 && count <= 10000), 'Ungültige Wiederholungshäufigkeit.');
  const byDay = values.BYDAY?.split(',') || [], months = values.BYMONTH?.split(',').map(Number), monthDays = values.BYMONTHDAY?.split(',').map(Number);
  check(byDay.length <= 70 && (!months || months.length <= 12) && (!monthDays || monthDays.length <= 62), 'Die Wiederholungsregel ist zu groß.');
  check(byDay.every(value => /^([+-]?[1-5])?(SU|MO|TU|WE|TH|FR|SA)$/.test(value)), 'Ungültige Wochentage in der Wiederholung.');
  check(!['DAILY','WEEKLY'].includes(values.FREQ) || byDay.every(value => value.length === 2), 'Diese Wiederholungsregel wird nicht unterstützt.');
  check(values.FREQ !== 'YEARLY' || !byDay.length || months?.length, 'Jährliche Wochentagsregeln benötigen einen Monat.');
  check(!months || months.every(month => Number.isInteger(month) && month >= 1 && month <= 12), 'Ungültige Monate in der Wiederholung.');
  check(!monthDays || monthDays.every(day => Number.isInteger(day) && day !== 0 && day >= -31 && day <= 31), 'Ungültige Monatstage in der Wiederholung.');
  const weekStart = weekdays.indexOf(values.WKST || 'MO'); check(weekStart >= 0, 'Ungültiger Wochenbeginn.');
  const base = new Date(start.date + 'T12:00:00Z'), baseWeek = dateNumber(start.date) - (base.getUTCDay() - weekStart + 7) % 7;
  check(dateNumber(through) - dateNumber(start.date) <= 36600, 'Die Wiederholung beginnt zu weit in der Vergangenheit.');
  const until = values.UNTIL ? stamp({ value: values.UNTIL, params: {} }, start.zone) : null, dates = []; let found = 0;
  for (let date = start.date; date <= through; date = addDays(date, 1)) {
    const value = new Date(date + 'T12:00:00Z'), weekday = value.getUTCDay(), month = value.getUTCMonth() + 1, dayOfMonth = value.getUTCDate(), daysInMonth = new Date(Date.UTC(value.getUTCFullYear(), month, 0)).getUTCDate();
    if (months && !months.includes(month)) continue;
    const monthMatch = !monthDays || monthDays.some(day => (day > 0 ? day : daysInMonth + day + 1) === dayOfMonth);
    const dayMatch = !byDay.length || byDay.some(day => { const ordinal = Number(day.slice(0,-2)); return day.slice(-2) === weekdays[weekday] && (!ordinal || (ordinal > 0 ? Math.ceil(dayOfMonth / 7) : -Math.ceil((daysInMonth - dayOfMonth + 1) / 7)) === ordinal); });
    if (!monthMatch || !dayMatch) continue;
    let matches;
    if (values.FREQ === 'DAILY') matches = (dateNumber(date) - dateNumber(start.date)) % interval === 0;
    else if (values.FREQ === 'WEEKLY') matches = Math.floor((dateNumber(date) - (weekday - weekStart + 7) % 7 - baseWeek) / 7) % interval === 0 && (byDay.length || weekday === base.getUTCDay());
    else if (values.FREQ === 'MONTHLY') matches = ((value.getUTCFullYear() - base.getUTCFullYear()) * 12 + value.getUTCMonth() - base.getUTCMonth()) % interval === 0 && (byDay.length || monthDays || dayOfMonth === base.getUTCDate());
    else matches = (value.getUTCFullYear() - base.getUTCFullYear()) % interval === 0 && (months || month === base.getUTCMonth() + 1) && (byDay.length || monthDays || dayOfMonth === base.getUTCDate());
    if (!matches) continue;
    const occurrence = { ...start, date };
    if (until && (until.allDay ? date > until.date : toEpoch(occurrence) > toEpoch(until))) break;
    if (++found > count) break; dates.push(occurrence);
  }
  return dates;
}
function normalizedEvent(properties, occurrence, timezone, category, source, uid) {
  const get = name => properties.find(item => item.name === name), original = stamp(get('DTSTART'), timezone), endProperty = get('DTEND'), duration = get('DURATION');
  check(!(endProperty && duration), 'Ein Termin darf nicht gleichzeitig Ende und Dauer enthalten.');
  let end = null, endEpoch = null;
  if (endProperty) {
    const originalEnd = stamp(endProperty, timezone); check(originalEnd.allDay === original.allDay, 'Beginn und Ende müssen dasselbe Datumsformat verwenden.');
    if (original.allDay) end = { ...originalEnd, date:addDays(occurrence.date,dateNumber(originalEnd.date)-dateNumber(original.date)) };
    else {
      // RFC 5545 3.8.5.3: DTEND repeats with the same elapsed duration.
      const duration = toEpoch(originalEnd) - toEpoch(original); check(duration > 0, 'Das Kalenderende liegt vor dem Beginn.');
      endEpoch = toEpoch(occurrence) + duration; end = { ...occurrence,...parts(endEpoch,occurrence.zone) };
    }
  }
  else if (duration) {
    const match = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(duration.value);
    check(match, 'Diese Kalenderdauer wird nicht unterstützt.'); const days = Number(match[1] || 0) * 7 + Number(match[2] || 0), seconds = Number(match[3] || 0) * 3600 + Number(match[4] || 0) * 60 + Number(match[5] || 0);
    check(days + seconds > 0 && (!original.allDay || seconds === 0), 'Ungültige Kalenderdauer.');
    end = { ...occurrence, date: addDays(occurrence.date, days) };
    if (!original.allDay) { endEpoch = toEpoch(end) + seconds * 1000; end = { ...end,...parts(endEpoch,occurrence.zone) }; }
  }
  const dayOff = isDayOffCategory(category), allDay = original.allDay || dayOff, startLocal = original.allDay ? occurrence : parts(toEpoch(occurrence), timezone);
  const endLocal = end ? (end.allDay ? end : parts(endEpoch ?? toEpoch(end), timezone)) : startLocal;
  if (end) check(original.allDay ? end.date > occurrence.date : (endEpoch ?? toEpoch(end)) > toEpoch(occurrence), 'Das Kalenderende liegt vor dem Beginn.');
  let endDate = endLocal.date;
  if (original.allDay && end || !original.allDay && dayOff && end && endLocal.time === '00:00') endDate = addDays(endDate, -1);
  return { title: unescape(get('SUMMARY')?.value || '(Ohne Titel)').slice(0,160), category, startDate: startLocal.date, endDate, allDay, startOnly: !allDay && !end, startTime: allDay ? '' : startLocal.time, endTime: allDay || !end ? '' : endLocal.time, enabled: true, pauseSchedules: dayOff, description: unescape(get('DESCRIPTION')?.value || '').slice(0,5000), location: unescape(get('LOCATION')?.value || '').slice(0,300), source, importKey: hash(`ics|${category}|${uid}|${identity(occurrence)}`) };
}

export function parseCalendar(input, { timezone = 'Europe/Berlin', from, until, category = 'event' } = {}) {
  day(from); day(until); check(until >= from && dateNumber(until) - dateNumber(from) <= 1096, 'Der Importzeitraum darf höchstens drei Jahre umfassen.');
  check(calendarCategories.some(([key]) => key === category), 'Ungültige Importart.');
  const { events,method } = parseEvents(input), entries = [], warnings = [], overrides = new Map(), source = 'ICS-Import';
  check(method !== 'CANCEL', 'Die Datei ist eine Absage, kein Kalenderexport.');
  const get = (event,name) => event.find(item => item.name === name);
  for (const event of events) if (get(event,'RECURRENCE-ID')) {
    const uid = get(event,'UID')?.value; if (uid) { const values = overrides.get(uid) || new Set(); values.add(identity(stamp(get(event,'RECURRENCE-ID'),timezone))); overrides.set(uid,values); }
  }
  for (const event of events) {
    const title = unescape(get(event,'SUMMARY')?.value || '(Ohne Titel)').slice(0,160);
    try {
      if (get(event,'STATUS')?.value.toUpperCase() === 'CANCELLED') continue;
      const start = stamp(get(event,'DTSTART'), timezone), uid = get(event,'UID')?.value || hash(event.map(item => item.name + ':' + item.value).join('\n'));
      const rule = get(event,'RRULE'); let occurrences = rule ? ruleDates(start, rule.value.toUpperCase(), addDays(until,1)) : [start];
      for (const item of event.filter(item => item.name === 'RDATE')) for (const value of item.value.split(',')) occurrences.push(stamp({ ...item, value }, timezone));
      const excluded = new Set(event.filter(item => item.name === 'EXDATE').flatMap(item => item.value.split(',').map(value => identity(stamp({ ...item,value },timezone)))));
      if (!get(event,'RECURRENCE-ID')) for (const value of overrides.get(uid) || []) excluded.add(value);
      const known = new Set();
      for (const occurrence of occurrences) {
        const id = identity(occurrence); if (excluded.has(id) || known.has(id)) continue; known.add(id);
        const entry = normalizedEvent(event, occurrence, timezone, category, source, uid);
        if (get(event,'RECURRENCE-ID')) entry.importKey = hash(`ics|${category}|${uid}|${identity(stamp(get(event,'RECURRENCE-ID'),timezone))}`);
        if (entry.endDate < from || entry.startDate > until) continue;
        entries.push(entry); check(entries.length <= 1000, 'Die Datei enthält mehr als 1000 Termine im gewählten Zeitraum.');
      }
    } catch (error) { if (entries.length > 1000) throw error; warnings.push(`„${title}“: ${error instanceof AppError ? error.message : 'Dieser Termin konnte nicht gelesen werden.'}`); }
  }
  if (!entries.length) warnings.push('Keine lesbaren Einträge im ausgewählten Zeitraum gefunden.');
  return { entries, warnings: [...new Set(warnings)].slice(0,100), source };
}
