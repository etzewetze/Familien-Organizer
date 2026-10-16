export const schoolDays = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
export const periodCounts = [6, 8, 10, 12];
const minutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const clock = minute => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

export function defaultPeriods(count = 6) {
  let start = 480;
  return Array.from({ length: count }, (_, index) => {
    const period = { startTime: clock(start), endTime: clock(start + 45) };
    start += 45 + (index % 2 ? 15 : 0); return period;
  });
}

// A school day is one slim interval from the first occupied lesson to the last.
export function scheduleWindows(schedules, date, { enabledOnly = true, selected = {}, memberId = '' } = {}) {
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
  if (weekday < 1 || weekday > 5) return [];
  return schedules.filter(plan => (!enabledOnly || plan.showInCalendar) && selected[plan.id] !== false && (!memberId || plan.memberId === memberId) && (!plan.validFrom || date >= plan.validFrom) && (!plan.validUntil || date <= plan.validUntil)).flatMap(plan => {
    const entries = plan.entries.filter(entry => entry.weekday === weekday);
    if (!entries.length) return [];
    const times = plan.type === 'school' ? entries.map(entry => plan.periods[entry.period - 1]).filter(Boolean) : entries;
    if (!times.length) return [];
    const start = Math.min(...times.map(entry => minutes(entry.startTime))), end = Math.max(...times.map(entry => minutes(entry.endTime)));
    return [{ id: plan.id, memberId: plan.memberId, title: plan.title, type: plan.type, start, end, startTime: clock(start), endTime: clock(end), entries }];
  });
}

export function yearMonths(year) {
  return Array.from({ length: 12 }, (_, month) => {
    const first = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const offset = (new Date(first + 'T12:00:00Z').getUTCDay() + 6) % 7;
    const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return { first, offset, dates: Array.from({ length }, (_, day) => `${first.slice(0, 8)}${String(day + 1).padStart(2, '0')}`) };
  });
}

export function matchTaskTemplates(templates, query = '') {
  const normalized = query.trim().toLocaleLowerCase('de');
  return templates.filter(template => !normalized || /^\d+$/.test(normalized) && String(template.code) === String(Number(normalized)) || !/^\d+$/.test(normalized) && template.title.toLocaleLowerCase('de').includes(normalized));
}

export function navigationOrder(saved, ids) {
  return [...new Set([...(Array.isArray(saved) ? saved.filter(id => ids.includes(id)) : []), ...ids])];
}
