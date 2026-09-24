// Swedish natural-language parser for spoken or typed calendar events, e.g.
// "tandläkare på fredag klockan 3" or "möte med Anna imorgon 14:30 i en timme".
import { addDays, startOfDay, toDateKey } from './dates.js';

const LETTER = '[\\p{L}\\d]';
// \b does not understand å/ä/ö, so use explicit letter boundaries instead.
const re = (src) => new RegExp(`(?<!${LETTER})(?:${src})(?!${LETTER})`, 'iu');

const NUMBER_WORDS = {
  en: 1, ett: 1, två: 2, tre: 3, fyra: 4, fem: 5, sex: 6, sju: 7, åtta: 8, nio: 9, tio: 10,
  elva: 11, tolv: 12, tretton: 13, fjorton: 14, femton: 15, sexton: 16, sjutton: 17,
  arton: 18, nitton: 19, tjugo: 20, tjugoen: 21, tjugoett: 21, tjugotvå: 22, tjugotre: 23,
  tjugofyra: 24, tjugofem: 25, trettio: 30, fyrtio: 40, fyrtiofem: 45, femtio: 50,
};
const NUM = `\\d{1,3}|${Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length).join('|')}`;

const WEEKDAYS = { söndag: 0, måndag: 1, tisdag: 2, onsdag: 3, torsdag: 4, fredag: 5, lördag: 6 };
const MONTHS = {
  januari: 0, jan: 0, februari: 1, feb: 1, mars: 2, mar: 2, april: 3, apr: 3, maj: 4,
  juni: 5, jun: 5, juli: 6, jul: 6, augusti: 7, aug: 7, september: 8, sept: 8, sep: 8,
  oktober: 9, okt: 9, november: 10, nov: 10, december: 11, dec: 11,
};
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
const KL = '(?:klockan|kl\\.?)\\s*';
const T = '(\\d{1,2})(?:[:.](\\d{2}))?';

function toNumber(s) {
  if (s == null) return null;
  const v = s.toLowerCase().replace(',', '.');
  if (/^\d+(\.\d+)?$/.test(v)) return Number(v);
  return NUMBER_WORDS[v] ?? null;
}

/** Remove the first match of `regex` from the working text and return it. */
function take(state, regex) {
  const m = regex.exec(state.text);
  if (!m) return null;
  state.text = `${state.text.slice(0, m.index)} ${state.text.slice(m.index + m[0].length)}`;
  return m;
}

function unitToMinutes(unit) {
  const u = unit.toLowerCase();
  if (u.startsWith('dag')) return 1440;
  if (u.startsWith('tim')) return 60;
  return 1;
}

function parseReminder(state) {
  const unit = '(minut(?:er)?|min|timm(?:e|ar)|dag(?:ar)?)';
  const m =
    take(state, re(`(?:och\\s+)?påminn(?:\\s+mig)?(?:\\s+om)?\\s+(${NUM})\\s+${unit}\\s+(?:innan|före|i\\s+förväg)`)) ||
    take(state, re(`(?:och\\s+|med\\s+)?(?:en\\s+)?påminnelse\\s+(${NUM})\\s+${unit}(?:\\s+(?:innan|före|i\\s+förväg))?`));
  if (!m) return undefined;
  return toNumber(m[1]) * unitToMinutes(m[2]);
}

function parseDaypart(state) {
  if (take(state, re('på\\s+morgonen|i\\s*morse|på\\s+förmiddagen|på\\s+morron|bitti'))) return 'am';
  if (take(state, re('på\\s+eftermiddagen|på\\s+kvällen|på\\s+kvällskvisten'))) return 'pm';
  if (take(state, re('på\\s+natten|i\\s*natt'))) return 'night';
  return null;
}

