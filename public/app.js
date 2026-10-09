import { birthdaysOnDate, nextBirthday } from './birthdays.js';
import { eventMembers, layoutTimedEvents, mealSlots, parsePlannerDrag, timeScale, hourScale } from './planner.js';
import { appearanceDefaults, appearanceFor, eventProperties, calendarColumns, isImageFile, themeProperties } from './appearance.js';

const $ = (selector, root = document) => root.querySelector(selector);
const E = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const paths = {
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18m-13 4h2m4 0h2m-8 3h2"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M9 21v-8h6v8"/>',
  tasks: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="m8 9 1 1 2-2m3 1h3m-9 6 1 1 2-2m3 1h3"/>',
  food: '<path d="M4 3v5a3 3 0 0 0 6 0V3M7 3v18m12-18c-3 2-4 5-4 8h4m0-8v18"/>',
  lists: '<path d="M9 6h12M9 12h12M9 18h12m-17-12h.01M4 12h.01M4 18h.01"/>',
  notes: '<path d="M14 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9m-10 5 2-5 6-6a2 2 0 0 1 3 3l-6 6Z"/>',
  photos: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  settings: '<path d="m9 3 1 3h4l1-3 3 2-1 3 2 3 3 1-1 4-3-1-3 2-1 4h-4l-1-4-3-2-3 1-1-4 3-1 2-3-1-3Z"/><circle cx="12" cy="12" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  left: '<path d="m14 6-6 6 6 6"/>', right: '<path d="m10 6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-16a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5"/>',
  shield: '<path d="m12 3 8 4v6c0 4-8 8-8 8s-8-4-8-8V7Z"/><path d="m8 12 3 3 5-6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  edit: '<path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m14 5 5 5"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  pin: '<path d="m16 3 5 5-5 2-3 6-2-2-6 7m0-16 2-2 5 5-6 3Z"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  refresh: '<path d="M20 7a9 9 0 0 0-15-2L3 8m0-5v5h5m-4 9a9 9 0 0 0 15 2l2-3m0 5v-5h-5"/>',
  server: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6h.01M7 17h.01m4-11h6m-6 11h6"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
  network: '<rect x="8" y="3" width="8" height="6" rx="1"/><rect x="2" y="16" width="6" height="5" rx="1"/><rect x="16" y="16" width="6" height="5" rx="1"/><path d="M12 9v4H5v3m7-3h7v3"/>',
  pause: '<path d="M8 5v14m8-14v14"/>', play: '<path d="m8 4 12 8-12 8Z"/>',
  logout: '<path d="M9 3H4v18h5m3-9h9m-4-4 4 4-4 4"/>',
  book: '<path d="M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1Zm0 0v15"/>',
  cake: '<path d="M4 12h16v9H4Zm0 4c2 2 4-2 6 0s4-2 6 0 3 1 4 0M8 12V8m4 4V8m4 4V8M8 5v1m4-3v3m4-1v1"/>',
};
const I = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.calendar}</svg>`;
const nav = [['home', 'Übersicht', 'home'], ['calendar', 'Kalender', 'calendar'], ['birthdays', 'Geburtstage', 'cake'], ['tasks', 'Aufgaben', 'tasks'], ['rewards', 'Belohnungen', 'star'], ['meals', 'Essen & Rezepte', 'food'], ['lists', 'Listen & Einkauf', 'lists'], ['notes', 'Notizen', 'notes'], ['photos', 'Bilderrahmen', 'photos']];
const app = $('#app'), editor = $('#editor'), confirmDialog = $('#confirm');
let S, status, route = location.hash.slice(1) || 'home', cursor = '', filter = '', online = true, editing = null, busy = false;
let calendarMode = 'week', taskMode = 'all', activeList = 'shopping';
let mealLayout = localStorage.getItem('mealLayout') === 'vertical' ? 'vertical' : 'horizontal';
let photoSource = localStorage.getItem('photoSource') || 'local', photoItems = [], photoLoaded = false, photoLoading = false, photoAlbum = localStorage.getItem('photoAlbum') || '', albums = [], photoUrls = new Map();
let taskBoard = 'all', updaterState = null, updateUnavailableSince = 0, updatePollBusy = false, taskPreviewUrl = '', pointerDrag = null, nativeDrag = null, suppressDragClick = false;
let memberPreviewUrl = '', backgroundPreviewUrl = '', recipePreviewUrl = '';
const calendarScrollPositions = new Map();
let slideTimer, slideIndex = 0, slidePaused = false, slideActive = false;
const ds = date => new Date(date + 'T12:00:00');
const addDays = (date, count) => { const d = ds(date); d.setDate(d.getDate() + count); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const monday = date => addDays(date, -((ds(date).getDay() + 6) % 7));
const shortDate = date => ds(date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
const fullDate = date => ds(date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
const fullWeekday = date => ds(date).toLocaleDateString('de-DE', { weekday: 'long' });
const weekCaption = date => `${shortDate(monday(date))} – ${shortDate(addDays(monday(date), 6))}`;
const weekday = date => ds(date).toLocaleDateString('de-DE', { weekday: 'short' });
const member = id => S?.members.find(m => m.id === id);
const colorStyle = color => `--person:${E(color)};--person-bg:${E(color)}24`;
const personStyle = id => colorStyle(member(id)?.color || appearanceFor(S?.settings).allColor);
const eventStyle = event => Object.entries(eventProperties(event, S.members, S.settings)).map(([key, value]) => `${key}:${E(value)}`).join(';');
const uiImageUrl = file => '/api/images/ui?file=' + encodeURIComponent(file);
function recipePicture(recipe, css = '') {
  return `<span class="recipe-picture ${css}"><span class="recipe-picture-fallback" aria-hidden="true">${I('food')}<small>Kein Bild</small></span>${isImageFile(recipe.imageFile) ? `<img src="${uiImageUrl(recipe.imageFile)}" alt="${E('Bild zu ' + recipe.title)}" loading="lazy" decoding="async" draggable="false" data-recipe-image>` : ''}</span>`;
}
const avatar = (id, size = '') => { const m = member(id); return `<span class="avatar ${size}" style="${personStyle(id)}"><span>${E((m?.name || 'Alle').slice(0, 1).toUpperCase())}</span>${isImageFile(m?.avatarImage) ? `<img src="${uiImageUrl(m.avatarImage)}" alt="" data-profile-image>` : ''}</span>`; };
const btn = (label, action, icon = '', css = '', attrs = '') => `<button class="button ${css}" data-action="${action}" ${attrs}>${icon ? I(icon) : ''}${E(label)}</button>`;
const iconBtn = (label, action, icon, attrs = '') => `<button class="icon-button" title="${E(label)}" aria-label="${E(label)}" data-action="${action}" ${attrs}>${I(icon)}</button>`;
const empty = (title, description, icon = 'calendar', action = '') => `<div class="empty">${I(icon)}<h3>${E(title)}</h3><p>${E(description)}</p>${action}</div>`;
const visibleEvents = date => [...S.events, ...birthdaysOnDate(S.birthdays || [], date)].filter(e => e.startDate <= date && e.endDate >= date && (!filter || eventMembers(e).includes(filter) || !eventMembers(e).length)).sort((a, b) => (a.allDay ? '00:00' : a.startTime).localeCompare(b.allDay ? '00:00' : b.startTime));
function due(task, date) {
  if (task.startDate && date < task.startDate) return false;
  const day = ds(date).getDay();
  return task.repeat === 'daily' || task.repeat === 'weekdays' && day > 0 && day < 6 || task.repeat === 'weekly' && day === ds(task.startDate).getDay() || task.repeat === 'none';
}
const completion = (task, date = cursor) => S.completions.find(c => c.task_id === task.id && c.day === (task.repeat === 'none' ? 'once' : date));
const visibleTasks = date => S.tasks.filter(t => due(t, date) && (!filter || t.memberId === filter || !t.memberId) && (taskMode === 'all' || taskMode === 'routines' && t.repeat !== 'none' || taskMode === 'todos' && t.repeat === 'none'));
const meal = (date, slot = 'dinner') => S.meals.find(m => m.date === date && (m.slot || 'dinner') === slot);
const recipeFor = date => S.recipes.find(r => r.id === meal(date)?.recipeId);
const quantity = n => n ? new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(n) : '';
const clockText = () => new Intl.DateTimeFormat('de-DE', { timeZone: S?.settings.timezone || 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date());
function toast(message, error = false) {
  const element = document.createElement('div'); element.className = 'toast' + (error ? ' error' : ''); element.textContent = message;
  $('#toasts').append(element); setTimeout(() => element.remove(), error ? 7500 : 4000);
}
async function api(path, method = 'GET', data) {
  const options = { method, headers: { 'X-Family-Request': '1' } };
  if (data !== undefined) { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(data); }
  let response;
  try { response = await fetch('/api' + path, options); }
  catch { throw new Error('Der Server ist gerade nicht erreichbar. Bitte die Verbindung prüfen.'); }
  const output = await response.json();
  if (!response.ok) { if (response.status === 401 && S) { S = null; renderAuth(true); } throw new Error(output.error || 'Die Anfrage ist fehlgeschlagen.'); }
  return output;
}
async function refresh(renderView = true) {
  const next = await api('/state');
  const changed = !S || S.revision !== next.revision || S.serverDate !== next.serverDate || !online;
  if (S && cursor === S.serverDate && S.serverDate !== next.serverDate) cursor = next.serverDate;
  S = next; online = true; cursor ||= S.serverDate;
  if (renderView && changed && !editor.open && !confirmDialog.open && !pointerDrag && !nativeDrag && !document.activeElement?.closest('form')) render();
}
async function mutate(path, method, data, message) {
  await api(path, method, data); await refresh(false); render(); if (message) toast(message);
}
function go(next) { if (!nav.some(n => n[0] === next) && next !== 'settings') next = 'home'; if (route === next) { render(); return; } location.hash = next; }
function renderAuth(login = false) {
  applyAppearance(appearanceDefaults);
  const art = `<aside class="auth-art"><div class="brand"><span class="brand-mark">${I('calendar')}</span><div><strong>Familien<br>Organisierer</strong></div></div><h1>Ein Ort für<br>euren Alltag.</h1><p>Gemeinsam planen, Aufgaben teilen und mehr Zeit füreinander haben.</p><div class="auth-feature">${I('calendar')}Eure Termine auf einen Blick</div><div class="auth-feature">${I('tasks')}Kleine Aufgaben. Gemeinsame Erfolge.</div><div class="auth-feature">${I('shield')}Bei euch zu Hause gespeichert</div></aside>`;
  app.innerHTML = `<div class="auth-page">${art}<main class="auth-form-wrap"><form class="auth-form" id="auth-form"><h2>${login ? 'Willkommen zurück' : 'Hallo, liebe Familie.'}</h2><p>${login ? 'Melde dich mit eurem Familienpasswort an.' : 'Richtet eure eigene Familienzentrale ein. Namen und Farben könnt ihr später jederzeit ändern.'}</p>${login ? '' : `<label class="form-field">Name eurer Familie<input name="familyName" value="Unsere Familie" required maxlength="60" autocomplete="organization"></label><label class="form-field">Familienmitglieder<textarea name="names" rows="3" placeholder="Ein Name pro Zeile" required></textarea><span class="field-hint">Ein bis zwanzig Personen, jeweils in einer eigenen Zeile.</span></label>`}<label class="form-field">Familienpasswort<input type="password" name="password" required ${login ? '' : 'minlength="12"'} maxlength="200" autocomplete="${login ? 'current-password' : 'new-password'}">${login ? '' : '<span class="field-hint">Mindestens 12 Zeichen. Dieses Passwort gilt für eure Geräte.</span>'}</label>${login ? '' : '<label class="checkbox-field"><input type="checkbox" name="demo">Beispiele zum Ausprobieren hinzufügen</label>'}<p class="form-error" id="auth-error" role="alert"></p><button class="button primary" type="submit">${login ? 'Anmelden' : 'Familienzentrale einrichten'}</button><p class="auth-version">Familien Organisierer · Version ${E(status?.version || '0.5.1')} · Selbst gehostet</p></form></main></div>`;
  $('#auth-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget, data = Object.fromEntries(new FormData(form));
    const button = $('button[type=submit]', form); button.disabled = true;
    try { if (!login) { data.names = data.names.split('\n').map(n => n.trim()).filter(Boolean); data.demo = !!data.demo; } await api(login ? '/login' : '/setup', 'POST', data); await refresh(false); render(); }
    catch (error) { $('#auth-error').textContent = error.message; }
    finally { button.disabled = false; }
  });
}
function pageHead(title, subtitle, action = '') {
  return `<div class="page-head"><div><h1>${E(title)}</h1>${subtitle ? `<p>${E(subtitle)}</p>` : ''}</div><div class="head-actions">${action}</div></div>`;
}
function navigation() {
  return `<aside class="rail" id="rail"><div class="brand"><span class="brand-mark">${I('calendar')}</span><div><strong>Familien<br>Organisierer</strong><small>Unser Alltag. Zusammen.</small></div></div><div><div class="rail-label">Familienzentrale</div><nav class="nav-list" aria-label="Hauptnavigation">${nav.map(([id, label, icon]) => `<button class="nav-item ${route === id ? 'active' : ''}" data-nav="${id}" ${route === id ? 'aria-current="page"' : ''}>${I(icon)}${label}</button>`).join('')}<button class="nav-item" disabled>${I('book')}Stundenpläne<span class="badge">Später</span></button></nav></div><div class="nav-bottom"><button class="nav-item ${route === 'settings' ? 'active' : ''}" data-nav="settings">${I('settings')}Einstellungen</button></div><div class="self-hosted"><strong>${I('shield')}Euer eigener Server</strong>Familien Organisierer · ${E(status?.version || '0.5.1')}</div></aside>`;
}
function render() {
  if (!S) return;
  applyAppearance(S.settings);
  if (route !== 'settings' && backgroundPreviewUrl) { URL.revokeObjectURL(backgroundPreviewUrl); backgroundPreviewUrl = ''; }
  const previousGrid = $('.time-scroll');
  if (previousGrid?.dataset.week) { const heights = previousGrid.dataset.hourHeights?.split(',').map(Number) || Array(24).fill(Number(previousGrid.dataset.hourSize) || 64); calendarScrollPositions.set(previousGrid.dataset.week, { minute: hourScale(heights).minuteAt(previousGrid.scrollTop), left: previousGrid.scrollLeft }); }
  if (!nav.some(n => n[0] === route) && route !== 'settings') route = 'home';
  const pages = { home: homePage, calendar: calendarPage, birthdays: birthdaysPage, tasks: tasksPage, rewards: rewardsPage, meals: mealsPage, lists: listsPage, notes: notesPage, photos: photosPage, settings: settingsPage };
  app.innerHTML = `<div class="shell">${navigation()}<div class="workspace"><header class="topbar"><div class="topbar-left">${iconBtn('Menü öffnen', 'menu', 'menu')}<span class="family-title">${E(S.settings.familyName)}</span></div>${headerMembers()}<div class="topbar-right"><span class="local-clock" aria-label="Aktuelle Uhrzeit">${clockText()}</span><span class="connection ${online ? '' : 'offline'}" id="connection">${online ? 'Verbunden' : 'Verbindung fehlt'}</span>${iconBtn('Bilderrahmen öffnen', 'photos', 'photos')}${iconBtn('Vollbild', 'fullscreen', 'expand')}</div></header>${online ? '' : '<div class="offline-banner">Verbindung zum Server fehlt. Änderungen sind erst nach der Verbindung möglich.</div>'}<main class="main" id="main">${pages[route]()}</main></div></div><nav class="mobile-nav" aria-label="Schnellnavigation">${[['home', 'Heute', 'home'], ['calendar', 'Kalender', 'calendar'], ['tasks', 'Aufgaben', 'tasks'], ['rewards', 'Belohnungen', 'star'], ['meals', 'Essen', 'food']].map(([id, label, icon]) => `<button data-nav="${id}" class="${route === id ? 'active' : ''}">${I(icon)}${label}</button>`).join('')}<button data-action="menu">${I('menu')}Mehr</button></nav>`;
  $('[data-action="menu"]', $('.topbar')).classList.add('mobile-menu');
  $('[data-action="photos"]', $('.topbar')).classList.add('picture-shortcut');
  document.querySelectorAll('#settings-family,#settings-photos,#settings-appearance').forEach(form => { form.dataset.revision = S.revision; });
  if (route === 'photos' && !photoLoaded && !photoLoading) void loadPhotos();
  updateDisabled();
  if (route === 'calendar' && calendarMode === 'week') { const grid = $('.time-scroll'), position = calendarScrollPositions.get(monday(cursor)); if (grid) { grid.scrollTop = weekTimeScale(cursor).position(position?.minute ?? 360); grid.scrollLeft = position?.left ?? 0; } }
  if (route === 'settings') { paintUpdateStatus(); void pollUpdateStatus(); }
}

function headerMembers() {
  return `<div class="header-members" role="group" aria-label="Familienmitglieder"><div class="header-members-inner"><button class="header-person ${!filter ? 'selected' : ''}" data-filter="" aria-pressed="${!filter}" style="${personStyle('')}"><span class="member-ring">${I('people')}</span><span>Alle</span></button>${S.members.map(m => `<button class="header-person ${filter === m.id ? 'selected' : ''}" data-filter="${m.id}" ${route === 'tasks' ? `data-task-drop="${m.id}"` : ''} style="${personStyle(m.id)}" aria-pressed="${filter === m.id}">${avatar(m.id)}<span>${E(m.name)}</span>${route === 'tasks' ? `<small class="header-points">${S.points[m.id].available} Punkte</small>` : ''}</button>`).join('')}</div></div>`;
}
function updateDisabled() { if (!online) document.querySelectorAll('[data-edit],[data-complete],[data-check-item],[data-redeem],[data-action=import-recipe],form button[type=submit]').forEach(el => el.disabled = true); }
function eventCard(e, compact = false) {
  const people = eventMembers(e).map(id => member(id)?.name).filter(Boolean).join(', ') || 'Alle';
  const time = e.birthdayId ? 'Geburtstag · jährlich' : e.allDay ? 'Ganztägig' : e.startOnly ? `${e.startTime} · ohne Ende` : `${e.startTime}–${e.endTime}`;
  return `<button class="event-card ${e.birthdayId ? 'birthday-event' : ''}" style="${eventStyle(e)}" data-edit="${e.birthdayId ? 'birthdays' : 'events'}" data-id="${e.birthdayId || e.id}" title="${E(e.title)}"><span class="event-time">${E(time)}</span><strong>${E(e.title)}</strong>${compact ? '' : `<span class="event-person">${E(people)}${e.googleAccountId ? ' · Google' : ''}</span>`}</button>`;
}
function dayHeading(date, css = '') {
  return `<div class="day-heading ${css}"><div><strong>${fullWeekday(date)}</strong><span>${fullDate(date)}</span></div><button class="icon-button day-plus" data-edit="events" data-date="${date}" aria-label="Termin am ${E(fullDate(date))} hinzufügen">${I('plus')}</button></div>`;
}
function weekGrid(date, includeMeals = false) {
  return `<div class="week-scroll"><div class="week-grid">${Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday(date), i), events = visibleEvents(day), recipe = recipeFor(day);
    return `<div class="day-column ${day === S.serverDate ? 'today' : ''}">${dayHeading(day)}${events.map(e => eventCard(e)).join('')}${includeMeals && recipe ? `<button class="day-meal" data-recipe="${recipe.id}">${I('food')}<span>${E(recipe.title)}</span></button>` : ''}</div>`;
  }).join('')}</div></div>`;
}

function weekTimeScale(date) { const theme = appearanceFor(S.settings); return timeScale(Array.from({ length: 7 }, (_, i) => { const day = addDays(monday(date), i); return { date: day, events: visibleEvents(day) }; }), theme.calendarHourSize, theme.calendarCompactHours); }
function timeWeek(date) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday(date), i)), events = days.map(visibleEvents), theme = appearanceFor(S.settings), grid = calendarColumns(events, theme.calendarAutoWidth);
  const scale = timeScale(days.map((date, i) => ({ date, events: events[i] })), theme.calendarHourSize, theme.calendarCompactHours);
  const headers = `<div class="time-head time-corner">${I('clock')}<span>Uhrzeit</span></div>${days.map(day => dayHeading(day, `time-head ${day === S.serverDate ? 'today' : ''}`)).join('')}`;
  const hasAllDay = events.some(list => list.some(event => event.allDay));
  const allDay = hasAllDay ? `<div class="all-day-label">Ganztägig</div>${days.map((day, index) => `<div class="all-day-cell ${day === S.serverDate ? 'today' : ''}">${events[index].filter(e => e.allDay).map(e => eventCard(e, true)).join('')}</div>`).join('')}` : '';
  const axis = `<div class="time-axis">${Array.from({ length: 25 }, (_, h) => `<span style="top:${scale.position(h * 60) / scale.total * 100}%">${String(h).padStart(2, '0')}:00</span>`).join('')}</div>`;
  const rows = scale.hours.map(row => `<div class="hour-row" aria-hidden="true" style="top:${row.top / scale.total * 100}%;height:${row.height / scale.total * 100}%"></div>`).join('');
  const columns = days.map((day, index) => `<div class="time-day ${day === S.serverDate ? 'today' : ''}" aria-label="${E(fullWeekday(day) + ', ' + fullDate(day))}">${rows}${layoutTimedEvents(events[index], day).map(({ event: e, start, end, column, columns }) => {
    const people = eventMembers(e).map(id => member(id)?.name).filter(Boolean).join(', ') || 'Alle';
    const label = `${e.title}, ${e.startTime}${e.startOnly ? ', ohne Ende' : ' bis ' + e.endTime}, ${people}${e.location ? ', ' + e.location : ''}`;
    return `<button class="time-event ${e.startOnly ? 'start-only' : ''}" data-edit="events" data-id="${e.id}" style="${eventStyle(e)};top:${scale.position(start) / scale.total * 100}%;height:${(scale.position(end) - scale.position(start)) / scale.total * 100}%;left:calc(${column / columns * 100}% + 3px);width:calc(${100 / columns}% - 6px)" title="${E(label)}" aria-label="${E(label)}">${e.startOnly ? `<strong>${E(e.startTime)} ${E(e.title)}</strong>` : `<span class="event-time">${E(e.startTime)}${e.endDate !== e.startDate ? ' …' : '–' + E(e.endTime)}</span><strong>${E(e.title)}</strong>${end - start >= 60 ? `<span class="event-person">${E(people)}</span>${e.location ? `<span class="event-person">${E(e.location)}</span>` : ''}` : ''}`}</button>`;
  }).join('')}</div>`).join('');
  return `<div class="time-scroll" data-week="${monday(date)}" data-hour-size="${theme.calendarHourSize}" data-hour-heights="${scale.hours.map(row => row.height).join(',')}" tabindex="0" aria-label="Wochenkalender, 24 Stunden"><div class="time-grid" style="grid-template-columns:${grid.template};min-width:${grid.minimum}px;--hour-size:${theme.calendarHourSize}px;--calendar-total:${scale.total}px">${headers}${allDay}${axis}${columns}</div></div>`;
}
function taskRow(task, date, compact = false) {
  const done = !!completion(task, date), repeats = { daily: 'Täglich', weekdays: 'Mo–Fr', weekly: 'Wöchentlich', none: 'Einmalig' };
  return `<div class="todo-row ${done ? 'done' : ''}" ${compact || done ? '' : `draggable="true" data-drag-kind="task" data-drag-id="${task.id}" data-drag-rev="${task._rev}"`}>${!compact && !done ? `<button class="drag-handle" data-drag-handle aria-label="${E(task.title)} verschieben">${I('menu')}</button>` : ''}<button class="check-button ${done ? 'checked' : ''}" data-complete="${task.id}" data-date="${date}" role="checkbox" aria-checked="${done}" aria-label="${E(task.title)} ${done ? 'wieder öffnen' : 'abhaken'}">${done ? I('check') : ''}</button>${task.imageFile ? `<img class="task-image" src="/api/tasks/image?file=${encodeURIComponent(task.imageFile)}" alt="" loading="lazy">` : ''}<div class="spacer"><div class="todo-title">${E(task.title)}</div><div class="todo-detail">${E(member(task.memberId)?.name || 'Allgemein')}${compact ? '' : ` · ${repeats[task.repeat]}`}</div></div>${task.points ? `<span class="points-tag">${I('star')}${task.points}</span>` : ''}${compact ? avatar(task.memberId) : iconBtn('Aufgabe bearbeiten', 'edit-task', 'edit', `data-edit="tasks" data-id="${task.id}"`)}</div>`;
}
function homePage() {
  const date = S.serverDate, tasks = visibleTasks(date), complete = tasks.filter(t => completion(t, date)).length;
  const todayRecipe = recipeFor(date), todayMeal = meal(date);
  const headingDate = ds(date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const openShopping = S.items.filter(i => i.listId === 'shopping' && !i.checked).length;
  return `${pageHead('Alles für eure Woche.', headingDate, `<button class="button primary" data-edit="events">${I('plus')}<span>Termin</span></button>`)}<div class="summary-row"><div class="summary-card"><div class="summary-icon">${I('calendar')}</div><div><strong>${visibleEvents(date).length}</strong><span>Termine heute</span></div><span class="summary-hint">Euer Tag im Blick</span></div><div class="summary-card"><div class="summary-icon orange">${I('tasks')}</div><div><strong>${complete}<span style="display:inline;font-size:1rem"> / ${tasks.length}</span></strong><span>Aufgaben erledigt</span></div><span class="summary-hint">Schritt für Schritt</span></div><div class="summary-card"><div class="summary-icon green">${I('lists')}</div><div><strong>${openShopping}</strong><span>Auf der Einkaufsliste</span></div><span class="summary-hint">Für euren Einkauf</span></div></div><div class="panel"><div class="panel-head"><div class="flex">${I('calendar')}<h2>Euer Wochenkalender</h2></div><div class="week-toolbar"><span class="week-caption">${weekCaption(cursor)}</span><div class="day-switch">${iconBtn('Vorherige Woche', 'prev', 'left')}${iconBtn('Nächste Woche', 'next', 'right')}</div><button class="panel-link" data-nav="calendar">Öffnen</button></div></div>${weekGrid(cursor, true)}</div><div class="home-grid"><section class="panel"><div class="panel-head"><div class="flex">${I('tasks')}<h2>Heute zu erledigen</h2><span class="tag orange">${tasks.length - complete} offen</span></div><button class="panel-link" data-nav="tasks">Alle Aufgaben</button></div><div class="panel-body">${tasks.length ? `<div class="flex between small muted"><span>${complete} von ${tasks.length} geschafft</span><span>${Math.round(complete / tasks.length * 100)} %</span></div><div class="mini-progress" style="margin:10px 0 4px"><div style="width:${complete / tasks.length * 100}%"></div></div>${tasks.slice(0, 7).map(t => taskRow(t, date, true)).join('')}` : empty('Alles frei für heute', 'Legt eine Aufgabe oder Routine für eure Familie an.', 'tasks', btn('Aufgabe hinzufügen', 'new-task', 'plus', 'subtle', 'data-edit="tasks"'))}</div></section><div class="home-side stack"><section class="panel meal-preview"><div class="panel-head"><div class="flex">${I('food')}<h2>Was gibt’s heute?</h2></div><button class="panel-link" data-nav="meals">Wochenplan</button></div><div class="panel-body">${todayRecipe ? `<span class="meal-label">${E(todayRecipe.category)}</span><h3>${E(todayRecipe.title)}</h3><div class="meal-meta"><span>${I('clock')}${todayRecipe.minutes} Min.</span><span>${I('people')}${todayMeal.servings} Portionen</span></div><button class="button" data-recipe="${todayRecipe.id}">${I('book')}Zum Rezept</button>` : `<h3>Heute noch nichts geplant</h3><p class="small muted">Sucht gemeinsam etwas Leckeres aus.</p><button class="button" data-action="plan-meal" data-date="${date}">${I('plus')}Essen auswählen</button>`}</div></section>${S.notes.length ? `<section class="panel"><div class="panel-body"><div class="flex between"><h3>${E((S.notes.find(n => n.pinned) || S.notes[0]).title)}</h3>${I('pin')}</div><div class="note-preview">${E((S.notes.find(n => n.pinned) || S.notes[0]).body.slice(0, 260))}</div><button class="panel-link" data-nav="notes">Unsere Notizen</button></div></section>` : ''}</div></div>`;
}
function calendarPage() {
  const modes = [['week', 'Woche'], ['month', 'Monat'], ['agenda', 'Liste']];
  const caption = calendarMode === 'month' ? ds(cursor).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }) : `${fullDate(monday(cursor))} – ${fullDate(addDays(monday(cursor), 6))}`;
  let content;
  if (calendarMode === 'week') content = timeWeek(cursor);
  else if (calendarMode === 'month') {
    const first = cursor.slice(0, 8) + '01', start = monday(first);
    content = `<div class="month-scroll"><div class="month-grid">${Array.from({ length: 7 }, (_, i) => `<div class="month-label">${fullWeekday(addDays(start, i))}</div>`).join('')}${Array.from({ length: 42 }, (_, i) => {
      const date = addDays(start, i);
      return `<section class="month-cell ${date.slice(0, 7) !== cursor.slice(0, 7) ? 'outside' : ''} ${date === S.serverDate ? 'today' : ''}">${dayHeading(date)}${visibleEvents(date).map(e => eventCard(e, true)).join('')}</section>`;
    }).join('')}</div></div>`;
  } else content = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday(cursor), i);
    return `<section class="agenda-day">${dayHeading(date)}${visibleEvents(date).length ? visibleEvents(date).map(e => `<button class="agenda-event" data-edit="${e.birthdayId ? 'birthdays' : 'events'}" data-id="${e.birthdayId || e.id}"><span class="agenda-time">${e.allDay ? 'Ganztägig' : E(e.startTime) + (e.startOnly ? ' · ohne Ende' : '–' + E(e.endTime))}</span><span class="agenda-line" style="${eventStyle(e)}"></span><span class="spacer"><strong>${E(e.title)}</strong><span class="todo-detail" style="display:block">${E(eventMembers(e).map(id => member(id)?.name).filter(Boolean).join(', ') || 'Alle')}${e.location ? ' · ' + E(e.location) : ''}</span></span>${e.birthdayId ? '<span class="tag">Geburtstag</span>' : ''}</button>`).join('') : '<p class="small muted">Keine Termine.</p>'}</section>`;
  }).join('');
  return `${pageHead('Unser Kalender', 'Platz für euren Tag. Zeit für eure Familie.', `<button class="button primary" data-edit="events">${I('plus')}<span>Termin</span></button>`)}<div class="panel calendar-panel"><div class="panel-head"><div class="week-toolbar">${iconBtn('Vorheriger Zeitraum', 'prev', 'left')}<span class="week-caption">${E(caption)}</span>${iconBtn('Nächster Zeitraum', 'next', 'right')}${btn('Heute', 'today', '', 'subtle')}</div><div class="view-switch">${modes.map(([id, label]) => `<button data-mode="${id}" class="${calendarMode === id ? 'active' : ''}">${label}</button>`).join('')}</div></div>${content}</div>${S.pendingSync.length ? '<p class="small muted section-gap">Google: Änderungen warten auf Synchronisierung.</p>' : ''}`;
}
function birthdaysPage() {
  const upcoming = (S.birthdays || []).filter(b => !filter || b.memberId === filter || !b.memberId)
    .map(birthday => ({ birthday, event: nextBirthday(birthday, S.serverDate) })).filter(item => item.event)
    .sort((a, b) => a.event.startDate.localeCompare(b.event.startDate) || a.birthday.name.localeCompare(b.birthday.name, 'de'));
  return `${pageHead('Unsere Geburtstage', 'Einmal eintragen. Jedes Jahr gemeinsam daran denken.', `<button class="button primary" data-edit="birthdays">${I('plus')}<span>Geburtstag</span></button>`)}<div class="section-gap">${upcoming.length ? `<div class="birthday-grid">${upcoming.map(({ birthday: b, event }) => `<article class="panel birthday-card"><div class="flex between"><span class="tag ${event.startDate === S.serverDate ? 'green' : ''}">${event.startDate === S.serverDate ? 'Heute!' : 'Nächster Geburtstag'}</span>${iconBtn('Geburtstag bearbeiten', 'edit-birthday', 'edit', `data-edit="birthdays" data-id="${b.id}"`)}</div><h2>${E(b.name)}</h2><div class="birthday-date">${I('cake')}<span>${ds(event.startDate).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>${event.age > 0 ? `<p class="small muted">Wird ${event.age} ${event.age === 1 ? 'Jahr' : 'Jahre'} alt${b.memberId ? ` · ${E(member(b.memberId)?.name || '')}` : ''}</p>` : '<p class="small muted">Jährlich im Familienkalender</p>'}${b.month === 2 && b.day === 29 ? `<p class="small muted">29. Februar · in Nicht-Schaltjahren am ${b.leapDay === 'feb28' ? '28. Februar' : '1. März'}</p>` : ''}${b.notes ? `<p class="note-preview small">${E(b.notes)}</p>` : ''}<button class="panel-link" data-action="birthday-calendar" data-date="${event.startDate}">Im Kalender ansehen</button></article>`).join('')}</div>` : `<section class="panel">${empty('Keinen Geburtstag vergessen', 'Namen, Tag und Monat eintragen. Das Geburtsjahr ist optional.', 'cake', btn('Geburtstag hinzufügen', 'new-birthday', 'plus', 'primary', 'data-edit="birthdays"'))}</section>`}</div>`;
}

function tasksPage() {
  const tasks = S.tasks.filter(t => due(t, cursor) && (taskMode === 'all' || taskMode === 'routines' && t.repeat !== 'none' || taskMode === 'todos' && t.repeat === 'none'));
  const groups = [{ id: '', name: 'Allgemein' }, ...S.members];
  if (filter) taskBoard = filter;
  if (taskBoard !== 'all' && !groups.some(g => g.id === taskBoard)) taskBoard = 'all';
  return `${pageHead('Gemeinsam schaffen wir das.', 'Aufgaben aus Allgemein in eine Personenspalte oder auf ein Profil im Header ziehen.', `<button class="button primary" data-edit="tasks" data-member="${taskBoard === 'all' ? '' : taskBoard}">${I('plus')}Aufgabe</button>`)}<div class="flex between wrap section-gap"><div class="week-toolbar">${iconBtn('Vorheriger Tag', 'prev-day', 'left')}<strong>${fullWeekday(cursor)}, ${fullDate(cursor)}</strong>${iconBtn('Nächster Tag', 'next-day', 'right')}${btn('Heute', 'today', '', 'subtle')}</div><div class="view-switch task-scope-switch"><button data-task-board="all" class="${taskBoard === 'all' ? 'active' : ''}">Alle Bereiche</button><button data-task-board="" data-task-drop="" class="${taskBoard === '' ? 'active' : ''}">Allgemein</button></div><div class="view-switch">${[['all', 'Alle'], ['todos', 'To-dos'], ['routines', 'Routinen']].map(([id, name]) => `<button data-task-mode="${id}" class="${taskMode === id ? 'active' : ''}">${name}</button>`).join('')}</div></div><div class="task-board ${taskBoard !== 'all' ? 'single-column' : ''}">${groups.filter(g => taskBoard === 'all' || g.id === taskBoard).map(g => `<section class="panel task-column" data-task-drop="${g.id}"><div class="task-column-head"><div class="spacer"><h2>${E(g.name)}</h2><p>${g.id ? `${S.points[g.id].available} Punkte` : 'Gemeinsame Aufgaben'}</p></div>${iconBtn('Aufgabe hinzufügen', 'new-task', 'plus', `data-edit="tasks" data-member="${g.id}"`)}</div><div class="task-column-body">${tasks.filter(t => (t.memberId || '') === g.id).map(t => taskRow(t, cursor)).join('') || '<p class="task-empty">Hier ist Platz für Aufgaben.</p>'}</div></section>`).join('')}</div><p class="field-hint section-gap">Mit Touch am Griff ziehen. Auch ein Profil oben nimmt Aufgaben an. Alternativ im Bearbeiten-Fenster zuordnen.</p>`;
}
function rewardsPage() {
  const selected = filter || S.members[0]?.id;
  return `${pageHead('Kleine Erfolge feiern.', 'Gesammelte Punkte einlösen und besondere Leistungen belohnen.', `<button class="button" data-action="award-points">${I('star')}Punkte vergeben</button><button class="button primary" data-edit="rewards">${I('plus')}Belohnung</button>`)}<div class="reward-balances">${S.members.map(m => `<div class="panel points-member">${avatar(m.id, 'large')}<div><strong>${E(m.name)}</strong><div class="point-value">${S.points[m.id].available} <span class="small">Punkte</span></div></div></div>`).join('')}</div><section class="panel section-gap"><div class="panel-body">${selectField('Belohnung einlösen für', 'reward-member', selected, S.members.map(m => [m.id, m.name]))}<div class="recipe-grid section-gap">${S.rewards.map(r => `<article class="reward-card"><div class="flex between"><h3>${E(r.title)}</h3>${iconBtn('Belohnung bearbeiten', 'edit-reward', 'edit', `data-edit="rewards" data-id="${r.id}"`)}</div><p>${E(r.description)}</p><span class="points-tag">${I('star')}${r.cost} Punkte</span><button class="button" data-redeem="${r.id}">Einlösen</button></article>`).join('') || '<p class="small muted">Legt eure erste Belohnung an.</p>'}</div></div></section><div class="panel section-gap"><div class="panel-head"><h2>Zuletzt gebucht</h2></div><div class="panel-body">${[...(S.pointAwards || []).map(a => ({ title: a.reason, person: a.memberId, points: '+' + a.points, at: a.awardedAt })), ...S.redemptions.map(r => ({ title: r.title, person: r.member_id, points: '−' + r.cost, at: r.redeemed_at }))].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20).map(a => `<div class="points-member">${avatar(a.person)}<div class="spacer"><strong>${E(a.title)}</strong><div class="todo-detail">${E(member(a.person)?.name || '')} · ${new Date(a.at).toLocaleString('de-DE')}</div></div><span class="points-tag">${E(a.points)}</span></div>`).join('') || '<p class="small muted">Hier erscheinen eingelöste Belohnungen und manuelle Punkte.</p>'}</div></div>`;
}
function mealsPage() {
  return `${pageHead('Was kommt auf den Tisch?', 'Frühstück, Mittag und Abendbrot gemeinsam planen.', `<button class="button" data-action="import-recipe">${I('download')}Rezeptlink importieren</button><button class="button primary" data-edit="recipes">${I('plus')}Rezept</button>`)}<div class="flex between wrap"><div class="week-toolbar">${iconBtn('Vorherige Woche', 'prev', 'left')}<strong>${weekCaption(cursor)}</strong>${iconBtn('Nächste Woche', 'next', 'right')}${btn('Diese Woche', 'today', '', 'subtle')}</div><div class="view-switch" aria-label="Ausrichtung der Essenswoche"><button data-meal-layout="horizontal" aria-pressed="${mealLayout === 'horizontal'}" class="${mealLayout === 'horizontal' ? 'active' : ''}">Waagerecht</button><button data-meal-layout="vertical" aria-pressed="${mealLayout === 'vertical'}" class="${mealLayout === 'vertical' ? 'active' : ''}">Senkrecht</button></div>${btn('Zutaten auf die Einkaufsliste', 'generate-shopping', 'lists')}</div><div class="meal-plan-scroll section-gap"><div class="meal-plan ${mealLayout}">${Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday(cursor), i);
    return `<section class="panel meal-plan-day ${date === S.serverDate ? 'today' : ''}"><div class="meal-date"><strong>${fullWeekday(date)}</strong><span>${fullDate(date)}</span></div><div class="meal-slots">${mealSlots.map(([slot, label]) => {
      const planned = meal(date, slot), recipe = S.recipes.find(r => r.id === planned?.recipeId);
      return `<div class="meal-slot ${slot}" data-meal-date="${date}" data-meal-slot="${slot}"><h3>${I(slot === 'breakfast' ? 'clock' : slot === 'lunch' ? 'food' : 'home')}${label}</h3>${recipe ? `<button class="meal-title" data-recipe="${recipe.id}">${isImageFile(recipe.imageFile) ? recipePicture(recipe, 'meal-picture') : ''}${E(recipe.title)}</button><span class="small muted">${planned.servings} Portionen</span>` : '<p class="meal-empty">Rezept hierher ziehen</p>'}<button class="panel-link" data-action="plan-meal" data-date="${date}" data-slot="${slot}">${I(recipe ? 'edit' : 'plus')}${recipe ? 'Ändern' : 'Auswählen'}</button></div>`;
    }).join('')}</div></section>`;
  }).join('')}</div></div><div class="flex between section-gap"><h2>Eure Rezepte</h2><span class="small muted">In eine Mahlzeit ziehen oder Auswählen verwenden.</span></div><div class="recipe-grid section-gap">${S.recipes.map(r => `<article class="panel recipe-card" draggable="true" data-drag-kind="recipe" data-drag-id="${r.id}" data-drag-rev="${r._rev}"><button class="recipe-image-button" data-recipe="${r.id}" aria-label="${E(r.title)} · Rezept öffnen">${recipePicture(r)}</button><div class="flex between" style="width:100%"><span class="tag green">${E(r.category)}</span><button class="drag-handle" data-drag-handle aria-label="${E(r.title)} in den Essensplan ziehen">${I('menu')}</button></div><h3>${E(r.title)}</h3><div class="recipe-meta"><span>${I('clock')}${r.minutes} Min.</span><span>${I('people')}${r.servings} Portionen</span></div><div class="recipe-bottom flex between"><button class="panel-link" data-recipe="${r.id}">Zum Rezept</button>${iconBtn('Rezept bearbeiten', 'edit-recipe', 'edit', `data-edit="recipes" data-id="${r.id}"`)}</div></article>`).join('') || '<div class="panel">Noch keine Rezepte. Legt eines an oder importiert einen Link.</div>'}</div>`;
}
function listsPage() {
  const list = S.lists.find(l => l.id === activeList) || S.lists[0]; activeList = list.id;
  const items = S.items.filter(i => i.listId === activeList), categories = [...new Set(items.map(i => i.category))].sort((a, b) => a.localeCompare(b, 'de'));
  return `${pageHead('Nicht vergessen.', 'Einkauf, Packlisten und alles, was ihr euch merken möchtet.', `<button class="button primary" data-edit="lists">${I('plus')}<span>Liste</span></button>`)}<div class="list-layout"><aside class="panel list-nav">${S.lists.map(l => `<button data-list="${l.id}" class="${l.id === activeList ? 'active' : ''}">${I(l.id === 'shopping' ? 'food' : 'lists')}<span class="spacer">${E(l.title)}</span><span class="tag">${S.items.filter(i => i.listId === l.id && !i.checked).length}</span></button>`).join('')}</aside><section class="panel"><div class="panel-head"><div><h2>${E(list.title)}</h2><span class="small muted">${items.filter(i => !i.checked).length} offen · ${items.filter(i => i.checked).length} erledigt</span></div><div class="flex">${activeList !== 'shopping' ? iconBtn('Liste bearbeiten', 'edit-list', 'edit', `data-edit="lists" data-id="${list.id}"`) : ''}${iconBtn('Eintrag mit Menge hinzufügen', 'new-item', 'plus', 'data-edit="items"')}</div></div><div class="panel-body"><form id="quick-item" class="inline-add"><input name="title" placeholder="${activeList === 'shopping' ? 'Was brauchen wir noch?' : 'Neuer Eintrag …'}" aria-label="Neuer Listeneintrag" required maxlength="160"><button class="button primary" type="submit" aria-label="Eintrag hinzufügen">${I('plus')}</button></form>${items.length ? categories.map(category => `<div class="list-category">${E(category)}</div>${items.filter(i => i.category === category).sort((a, b) => Number(a.checked) - Number(b.checked)).map(item => `<div class="todo-row ${item.checked ? 'done' : ''}"><button class="check-button ${item.checked ? 'checked' : ''}" role="checkbox" aria-checked="${item.checked}" aria-label="${E(item.title)} ${item.checked ? 'wieder öffnen' : 'abhaken'}" data-check-item="${item.id}">${item.checked ? I('check') : ''}</button><div class="spacer"><div class="todo-title">${E(item.title)}</div>${item.generatedWeek ? '<span class="todo-detail">Aus dem Essensplan</span>' : ''}</div>${item.quantity || item.unit ? `<span class="small muted">${quantity(item.quantity)} ${E(item.unit)}</span>` : ''}<div class="task-buttons">${iconBtn('Eintrag bearbeiten', 'edit-item', 'edit', `data-edit="items" data-id="${item.id}"`)}</div></div>`).join('')}`).join('') : empty('Hier ist noch Platz', activeList === 'shopping' ? 'Zutaten aus dem Essensplan übernehmen oder Artikel selbst hinzufügen.' : 'Fügt euren ersten Eintrag hinzu.', 'lists')}</div></section></div>`;
}
function notesPage() {
  return `${pageHead('Für später. Für alle.', 'Gedanken, Ideen und wichtige Familieninfos.', `<button class="button primary" data-edit="notes">${I('plus')}<span>Notiz</span></button>`)}${S.notes.length ? `<div class="notes-grid">${[...S.notes].sort((a, b) => Number(b.pinned) - Number(a.pinned)).map(n => `<article class="panel note-card ${n.pinned ? 'pinned' : ''}"><div class="flex between"><h3>${E(n.title)}</h3>${n.pinned ? I('pin') : ''}</div><div class="note-body">${E(n.body)}</div><div class="note-footer"><button data-edit="notes" data-id="${n.id}" aria-label="${E(n.title)} bearbeiten">${I('edit')}</button></div></article>`).join('')}</div>` : `<div class="panel">${empty('Ein gemeinsamer Platz für Gedanken', 'Wichtige Infos, kleine Ideen und große Pläne finden hier ihren Platz.', 'notes', btn('Notiz hinzufügen', 'new-note', 'plus', 'primary', 'data-edit="notes"'))}</div>`}`;
}
function photosPage() {
  const sources = [['local', 'Nur auf diesem Gerät', 'phone', 'Kein Upload zum Server'], ['server', 'Container-Speicher', 'server', 'Fotos von eurem Server'], ['remote', 'Netzwerkadresse', 'network', 'Bilder über eine IP oder URL'], ['immich', 'Immich', 'photos', 'Ein Album eurer Fotobibliothek']];
  return `${pageHead('Eure schönsten Momente.', 'Ein Bilderrahmen für euer Zuhause.', btn('Diashow starten', 'start-slides', 'play', 'primary', photoItems.length ? '' : 'disabled'))}<div class="photo-sources">${sources.map(([id, name, icon, hint]) => `<button class="source-card ${photoSource === id ? 'active' : ''}" data-photo-source="${id}">${I(icon)}<strong>${name}</strong><small>${hint}</small></button>`).join('')}</div><div class="panel"><div class="panel-head"><h2>${E(sources.find(s => s[0] === photoSource)?.[1] || '')}</h2><span class="small muted">${photoItems.length} Bilder</span></div><div class="panel-body"><div class="photo-toolbar">${['local', 'server'].includes(photoSource) ? `<label class="button primary upload-button">${I('plus')}${photoSource === 'local' ? 'Fotos auf diesem Gerät auswählen' : 'Fotos zum Server hochladen'}<input type="file" id="photo-upload" accept="image/jpeg,image/png,image/webp,image/gif" multiple></label>` : ''}${photoSource === 'immich' ? `<select id="immich-album" aria-label="Immich-Album"><option value="">Album auswählen</option>${albums.map(a => `<option value="${E(a.id)}" ${photoAlbum === a.id ? 'selected' : ''}>${E(a.name)} (${a.count})</option>`).join('')}</select>` : ''}${btn('Neu laden', 'reload-photos', 'refresh')}${['remote', 'immich'].includes(photoSource) ? '<button class="panel-link" data-nav="settings">Quelle einrichten</button>' : ''}</div>${photoLoading ? '<div class="empty"><span class="loader"></span><p>Bilder werden geladen …</p></div>' : photoItems.length ? `<div class="photo-grid">${photoItems.map((p, i) => `<div class="photo-thumbnail" data-slide="${i}" role="button" tabindex="0" aria-label="${E(p.name)} in Diashow öffnen"><img src="${E(p.url)}" alt="${E(p.name)}" loading="lazy"><span class="photo-caption">${E(p.name)}</span>${photoSource === 'local' ? `<button class="photo-delete" data-remove-local="${E(p.id)}" aria-label="${E(p.name)} vom Gerät entfernen">${I('trash')}</button>` : ''}</div>`).join('')}</div>` : empty('Hier kommen eure Fotos hin', photoSource === 'local' ? 'Ausgewählte Fotos bleiben in diesem Browser auf diesem Gerät gespeichert.' : photoSource === 'server' ? 'Ladet Fotos hoch oder legt sie im Bilderordner eures Containers ab.' : photoSource === 'immich' ? 'Verbindet Immich in den Einstellungen und wählt ein Album aus.' : 'Tragt in den Einstellungen eine Adresse ein, die eure Bilderliste liefert.', 'photos')}<p class="small muted section-gap">${photoSource === 'local' ? 'Beim Löschen der Browserdaten werden auch diese lokalen Fotos entfernt.' : 'Die Bilderquelle bleibt innerhalb eures eigenen Netzes. API-Schlüssel werden nur auf dem Server gespeichert.'} Wechsel alle ${S.settings.photoInterval} Sekunden.</p></div></div>`;
}
function settingsPage() {
  return `${pageHead('Euer Zuhause. Eure Einstellungen.', 'Familie, Kalender und Bilderquellen verwalten.')}<div class="settings-grid"><section class="panel"><div class="panel-head"><h2>Unsere Familie</h2>${iconBtn('Familienmitglied hinzufügen', 'new-member', 'plus', 'data-edit="members"')}</div><div class="panel-body"><form id="settings-family" class="stack"><label class="form-field">Name der Familie<input name="familyName" value="${E(S.settings.familyName)}" required maxlength="60"></label><label class="form-field">Zeitzone<input name="timezone" value="${E(S.settings.timezone)}" required placeholder="Europe/Berlin"></label><div><button class="button primary" type="submit">Speichern</button></div></form><div class="section-gap">${S.members.map(m => `<div class="member-edit">${avatar(m.id, 'large')}<div class="spacer"><strong class="small">${E(m.name)}</strong><div class="todo-detail">${m.role === 'child' ? 'Kind' : 'Erwachsen'}</div></div>${iconBtn('Familienmitglied bearbeiten', 'edit-member', 'edit', `data-edit="members" data-id="${m.id}"`)}</div>`).join('')}</div><p class="field-hint section-gap">Die Auswahl „Kind“ wird zur Anzeige verwendet. In Allgemeine Familiendaten können alle angemeldeten Geräte bearbeiten. Manuelle Punkte und Software-Updates benötigen das Elternpasswort.</p></div></section><section class="panel"><div class="panel-head"><h2>Google Kalender</h2>${btn('Synchronisieren', 'google-sync', 'refresh')}</div><div class="panel-body"><p class="small muted">Mehrere Google-Konten verbinden und für jeden Kalender ein Familienmitglied auswählen. Abgleich automatisch alle 5 Minuten.</p>${btn('Google-Konto verbinden', 'google-connect', 'plus', 'primary')}${!status.googleConfigured ? '<div class="info-box section-gap">Zuerst Google-Zugangsdaten und die Adresse dieser Familienzentrale auf dem Server einrichten. Die Schritte stehen in der Installationsanleitung.</div>' : ''}${S.google.map(a => `<section class="integration-card"><div class="integration-heading"><span class="google-logo">G</span><div class="spacer"><strong class="small">${E(a.email)}</strong><div class="todo-detail">${a.lastSync ? `Letzter Abgleich: ${new Date(a.lastSync).toLocaleString('de-DE')}` : 'Noch nicht synchronisiert'}</div></div>${iconBtn('Konto trennen', 'google-disconnect', 'close', `data-account="${a.id}"`)}</div><form data-calendar-form="${a.id}">${a.calendars.map(c => `<div class="calendar-setting"><label class="checkbox-field"><input type="checkbox" name="cal-${E(c.id)}" value="${E(c.id)}" ${c.selected ? 'checked' : ''}><span>${E(c.title)}${!['owner', 'writer'].includes(c.accessRole) ? '<span class="todo-detail" style="display:block">Nur lesen</span>' : ''}</span></label><select data-cal-member="${E(c.id)}" aria-label="Familienmitglied für ${E(c.title)}"><option value="">Alle</option>${S.members.map(m => `<option value="${m.id}" ${c.memberId === m.id ? 'selected' : ''}>${E(m.name)}</option>`).join('')}</select></div>`).join('')}<div class="form-actions"><button type="button" class="button" data-action="google-refresh" data-account="${a.id}">Kalender neu laden</button><button class="button primary" type="submit">Auswahl speichern</button></div></form>${a.error ? `<p class="integration-error">${E(a.error)}</p>` : ''}</section>`).join('')}${S.pendingSync.length ? `<div class="info-box section-gap">${S.pendingSync.length} Änderung(en) warten auf Google.${S.pendingSync.filter(p => p.error).map(p => `<div class="integration-error">${E(p.error)}</div>`).join('')}</div>` : ''}</div></section><section class="panel"><div class="panel-head"><h2>Bilderrahmen & Quellen</h2></div><div class="panel-body"><form id="settings-photos"><div class="form-grid">${field('Bildwechsel (Sekunden)', 'photoInterval', S.settings.photoInterval, 'number', 'min="3" max="300" required')}${selectField('Darstellung', 'photoFit', S.settings.photoFit, [['contain', 'Ganzes Bild'], ['cover', 'Bildschirm ausfüllen']])}${field('Netzwerk-Bilderliste (URL)', 'remoteManifestUrl', S.settings.remoteManifestUrl, 'url', 'placeholder="http://192.168.1.20:8090/photos.json"', true)}${field('Immich-Adresse', 'immichUrl', S.settings.immichUrl, 'url', 'placeholder="http://192.168.1.30:2283"', true)}${field('Immich-API-Schlüssel', 'immichKey', '', 'password', `autocomplete="off" placeholder="${S.immichConfigured ? 'Gespeichert · leer lassen zum Behalten' : 'Schlüssel eintragen'}"`, true)}<p class="field-hint" style="grid-column:1/-1;margin:0">Beim Ändern der Immich-Adresse den Schlüssel erneut eingeben. Die Netzwerkadresse muss eine JSON-Liste von Bildadressen liefern.</p></div><div class="form-actions"><button class="button primary" type="submit">Speichern</button></div></form></div></section><section class="panel"><div class="panel-head"><h2>Daten & Zugang</h2></div><div class="panel-body"><p class="small muted">Alle gemeinsamen Daten liegen auf eurem Server. Ein Export enthält eure Familiendaten, aber keine Passwörter oder API-Schlüssel.</p><a class="button" href="/api/export" download>${I('download')}Familiendaten exportieren</a><p class="field-hint section-gap">Für eine vollständig wiederherstellbare Sicherung den Datenordner mit Datenbank und Schlüssel sichern. Anleitung: docs/LXC.md.</p><form id="password-form" class="stack section-gap"><h3>Familienpasswort ändern</h3>${field('Bisheriges Passwort', 'currentPassword', '', 'password', 'required autocomplete="current-password"')}${field('Neues Passwort', 'newPassword', '', 'password', 'required minlength="12" maxlength="200" autocomplete="new-password"')}<div><button class="button" type="submit">Passwort ändern</button></div></form><div class="section-gap">${btn('Auf diesem Gerät abmelden', 'logout', 'logout')}</div></div></section>${appearanceSettingsPanel()}${parentSettings()}${updateSettings()}</div>`;
}

function field(label, name, value = '', type = 'text', attrs = '', full = false) {
  return `<label class="form-field ${full ? 'full' : ''}">${E(label)}<input name="${name}" type="${type}" value="${E(value)}" ${attrs}></label>`;
}
function selectField(label, name, value, options, full = false) {
  return `<label class="form-field ${full ? 'full' : ''}">${E(label)}<select name="${name}">${options.map(([id, title]) => `<option value="${E(id)}" ${String(id) === String(value) ? 'selected' : ''}>${E(title)}</option>`).join('')}</select></label>`;
}
function textareaField(label, name, value, attrs = '', hint = '') {
  return `<label class="form-field full">${E(label)}<textarea name="${name}" ${attrs}>${E(value)}</textarea>${hint ? `<span class="field-hint">${E(hint)}</span>` : ''}</label>`;
}
function memberOptions() { return [['', 'Für alle'], ...S.members.map(m => [m.id, m.name])]; }
function dialog(title, body, footer = '') {
  if (recipePreviewUrl) { URL.revokeObjectURL(recipePreviewUrl); recipePreviewUrl = ''; }
  editor.classList.toggle('wide', body.includes('event-edit-form') || body.includes('meal-form'));
  editor.innerHTML = `<div class="dialog-header"><h2 id="editor-title">${E(title)}</h2>${iconBtn('Schließen', 'close-editor', 'close')}</div><div class="dialog-body">${body}${footer}</div>`;
  if (!editor.open) editor.showModal();
}
function editRecord(kind, id = '', defaults = {}) {
  const old = id ? S[kind]?.find(r => r.id === id) : null;
  if (id && !old) throw new Error('Dieser Eintrag ist nicht mehr vorhanden.');
  if (kind === 'events') { if (old) openEventEditor(old); else startEventWizard(null, defaults); return; }
  const record = old || { ...defaults };
  editing = { kind, old, ...(kind === 'recipes' ? { imageFile: record.imageFile || '' } : {}) };
  const required = 'required maxlength="160"';
  let fields = '', title;
  const titles = { events: 'Termin', birthdays: 'Geburtstag', tasks: 'Aufgabe', recipes: 'Rezept', lists: 'Liste', items: 'Listeneintrag', notes: 'Notiz', rewards: 'Belohnung', members: 'Familienmitglied' };
  title = titles[kind] + (old ? ' bearbeiten' : ' hinzufügen');
  if (kind === 'birthdays') {
    fields = `${field('Name', 'name', record.name, 'text', 'required maxlength="100"', true)}${field('Tag', 'day', record.day || '', 'number', 'required min="1" max="31" step="1"')}${selectField('Monat', 'month', record.month || '', [['', 'Bitte auswählen'], ...Array.from({ length: 12 }, (_, i) => [String(i + 1), ds(`2000-${String(i + 1).padStart(2, '0')}-01`).toLocaleDateString('de-DE', { month: 'long' })])])}${field('Geburtsjahr (optional)', 'birthYear', record.birthYear || '', 'number', `min="1" max="${S.serverDate.slice(0, 4)}" step="1"`)}${selectField('Zuordnung (optional)', 'memberId', record.memberId || '', [['', 'Keine Zuordnung'], ...S.members.map(m => [m.id, m.name])])}${selectField('29. Februar in Nicht-Schaltjahren', 'leapDay', record.leapDay || 'mar1', [['mar1', 'Am 1. März anzeigen'], ['feb28', 'Am 28. Februar anzeigen']], true)}${textareaField('Notizen', 'notes', record.notes, 'rows="3" maxlength="2000"')}<p class="field-hint full">Erscheint automatisch jedes Jahr im Kalender. Mit Geburtsjahr wird auch das Alter angezeigt.</p>`;
  } else if (kind === 'tasks') fields = `${taskImageField(record)}${field('Titel der Aufgabe', 'title', record.title, 'text', required, true)}${field('Punkte', 'points', record.points || 0, 'number', 'min="0" max="1000" step="1" required')}${selectField('Zuordnen', 'memberId', old ? record.memberId || '' : record.memberId || '', [['', 'Allgemein'], ...S.members.map(m => [m.id, m.name])])}${selectField('Wiederholung', 'repeat', record.repeat || 'none', [['none', 'Einmalig'], ['daily', 'Täglich'], ['weekdays', 'Montag bis Freitag'], ['weekly', 'Wöchentlich']])}${field('Fällig / erster Tag', 'startDate', record.startDate || S.serverDate, 'date')}${textareaField('Beschreibung', 'description', record.description, 'rows="3" maxlength="2000"')}`;
  else if (kind === 'recipes') fields = `${recipeImageField(record)}${field('Rezeptname', 'title', record.title, 'text', required, true)}${field('Portionen', 'servings', record.servings || 4, 'number', 'min="1" max="100" step="1" required')}${field('Zeit in Minuten', 'minutes', record.minutes ?? 30, 'number', 'min="0" max="1440" step="1" required')}${field('Kategorie', 'category', record.category || 'Hauptgericht', 'text', 'maxlength="60"', true)}${textareaField('Zutaten · eine pro Zeile', 'ingredientsText', (record.ingredients || []).map(i => `${i.quantity} | ${i.unit} | ${i.name} | ${i.category}`).join('\n'), 'rows="5" placeholder="500 | g | Nudeln | Vorrat"', 'Menge | Einheit | Zutat | Kategorie. Dezimalzahlen mit Punkt oder Komma sind möglich.')}${textareaField('Zubereitung', 'instructions', record.instructions, 'rows="5" maxlength="15000"')}${field('Link zur Quelle (optional)', 'sourceUrl', record.sourceUrl, 'url', '', true)}`;
  else if (kind === 'members') fields = `${memberImageField(record)}${field('Name', 'name', record.name, 'text', 'required maxlength="50"', true)}${field('Farbe', 'color', record.color || '#6366f1', 'color', 'required')}${selectField('Anzeige', 'role', record.role || 'adult', [['adult', 'Erwachsen'], ['child', 'Kind']])}`;
  else if (kind === 'lists') fields = field('Name der Liste', 'title', record.title, 'text', required, true);
  else if (kind === 'items') fields = `${field('Eintrag', 'title', record.title, 'text', required, true)}${field('Menge (optional)', 'quantity', record.quantity || '', 'number', 'min="0" max="100000" step="any"')}${field('Einheit', 'unit', record.unit, 'text', 'maxlength="30"')}${field('Kategorie', 'category', record.category || 'Sonstiges', 'text', 'maxlength="50"', true)}`;
  else if (kind === 'notes') fields = `${field('Titel', 'title', record.title, 'text', required, true)}${textareaField('Notiz', 'body', record.body, 'rows="8" maxlength="20000"')}<label class="checkbox-field" style="grid-column:1/-1"><input type="checkbox" name="pinned" ${record.pinned ? 'checked' : ''}>Oben anheften</label>`;
  else if (kind === 'rewards') fields = `${field('Belohnung', 'title', record.title, 'text', required, true)}${field('Benötigte Punkte', 'cost', record.cost || 25, 'number', 'min="1" max="100000" step="1" required', true)}${textareaField('Beschreibung', 'description', record.description, 'rows="3" maxlength="1000"')}`;
  const deletable = old && kind !== 'members' && !(kind === 'lists' && old.id === 'shopping') && !old.googleReadOnly;
  const preview = kind === 'recipes' && record._imported ? `<div class="info-box full"><strong>Rezeptimport · Vorschau</strong><p>Bitte Zutatenmengen und Portionen prüfen. Erst mit „Speichern“ wird das Rezept übernommen.</p>${(record._importWarnings || []).map(warning => `<p>${E(warning)}</p>`).join('')}</div>` : '';
  dialog(title, `<form id="record-form"><div class="form-grid">${preview}${fields}</div><p class="form-error" id="editor-error" role="alert"></p><div class="form-actions">${deletable ? '<button class="button danger" type="button" data-action="delete-record">Löschen</button><div class="spacer"></div>' : ''}<button type="button" class="button" data-action="close-editor">Abbrechen</button><button class="button primary" type="submit" ${old?.googleReadOnly ? 'disabled' : ''}>Speichern</button></div></form>`);
}
async function saveEditor(form) {
  const data = Object.fromEntries(new FormData(form)), { kind, old } = editing;
  if (old) data._rev = old._rev;
  if (kind === 'tasks') {
    const current = editing, file = $('#task-image-input')?.files?.[0];
    data.imageFile = data.removeImage ? '' : old?.imageFile || '';
    if (file) { data.imageFile = await uploadTaskImage(file); if (!editor.open || editing !== current) return; }
  }
  if (kind === 'members') {
    const current = editing, file = $('#member-image-input')?.files?.[0];
    data.avatarImage = data.removeMemberImage ? '' : old?.avatarImage || '';
    if (file) { data.avatarImage = await uploadUiImage(file); if (!editor.open || editing !== current) return; }
  }
  if (kind === 'notes') data.pinned = !!data.pinned;
  if (kind === 'items') { data.listId = old?.listId || activeList; data.checked = old?.checked || false; }
  if (kind === 'recipes') {
    data.ingredients = data.ingredientsText.split('\n').filter(l => l.trim()).map((line, i) => {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length < 3 || !parts[2]) throw new Error(`Zutat ${i + 1}: Bitte Menge | Einheit | Zutat eingeben.`);
      const quantity = Number(parts[0].replace(',', '.'));
      if (!Number.isFinite(quantity)) throw new Error(`Zutat ${i + 1}: Die Menge ist keine Zahl.`);
      return { quantity, unit: parts[1], name: parts[2], category: parts[3] || 'Sonstiges' };
    });
    const current = editing, file = $('#recipe-image-input')?.files?.[0];
    data.imageFile = data.removeRecipeImage ? '' : current.imageFile;
    if (file && !data.removeRecipeImage) {
      data.imageFile = await uploadUiImage(file);
      if (!editor.open || editing !== current) return;
      current.imageFile = data.imageFile;
    }
  }
  await api(`/records/${kind}${old ? '/' + old.id : ''}`, old ? 'PUT' : 'POST', data);
  editor.close(); await refresh(false); render(); toast('Gespeichert.');
}
function openRecipeImport() {
  editing = { kind: 'recipe-import' };
  dialog('Rezeptlink importieren', `<form id="recipe-import-form"><p class="small muted">Füge den direkten Link zu einem öffentlichen Rezept ein, zum Beispiel von Chefkoch. Du kannst das geladene Rezept vor dem Speichern bearbeiten.</p><label class="form-field">Link zum Rezept<input id="recipe-url" name="url" type="url" required maxlength="2048" placeholder="https://www.chefkoch.de/rezepte/…"></label><p class="form-error" id="editor-error" role="alert"></p><div class="form-actions"><button class="button" type="button" data-action="manual-recipe">Manuell eingeben</button><div class="spacer"></div><button class="button" type="button" data-action="close-editor">Abbrechen</button><button class="button primary" type="submit">Vorschau laden</button></div></form>`);
}
async function loadRecipeImport(url) {
  const current = editing;
  const result = await api('/recipes/import', 'POST', { url });
  if (!editor.open || editing !== current) return;
  editRecord('recipes', '', { ...result.recipe, _imported: true, _importWarnings: result.warnings });
}
function openMeal(date, slot = 'dinner') {
  if (!S.recipes.length) { toast('Legt zuerst ein Rezept an.'); editRecord('recipes'); return; }
  const old = meal(date, slot); editing = { kind: 'meals', old, date, slot };
  const selected = S.recipes.some(r => r.id === old?.recipeId) ? old.recipeId : S.recipes[0].id;
  const choices = `<fieldset class="recipe-picker"><legend>Rezept auswählen</legend><div class="recipe-options">${S.recipes.map(r => `<label class="recipe-option"><input type="radio" name="recipeId" value="${E(r.id)}" ${r.id === selected ? 'checked' : ''} required><span class="recipe-choice">${recipePicture(r)}<span class="recipe-check" aria-hidden="true">${I('check')}</span><span class="recipe-choice-body"><strong>${E(r.title)}</strong><span>${r.minutes} Min. · ${r.servings} Portionen</span></span></span></label>`).join('')}</div></fieldset>`;
  dialog(`${mealSlots.find(s => s[0] === slot)[1]} · ${fullDate(date)}`, `<form id="meal-form">${choices}${field('Portionen', 'servings', old?.servings || S.members.length || 4, 'number', 'required min="1" max="100" step="1"')}<p class="form-error" id="editor-error" role="alert"></p><div class="form-actions">${old ? '<button class="button danger" type="button" data-action="delete-record">Entfernen</button>' : ''}<button class="button" type="button" data-action="close-editor">Abbrechen</button><button class="button primary" type="submit">Speichern</button></div></form>`);
}
function viewRecipe(id) {
  const r = S.recipes.find(r => r.id === id); if (!r) return;
  editing = null;
  dialog(r.title, `${isImageFile(r.imageFile) ? recipePicture(r, 'recipe-detail-picture') : ''}<div class="flex wrap"><span class="tag">${E(r.category)}</span><span class="small muted">${r.minutes} Minuten · ${r.servings} Portionen</span></div><h3 class="section-gap">Zutaten</h3>${r.ingredients.map(i => `<div class="ingredient-row"><span>${quantity(i.quantity)} ${E(i.unit)}</span><span>${E(i.name)}</span></div>`).join('')}<h3 class="section-gap">Zubereitung</h3><div class="recipe-instructions">${E(r.instructions || 'Noch keine Zubereitung gespeichert.')}</div>${r.sourceUrl ? `<p class="section-gap"><a href="${E(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">Rezeptquelle öffnen</a></p>` : ''}<div class="form-actions"><button class="button" data-edit="recipes" data-id="${r.id}">Bearbeiten</button><button class="button primary" data-action="close-editor">Schließen</button></div>`);
}
let resolveConfirmation;
function ask(title, message, label = 'Bestätigen', destructive = false) {
  return new Promise(resolve => {
    resolveConfirmation = resolve;
    confirmDialog.innerHTML = `<div class="dialog-header"><h2 id="confirm-title">${E(title)}</h2></div><div class="confirm-body"><p>${E(message)}</p><div class="form-actions"><button class="button" data-confirm="no">Abbrechen</button><button class="button ${destructive ? 'danger' : 'primary'}" data-confirm="yes">${E(label)}</button></div></div>`;
    confirmDialog.showModal();
  });
}
async function completeTask(id, date) {
  const task = S.tasks.find(t => t.id === id), done = !!completion(task, date);
  if (!task.memberId && !done) {
    editing = { kind: 'completion', task, date };
    dialog('Wer hat die Aufgabe erledigt?', `<form id="complete-form">${selectField('Familienmitglied', 'memberId', filter || S.members[0].id, S.members.map(m => [m.id, m.name]), true)}<p class="form-error" id="editor-error" role="alert"></p><div class="form-actions"><button class="button primary" type="submit">${task.points} Punkte vergeben</button></div></form>`);
    return;
  }
  await mutate(`/tasks/${id}/complete`, 'POST', { date, done: !done }, !done && task.points ? `Geschafft! +${task.points} Punkte für ${member(task.memberId)?.name}.` : !done ? 'Geschafft!' : 'Aufgabe wieder geöffnet.');
}
async function changeSettings(form, data) {
  await api('/settings', 'PUT', { ...S.settings, ...data, _revision: Number(form.dataset.revision) }); await refresh(false); render(); toast('Einstellungen gespeichert.');
}
function uid() { return Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join(''); }

document.addEventListener('click', async event => {
  if (suppressDragClick) { event.preventDefault(); return; }
  const target = event.target.closest('button,a,[data-slide]'); if (!target) return;
  if (target.dataset.confirm) { const yes = target.dataset.confirm === 'yes'; confirmDialog.close(); resolveConfirmation?.(yes); resolveConfirmation = null; return; }
  if (target.dataset.removeLocal) { event.stopPropagation(); if (await ask('Lokales Foto entfernen?', 'Das Foto wird nur aus diesem Browser entfernt. Deine Originaldatei bleibt erhalten.', 'Entfernen', true)) { await localDbAction('delete', target.dataset.removeLocal); await loadPhotos(); } return; }
  if (target.dataset.slide !== undefined) { startSlides(Number(target.dataset.slide)); return; }
  if (target.dataset.nav) { go(target.dataset.nav); return; }
  if (target.dataset.filter !== undefined) { filter = target.dataset.filter; taskBoard = filter || 'all'; render(); return; }
  if (target.dataset.mode) { calendarMode = target.dataset.mode; render(); return; }
  if (target.dataset.taskBoard !== undefined) { taskBoard = target.dataset.taskBoard; filter = taskBoard === 'all' ? '' : taskBoard; render(); return; }
  if (target.dataset.mealLayout) { setMealLayout(target.dataset.mealLayout); return; }
  if (target.dataset.taskMode) { taskMode = target.dataset.taskMode; render(); return; }
  if (target.dataset.list) { activeList = target.dataset.list; render(); return; }
  if (target.dataset.photoSource) { photoSource = target.dataset.photoSource; localStorage.setItem('photoSource', photoSource); photoLoaded = false; photoItems = []; render(); void loadPhotos(); return; }
  if (target.dataset.edit) { try { editRecord(target.dataset.edit, target.dataset.id, { ...(target.dataset.date ? { startDate: target.dataset.date, fixedDate: true } : {}), ...(target.dataset.member !== undefined ? { memberId: target.dataset.member } : {}) }); } catch (error) { toast(error.message, true); } return; }
  if (target.dataset.recipe) { viewRecipe(target.dataset.recipe); return; }
  if (busy || target.disabled) return;
  const action = target.dataset.action;
  try {
    busy = true;
    if (target.dataset.complete) await completeTask(target.dataset.complete, target.dataset.date);
    else if (target.dataset.checkItem) { const item = S.items.find(i => i.id === target.dataset.checkItem); await mutate('/records/items/' + item.id, 'PUT', { ...item, checked: !item.checked }); }
    else if (target.dataset.redeem) {
      const memberId = $('[name=reward-member]').value, reward = S.rewards.find(r => r.id === target.dataset.redeem);
      if (await ask('Belohnung einlösen?', `${member(memberId).name} löst „${reward.title}“ für ${reward.cost} Punkte ein.`, 'Einlösen')) await mutate(`/rewards/${reward.id}/redeem`, 'POST', { memberId, requestId: uid() }, 'Belohnung eingelöst. Viel Spaß!');
    } else if (action === 'menu') $('#rail').classList.toggle('open');
    else if (action === 'photos') go('photos');
    else if (action === 'fullscreen') { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    else if (action === 'close-editor') { editor.close(); editing = null; if (taskPreviewUrl) { URL.revokeObjectURL(taskPreviewUrl); taskPreviewUrl = ''; } }
    else if (action === 'import-recipe') openRecipeImport();
    else if (action === 'manual-recipe') editRecord('recipes', '', { sourceUrl: $('#recipe-url')?.value || '' });
    else if (action === 'birthday-calendar') { cursor = target.dataset.date; go('calendar'); }
    else if (action === 'today') { cursor = S.serverDate; render(); }
    else if (action === 'prev-day' || action === 'next-day') { cursor = addDays(cursor, action === 'prev-day' ? -1 : 1); render(); }
    else if (action === 'prev' || action === 'next') {
      const direction = action === 'prev' ? -1 : 1;
      if (route === 'calendar' && calendarMode === 'month') { const d = ds(cursor.slice(0, 8) + '01'); d.setMonth(d.getMonth() + direction); cursor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }
      else cursor = addDays(cursor, direction * 7);
      render();
    } else if (action === 'agenda-day') { cursor = target.dataset.date; calendarMode = 'agenda'; render(); }
    else if (action === 'delete-record') {
      const { kind, old } = editing;
      if (await ask('Eintrag löschen?', `„${old.title || old.name || 'Geplantes Essen'}“ wird entfernt.${kind === 'birthdays' ? ' Der Geburtstag verschwindet auch aus allen Kalenderjahren.' : ''}${kind === 'events' && old.googleAccountId ? ' Der Termin wird auch in Google Kalender gelöscht.' : ''}${kind === 'tasks' ? ' Bereits verdiente Punkte bleiben erhalten.' : ''}`, 'Löschen', true)) { await api(`/records/${kind}/${old.id}`, 'DELETE', { _rev: old._rev }); editor.close(); await refresh(false); render(); toast('Entfernt.'); }
    } else if (action === 'plan-meal') openMeal(target.dataset.date, target.dataset.slot || 'dinner');
    else if (action === 'wizard-back') { collectEventStep($('#event-wizard-form')); editing.index--; renderEventWizard(); }
    else if (action === 'award-points') openPointsAward();
    else if (action === 'software-update') openUpdateConfirm();
    else if (action === 'reload-app') location.reload();
    else if (action === 'reset-appearance') resetAppearanceForm();
    else if (action === 'generate-shopping') { const result = await api('/shopping/generate', 'POST', { week: monday(cursor) }); await refresh(false); render(); toast(`${result.count} Zutaten auf der Einkaufsliste aktualisiert.`); }
    else if (action === 'google-connect') { const result = await api('/google/authorize', 'POST', {}); location.assign(result.url); }
    else if (action === 'google-sync') { toast('Kalender werden abgeglichen …'); const result = await api('/google/sync', 'POST', {}); await refresh(false); render(); toast(result.pending ? `${result.pending} Änderung(en) sind noch offen. Details stehen in den Einstellungen.` : 'Kalender abgeglichen.'); }
    else if (action === 'google-refresh') { await api(`/google/accounts/${target.dataset.account}/refresh`, 'POST', {}); await refresh(false); render(); toast('Kalenderliste aktualisiert.'); }
    else if (action === 'google-disconnect') { if (await ask('Google-Konto trennen?', 'Die angezeigten Termine bleiben als lokale Termine erhalten. Offene Google-Änderungen werden verworfen. Das Google-Konto selbst wird nicht verändert.', 'Trennen', true)) await mutate(`/google/accounts/${target.dataset.account}`, 'DELETE', {}, 'Google-Konto getrennt.'); }
    else if (action === 'logout') { await api('/logout', 'POST', {}); stopSlides(); S = null; renderAuth(true); }
    else if (action === 'reload-photos') await loadPhotos();
    else if (action === 'start-slides') startSlides();
    else if (action === 'close-slides') stopSlides();
    else if (action === 'prev-slide' || action === 'next-slide') { slideIndex = (slideIndex + (action === 'next-slide' ? 1 : -1) + photoItems.length) % photoItems.length; renderSlide(); }
    else if (action === 'pause-slides') { slidePaused = !slidePaused; renderSlide(); }
  } catch (error) { toast(error.message, true); }
  finally { busy = false; }
});
document.addEventListener('submit', async event => {
  const form = event.target;
  if (form.id === 'auth-form') return;
  event.preventDefault(); if (busy) return; busy = true;
  const submit = $('button[type=submit]', form); if (submit) submit.disabled = true;
  const errorArea = $('#editor-error'); if (errorArea) errorArea.textContent = '';
  try {
    const data = Object.fromEntries(new FormData(form));
    if (form.id === 'record-form') await saveEditor(form);
    else if (form.id === 'recipe-import-form') await loadRecipeImport(data.url);
    else if (form.id === 'event-wizard-form') await advanceEventWizard(form);
    else if (form.id === 'event-edit-form') await saveEventEditor(form);
    else if (form.id === 'settings-appearance') await saveAppearance(form, data);
    else if (form.id === 'parent-password-form') await mutate('/parent-password', 'PUT', data, 'Elternpasswort gespeichert.');
    else if (form.id === 'points-award-form') { await api('/points/award', 'POST', { ...data, requestId: editing.requestId }); editor.close(); await refresh(false); render(); toast('Punkte vergeben.'); }
    else if (form.id === 'update-start-form') { updaterState = await api('/updates/start', 'POST', data); editor.close(); paintUpdateStatus(); toast('Update gestartet. Sicherung wird erstellt.'); }
    else if (form.id === 'meal-form') { const { old, date, slot } = editing; await api('/records/meals' + (old ? '/' + old.id : ''), old ? 'PUT' : 'POST', { ...data, date, slot, ...(old ? { _rev: old._rev } : {}) }); editor.close(); await refresh(false); render(); toast('Essen geplant.'); }
    else if (form.id === 'complete-form') { await api(`/tasks/${editing.task.id}/complete`, 'POST', { date: editing.date, done: true, memberId: data.memberId }); editor.close(); await refresh(false); render(); toast('Aufgabe erledigt und Punkte vergeben.'); }
    else if (form.id === 'quick-item') await mutate('/records/items', 'POST', { title: data.title, listId: activeList, quantity: 0, unit: '', category: 'Sonstiges', checked: false });
    else if (form.id === 'settings-family' || form.id === 'settings-photos') await changeSettings(form, data);
    else if (form.id === 'password-form') await mutate('/password', 'POST', data, 'Passwort geändert. Andere Geräte müssen sich neu anmelden.');
    else if (form.dataset.calendarForm) {
      const account = S.google.find(a => a.id === form.dataset.calendarForm);
      const calendars = account.calendars.map(c => ({ id: c.id, selected: [...form.querySelectorAll('input[type=checkbox]')].some(i => i.value === c.id && i.checked), memberId: [...form.querySelectorAll('[data-cal-member]')].find(s => s.dataset.calMember === c.id).value }));
      await mutate(`/google/accounts/${account.id}/calendars`, 'PUT', { calendars }, 'Kalenderauswahl gespeichert.');
    }
  } catch (error) { if (errorArea) errorArea.textContent = error.message; else toast(error.message, true); }
  finally { busy = false; if (submit) submit.disabled = false; }
});
document.addEventListener('change', async event => {
  const input = event.target;
  if (input.name === 'event-person') {
    const choices = [...editor.querySelectorAll('[name=event-person]')];
    if (input.value === 'all' && input.checked) choices.forEach(el => { if (el !== input) el.checked = false; });
    else if (input.checked) { const all = choices.find(el => el.value === 'all'); if (all) all.checked = false; }
  }
  if (input.name === 'event-person' || input.name === 'useDefaultColor') updateEventColorControls();
  if (input.name === 'wizardAllDay' || input.name === 'timeMode') updateEventTimeControls();
  if (input.id === 'task-image-input') {
    if (taskPreviewUrl) URL.revokeObjectURL(taskPreviewUrl);
    taskPreviewUrl = input.files?.[0] ? URL.createObjectURL(input.files[0]) : '';
    const image = $('#task-image-preview'); if (image) { image.src = taskPreviewUrl; image.hidden = !taskPreviewUrl; }
  }
  if (input.id === 'member-image-input') previewMemberImage(input);
  if (input.id === 'recipe-image-input' || input.name === 'removeRecipeImage') previewRecipeImage(input);
  if (input.id === 'background-image-input') previewBackgroundImage(input);
  if (input.closest?.('#settings-appearance')) previewAppearance();
  if (input.name === 'startDate' && editor.contains(input)) { const end = $('[name=endDate]', editor); if (end && end.value < input.value) end.value = input.value; }
  if (input.id === 'immich-album') { photoAlbum = input.value; localStorage.setItem('photoAlbum', photoAlbum); await loadPhotos(); }
  if (input.id === 'photo-upload') {
    try {
      for (const file of input.files) {
        if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name}: Das Bild ist größer als 20 MB.`);
        if (photoSource === 'local') await localDbAction('put', { id: uid(), name: file.name, file });
        else { const response = await fetch('/api/photos/upload', { method: 'POST', headers: { 'X-Family-Request': '1', 'Content-Type': file.type }, body: file }); if (!response.ok) throw new Error((await response.json()).error); }
      }
      await loadPhotos(); toast('Fotos hinzugefügt.');
    } catch (error) { toast(error.message, true); }
  }
});
editor.addEventListener('close', () => { editing = null; for (const url of [taskPreviewUrl, memberPreviewUrl, recipePreviewUrl]) if (url) URL.revokeObjectURL(url); taskPreviewUrl = ''; memberPreviewUrl = ''; recipePreviewUrl = ''; if (S) render(); });
confirmDialog.addEventListener('cancel', () => { resolveConfirmation?.(false); resolveConfirmation = null; });
document.addEventListener('keydown', event => {
  if (slideActive) { if (event.key === 'Escape') stopSlides(); if (event.key === 'ArrowRight') { slideIndex = (slideIndex + 1) % photoItems.length; renderSlide(); } if (event.key === 'ArrowLeft') { slideIndex = (slideIndex - 1 + photoItems.length) % photoItems.length; renderSlide(); } }
  else if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-slide]')) { event.preventDefault(); startSlides(Number(event.target.dataset.slide)); }
});
addEventListener('hashchange', () => { route = location.hash.slice(1) || 'home'; if (S) render(); });

