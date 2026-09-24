import React from 'react';

export default function Toasts({ toasts, onDismiss }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
          <div>
            <strong>{t.title}</strong>
            {t.body && <p>{t.body}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={() => onDismiss(t.id)} aria-label="Stäng">✕</button>
        </div>
      ))}
    </div>
  );
}
