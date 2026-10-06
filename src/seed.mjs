import { addDays } from './model.mjs';

export function seed(store, names, demo, date) {
  const colors = ['#6366f1', '#ec4899', '#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6'];
  const members = names.map((name, i) => store.put('members', store.id(), { name, color: colors[i % colors.length], role: i < 2 ? 'adult' : 'child' }));
  store.put('lists', 'shopping', { title: 'Einkaufsliste' });
  if (!demo) return;
  const at = (n) => members[n % members.length].id;
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
  const monday = addDays(date, -((weekday + 6) % 7));
  const event = (title, offset, startTime, endTime, memberId, location = '') => store.put('events', store.id(), { title, startDate: addDays(monday, offset), endDate: addDays(monday, offset), startTime, endTime, allDay: false, memberId, location, description: '', googleAccountId: '', calendarId: '', googleEventId: '', googleReadOnly: false });
  event('Schwimmkurs', 0, '16:00', '17:00', at(2), 'Hallenbad');
  event('Elternabend', 1, '19:00', '20:30', at(0), 'Grundschule');
  event('Fußballtraining', 2, '16:30', '18:00', at(3), 'Sportplatz');
  event('Zahnarzt', 3, '09:30', '10:00', at(1));
  event('Spieleabend', 4, '18:00', '20:00', '', 'Zuhause');
  event('Ausflug in den Wald', 5, '10:00', '13:00', '');
  [['Schulranzen packen', 2, 5, 'weekdays'], ['Zimmer aufräumen', 3, 10, 'daily'], ['Spülmaschine ausräumen', 2, 5, 'daily'], ['Pflanzen gießen', 1, 5, 'weekly'], ['Bücher zurückbringen', 0, 0, 'none']].forEach(([title, n, points, repeat]) => store.put('tasks', store.id(), { title, memberId: at(n), points, repeat, startDate: monday, description: '' }));
  const recipes = [
    { title: 'Pasta mit Tomatensauce', minutes: 25, servings: 4, category: 'Vegetarisch', ingredients: [{ name: 'Nudeln', quantity: 500, unit: 'g', category: 'Vorrat' }, { name: 'Passierte Tomaten', quantity: 500, unit: 'ml', category: 'Vorrat' }, { name: 'Zwiebel', quantity: 1, unit: 'Stück', category: 'Gemüse' }], instructions: 'Zwiebel klein schneiden und anbraten. Tomaten zugeben und 15 Minuten köcheln lassen. Nudeln kochen und mit der Sauce servieren.', sourceUrl: '' },
    { title: 'Ofengemüse mit Feta', minutes: 40, servings: 4, category: 'Vegetarisch', ingredients: [{ name: 'Kartoffeln', quantity: 800, unit: 'g', category: 'Gemüse' }, { name: 'Paprika', quantity: 3, unit: 'Stück', category: 'Gemüse' }, { name: 'Feta', quantity: 200, unit: 'g', category: 'Kühlregal' }], instructions: 'Gemüse würfeln, mit Öl und Gewürzen mischen. Bei 200 °C etwa 30 Minuten backen. Feta darüberbröseln und weitere 10 Minuten backen.', sourceUrl: '' },
    { title: 'Pfannkuchen', minutes: 30, servings: 4, category: 'Familienliebling', ingredients: [{ name: 'Mehl', quantity: 250, unit: 'g', category: 'Vorrat' }, { name: 'Milch', quantity: 500, unit: 'ml', category: 'Kühlregal' }, { name: 'Eier', quantity: 3, unit: 'Stück', category: 'Kühlregal' }], instructions: 'Alle Zutaten zu einem glatten Teig verrühren. 10 Minuten ruhen lassen und portionsweise in einer beschichteten Pfanne ausbacken.', sourceUrl: '' },
  ].map(r => store.put('recipes', store.id(), r));
  for (let i = 0; i < 3; i++) store.put('meals', addDays(monday, i), { date: addDays(monday, i), recipeId: recipes[i].id, servings: members.length });
  store.put('items', store.id(), { title: 'Äpfel', listId: 'shopping', quantity: 6, unit: 'Stück', category: 'Obst', checked: false, generatedWeek: '' });
  store.put('items', store.id(), { title: 'Brot', listId: 'shopping', quantity: 1, unit: 'Stück', category: 'Bäckerei', checked: false, generatedWeek: '' });
  const list = store.put('lists', store.id(), { title: 'Für den Wochenendausflug' });
  store.put('items', store.id(), { title: 'Trinkflaschen einpacken', listId: list.id, quantity: 0, unit: '', category: 'Sonstiges', checked: false, generatedWeek: '' });
  store.put('notes', store.id(), { title: 'Unsere Familienideen', body: 'Am Wochenende einen neuen Spielplatz entdecken.\nIm Herbst gemeinsam Kürbissuppe kochen.\nFür den Spieleabend darf jeder ein Spiel aussuchen.', pinned: true });
  store.put('rewards', store.id(), { title: 'Filmabend aussuchen', cost: 25, description: 'Du suchst den Film für unseren nächsten Filmabend aus.' });
  store.put('rewards', store.id(), { title: 'Ein Eis zusammen', cost: 40, description: 'Ein gemeinsamer Ausflug zur Eisdiele.' });
}
