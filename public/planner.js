export const mealSlots = [['breakfast', 'Frühstück'], ['lunch', 'Mittag'], ['dinner', 'Abendbrot']];
export const eventMembers = event => event.memberIds || (event.memberId ? [event.memberId] : []);
export const minutesOf = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export function eventWindow(event, date) {
  if (event.allDay || event.startDate > date || event.endDate < date) return null;
  const start = event.startDate < date ? 0 : minutesOf(event.startTime);
  const end = event.startOnly ? Math.min(start + 15, 1440) : event.endDate > date ? 1440 : minutesOf(event.endTime);
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { event, start, end } : null;
}

// Each connected overlap group shares columns; adjacent appointments use the full width.
export function layoutTimedEvents(events, date) {
  const intervals = events.map(event => eventWindow(event, date)).filter(Boolean).sort((a, b) => a.start - b.start || b.end - a.end);
  const output = []; let group = [], groupEnd = -1;
  const finish = () => {
    const ends = [];
    for (const item of group) {
      let column = ends.findIndex(end => end <= item.start);
      if (column < 0) column = ends.length;
      ends[column] = item.end; item.column = column;
    }
    for (const item of group) output.push({ ...item, columns: ends.length });
    group = []; groupEnd = -1;
  };
  for (const item of intervals) {
    if (group.length && item.start >= groupEnd) finish();
    group.push(item); groupEnd = Math.max(groupEnd, item.end);
  }
  if (group.length) finish();
  return output;
}

export function parsePlannerDrag(value) {
  try {
    const data = JSON.parse(value);
    if (!data || !['task', 'recipe'].includes(data.kind) || !/^[a-zA-Z0-9-]{1,100}$/.test(data.id) || !Number.isInteger(data.rev)) return null;
    return { kind: data.kind, id: data.id, rev: data.rev };
  } catch { return null; }
}
