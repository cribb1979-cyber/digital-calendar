import { addDays, addMinutes, combine, formatDateRelative, formatTime, fromDateKey, startOfDay, toDateKey } from './dates.js';

export const DEFAULT_DURATION = 60;
export const DEFAULT_REMINDER = 15;

/** Events that overlap the given local day, sorted with all-day first. */
export function eventsForDay(events, day) {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  return events
    .filter((ev) => {
      const start = new Date(ev.start);
      const end = ev.end ? new Date(ev.end) : start;
      if (start >= dayEnd) return false;
      return end > dayStart || (end.getTime() === start.getTime() && start >= dayStart);
    })
    .sort((a, b) => (b.allDay - a.allDay) || a.start.localeCompare(b.start));
}

export function upcomingEvents(events, now = new Date(), limit = 5) {
  return events
    .filter((ev) => new Date(ev.end || ev.start) >= (ev.allDay ? startOfDay(now) : now))
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, limit);
}

/**
 * Turn form/draft values into an API payload.
 * values: { title, date, time, endTime, allDay, durationMinutes, reminderMinutes, notes }
 */
export function buildEventPayload(values) {
  const reminderMinutes = values.reminderMinutes === undefined
    ? (values.allDay ? null : DEFAULT_REMINDER)
    : values.reminderMinutes;

  if (values.allDay) {
    return {
      title: values.title.trim(),
      start: combine(values.date).toISOString(),
      end: null,
      allDay: true,
      reminderMinutes,
      notes: values.notes || '',
    };
  }
  const start = combine(values.date, values.time);
  let end;
  if (values.endTime) {
    end = combine(values.date, values.endTime);
    if (end <= start) end = addDays(end, 1);
  } else {
    end = addMinutes(start, values.durationMinutes || DEFAULT_DURATION);
  }
  return {
    title: values.title.trim(),
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: false,
    reminderMinutes,
    notes: values.notes || '',
  };
}

/** Form values for an existing event. */
export function eventToValues(ev) {
  const start = new Date(ev.start);
  const end = ev.end ? new Date(ev.end) : null;
  return {
    title: ev.title,
    date: toDateKey(start),
    time: ev.allDay ? '' : formatTime(start),
    endTime: !ev.allDay && end ? formatTime(end) : '',
    allDay: ev.allDay,
    reminderMinutes: ev.reminderMinutes,
    notes: ev.notes || '',
  };
}

export function formatEventTime(ev) {
  if (ev.allDay) return 'Heldag';
  const start = new Date(ev.start);
  return ev.end ? `${formatTime(start)}–${formatTime(new Date(ev.end))}` : formatTime(start);
}

/** "fredag 25 september kl 15:00–16:00" for a draft. */
export function describeWhen({ date, time, endTime, allDay, durationMinutes }, now = new Date()) {
  if (!date) return '';
  const day = formatDateRelative(fromDateKey(date), now);
  if (allDay) return `${day}, hela dagen`;
  if (!time) return day;
  const end = endTime || formatTime(addMinutes(combine(date, time), durationMinutes || DEFAULT_DURATION));
  return `${day} kl ${time}–${end}`;
}
