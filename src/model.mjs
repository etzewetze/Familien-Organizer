import { createHash } from 'node:crypto';
import { KINDS } from './store.mjs';

export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export const check = (ok, message, status = 400) => { if (!ok) throw new AppError(message, status); };
export function text(value, max = 200, required = false) {
  check(typeof value === 'string' || value === undefined, 'Ungültiger Text.');
  const output = (value || '').trim();
  check(output.length <= max && (!required || output.length > 0), `Text muss ${required ? '1' : '0'} bis ${max} Zeichen enthalten.`);
  return output;
}
export function day(value, optional = false) {
  if (optional && !value) return '';
  check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, 'Ungültiges Datum.');
  return value;
}
export function number(value, min = 0, max = 10000, integer = false) {
  const n = Number(value);
  check(Number.isFinite(n) && n >= min && n <= max && (!integer || Number.isInteger(n)), `Zahl muss zwischen ${min} und ${max} liegen.`);
  return n;
}
export function networkUrl(value, optional = true) {
  if (!value && optional) return '';
  let url;
  try { url = new URL(value); } catch { throw new AppError('Bitte eine vollständige http://- oder https://-Adresse eingeben.'); }
  check(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password, 'Nur HTTP/HTTPS ohne Zugangsdaten in der Adresse ist erlaubt.');
  return url.toString();
}
export function taskDue(task, date) {
  if (task.startDate && date < task.startDate) return false;
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
  if (task.repeat === 'daily') return true;
  if (task.repeat === 'weekdays') return weekday >= 1 && weekday <= 5;
  if (task.repeat === 'weekly') return weekday === new Date(task.startDate + 'T12:00:00Z').getUTCDay();
  return !task.startDate || task.startDate <= date;
}
export function addDays(date, count) {
  const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + count); return d.toISOString().slice(0, 10);
}
export class Model {
  constructor(store) { this.store = store; }
  member(id, optional = false) {
    if (optional && !id) return '';
    check(typeof id === 'string' && !!this.store.get('members', id), 'Familienmitglied wurde nicht gefunden.');
    return id;
  }
  validate(kind, data, old = null) {
    const title = () => text(data.title, 160, true);
    const memberId = () => this.member(data.memberId, true);
    switch (kind) {
      case 'members': {
        check(/^#[0-9a-f]{6}$/i.test(data.color), 'Ungültige Farbe.');
        return { name: text(data.name, 50, true), color: data.color, role: data.role === 'child' ? 'child' : 'adult' };
      }
      case 'events': {
        const startDate = day(data.startDate), endDate = day(data.endDate || startDate);
        const allDay = !!data.allDay;
        const startOnly = !allDay && !!data.startOnly;
        const startTime = allDay ? '' : text(data.startTime || '09:00', 5);
        const endTime = allDay || startOnly ? '' : text(data.endTime || '10:00', 5);
        check(allDay || (startOnly ? [startTime] : [startTime, endTime]).every(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)), 'Ungültige Uhrzeit.');
        check(startOnly ? endDate === startDate : endDate >= startDate && (allDay || endDate > startDate || endTime > startTime), 'Das Terminende muss nach dem Beginn liegen.');
        const selected = data.memberIds === undefined ? (data.memberId ? [data.memberId] : []) : data.memberIds;
        check(Array.isArray(selected) && selected.length <= 20, 'Bitte Alle oder Familienmitglieder auswählen.');
        const memberIds = [...new Set(selected.map(id => this.member(id)))];
        const googleAccountId = text(data.googleAccountId, 100), calendarId = text(data.calendarId, 300);
        if (old?.googleAccountId) check(googleAccountId === old.googleAccountId && calendarId === old.calendarId, 'Google-Termine können nicht zwischen Kalendern verschoben werden.');
        if (googleAccountId) {
          const account = this.store.publicAccounts().find(a => a.id === googleAccountId);
          const calendar = account?.calendars?.find(c => c.id === calendarId && c.selected);
          check(calendar && ['owner', 'writer'].includes(calendar.accessRole), 'Dieser Google-Kalender ist nicht schreibbar oder nicht ausgewählt.');
        } else check(!calendarId, 'Bitte Google-Konto auswählen.');
        check(!old?.googleReadOnly, 'Dieser Google-Kalender ist schreibgeschützt.', 403);
        return { title: title(), startDate, endDate, startTime, endTime, allDay, startOnly, memberIds, memberId: memberIds[0] || '', location: text(data.location, 300), description: text(data.description, 5000), googleAccountId, calendarId, googleEventId: old?.googleEventId || '', googleReadOnly: old?.googleReadOnly || false };
      }
      case 'birthdays': {
        const month = number(data.month, 1, 12, true), birthdayDay = number(data.day, 1, 31, true);
        day(`2000-${String(month).padStart(2, '0')}-${String(birthdayDay).padStart(2, '0')}`);
        const currentYear = Number(new Intl.DateTimeFormat('sv-SE', { timeZone: this.store.meta('settings', {}).timezone || 'Europe/Berlin' }).format(new Date()).slice(0, 4));
        const birthYear = data.birthYear === undefined || data.birthYear === null || data.birthYear === '' ? null : number(data.birthYear, 1, currentYear, true);
        if (birthYear !== null) day(`${String(birthYear).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(birthdayDay).padStart(2, '0')}`);
        const leapDay = data.leapDay || 'mar1';
        check(['mar1', 'feb28'].includes(leapDay), 'Bitte den Ersatztermin für den 29. Februar auswählen.');
        return { name: text(data.name, 100, true), month, day: birthdayDay, birthYear, leapDay, memberId: memberId(), notes: text(data.notes, 2000) };
      }
      case 'tasks': {
        const repeat = data.repeat || 'none';
        check(['none', 'daily', 'weekdays', 'weekly'].includes(repeat), 'Ungültige Wiederholung.');
        const startDate = day(data.startDate, repeat !== 'weekly');
        const imageFile = text(data.imageFile, 100);
        check(!imageFile || /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.(?:jpg|png|webp|gif)$/.test(imageFile), 'Ungültiges Aufgabenbild.');
        return { title: title(), memberId: memberId(), points: number(data.points || 0, 0, 1000, true), repeat, startDate, description: text(data.description, 2000), imageFile };
      }
      case 'recipes': {
        check(Array.isArray(data.ingredients) && data.ingredients.length <= 100, 'Maximal 100 Zutaten je Rezept.');
        const ingredients = data.ingredients.map(i => ({ name: text(i.name, 100, true), quantity: number(i.quantity, 0, 100000), unit: text(i.unit, 30), category: text(i.category || 'Sonstiges', 50) }));
        return { title: title(), servings: number(data.servings || 4, 1, 100, true), minutes: number(data.minutes || 30, 0, 1440, true), category: text(data.category || 'Hauptgericht', 60), ingredients, instructions: text(data.instructions, 15000), sourceUrl: networkUrl(data.sourceUrl) };
      }
      case 'meals': {
        check(this.store.get('recipes', data.recipeId), 'Rezept nicht gefunden.');
        const slot = data.slot || old?.slot || 'dinner';
        check(['breakfast', 'lunch', 'dinner'].includes(slot), 'Bitte Frühstück, Mittag oder Abendbrot auswählen.');
        return { date: day(data.date), slot, recipeId: data.recipeId, servings: number(data.servings || 4, 1, 100, true) };
      }
      case 'lists': return { title: title() };
      case 'items': {
        check(this.store.get('lists', data.listId), 'Liste nicht gefunden.');
        return { title: title(), listId: data.listId, quantity: number(data.quantity || 0, 0, 100000), unit: text(data.unit, 30), category: text(data.category || 'Sonstiges', 50), checked: !!data.checked, generatedWeek: old?.generatedWeek || '' };
      }
      case 'notes': return { title: title(), body: text(data.body, 20000), pinned: !!data.pinned };
      case 'rewards': return { title: title(), cost: number(data.cost, 1, 100000, true), description: text(data.description, 1000) };
      default: throw new AppError('Bereich nicht gefunden.', 404);
    }
  }
  save(kind, id, data) {
    check(KINDS.includes(kind), 'Bereich nicht gefunden.', 404);
    return this.store.transaction(() => {
      const old = id ? this.store.get(kind, id) : null;
      if (kind === 'members' && !old) check(this.store.all('members').length < 20, 'Maximal 20 Familienmitglieder.');
      if (id) check(old, 'Eintrag wurde nicht gefunden.', 404);
      if (old) check(data._rev === old._rev, 'Der Eintrag wurde auf einem anderen Gerät geändert. Bitte neu öffnen.', 409);
      const value = this.validate(kind, data, old);
      const recordId = old?.id || (kind === 'meals' ? value.date + (data.slot ? '-' + value.slot : '') : this.store.id());
      if (kind === 'meals') {
        check(!this.store.all('meals').some(m => m.id !== old?.id && m.date === value.date && (m.slot || 'dinner') === value.slot), 'Diese Mahlzeit ist bereits geplant. Bitte den bestehenden Plan bearbeiten.', 409);
        if (old) check(old.date === value.date && (old.slot || 'dinner') === value.slot, 'Zum Verschieben die Mahlzeit neu planen.');
      }
      const saved = this.store.put(kind, recordId, value);
      if (kind === 'events' && value.googleAccountId) this.enqueue(saved, 'save');
      return saved;
    });
  }
  enqueue(event, operation) {
    this.store.db.prepare("INSERT INTO outbox(record_id,operation,data) VALUES (?,?,?) ON CONFLICT(record_id) DO UPDATE SET operation=excluded.operation,data=excluded.data,error='',attempts=0").run(event.id, operation, JSON.stringify(event));
  }
  delete(kind, id, rev) {
    check(KINDS.includes(kind), 'Bereich nicht gefunden.', 404);
    check(kind !== 'pointAwards', 'Punktebuchungen werden als Historie aufbewahrt.', 403);
    return this.store.transaction(() => {
      const record = this.store.get(kind, id);
      check(record, 'Eintrag nicht gefunden.', 404);
      check(record._rev === rev, 'Der Eintrag wurde zwischenzeitlich geändert. Bitte neu öffnen.', 409);
      check(kind !== 'members', 'Familienmitglieder bleiben wegen der Punktehistorie erhalten.');
      check(!(kind === 'lists' && id === 'shopping'), 'Die Einkaufsliste bleibt erhalten.');
      if (kind === 'recipes') check(!this.store.all('meals').some(m => m.recipeId === id), 'Dieses Rezept ist noch im Essensplan. Zuerst dort entfernen.');
      if (kind === 'lists') for (const item of this.store.all('items').filter(i => i.listId === id)) this.store.remove('items', item.id);
      if (kind === 'events' && record.googleAccountId) { check(!record.googleReadOnly, 'Dieser Kalender ist schreibgeschützt.'); this.enqueue(record, 'delete'); }
      this.store.remove(kind, id);
    });
  }
  complete(taskId, data, today) {
    return this.store.transaction(() => {
      const task = this.store.get('tasks', taskId);
      check(task, 'Aufgabe nicht gefunden.', 404);
      const date = day(data.date);
      check(date <= today, 'Aufgaben können erst am jeweiligen Tag abgehakt werden.');
      check(taskDue(task, date), 'Die Aufgabe ist an diesem Tag nicht geplant.');
      const key = task.repeat === 'none' ? 'once' : date;
      const existing = this.store.db.prepare('SELECT * FROM completions WHERE task_id=? AND day=?').get(taskId, key);
      if (data.done) {
        if (existing) return existing;
        const memberId = task.memberId || this.member(data.memberId);
        this.store.db.prepare('INSERT INTO completions VALUES (?,?,?,?,?,?)').run(taskId, key, memberId, task.points, task.title, new Date().toISOString());
      } else if (existing) {
        check(this.store.balance(existing.member_id).available >= existing.points, 'Diese Punkte wurden bereits eingelöst. Die Erledigung kann deshalb nicht zurückgenommen werden.');
        this.store.db.prepare('DELETE FROM completions WHERE task_id=? AND day=?').run(taskId, key);
      }
      this.store.bump();
    });
  }
  assignTask(taskId, data) {
    return this.store.transaction(() => {
      const task = this.store.get('tasks', taskId);
      check(task, 'Aufgabe nicht gefunden.', 404);
      check(task._rev === data._rev, 'Die Aufgabe wurde auf einem anderen Gerät geändert. Bitte neu laden.', 409);
      const date = day(data.date);
      const key = task.repeat === 'none' ? 'once' : date;
      check(!this.store.db.prepare('SELECT 1 FROM completions WHERE task_id=? AND day=?').get(taskId, key), 'Erledigte Aufgaben zuerst wieder öffnen, bevor sie verteilt werden.', 409);
      return this.store.put('tasks', taskId, { ...task, memberId: this.member(data.memberId, true) });
    });
  }
  awardPoints(data) {
    return this.store.transaction(() => {
      const memberId = this.member(data.memberId), points = number(data.points, 1, 100000, true), reason = text(data.reason, 160, true);
      check(typeof data.requestId === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(data.requestId), 'Ungültige Buchungskennung.');
      const existing = this.store.get('pointAwards', data.requestId);
      if (existing) {
        check(existing.memberId === memberId && existing.points === points && existing.reason === reason, 'Buchungskennung bereits verwendet.', 409);
        return existing;
      }
      return this.store.put('pointAwards', data.requestId, { memberId, points, reason, awardedAt: new Date().toISOString() });
    });
  }
  redeem(rewardId, memberId, requestId) {
    return this.store.transaction(() => {
      this.member(memberId);
      check(typeof requestId === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(requestId), 'Ungültige Buchungskennung.');
      const existing = this.store.db.prepare('SELECT * FROM redemptions WHERE id=?').get(requestId);
      if (existing) { check(existing.member_id === memberId && existing.reward_id === rewardId, 'Buchungskennung bereits verwendet.', 409); return existing; }
      const reward = this.store.get('rewards', rewardId);
      check(reward, 'Belohnung nicht gefunden.', 404);
      check(this.store.balance(memberId).available >= reward.cost, 'Dafür fehlen noch Punkte.');
      this.store.db.prepare('INSERT INTO redemptions VALUES (?,?,?,?,?,?)').run(requestId, memberId, rewardId, reward.title, reward.cost, new Date().toISOString());
      this.store.bump();
    });
  }
  generateShopping(week) {
    day(week);
    check(new Date(week + 'T12:00:00Z').getUTCDay() === 1, 'Bitte den Montag der Woche auswählen.');
    return this.store.transaction(() => {
      const aggregate = new Map();
      for (const meal of this.store.all('meals').filter(m => m.date >= week && m.date < addDays(week, 7))) {
        const recipe = this.store.get('recipes', meal.recipeId);
        for (const ingredient of recipe?.ingredients || []) {
          const key = ingredient.name.trim().toLocaleLowerCase('de') + '|' + ingredient.unit.toLocaleLowerCase('de');
          const item = aggregate.get(key) || { title: ingredient.name, quantity: 0, unit: ingredient.unit, category: ingredient.category, listId: 'shopping', checked: false, generatedWeek: week };
          item.quantity += ingredient.quantity * meal.servings / recipe.servings;
          aggregate.set(key, item);
        }
      }
      const oldItems = this.store.all('items').filter(i => i.generatedWeek === week);
      const ids = new Set();
      for (const [key, item] of aggregate) {
        const id = 'meal-' + createHash('sha256').update(week + key).digest('hex').slice(0, 24);
        ids.add(id); item.quantity = Math.round(item.quantity * 100) / 100;
        const old = this.store.get('items', id);
        item.checked = !!old?.checked && old.quantity === item.quantity;
        this.store.put('items', id, item);
      }
      for (const old of oldItems) if (!ids.has(old.id)) this.store.remove('items', old.id);
      return { count: aggregate.size };
    });
  }
}
