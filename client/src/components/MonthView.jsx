import React from 'react';
import { MONTH_NAMES, WEEKDAY_SHORT, monthGrid, sameDay, toDateKey } from '../lib/dates.js';
import { eventsForDay, formatEventTime } from '../lib/events.js';

const MAX_VISIBLE = 3;

export default function MonthView({ month, selected, events, onSelect, onOpenEvent, onPrev, onNext, onToday }) {
  const today = new Date();
  const days = monthGrid(month.getFullYear(), month.getMonth());

  return (
    <section className="month card" aria-label="Månadsvy">
      <header className="month__header">
        <h2>
          {MONTH_NAMES[month.getMonth()]} <span className="muted">{month.getFullYear()}</span>
        </h2>
        <div className="month__nav">
          <button type="button" className="btn btn--ghost" onClick={onToday}>Idag</button>
          <button type="button" className="icon-btn" onClick={onPrev} aria-label="Föregående månad">‹</button>
          <button type="button" className="icon-btn" onClick={onNext} aria-label="Nästa månad">›</button>
        </div>
      </header>

      <div className="month__grid" role="grid">
        {WEEKDAY_SHORT.map((d) => (
          <div key={d} className="month__weekday" role="columnheader">{d}</div>
        ))}
        {days.map((day) => {
          const key = toDateKey(day);
          const dayEvents = eventsForDay(events, day);
          const classes = [
            'day',
            day.getMonth() !== month.getMonth() && 'day--outside',
            sameDay(day, today) && 'day--today',
            key === selected && 'day--selected',
          ].filter(Boolean).join(' ');
          return (
            <div
              key={key}
              className={classes}
              role="gridcell"
              tabIndex={0}
              aria-selected={key === selected}
              aria-label={`${day.getDate()} ${MONTH_NAMES[day.getMonth()]}, ${dayEvents.length} händelser`}
              onClick={() => onSelect(key)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(key); } }}
            >
              <span className="day__number">{day.getDate()}</span>
              <div className="day__events">
                {dayEvents.slice(0, MAX_VISIBLE).map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    className={`event-chip ${ev.allDay ? 'event-chip--allday' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onOpenEvent(ev); }}
                    title={`${formatEventTime(ev)} ${ev.title}`}
                  >
                    {!ev.allDay && <span className="event-chip__time">{formatEventTime(ev).slice(0, 5)}</span>}
                    {ev.title}
                  </button>
                ))}
                {dayEvents.length > MAX_VISIBLE && (
                  <span className="day__more">+{dayEvents.length - MAX_VISIBLE} till</span>
                )}
              </div>
              {dayEvents.length > 0 && <span className="day__dots" aria-hidden="true">{'•'.repeat(Math.min(dayEvents.length, 3))}</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