let dbPromise;
function photoDb() {
  dbPromise ||= new Promise((resolve, reject) => {
    const request = indexedDB.open('familien-organisierer-photos', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('photos', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('Dieser Browser konnte keine Fotos auf dem Gerät speichern.'));
  });
  return dbPromise;
}
async function localDbAction(action, value) {
  const db = await photoDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('photos', action === 'getAll' ? 'readonly' : 'readwrite');
    const request = transaction.objectStore('photos')[action](value);
    let result;
    request.onsuccess = () => { result = request.result; };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(new Error('Fotos konnten nicht auf dem Gerät gespeichert werden. Der Speicher könnte voll sein.'));
  });
}
let photoLoadSequence = 0;
async function loadPhotos() {
  const sequence = ++photoLoadSequence, source = photoSource;
  photoLoading = true; if (route === 'photos') render();
  try {
    let items;
    if (source === 'local') {
      const records = await localDbAction('getAll');
      const ids = new Set(records.map(r => r.id));
      for (const [id, url] of photoUrls) if (!ids.has(id)) { URL.revokeObjectURL(url); photoUrls.delete(id); }
      items = records.map(r => { if (!photoUrls.has(r.id)) photoUrls.set(r.id, URL.createObjectURL(r.file)); return { id: r.id, name: r.name, url: photoUrls.get(r.id) }; });
    } else if (source === 'server') items = await api('/photos');
    else if (source === 'remote') items = await api('/photos/remote-list');
    else { const list = await api('/immich/albums'); if (sequence !== photoLoadSequence) return; albums = list; items = photoAlbum ? await api('/immich/albums/' + photoAlbum) : []; }
    if (sequence !== photoLoadSequence) return;
    photoItems = items; photoLoaded = true;
  } catch (error) { if (sequence === photoLoadSequence) { photoItems = []; photoLoaded = true; toast(error.message, true); } }
  finally { if (sequence === photoLoadSequence) { photoLoading = false; if (route === 'photos') render(); } }
}
function startSlides(index = 0) {
  if (!photoItems.length) return;
  slideIndex = index; slidePaused = false; slideActive = true;
  $('#slideshow').hidden = false; renderSlide();
  clearInterval(slideTimer);
  slideTimer = setInterval(() => { if (!slidePaused && slideActive && photoItems.length) { slideIndex = (slideIndex + 1) % photoItems.length; renderSlide(); } }, S.settings.photoInterval * 1000);
}
function renderSlide() {
  const p = photoItems[slideIndex]; if (!p) return stopSlides();
  $('#slideshow').innerHTML = `<img src="${E(p.url)}" alt="${E(p.name)}" style="object-fit:${S.settings.photoFit}"><div class="slide-overlay"></div><div class="slide-toolbar"><span class="small">${E(S.settings.familyName)}</span><div class="spacer"></div>${iconBtn('Vorheriges Bild', 'prev-slide', 'left')}${iconBtn(slidePaused ? 'Weiter abspielen' : 'Pausieren', 'pause-slides', slidePaused ? 'play' : 'pause')}${iconBtn('Nächstes Bild', 'next-slide', 'right')}${iconBtn('Bilderrahmen schließen', 'close-slides', 'close')}</div><div class="slide-footer"><div><div class="slide-clock">${clockText()}</div><div class="small">${ds(S.serverDate).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</div></div><span class="slide-count">${slideIndex + 1} / ${photoItems.length}</span></div>`;
}
function stopSlides() { clearInterval(slideTimer); slideActive = false; $('#slideshow').hidden = true; $('#slideshow').innerHTML = ''; }
async function boot() {
  try { status = await api('/status'); if (!status.configured) return renderAuth(); if (!status.authenticated) return renderAuth(true); await refresh(false); render();
    if (new URLSearchParams(location.search).get('google')) { const connected = new URLSearchParams(location.search).get('google') === 'connected'; toast(connected ? 'Google-Konto verbunden. Jetzt Kalender auswählen.' : 'Google-Verbindung fehlgeschlagen. Bitte erneut versuchen.', !connected); history.replaceState(null, '', location.pathname + location.hash); }
  } catch (error) { app.innerHTML = `<main class="boot"><h2>Familienzentrale nicht erreichbar</h2><p>${E(error.message)}</p>${btn('Erneut versuchen', 'retry', 'refresh', 'primary')}</main>`; $('[data-action=retry]').onclick = boot; }
}
setInterval(async () => {
  if (!S || busy || document.hidden) return;
  try { await refresh(); }
  catch { if (S && online) { online = false; if (!editor.open && !document.activeElement?.closest('form')) render(); else { $('#connection')?.classList.add('offline'); if ($('#connection')) $('#connection').textContent = 'Verbindung fehlt'; updateDisabled(); } } }
}, 15000);
setInterval(() => { document.querySelectorAll('.local-clock,.slide-clock').forEach(el => el.textContent = clockText()); }, 1000);
void boot();


