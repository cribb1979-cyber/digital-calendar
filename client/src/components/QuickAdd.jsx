import React, { useRef, useState } from 'react';
import { parseEventText } from '../lib/parser.js';
import { describeWhen } from '../lib/events.js';
import { formatReminder, toDateKey, addDays } from '../lib/dates.js';
import { speak, useSpeechRecognition } from '../hooks/useSpeechRecognition.js';

const EXAMPLES = [
  'Tandläkare på fredag klockan 3',
  'Möte med Anna imorgon 14:30 i en timme',
  'Ring mamma ikväll kl 7, påminn mig 10 minuter innan',
];

/** The first thing we still need to ask about, as a question. */
function questionFor(draft) {
  if (!draft) return null;
  if (draft.ambiguousTimes) {
    const [a, b] = draft.ambiguousTimes;
    return { key: 'ambiguous', text: `Menar du klockan ${a} eller ${b}?` };
  }
  if (!draft.title) return { key: 'title', text: 'Vad gäller det?' };
  if (!draft.date) return { key: 'date', text: 'Vilken dag?' };
  if (!draft.time && !draft.allDay) return { key: 'time', text: 'Vilken tid? Eller är det en heldag?' };
  return null;
}

/** Merge a spoken or typed follow-up answer into the draft. */
function applyAnswer(draft, answer) {
  const text = answer.trim();
  const next = { ...draft };
  const question = questionFor(draft);

  if (question?.key === 'ambiguous') {
    const [early, late] = draft.ambiguousTimes;
    if (/eftermiddag|kväll|em\b|sen/i.test(text)) next.time = late;
    else if (/morgon|förmiddag|natt|fm\b|tidig/i.test(text)) next.time = early;
    else {
      const p = parseEventText(/^\d{1,2}([:.]\d{2})?$/.test(text) ? `kl ${text}` : text);
      if (p.time && draft.ambiguousTimes.includes(p.time)) next.time = p.time;
      else if (p.ambiguousTimes) return draft;
      else if (p.time) next.time = p.time;
      else return draft;
    }
    next.ambiguousTimes = null;
    return next;
  }
  if (question?.key === 'title') {
    next.title = text[0].toUpperCase() + text.slice(1);
    return next;
  }

  const p = parseEventText(/^\d{1,2}([:.]\d{2})?$/.test(text) ? `kl ${text}` : text);
  if (!next.date && p.date) next.date = p.date;
  if (!next.time && !next.allDay) {
    if (p.allDay) next.allDay = true;
    else if (p.time) {
      next.time = p.time;
      next.ambiguousTimes = p.ambiguousTimes;
      next.endTime = p.endTime;
    }
  }
  return next;
}

