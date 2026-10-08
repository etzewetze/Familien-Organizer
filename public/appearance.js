export const appearanceDefaults = Object.freeze({
  allColor: '#6366f1', backgroundColor: '#f5f6fb', headerColor: '#ffffff',
  surfaceColor: '#ffffff', navColor: '#172237', accentColor: '#4f46e5', textColor: '#20283d',
  backgroundImage: '', calendarHourSize: 64, calendarAutoWidth: true, calendarCompactHours: true,
});
export const isColor = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
export const isImageFile = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.(?:jpg|png|webp|gif)$/.test(value);

export function appearanceFor(settings = {}) {
  const result = { ...appearanceDefaults };
  for (const key of Object.keys(result).filter(key => key.endsWith('Color'))) if (isColor(settings[key])) result[key] = settings[key];
  if (isImageFile(settings.backgroundImage)) result.backgroundImage = settings.backgroundImage;
  if (Number.isInteger(settings.calendarHourSize) && settings.calendarHourSize >= 52 && settings.calendarHourSize <= 100) result.calendarHourSize = settings.calendarHourSize;
  if (typeof settings.calendarAutoWidth === 'boolean') result.calendarAutoWidth = settings.calendarAutoWidth;
  if (typeof settings.calendarCompactHours === 'boolean') result.calendarCompactHours = settings.calendarCompactHours;
  return result;
}

export function eventColor(event, members, settings) {
  const people = Array.isArray(event.memberIds) ? event.memberIds : event.memberId ? [event.memberId] : [];
  const theme = appearanceFor(settings);
  if (people.length) return members.find(member => member.id === people[0])?.color || theme.allColor;
  return isColor(event.color) ? event.color : theme.allColor;
}

export function calendarColumns(eventsByDay, automatic = true) {
  const widths = eventsByDay.map(events => automatic && events.length === 0 ? 128 : 160);
  return { template: '52px ' + widths.map(width => `minmax(${width}px,${width === 128 ? '.7' : '1.3'}fr)`).join(' '), minimum: 52 + widths.reduce((sum, width) => sum + width, 0) };
}

const blend = (a, b, weight) => '#' + [1, 3, 5].map(index => Math.round(parseInt(a.slice(index, index + 2), 16) * weight + parseInt(b.slice(index, index + 2), 16) * (1 - weight)).toString(16).padStart(2, '0')).join('');
export function contrastText(color) {
  const channels = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722 > .179 ? '#111827' : '#ffffff';
}
export function themeProperties(settings) {
  const theme = appearanceFor(settings);
  return { '--bg': theme.backgroundColor, '--header': theme.headerColor, '--surface': theme.surfaceColor, '--nav': theme.navColor, '--primary': theme.accentColor, '--ink': theme.textColor,
    '--muted': blend(theme.textColor, theme.surfaceColor, .67), '--line': blend(theme.textColor, theme.surfaceColor, .14), '--soft': blend(theme.textColor, theme.surfaceColor, .04),
    '--header-ink': contrastText(theme.headerColor), '--nav-ink': contrastText(theme.navColor), '--primary-ink': contrastText(theme.accentColor) };
}