function taskImageField(record) {
  return `<div class="task-image-field full"><label class="form-field">Bild zur Aufgabe (optional)<input id="task-image-input" type="file" name="taskImage" accept="image/jpeg,image/png,image/webp,image/gif"><span class="field-hint">Bis 5 MB. Das Bild wird für eure Familie auf dem Server gespeichert.</span></label><img id="task-image-preview" class="task-image-preview" src="${record.imageFile ? '/api/tasks/image?file=' + encodeURIComponent(record.imageFile) : ''}" alt="Bild zur Aufgabe" ${record.imageFile ? '' : 'hidden'}>${record.imageFile ? '<label class="checkbox-field"><input type="checkbox" name="removeImage">Bild entfernen</label>' : ''}</div>`;
}
async function uploadTaskImage(file) {
  if (file.size > 5 * 1024 * 1024) throw new Error('Das Aufgabenbild darf höchstens 5 MB groß sein.');
  const res = await fetch('/api/tasks/image', { method: 'POST', headers: { 'X-Family-Request': '1', 'Content-Type': 'application/octet-stream' }, body: file });
  const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Bild konnte nicht hochgeladen werden.'); return data.imageFile;
}
function applyAppearance(settings, imageUrl) {
  const theme = appearanceFor(settings);
  for (const [key, value] of Object.entries(themeProperties(theme))) document.documentElement.style.setProperty(key, value);
  const image = imageUrl === undefined ? theme.backgroundImage ? uiImageUrl(theme.backgroundImage) : '' : imageUrl;
  document.documentElement.style.setProperty('--page-image', image ? `url("${image}")` : 'none');
}
function setMealLayout(value) {
  mealLayout = value === 'vertical' ? 'vertical' : 'horizontal';
  localStorage.setItem('mealLayout', mealLayout); render();
}
function memberImageField(record) {
  return `<div class="form-field full"><span>Profilbild (optional)</span><input id="member-image-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif"><img id="member-image-preview" class="profile-image-preview" ${isImageFile(record.avatarImage) ? `src="${uiImageUrl(record.avatarImage)}"` : 'hidden'} alt="Vorschau des Profilbildes">${record.avatarImage ? '<label class="checkbox-field"><input type="checkbox" name="removeMemberImage">Profilbild entfernen und Initialen anzeigen</label>' : ''}<span class="field-hint">Bis 5 MB. Das Bild wird für alle Geräte im Container gespeichert.</span></div>`;
}
function recipeImageField(record) {
  return `<div class="form-field full"><span>Rezeptbild (optional)</span><input id="recipe-image-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif"><img id="recipe-image-preview" class="recipe-image-preview" ${isImageFile(record.imageFile) ? `src="${uiImageUrl(record.imageFile)}"` : 'hidden'} alt="Vorschau des Rezeptbildes"><label class="checkbox-field"><input type="checkbox" name="removeRecipeImage">Rezeptbild entfernen</label><span class="field-hint">JPEG, PNG, WebP oder GIF bis 5 MB. Das Bild wird für alle Geräte im Container gespeichert.</span></div>`;
}
function previewRecipeImage(input) {
  if (editing?.kind !== 'recipes') return;
  if (input.id === 'recipe-image-input') {
    if (recipePreviewUrl) URL.revokeObjectURL(recipePreviewUrl);
    recipePreviewUrl = input.files?.[0] ? URL.createObjectURL(input.files[0]) : '';
    if (recipePreviewUrl) $('[name=removeRecipeImage]').checked = false;
  }
  const image = $('#recipe-image-preview'), removed = $('[name=removeRecipeImage]')?.checked;
  if (image) { const source = removed ? '' : recipePreviewUrl || (isImageFile(editing.imageFile) ? uiImageUrl(editing.imageFile) : ''); image.src = source; image.hidden = !source; }
}
async function uploadUiImage(file) {
  if (file.size > 5 * 1024 * 1024) throw new Error('Das Bild darf höchstens 5 MB groß sein.');
  const response = await fetch('/api/images/ui', { method: 'POST', headers: { 'X-Family-Request': '1', 'Content-Type': file.type }, body: file });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Das Bild konnte nicht gespeichert werden.');
  return result.imageFile;
}
function previewMemberImage(input) {
  if (memberPreviewUrl) URL.revokeObjectURL(memberPreviewUrl);
  memberPreviewUrl = input.files?.[0] ? URL.createObjectURL(input.files[0]) : '';
  const image = $('#member-image-preview');
  if (image) { const source = memberPreviewUrl || (editing.old?.avatarImage ? uiImageUrl(editing.old.avatarImage) : ''); image.src = source; image.hidden = !source; }
}
function appearanceSettingsPanel() {
  const theme = appearanceFor(S.settings), labels = [['allColor', 'Standardfarbe für Alle'], ['backgroundColor', 'Seitenhintergrund'], ['headerColor', 'Header'], ['surfaceColor', 'Karten und Formulare'], ['navColor', 'Seitenmenü'], ['accentColor', 'Buttons und Akzente'], ['textColor', 'Textfarbe']];
  return `<section class="panel settings-wide"><div class="panel-head"><h2>${I('photos')}Darstellung</h2></div><div class="panel-body"><form id="settings-appearance"><div class="form-grid appearance-colors">${labels.map(([key, label]) => field(label, key, theme[key], 'color', 'required data-appearance-color')).join('')}${selectField('Höhe einer Kalenderstunde', 'calendarHourSize', theme.calendarHourSize, [...new Set([52, 64, 84, 100, theme.calendarHourSize])].sort((a,b) => a-b).map(size => [size, `${size} px${size === 52 ? ' · kompakt' : size === 64 ? ' · normal' : size === 84 ? ' · groß' : size === 100 ? ' · sehr groß' : ''}`]))}<label class="checkbox-field full"><input name="calendarAutoWidth" type="checkbox" ${theme.calendarAutoWidth ? 'checked' : ''}>Leere Kalendertage schmaler anzeigen</label><label class="checkbox-field full"><input name="calendarCompactHours" type="checkbox" ${theme.calendarCompactHours ? 'checked' : ''}>Leere Stunden in der gesamten Woche verdichten</label><div class="form-field full"><span>Hintergrundbild (optional)</span><input id="background-image-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif"><img id="background-image-preview" class="background-image-preview" ${theme.backgroundImage ? `src="${uiImageUrl(theme.backgroundImage)}"` : 'hidden'} alt="Vorschau des Hintergrundbildes"><label class="checkbox-field"><input name="removeBackgroundImage" type="checkbox">Hintergrundbild entfernen</label><span class="field-hint">Bis 5 MB; füllt den Seitenhintergrund aus. Karten behalten die eingestellte Kartenfarbe.</span></div></div><p class="field-hint section-gap">Farben werden hier direkt als Vorschau gezeigt. Erst Speichern übernimmt sie für alle Geräte. Eine eigene Terminfarbe überschreibt die Standardfarbe für Alle.</p><div class="form-actions"><button class="button" type="button" data-action="reset-appearance">Standard wiederherstellen</button><button class="button primary" type="submit">Darstellung speichern</button></div></form></div></section>`;
}
function appearanceDraft(form) {
  const data = Object.fromEntries(new FormData(form));
  return { ...S.settings, ...data, calendarHourSize: Number(data.calendarHourSize), calendarAutoWidth: data.calendarAutoWidth === 'on', calendarCompactHours: data.calendarCompactHours === 'on', backgroundImage: data.removeBackgroundImage ? '' : S.settings.backgroundImage || '' };
}
function previewAppearance() {
  const form = $('#settings-appearance'); if (!form) return;
  const draft = appearanceDraft(form), removed = $('[name=removeBackgroundImage]', form).checked;
  applyAppearance(draft, removed ? '' : backgroundPreviewUrl || (draft.backgroundImage ? uiImageUrl(draft.backgroundImage) : ''));
}
function previewBackgroundImage(input) {
  if (backgroundPreviewUrl) URL.revokeObjectURL(backgroundPreviewUrl);
  backgroundPreviewUrl = input.files?.[0] ? URL.createObjectURL(input.files[0]) : '';
  const image = $('#background-image-preview'), previous = S.settings.backgroundImage;
  if (image) { const source = backgroundPreviewUrl || (previous ? uiImageUrl(previous) : ''); image.src = source; image.hidden = !source; }
  if (backgroundPreviewUrl) $('[name=removeBackgroundImage]').checked = false;
}
async function saveAppearance(form, data) {
  const draft = appearanceDraft(form), file = $('#background-image-input')?.files?.[0];
  if (file && !data.removeBackgroundImage) draft.backgroundImage = await uploadUiImage(file);
  await changeSettings(form, draft);
  if (backgroundPreviewUrl) { URL.revokeObjectURL(backgroundPreviewUrl); backgroundPreviewUrl = ''; }
}
function resetAppearanceForm() {
  const form = $('#settings-appearance');
  for (const [key, value] of Object.entries(appearanceDefaults)) {
    if (key === 'backgroundImage') continue;
    const input = $(`[name=${key}]`, form); if (!input) continue;
    if (typeof value === 'boolean') input.checked = value; else input.value = value;
  }
  $('[name=removeBackgroundImage]', form).checked = true; $('#background-image-input').value = ''; $('#background-image-preview').hidden = true;
  if (backgroundPreviewUrl) { URL.revokeObjectURL(backgroundPreviewUrl); backgroundPreviewUrl = ''; }
  previewAppearance();
}
function eventPeopleField(draft) {
  return `<fieldset class="event-people full"><legend>Für wen ist der Termin?</legend><p class="small muted">Alle oder eine oder mehrere Personen auswählen.</p><div class="person-choice-grid"><label class="person-choice" style="${personStyle('')}"><input name="event-person" type="checkbox" value="all" ${!draft.memberIds.length ? 'checked' : ''}>${I('people')}<span>Alle</span></label>${S.members.map(m => `<label class="person-choice" style="${personStyle(m.id)}"><input name="event-person" type="checkbox" value="${m.id}" ${draft.memberIds.includes(m.id) ? 'checked' : ''}>${avatar(m.id)}<span>${E(m.name)}</span></label>`).join('')}</div></fieldset>`;
}
function eventColorField(draft) {
  return `<div id="event-color-options" class="full event-color-options" ${draft.memberIds.length ? 'hidden' : ''}><label class="checkbox-field"><input type="checkbox" name="useDefaultColor" ${draft.color ? '' : 'checked'}>Standardfarbe für Alle verwenden</label>${field('Eigene Terminfarbe', 'eventColor', draft.color || appearanceFor(S.settings).allColor, 'color', draft.color && !draft.memberIds.length ? '' : 'disabled')}</div>`;
}
function eventTimeFields(draft, old, includeEndDate = true) {
  return `<div class="full"><label class="checkbox-field"><input type="checkbox" name="wizardAllDay" ${draft.allDay ? 'checked' : ''}>Ganztägig</label><div id="event-time-options" ${draft.allDay ? 'hidden' : ''}><div class="time-mode-choice"><label><input type="radio" name="timeMode" value="span" ${draft.startOnly ? '' : 'checked'}>Zeitspanne</label><label><input type="radio" name="timeMode" value="point" ${draft.startOnly ? 'checked' : ''}>Feste Zeit ohne Ende</label></div><div class="form-grid">${field('Beginn', 'startTime', draft.startTime || '09:00', 'time', draft.allDay ? 'disabled' : 'required')}${field('Ende', 'endTime', draft.endTime || '10:00', 'time', draft.allDay || draft.startOnly ? 'disabled' : 'required')}</div><p class="field-hint" id="start-only-hint" ${draft.startOnly ? '' : 'hidden'}>Ohne feste Endzeit: Die Farbe blendet im Kalender über 15 Minuten aus.</p></div>${includeEndDate ? `<div id="event-end-date" class="section-gap" ${draft.startOnly && !draft.allDay ? 'hidden' : ''}>${field('Enddatum', 'endDate', draft.endDate || draft.startDate, 'date', draft.startOnly && !draft.allDay ? 'disabled' : 'required')}</div>` : ''}${old?.googleAccountId ? `<div class="info-box section-gap">${old.googleReadOnly ? 'Dieser Google-Kalender ist schreibgeschützt.' : 'Änderungen werden auch in Google gespeichert.'}</div>` : selectField('Kalender', 'googleTarget', draft.googleTarget || '', [['', 'Nur Familienkalender'], ...S.google.flatMap(a => a.calendars.filter(c => c.selected && ['owner', 'writer'].includes(c.accessRole)).map(c => [JSON.stringify([a.id, c.id]), `${c.title} · ${a.email}`]))], true)}</div>`;
}
function updateEventColorControls() {
  const group = $('#event-color-options'); if (!group) return;
  const all = [...editor.querySelectorAll('[name=event-person]')].some(input => input.value === 'all' && input.checked);
  const selectedStep = editing?.steps?.[editing.index];
  const forAll = selectedStep === 'details' ? !editing.draft.memberIds.length : all;
  group.hidden = !forAll;
  $('[name=eventColor]').disabled = !forAll || $('[name=useDefaultColor]').checked;
}
function eventColorFromForm(data, people) { return !people.length && data.get('useDefaultColor') !== 'on' ? data.get('eventColor') || appearanceFor(S.settings).allColor : ''; }
function openEventEditor(old) {
  const draft = { ...old, memberIds: eventMembers(old) }; editing = { kind: 'events', old, draft };
  dialog(old.googleReadOnly ? 'Termin ansehen' : 'Termin bearbeiten', `<form id="event-edit-form"><div class="form-grid">${eventPeopleField(draft)}${field('Überschrift', 'title', draft.title, 'text', 'required maxlength="160"', true)}${textareaField('Beschreibung (optional)', 'description', draft.description, 'rows="3" maxlength="5000"')}${field('Adresse / Ort (optional)', 'location', draft.location, 'text', 'maxlength="300"', true)}${eventColorField(draft)}${field('Datum', 'startDate', draft.startDate, 'date', 'required')}<div id="event-end-date" ${draft.startOnly && !draft.allDay ? 'hidden' : ''}>${field('Enddatum', 'endDate', draft.endDate || draft.startDate, 'date', draft.startOnly && !draft.allDay ? 'disabled' : 'required')}</div>${eventTimeFields(draft, old, false)}</div><p class="form-error" id="editor-error" role="alert"></p><div class="form-actions">${old.googleReadOnly ? '' : '<button class="button danger" type="button" data-action="delete-record">Löschen</button>'}<div class="spacer"></div><button class="button" type="button" data-action="close-editor">Abbrechen</button><button class="button primary" type="submit" ${old.googleReadOnly ? 'disabled' : ''}>Speichern</button></div></form>`);
}
async function saveEventEditor(form) {
  const data = new FormData(form), selected = data.getAll('event-person');
  if (!selected.length) throw new Error('Bitte Alle oder mindestens eine Person auswählen.');
  const people = selected.includes('all') ? [] : selected, { old } = editing;
  const allDay = data.get('wizardAllDay') === 'on', startOnly = !allDay && data.get('timeMode') === 'point', startDate = data.get('startDate');
  const target = data.get('googleTarget') ? JSON.parse(data.get('googleTarget')) : [];
  await api('/records/events/' + old.id, 'PUT', { ...old, title: data.get('title'), description: data.get('description') || '', location: data.get('location') || '', memberIds: people, memberId: people[0] || '', color: eventColorFromForm(data, people), startDate, endDate: startOnly ? startDate : data.get('endDate'), allDay, startOnly, startTime: allDay ? '' : data.get('startTime'), endTime: allDay || startOnly ? '' : data.get('endTime'), googleAccountId: old.googleAccountId || target[0] || '', calendarId: old.calendarId || target[1] || '', _rev: old._rev });
  editor.close(); await refresh(false); render(); toast('Termin gespeichert.');
}

