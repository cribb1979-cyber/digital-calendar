import React, { useCallback, useEffect, useState } from 'react';
import QuickAdd from './components/QuickAdd.jsx';
import MonthView from './components/MonthView.jsx';
import DayPanel from './components/DayPanel.jsx';
import EventModal from './components/EventModal.jsx';
import Toasts from './components/Toasts.jsx';
import { api } from './lib/api.js';
import { buildEventPayload, eventToValues } from './lib/events.js';
import { fromDateKey, toDateKey } from './lib/dates.js';
import { useReminders } from './hooks/useReminders.js';

let toastId = 0;

export default function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(() => toDateKey(new Date()));
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  // { values, event? } while the edit dialog is open
  const [editing, setEditing] = useState(null);
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((kind, title, body) => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, kind, title, body }]);
    if (kind !== 'reminder') setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  const load = useCallback(async () => {
    try {
      setEvents(await api.list());
    } catch (err) {
      toast('error', 'Kunde inte hämta kalendern', err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const onRemind = useCallback((ev, body) => toast('reminder', `🔔 ${ev.title}`, body), [toast]);
  const { permission, requestPermission } = useReminders(events, onRemind);

  const selectDay = (key) => {
    setSelected(key);
    const d = fromDateKey(key);
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const create = async (values) => {
    try {
      const created = await api.create(buildEventPayload(values));
      setEvents((list) => [...list, created]);
      selectDay(values.date);
      toast('success', 'Händelsen är sparad', created.title);
    } catch (err) {
      toast('error', 'Kunde inte spara', err.message);
      throw err;
    }
  };

  const saveFromModal = async (values) => {
    const payload = buildEventPayload(values);
    if (editing.event) {
      const updated = await api.update(editing.event.id, payload);
      setEvents((list) => list.map((e) => (e.id === updated.id ? updated : e)));
      selectDay(values.date);
      toast('success', 'Ändringarna är sparade', updated.title);
    } else {
      await create(values);
    }
    setEditing(null);
  };

  const removeEvent = async () => {
    await api.remove(editing.event.id);
    setEvents((list) => list.filter((e) => e.id !== editing.event.id));
    toast('success', 'Händelsen är borttagen', editing.event.title);
    setEditing(null);
  };

  return (
    <div className="app">
      <header className="app__header">
        <div className="brand">
          <span className="brand__logo" aria-hidden="true">📅</span>
          <div>
            <h1>Digital kalender</h1>
            <p className="muted">Säg vad du ska göra – kalendern sköter resten.</p>
          </div>
        </div>
        {permission === 'default' && (
          <button type="button" className="btn" onClick={requestPermission}>🔔 Aktivera påminnelser</button>
        )}
        {permission === 'denied' && (
          <p className="muted small">Notiser är blockerade – påminnelser visas bara i appen.</p>
        )}
      </header>

      <QuickAdd onSave={create} onMoreDetails={(draft) => setEditing({ values: draft })} />

      <main className="layout">
        <MonthView
          month={month}
          selected={selected}
          events={events}
          onSelect={setSelected}
          onOpenEvent={(ev) => setEditing({ event: ev, values: eventToValues(ev) })}
          onPrev={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          onNext={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          onToday={() => selectDay(toDateKey(new Date()))}
        />
        <DayPanel
          selected={selected}
          events={events}
          onNew={() => setEditing({ values: { date: selected, time: '09:00' } })}
          onOpen={(ev) => setEditing({ event: ev, values: eventToValues(ev) })}
        />
      </main>

      {loading && <p className="muted center">Laddar…</p>}

      {editing && (
        <EventModal
          values={editing.values}
          isNew={!editing.event}
          onSave={saveFromModal}
          onDelete={removeEvent}
          onClose={() => setEditing(null)}
        />
      )}

      <Toasts toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  );
}
