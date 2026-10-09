const pad = value => String(value).padStart(2, '0');
const leapYear = year => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

export function birthdayOccurrence(birthday, year) {
  if (!Number.isInteger(year) || year < 1 || year > 9999 || birthday.birthYear && year < birthday.birthYear) return null;
  let month = birthday.month, day = birthday.day;
  if (month === 2 && day === 29 && !leapYear(year)) {
    month = birthday.leapDay === 'feb28' ? 2 : 3;
    day = birthday.leapDay === 'feb28' ? 28 : 1;
  }
  const date = `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
  const age = birthday.birthYear ? year - birthday.birthYear : null;
  return {
    id: `birthday-${birthday.id}-${year}`, birthdayId: birthday.id,
    title: `🎂 ${birthday.name}${age !== null ? ` · ${age} ${age === 1 ? 'Jahr' : 'Jahre'}` : ''}`,
    startDate: date, endDate: date, startTime: '', endTime: '', allDay: true,
    memberId: birthday.memberId || '', location: '', description: birthday.notes || '', age,
  };
}

export function birthdaysOnDate(birthdays, date) {
  const year = Number(date.slice(0, 4));
  return birthdays.map(birthday => birthdayOccurrence(birthday, year)).filter(event => event?.startDate === date);
}

export function nextBirthday(birthday, date) {
  const year = Number(date.slice(0, 4));
  const current = birthdayOccurrence(birthday, year);
  return current && current.startDate >= date ? current : birthdayOccurrence(birthday, year + 1);
}
