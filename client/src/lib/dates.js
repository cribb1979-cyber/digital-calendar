export const MONTH_NAMES = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december',
];
export const WEEKDAY_NAMES = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
// Monday-first short names for calendar headers
export const WEEKDAY_SHORT = ['mån', 'tis', 'ons', 'tor', 'fre', 'lör', 'sön'];

export const pad = (n) => String(n).padStart(2, '0');

export function toDateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addMinutes(d, n) {
  return new Date(d.getTime() + n * 60000);
}

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatTime(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDateLong(d) {
  return `${WEEKDAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

export function formatDateRelative(d, now = new Date()) {
  const diff = Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
  if (diff === 0) return 'idag';
  if (diff === 1) return 'imorgon';
  if (diff === -1) return 'igår';
  const long = formatDateLong(d);
  return d.getFullYear() === now.getFullYear() ? long : `${long} ${d.getFullYear()}`;
}

/** Build a local Date from a YYYY-MM-DD key and an optional HH:MM string. */
export function combine(dateKey, time) {
  const d = fromDateKey(dateKey);
  if (time) {
    const [h, m] = time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  }
  return d;
}

/** 6x7 grid of dates (Monday first) covering the given month. */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function formatReminder(minutes) {
  if (minutes == null) return 'ingen påminnelse';
  if (minutes === 0) return 'påminnelse vid start';
  if (minutes % 1440 === 0) {
    const n = minutes / 1440;
    return `påminnelse ${n} ${n === 1 ? 'dag' : 'dagar'} innan`;
  }
  if (minutes % 60 === 0) {
    const n = minutes / 60;
    return `påminnelse ${n} ${n === 1 ? 'timme' : 'timmar'} innan`;
  }
  return `påminnelse ${minutes} min innan`;
}
