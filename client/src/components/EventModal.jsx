import React, { useEffect, useRef, useState } from 'react';
import { DEFAULT_REMINDER } from '../lib/events.js';
import { addMinutes, combine, formatTime } from '../lib/dates.js';

const REMINDER_OPTIONS = [
  ['none', 'Ingen'],
  ['0', 'När det börjar'],
  ['5', '5 minuter innan'],
  ['10', '10 minuter innan'],
  ['15', '15 minuter innan'],
  ['30', '30 minuter innan'],
  ['60', '1 timme innan'],
  ['120', '2 timmar innan'],
  ['1440', '1 dag innan'],
];

function initialState(values) {
  const reminder = values.reminderMinutes === undefined
    ? (values.allDay ? null : DEFAULT_REMINDER)
    : values.reminderMinutes;
  let endTime = values.endTime || '';
  if (!endTime && values.time && values.date) {
    endTime = formatTime(addMinutes(combine(values.date, values.time), values.durationMinutes || 60));
  }
  return {
    title: values.title || '',
    date: values.date || '',
    time: values.time || '',
    endTime,
    allDay: !!values.allDay,
    reminder: reminder == null ? 'none' : String(reminder),
    notes: values.notes || '',
  };
}

export default function EventModal({ values, isNew, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(() => initialState(values));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal?.();
    return () => dialog?.close?.();
  }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setError('Ange en titel.');
    if (!form.date) return setError('Välj en dag.');
    if (!form.allDay && !form.time) return setError('Ange en starttid eller välj heldag.');
    setBusy(true);
    setError('');
    try {
      await onSave({
        title: form.title,
        date: form.date,
        time: form.allDay ? null : form.time,
        endTime: form.allDay ? null : form.endTime || null,
        allDay: form.allDay,
        reminderMinutes: form.reminder === 'none' ? null : Number(form.reminder),
        notes: form.notes,
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Ta bort "${form.title}"?`)) return;
    setBusy(true);
    try {
      await onDelete();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
    >
      <form className="modal__body" onSubmit={submit}>
        <header className="modal__header">
          <h2>{isNew ? 'Ny händelse' : 'Redigera händelse'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Stäng">✕</button>
        </header>

        <label className="field">
          <span>Titel</span>
          <input value={form.title} onChange={(e) => set({ title: e.target.value })} autoFocus required maxLength={200} />
        </label>

        <div className="modal__row">
          <label className="field field--grow">
            <span>Dag</span>
            <input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} required />
          </label>
          <label className="field field--check">
            <input type="checkbox" checked={form.allDay} onChange={(e) => set({ allDay: e.target.checked })} />
            <span>Heldag</span>
          </label>
        </div>

        {!form.allDay && (
          <div className="modal__row">
            <label className="field field--grow">
              <span>Start</span>
              <input type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} required />
            </label>
            <label className="field field--grow">
              <span>Slut</span>
              <input type="time" value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} />
            </label>
          </div>
        )}

        <label className="field">
          <span>Påminnelse</span>
          <select value={form.reminder} onChange={(e) => set({ reminder: e.target.value })}>
            {REMINDER_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>

        <label className="field">
          <span>Anteckningar</span>
          <textarea rows={3} value={form.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={5000} />
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}

        <footer className="modal__footer">
          {!isNew && (
            <button type="button" className="btn btn--danger" onClick={remove} disabled={busy}>Ta bort</button>
          )}
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>Avbryt</button>
          <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Sparar…' : 'Spara'}</button>
        </footer>
      </form>
    </dialog>
  );
}