function startEventWizard(old, defaults = {}) {
  const startDate = old?.startDate || defaults.startDate || cursor;
  editing = { kind: 'events', old, index: 0, steps: defaults.fixedDate && !old ? ['people', 'details', 'time'] : ['people', 'details', 'date', 'time'], draft: { title: '', description: '', location: '', startDate, endDate: startDate, startTime: '09:00', endTime: '10:00', allDay: false, startOnly: false, memberIds: filter ? [filter] : [], ...old, ...defaults } };
  if (old) editing.draft.memberIds = eventMembers(old);
  renderEventWizard();
}
function renderEventWizard() {
  const { draft: d, steps, index, old } = editing, step = steps[index]; let body;
  if (step === 'people') body = eventPeopleField(d);
  else if (step === 'details') body = `<div class="form-grid">${field('Überschrift', 'title', d.title, 'text', 'required maxlength="160"', true)}${textareaField('Beschreibung (optional)', 'description', d.description, 'rows="3" maxlength="5000"')}${field('Adresse / Ort (optional)', 'location', d.location, 'text', 'maxlength="300"', true)}${eventColorField(d)}</div>`;
  else if (step === 'date') body = `<h3>An welchem Tag?</h3><div class="form-grid section-gap">${field('Datum', 'startDate', d.startDate, 'date', 'required', true)}</div>`;
  else body = `<div class="event-summary"><strong>${E(d.title)}</strong><span>${fullWeekday(d.startDate)}, ${fullDate(d.startDate)}</span><span>${E(d.memberIds.map(id => member(id)?.name).filter(Boolean).join(', ') || 'Alle')}</span></div><div class="section-gap">${eventTimeFields(d, old)}</div>`;
  dialog('Termin hinzufügen', `<form id="event-wizard-form"><div class="wizard-progress">Schritt ${index + 1} von ${steps.length}<div>${steps.map((_, i) => `<span class="${i <= index ? 'done' : ''}"></span>`).join('')}</div></div>${body}<p class="form-error" id="editor-error" role="alert"></p><div class="form-actions"><div class="spacer"></div>${index ? '<button class="button" type="button" data-action="wizard-back">Zurück</button>' : ''}<button class="button" type="button" data-action="close-editor">Abbrechen</button><button class="button primary" type="submit">${index === steps.length - 1 ? 'Speichern' : 'Weiter'}</button></div></form>`);
}
function collectEventStep(form) {
  const data = new FormData(form), { draft: d, steps, index } = editing, step = steps[index];
  if (step === 'people') { const selected = data.getAll('event-person'); if (!selected.length) throw new Error('Bitte Alle oder mindestens eine Person auswählen.'); d.memberIds = selected.includes('all') ? [] : selected; }
  if (step === 'details') { for (const key of ['title', 'description', 'location']) d[key] = data.get(key) || ''; d.color = eventColorFromForm(data, d.memberIds); }
  if (step === 'date') { const prior = d.startDate; d.startDate = data.get('startDate'); if (d.endDate === prior || d.endDate < d.startDate) d.endDate = d.startDate; }
  if (step === 'time') { d.allDay = data.get('wizardAllDay') === 'on'; d.startOnly = !d.allDay && data.get('timeMode') === 'point'; d.startTime = d.allDay ? '' : data.get('startTime'); d.endTime = d.allDay || d.startOnly ? '' : data.get('endTime'); d.endDate = d.startOnly ? d.startDate : data.get('endDate'); d.googleTarget = data.get('googleTarget') || ''; }
}
function updateEventTimeControls() {
  const allDay = $('[name=wizardAllDay]').checked, point = $('[name=timeMode]:checked')?.value === 'point';
  $('#event-time-options').hidden = allDay; $('#event-end-date').hidden = point && !allDay; $('#start-only-hint').hidden = !point;
  for (const name of ['startTime', 'endTime']) { const el = $(`[name=${name}]`); el.disabled = allDay || name === 'endTime' && point; el.required = !el.disabled; }
  const endDate = $('[name=endDate]'); endDate.disabled = point && !allDay; endDate.required = !endDate.disabled;
}
async function advanceEventWizard(form) {
  collectEventStep(form);
  if (editing.index < editing.steps.length - 1) { editing.index++; renderEventWizard(); return; }
  const { old, draft: d } = editing, target = d.googleTarget ? JSON.parse(d.googleTarget) : [];
  await api('/records/events' + (old ? '/' + old.id : ''), old ? 'PUT' : 'POST', { ...d, memberId: d.memberIds[0] || '', googleAccountId: old?.googleAccountId || target[0] || '', calendarId: old?.calendarId || target[1] || '', ...(old ? { _rev: old._rev } : {}) });
  editor.close(); await refresh(false); render(); toast('Termin gespeichert.');
}
function parentSettings() {
  return `<section class="panel"><div class="panel-head"><h2>${I('shield')}Elternpasswort</h2></div><div class="panel-body"><p class="small muted">Schützt manuelle Punkte und Software-Updates. Vom Familienpasswort getrennt aufbewahren.</p><form id="parent-password-form" class="stack">${field('Familienpasswort', 'familyPassword', '', 'password', 'required autocomplete="current-password"')}${S.parentPasswordConfigured ? field('Bisheriges Elternpasswort', 'currentPassword', '', 'password', 'required autocomplete="off"') : ''}${field('Neues Elternpasswort', 'newPassword', '', 'password', 'required minlength="8" maxlength="200" autocomplete="new-password"')}${field('Neues Elternpasswort wiederholen', 'confirmPassword', '', 'password', 'required minlength="8" maxlength="200" autocomplete="new-password"')}<button class="button primary" type="submit">${S.parentPasswordConfigured ? 'Elternpasswort ändern' : 'Elternpasswort anlegen'}</button></form></div></section>`;
}
function openPointsAward() {
  if (!S.parentPasswordConfigured) { toast('Zuerst ein Elternpasswort in den Einstellungen anlegen.'); go('settings'); return; }
  editing = { kind: 'point-award', requestId: uid() };
  dialog('Punkte manuell vergeben', `<form id="points-award-form" class="stack">${selectField('Für wen?', 'memberId', filter || S.members[0].id, S.members.map(m => [m.id, m.name]))}${field('Punkte', 'points', 5, 'number', 'required min="1" max="100000" step="1"')}${field('Wofür?', 'reason', '', 'text', 'required maxlength="160"')}${field('Elternpasswort', 'password', '', 'password', 'required autocomplete="off"')}<p class="form-error" id="editor-error" role="alert"></p><button class="button primary" type="submit">Punkte vergeben</button></form>`);
}
function updateSettings() {
  return `<section class="panel settings-wide"><div class="panel-head"><h2>${I('refresh')}Software aktualisieren</h2></div><div class="panel-body"><p class="small muted">Installierte Version: <strong id="installed-version">${E(status?.version || '0.5.1')}</strong>. Vor dem Update werden eure Daten gesichert. Bei einem Fehler wird die vorherige Version wiederhergestellt.</p><div id="update-status" class="info-box" role="status" aria-live="polite">Updatedienst wird geprüft …</div><div class="form-actions"><button id="software-update-button" class="button primary" data-action="software-update" disabled>${I('refresh')}Update</button><button class="button" data-action="reload-app">Seite neu laden</button></div></div></section>`;
}
function paintUpdateStatus() {
  const area = $('#update-status'); if (!area || !updaterState) return;
  area.textContent = [updaterState.message, updaterState.error, updaterState.finishedAt ? 'Letzter Abschluss: ' + new Date(updaterState.finishedAt).toLocaleString('de-DE') : '', updaterState.active ? 'Während des Neustarts kann die Verbindung kurz fehlen.' : ''].filter(Boolean).join('\n');
  area.classList.toggle('update-error', ['failed', 'rollback_failed', 'interrupted'].includes(updaterState.phase));
  const version = $('#installed-version'); if (version && updaterState.currentVersion) version.textContent = updaterState.currentVersion;
  const button = $('#software-update-button'); if (button) button.disabled = !online || !updaterState.supported || updaterState.active;
}
async function pollUpdateStatus() {
  if (!S || updatePollBusy || route !== 'settings' && !updaterState?.active) return;
  updatePollBusy = true;
  try { updaterState = await api('/updates/status'); updateUnavailableSince = 0; paintUpdateStatus(); }
  catch { if (updaterState?.active) { updateUnavailableSince ||= Date.now(); const area = $('#update-status'); if (area) area.textContent = Date.now() - updateUnavailableSince > 60000 ? 'Die Verbindung bleibt unterbrochen. Das Update-Ergebnis kann gerade nicht geladen werden. Bitte den Anwendungs- und Updatedienst im LXC prüfen; die Sicherung wird aufbewahrt.' : 'Die Anwendung startet neu. Der Update-Status wird gleich wieder geladen …'; } }
  finally { updatePollBusy = false; }
}
function openUpdateConfirm() {
  if (!S.parentPasswordConfigured) { toast('Zuerst ein Elternpasswort anlegen.'); return; }
  editing = { kind: 'update' };
  dialog('Software-Update starten', `<form id="update-start-form"><p>Eure Daten werden zuerst gesichert. Anschließend wird die aktuelle Version heruntergeladen und installiert. Die Anwendung ist beim Neustart kurz nicht erreichbar.</p>${field('Elternpasswort', 'password', '', 'password', 'required autocomplete="off"')}<p class="form-error" id="editor-error" role="alert"></p><div class="form-actions"><button class="button" type="button" data-action="close-editor">Abbrechen</button><button class="button primary" type="submit">Update starten</button></div></form>`);
}
setInterval(() => { void pollUpdateStatus(); }, 3000);