export default function QuickAdd({ onSave, onMoreDetails }) {
  const [text, setText] = useState('');
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [usedVoice, setUsedVoice] = useState(false);

  // True while a hands-free voice dialog is running: after each spoken
  // question we start listening again automatically, so no extra taps.
  const conversationRef = useRef(false);
  const silenceCountRef = useRef(0);

  const promptFor = (d) => {
    const q = questionFor(d);
    return q ? q.text : `${d.title}, ${describeWhen(d)}. Säg spara eller avbryt.`;
  };

  const endConversation = () => {
    conversationRef.current = false;
    silenceCountRef.current = 0;
  };

  // Speak, then listen for the answer
  const ask = (prompt) => {
    conversationRef.current = true;
    speak(prompt, {
      // Short pause so the microphone doesn't pick up the end of the prompt
      onDone: () => setTimeout(() => conversationRef.current && speech.start(), 300),
    });
  };

  const updateDraft = (next, voice, prefix = '') => {
    setDraft(next);
    if (voice) ask(prefix + promptFor(next));
  };

  const interpret = (value, voice = false) => {
    if (!value.trim()) return;
    setUsedVoice(voice);
    updateDraft(parseEventText(value), voice);
  };

  const handleVoice = (transcript) => {
    silenceCountRef.current = 0;
    setText(transcript);
    const said = transcript.trim().replace(/[.!]$/, '');
    if (draft) {
      if (/^(spara|ja|okej|ok|lägg in det|stämmer|spara det)$/i.test(said)) {
        const q = questionFor(draft);
        if (q) ask(q.text);
        else save();
        return;
      }
      if (/^(avbryt|nej|glöm det|stopp)$/i.test(said)) {
        reset();
        speak('Avbrutet.');
        return;
      }
      const next = applyAnswer(draft, transcript);
      updateDraft(next, true, next === draft ? 'Jag förstod inte. ' : '');
      return;
    }
    interpret(transcript, true);
  };

  const handleSilence = () => {
    if (!conversationRef.current || !draft) return;
    silenceCountRef.current += 1;
    if (silenceCountRef.current === 1) {
      ask(`Jag hörde inget. ${promptFor(draft)}`);
    } else {
      endConversation();
      speak('Jag slutar lyssna. Tryck på mikrofonen för att fortsätta.');
    }
  };

  const speech = useSpeechRecognition({ onFinal: handleVoice, onSilence: handleSilence });

  const toggleMic = () => {
    if (speech.listening) {
      endConversation();
      speech.stop();
    } else {
      window.speechSynthesis?.cancel();
      speech.start();
    }
  };

  const reset = () => {
    endConversation();
    setDraft(null);
    setText('');
  };

  const save = async () => {
    if (!draft || questionFor(draft)) return;
    setSaving(true);
    try {
      await onSave(draft);
      if (usedVoice) speak(`Sparat. ${draft.title}, ${describeWhen(draft)}.`);
      reset();
    } catch {
      if (conversationRef.current) {
        endConversation();
        speak('Det gick inte att spara.');
      }
    } finally {
      setSaving(false);
    }
  };

  const question = questionFor(draft);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const today = new Date();

  return (
    <section className="quick-add card" aria-label="Snabbinmatning">
      <form
        className="quick-add__bar"
        onSubmit={(e) => {
          e.preventDefault();
          interpret(text);
        }}
      >
        <button
          type="button"
          className={`mic ${speech.listening ? 'mic--on' : ''}`}
          onClick={toggleMic}
          disabled={!speech.supported}
          title={speech.supported ? 'Tala in en händelse' : 'Röstinmatning stöds inte i den här webbläsaren'}
          aria-label={speech.listening ? 'Sluta lyssna' : 'Tala in en händelse'}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
          </svg>
        </button>
        <input
          className="quick-add__input"
          value={speech.listening ? speech.interim : text}
          onChange={(e) => setText(e.target.value)}
          placeholder={speech.listening ? 'Lyssnar…' : 'Säg eller skriv t.ex. "Tandläkare på fredag klockan 3"'}
          aria-label="Beskriv händelsen"
        />
        <button type="submit" className="btn btn--primary" disabled={!text.trim() || speech.listening}>
          Tolka
        </button>
      </form>

      {speech.error && <p className="quick-add__error">{speech.error}</p>}
      {!speech.supported && (
        <p className="quick-add__hint">Röstinmatning fungerar i Chrome, Edge och Safari. Du kan alltid skriva istället.</p>
      )}

      {!draft && (
        <div className="quick-add__examples">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="chip" onClick={() => { setText(ex); interpret(ex); }}>
              {ex}
            </button>
          ))}
        </div>
      )}

      {draft && (
        <div className="draft">
          {question && (
            <div className="draft__question" role="status">
              <strong>{question.text}</strong>
              {question.key === 'ambiguous' && (
                <div className="draft__choices">
                  {draft.ambiguousTimes.map((t) => (
                    <button key={t} type="button" className="btn" onClick={() => set({ time: t, ambiguousTimes: null })}>
                      {t}
                    </button>
                  ))}
                </div>
              )}
              {question.key === 'date' && (
                <div className="draft__choices">
                  <button type="button" className="btn" onClick={() => set({ date: toDateKey(today) })}>Idag</button>
                  <button type="button" className="btn" onClick={() => set({ date: toDateKey(addDays(today, 1)) })}>Imorgon</button>
                </div>
              )}
              {question.key === 'time' && (
                <div className="draft__choices">
                  <button type="button" className="btn" onClick={() => set({ allDay: true })}>Heldag</button>
                </div>
              )}
              {speech.supported && (
                <span className="draft__voice-hint">
                  {speech.listening ? 'Lyssnar – svara med rösten.' : 'Du kan svara med rösten.'}
                </span>
              )}
            </div>
          )}

          <div className="draft__fields">
            <label className="field field--grow">
              <span>Titel</span>
              <input value={draft.title} onChange={(e) => set({ title: e.target.value })} />
            </label>
            <label className="field">
              <span>Dag</span>
              <input type="date" value={draft.date || ''} onChange={(e) => set({ date: e.target.value || null })} />
            </label>
            <label className="field">
              <span>Tid</span>
              <input
                type="time"
                value={draft.time || ''}
                disabled={draft.allDay}
                onChange={(e) => set({ time: e.target.value || null, ambiguousTimes: null })}
              />
            </label>
            <label className="field field--check">
              <input
                type="checkbox"
                checked={draft.allDay}
                onChange={(e) => set({ allDay: e.target.checked, ambiguousTimes: null })}
              />
              <span>Heldag</span>
            </label>
          </div>

          {!question && (
            <p className="draft__summary">
              <strong>{draft.title}</strong> · {describeWhen(draft)} ·{' '}
              {formatReminder(draft.reminderMinutes === undefined ? (draft.allDay ? null : 15) : draft.reminderMinutes)}
            </p>
          )}

          <div className="draft__actions">
            <button type="button" className="btn btn--primary" onClick={save} disabled={!!question || saving}>
              {saving ? 'Sparar…' : 'Spara'}
            </button>
            <button type="button" className="btn" onClick={() => { onMoreDetails(draft); reset(); }}>
              Fler detaljer
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => { reset(); window.speechSynthesis?.cancel(); speech.stop(); }}>Avbryt</button>
          </div>
        </div>
      )}
    </section>
  );
}
