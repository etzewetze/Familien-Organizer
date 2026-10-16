export const calendarCategories = [['vacation', 'Ferien'], ['holiday', 'Feiertage'], ['event', 'Importierte Termine']];
export const calendarOptionDefaults = { vacation: true, holiday: true, event: true };
export const germanStates = [['DE-BW','Baden-Württemberg'],['DE-BY','Bayern'],['DE-BE','Berlin'],['DE-BB','Brandenburg'],['DE-HB','Bremen'],['DE-HH','Hamburg'],['DE-HE','Hessen'],['DE-MV','Mecklenburg-Vorpommern'],['DE-NI','Niedersachsen'],['DE-NW','Nordrhein-Westfalen'],['DE-RP','Rheinland-Pfalz'],['DE-SL','Saarland'],['DE-SN','Sachsen'],['DE-ST','Sachsen-Anhalt'],['DE-SH','Schleswig-Holstein'],['DE-TH','Thüringen']];
export const planCaption = (plan, people = []) => plan.title?.trim() || people.find(person => person.id === plan.memberId)?.name || (plan.type === 'kita' ? 'Kitaplan' : 'Stundenplan');
export const calendarEntryActive = (entry, options = {}) => entry.enabled !== false && options[entry.category] !== false;
export function calendarEntriesOnDate(entries, date, options = {}) {
  return entries.filter(entry => calendarEntryActive(entry, options) && entry.startDate <= date && entry.endDate >= date).map(entry => ({ ...entry, calendarEntryId: entry.id, memberIds: entry.memberId ? [entry.memberId] : [], emoji: entry.category === 'vacation' ? '🏖️' : entry.category === 'holiday' ? '🎉' : '' }));
}
export function scheduleClosed(plan, date, entries = [], options = {}) {
  return entries.some(entry => entry.allDay && entry.category !== 'event' && entry.pauseSchedules !== false && calendarEntryActive(entry, options) && (!entry.memberId || entry.memberId === plan.memberId) && entry.startDate <= date && entry.endDate >= date && (entry.category === 'vacation' ? (plan.pauseDuringVacations ?? plan.type === 'school') : plan.pauseOnHolidays !== false));
}