function parseDate(state, today) {
  let m;
  if (take(state, re('i\\s*övermorgon|övermorgon'))) return addDays(today, 2);
  if ((m = take(state, re('i\\s*(?:morgon|morn|morron)(?:\\s+(bitti))?')))) {
    if (m[1]) state.daypart = 'am';
    return addDays(today, 1);
  }
  if (take(state, re('i\\s*kväll'))) { state.daypart = 'pm'; return today; }
  if (take(state, re('i\\s*eftermiddag'))) { state.daypart = 'pm'; return today; }
  if (take(state, re('i\\s*förmiddag'))) { state.daypart = 'am'; return today; }
  if (take(state, re('i\\s*dag'))) return today;

  if ((m = take(state, re(`om\\s+(${NUM})\\s+(dag|dagar|vecka|veckor)`)))) {
    const n = toNumber(m[1]);
    return addDays(today, m[2].startsWith('veck') ? n * 7 : n);
  }

  const weekdayRe = `(?:(nästa|på)\\s+)?(${Object.keys(WEEKDAYS).join('|')})(?:en)?`;
  if ((m = take(state, re(weekdayRe)))) {
    const target = WEEKDAYS[m[2].toLowerCase()];
    let diff = (target - today.getDay() + 7) % 7 || 7;
    if (m[1] && m[1].toLowerCase() === 'nästa') {
      // "nästa fredag" = the Friday in next (Monday-based) week
      diff = 7 - ((today.getDay() + 6) % 7) + ((target + 6) % 7);
    }
    return addDays(today, diff);
  }
  if (take(state, re('nästa\\s+vecka'))) {
    return addDays(today, 7 - ((today.getDay() + 6) % 7));
  }

  if ((m = take(state, re('(\\d{4})-(\\d{2})-(\\d{2})')))) {
    return validDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  if ((m = take(state, re(`(?:den\\s+)?(\\d{1,2})(?::?e|:a)?\\s+(${MONTH_RE})\\.?(?:\\s+(\\d{4}))?`)))) {
    return futureDate(today, Number(m[1]), MONTHS[m[2].toLowerCase()], m[3] && Number(m[3]));
  }
  if ((m = take(state, re('(?:den\\s+)?(\\d{1,2})\\/(\\d{1,2})(?:\\/(\\d{2,4}))?')))) {
    let year = m[3] && Number(m[3]);
    if (year && year < 100) year += 2000;
    return futureDate(today, Number(m[1]), Number(m[2]) - 1, year);
  }
  if ((m = take(state, re('den\\s+(\\d{1,2})(?::?e|:a)')))) {
    const day = Number(m[1]);
    let d = validDate(today.getFullYear(), today.getMonth(), day);
    if (d && d < today) d = validDate(today.getFullYear(), today.getMonth() + 1, day);
    return d;
  }
  return null;
}

function validDate(y, month, day) {
  const d = new Date(y, month, day);
  // Reject overflow like 31 februari
  return d.getDate() === day ? d : null;
}

function futureDate(today, day, month, year) {
  if (year) return validDate(year, month, day);
  const d = validDate(today.getFullYear(), month, day);
  if (d && d < today) return validDate(today.getFullYear() + 1, month, day);
  return d;
}

/**
 * Turn a raw hour into a 24h hour, using the daypart when given. Returns
 * `ambiguous` options when an hour like "3" could mean 03:00 or 15:00.
 */
function resolveHour(hour, minute, { padded = false, daypart = null } = {}) {
  if (hour == null || hour > 24 || minute > 59) return null;
  if (hour === 24) hour = 0;
  if (hour >= 13 || hour === 0 || padded) return { hour, minute };
  if (daypart === 'am') return { hour, minute };
  if (daypart === 'pm') return { hour: hour === 12 ? 12 : hour + 12, minute };
  if (daypart === 'night') return { hour: hour >= 6 && hour < 12 ? hour + 12 : hour, minute };
  // 08–12 is almost always meant as daytime; 1–7 is genuinely ambiguous.
  if (hour >= 8) return { hour, minute };
  return {
    hour: hour <= 6 ? hour + 12 : hour,
    minute,
    ambiguous: [
      { hour, minute },
      { hour: hour + 12, minute },
    ],
  };
}

function parseTimeRange(state) {
  const m =
    take(state, re(`mellan\\s+(?:${KL})?${T}\\s+och\\s+(?:${KL})?${T}`)) ||
    take(state, re(`från\\s+(?:${KL})?${T}\\s+till\\s+(?:${KL})?${T}`)) ||
    take(state, re(`${KL}${T}\\s*(?:-|–|till)\\s*(?:${KL})?${T}`));
  if (!m) return null;
  return {
    start: { hour: Number(m[1]), minute: Number(m[2] || 0), padded: m[1].length === 2 && m[1][0] === '0' },
    end: { hour: Number(m[3]), minute: Number(m[4] || 0) },
  };
}

function parseTime(state) {
  let m;
  if ((m = take(state, re(`(?:(?:${KL}|vid\\s+))?(\\d{1,2})[:.](\\d{2})`)))) {
    return { hour: Number(m[1]), minute: Number(m[2]), padded: m[1].length === 2 && m[1][0] === '0' };
  }
  const minuteWords = '\\d{1,2}|fem|tio|tjugo|tjugofem';
  if ((m = take(state, re(`(?:${KL})?(?:(halv)|kvart\\s+(över|i)|(${minuteWords})\\s+(?:minuter\\s+)?(över|i))\\s+(${NUM})(?!\\s+(?:timm|minut|min))`)))) {
    const h = toNumber(m[5]);
    if (h == null) return null;
    let hour;
    let minute;
    if (m[1]) { hour = h - 1; minute = 30; }
    else if (m[2]) { hour = m[2].toLowerCase() === 'över' ? h : h - 1; minute = m[2].toLowerCase() === 'över' ? 15 : 45; }
    else {
      const n = toNumber(m[3]);
      if (m[4].toLowerCase() === 'över') { hour = h; minute = n; }
      else { hour = h - 1; minute = 60 - n; }
    }
    if (hour <= 0) hour += 12;
    return { hour, minute };
  }
  if ((m = take(state, re(`${KL}(${NUM})`)) || take(state, re('vid\\s+(\\d{1,2})')))) {
    return { hour: toNumber(m[1]), minute: 0, padded: m[1].length === 2 && m[1][0] === '0' };
  }
  return null;
}

function parseDuration(state) {
  const m = take(state, re(`i\\s+(en\\s+och\\s+en\\s+halv|en\\s+halv|\\d+[.,]\\d+|${NUM})\\s+(timm(?:e|ar)|minuter|min)`));
  if (!m) return null;
  const amount = m[1].toLowerCase().replace(/\s+/g, ' ');
  const value = amount === 'en och en halv' ? 1.5 : amount === 'en halv' ? 0.5 : toNumber(amount);
  if (value == null) return null;
  return Math.round(value * unitToMinutes(m[2]));
}

const LEADING_FILLER = new RegExp(
  '^(?:kan du|snälla|lägg till|lägg in|boka in|boka|skapa|schemalägg|jag har|jag ska|vi har|vi ska|' +
    'påminn mig om att|påminn mig att|påminn mig om|påminn mig|kom ihåg att|kom ihåg|notera|att|ett|en)\\s+',
  'iu',
);
const EDGE_WORDS = '(?:på|i|den|kl\\.?|klockan|om|till|vid|och|från|mellan|,|\\.|-)';
const LEADING_EDGE = new RegExp(`^${EDGE_WORDS}(?:\\s+|$)`, 'iu');
const TRAILING_EDGE = new RegExp(`(?:^|\\s+)${EDGE_WORDS}$`, 'iu');

function cleanTitle(text) {
  let t = text.replace(/\s+/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
  let prev;
  do {
    prev = t;
    t = t.replace(/[.,!?]+$/, '').trim();
    t = t.replace(LEADING_FILLER, '').replace(LEADING_EDGE, '').replace(TRAILING_EDGE, '').trim();
  } while (t !== prev);
  return t ? t[0].toUpperCase() + t.slice(1) : '';
}

/**
 * Parse free text into an event draft.
 *
 * @returns {{
 *   title: string, date: string|null, time: string|null, endTime: string|null,
 *   allDay: boolean, durationMinutes: number|null, reminderMinutes: number|undefined,
 *   ambiguousTimes: string[]|null, missing: string[]
 * }}
 */
export function parseEventText(input, now = new Date()) {
  const state = { text: ` ${input || ''} `, daypart: null };
  const today = startOfDay(now);

  const reminderMinutes = parseReminder(state);
  const allDay = !!take(state, re('hela\\s+dagen|heldag'));
  const daypart = parseDaypart(state);
  const date = parseDate(state, today);
  state.daypart = daypart || state.daypart;

  // Before times, so "kl 14 i en timme" isn't read as "14 minutes to one"
  const durationMinutes = parseDuration(state);
  let time = null;
  let endTime = null;
  let ambiguousTimes = null;
  const range = parseTimeRange(state);
  const raw = range ? range.start : parseTime(state);
  if (raw && !allDay) {
    const resolved = resolveHour(raw.hour, raw.minute, { padded: raw.padded, daypart: state.daypart });
    if (resolved) {
      time = fmt(resolved);
      if (resolved.ambiguous) ambiguousTimes = resolved.ambiguous.map(fmt);
      if (range) {
        let endHour = range.end.hour;
        // "mellan 3 och 5" -> keep the end on the same half of the day as the start
        if (endHour < 12 && resolved.hour >= 12 && endHour + 12 > resolved.hour) endHour += 12;
        if (endHour <= 24 && range.end.minute < 60) endTime = fmt({ hour: endHour % 24, minute: range.end.minute });
      }
    }
  }
  const title = cleanTitle(state.text);

  const missing = [];
  if (!title) missing.push('title');
  if (!date) missing.push('date');
  if (!time && !allDay) missing.push('time');

  return {
    title,
    date: date ? toDateKey(date) : null,
    time,
    endTime,
    allDay,
    durationMinutes,
    reminderMinutes,
    ambiguousTimes,
    missing,
  };
}

function fmt({ hour, minute }) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