function dragData(element) {
  return parsePlannerDrag(JSON.stringify({ kind: element.dataset.dragKind, id: element.dataset.dragId, rev: Number(element.dataset.dragRev) }));
}
function dropTarget(element, data) { return element?.closest(data?.kind === 'task' ? '[data-task-drop]' : '[data-meal-slot]'); }
async function applyPlannerDrop(data, target) {
  if (!data || !target || !online || busy) return;
  busy = true;
  try {
    if (data.kind === 'task') await api(`/tasks/${data.id}/assign`, 'POST', { memberId: target.dataset.taskDrop, date: cursor, _rev: data.rev });
    else {
      const recipe = S.recipes.find(r => r.id === data.id); if (!recipe || recipe._rev !== data.rev) throw new Error('Das Rezept wurde geändert. Bitte neu laden.');
      const date = target.dataset.mealDate, slot = target.dataset.mealSlot, old = meal(date, slot);
      await api('/records/meals' + (old ? '/' + old.id : ''), old ? 'PUT' : 'POST', { date, slot, recipeId: recipe.id, servings: old?.servings || recipe.servings, ...(old ? { _rev: old._rev } : {}) });
    }
    await refresh(false); render(); toast(data.kind === 'task' ? 'Aufgabe zugeordnet.' : 'Mahlzeit geplant.');
  } catch (error) { toast(error.message, true); }
  finally { busy = false; }
}
document.addEventListener('dragstart', event => {
  const source = event.target.closest('[data-drag-kind]'); if (!source || !online || busy) { event.preventDefault(); return; }
  nativeDrag = dragData(source); if (!nativeDrag) { event.preventDefault(); return; }
  event.dataTransfer.setData('application/x-family-planner', JSON.stringify(nativeDrag)); event.dataTransfer.effectAllowed = nativeDrag.kind === 'task' ? 'move' : 'copy';
});
document.addEventListener('dragover', event => { const target = dropTarget(event.target, nativeDrag); if (target) { event.preventDefault(); target.classList.add('drag-over'); } });
document.addEventListener('dragleave', event => { const target = event.target.closest('[data-task-drop],[data-meal-slot]'); if (target && !target.contains(event.relatedTarget)) target.classList.remove('drag-over'); });
document.addEventListener('drop', event => { const data = parsePlannerDrag(event.dataTransfer.getData('application/x-family-planner')), target = dropTarget(event.target, data); if (!target) return; event.preventDefault(); target.classList.remove('drag-over'); nativeDrag = null; void applyPlannerDrop(data, target); });
document.addEventListener('dragend', () => { nativeDrag = null; document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over')); });
document.addEventListener('pointerdown', event => {
  const handle = event.target.closest('[data-drag-handle]'); if (!handle || event.pointerType === 'mouse' || !online || busy) return;
  const data = dragData(handle.closest('[data-drag-kind]')); if (!data) return;
  pointerDrag = { data, id: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, target: null };
  handle.setPointerCapture?.(event.pointerId);
});
document.addEventListener('pointermove', event => {
  if (!pointerDrag || pointerDrag.id !== event.pointerId) return;
  if (Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY) < 6 && !pointerDrag.moved) return;
  pointerDrag.moved = true; suppressDragClick = true; event.preventDefault();
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  pointerDrag.target = dropTarget(document.elementFromPoint(event.clientX, event.clientY), pointerDrag.data); pointerDrag.target?.classList.add('drag-over');
  const scroll = document.elementFromPoint(event.clientX, event.clientY)?.closest('.task-board,.header-members,.meal-plan-scroll');
  if (scroll) { const box = scroll.getBoundingClientRect(); if (event.clientX > box.right - 35) scroll.scrollLeft += 20; if (event.clientX < box.left + 35) scroll.scrollLeft -= 20; }
  if (event.clientY < 70) window.scrollBy(0, -15); if (event.clientY > innerHeight - 90) window.scrollBy(0, 15);
}, { passive: false });
document.addEventListener('pointerup', event => { if (!pointerDrag || pointerDrag.id !== event.pointerId) return; const drag = pointerDrag; pointerDrag = null; drag.target?.classList.remove('drag-over'); if (drag.moved) void applyPlannerDrop(drag.data, drag.target); setTimeout(() => { suppressDragClick = false; }, 0); });
document.addEventListener('pointercancel', () => { pointerDrag?.target?.classList.remove('drag-over'); pointerDrag = null; suppressDragClick = false; });

document.addEventListener('input', event => { if (event.target.matches?.('[data-appearance-color]')) previewAppearance(); });
document.addEventListener('error', event => { if (event.target.matches?.('[data-profile-image],[data-recipe-image]')) event.target.hidden = true; }, true);
