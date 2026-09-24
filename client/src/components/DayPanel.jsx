import React from 'react';
import { formatDateRelative, fromDateKey } from '../lib/dates.js';
import { eventsForDay, formatEventTime, upcomingEvents } from '../lib/events.js';

function EventRow({ ev, onOpen, showDate }) {
  return (
    <li>
      <button type="button" className="event-row" onClick={() => onOpen(ev)}>
        <span className="event-row__time">{formatEventTime(ev)}</span>
        <span className="event-row__title">{ev.title}</span>
        {showDate && <span className="event-row__date">{formatDateRelative(new Date(ev.start))}</span>}
        {ev.reminderMinutes != null && <span className="event-row__bell" title="Påminnelse" aria-label="Har påminnelse">🔔</span>}
      </button>
    </li>
  );
}

export default function DayPanel({ selected, events, onNew, onOpen }) {
  const day = fromDateKey(selected);
  const dayEvents = eventsForDay(events, day);
  const upcoming = upcomingEvents(events);
  const label = formatDateRelative(day);

  return (
    <aside className="side">
      <section className="card">
        <header className="side__header">
          <h2>{label[0].toUpperCase() + label.slice(1)}</h2>
          <button type="button" className="btn btn--primary" onClick={onNew}>+ Ny</button>
        </header>
        {dayEvents.length === 0 ? (
          <p className="muted empty">Inga händelser den här dagen.</p>
        ) : (
          <ul className="event-list">
            {dayEvents.map((ev) => <EventRow key={ev.id} ev={ev} onOpen={onOpen} />)}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="side__title">Kommande</h2>
        {upcoming.length === 0 ? (
          <p className="muted empty">Inget inplanerat.</p>
        ) : (
          <ul className="event-list">
            {upcoming.map((ev) => <EventRow key={ev.id} ev={ev} onOpen={onOpen} showDate />)}
          </ul>
        )}
      </section>
    </aside>
  );
}
