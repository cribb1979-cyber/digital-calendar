import React, { useEffect, useRef, useState } from 'react';
import { parseEventText } from '../lib/parser.js';
import { describeWhen } from '../lib/events.js';
import { formatReminder, toDateKey, addDays } from '../lib/dates.js';
import { FATAL_ERRORS, speak, useSpeechRecognition } from '../hooks/useSpeechRecognition.js';

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

// "Kalender, tandläkare på fredag" - the wake word may come with the command
const WAKE_RE = /(?:^|\s)(?:hej\s+|hallå\s+|ok(?:ej)?\s+)?kalender(?:n)?[\s,.!:]*(.*)$/i;

export default function QuickAdd({ onSave, onMoreDetails }) {
  const [text, setText] = useState('');
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [usedVoice, setUsedVoice] = useState(false);
  const [handsFree, setHandsFree] = useState(false);

  // Voice state lives in refs because speech callbacks fire outside renders.
  const handsFreeRef = useRef(false);
  // 'wake': listening for the wake word, 'dialog': waiting for an answer
  const modeRef = useRef(null);
  // True while a voice dialog is running: after each spoken question we
  // listen again automatically, so no extra taps are needed.
  const conversationRef = useRef(false);
  const speakingRef = useRef(false);
  const silenceCountRef = useRef(0);
  const wakeLockRef = useRef(null);

  const promptFor = (d) => {
    if (!d) return 'Vad vill du lägga in?';
    const q = questionFor(d);
    return q ? q.text : `${d.title}, ${describeWhen(d)}. Säg spara eller avbryt.`;
  };

  const endConversation = () => {
    conversationRef.current = false;
    silenceCountRef.current = 0;
  };

  const listenForAnswer = () => {
    modeRef.current = 'dialog';
    speech.start();
  };

  const listenForWakeWord = () => {
    if (!handsFreeRef.current || conversationRef.current || speakingRef.current) return;
    modeRef.current = 'wake';
    speech.start({ continuous: true });
  };

  // Speak, then listen for the answer (in a dialog) or for the wake word
  const say = (prompt) => {
    speakingRef.current = true;
    speech.stop();
    speak(prompt, {
      onDone: () => {
        // Short pause so the microphone doesn't pick up the end of the prompt
        setTimeout(() => {
          speakingRef.current = false;
          if (conversationRef.current) listenForAnswer();
          else listenForWakeWord();
        }, 300);
      },
    });
  };

  const ask = (prompt) => {
    conversationRef.current = true;
    say(prompt);
  };

  // End the dialog with a last message
  const finish = (message) => {
    endConversation();
    say(message);
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
    if (/^(avbryt|nej|glöm det|stopp)$/i.test(said)) {
      reset();
      finish('Avbrutet.');
      return;
    }
    if (draft) {
      if (/^(spara|ja|okej|ok|lägg in det|stämmer|spara det)$/i.test(said)) {
        const q = questionFor(draft);
        if (q) ask(q.text);
        else save();
        return;
      }
      const next = applyAnswer(draft, transcript);
      updateDraft(next, true, next === draft ? 'Jag förstod inte. ' : '');
      return;
    }
    interpret(transcript, true);
  };

  const handleResult = (transcript) => {
    if (modeRef.current !== 'wake') {
      handleVoice(transcript);
      return;
    }
    const m = WAKE_RE.exec(transcript);
    if (!m) return; // not for us - keep listening
    setUsedVoice(true);
    const command = m[1].trim();
    if (command) handleVoice(command);
    else ask(draft ? promptFor(draft) : 'Ja?');
  };

  const handleSilence = () => {
    if (!conversationRef.current) {
      listenForWakeWord();
      return;
    }
    silenceCountRef.current += 1;
    if (silenceCountRef.current === 1) {
      ask(`Jag hörde inget. ${promptFor(draft)}`);
    } else {
      finish(handsFreeRef.current
        ? 'Jag väntar. Säg kalender när du behöver mig.'
        : 'Jag slutar lyssna. Tryck på mikrofonen för att fortsätta.');
    }
  };

  const handleEnd = ({ heard, error }) => {
    if (speakingRef.current) return;
    if (FATAL_ERRORS.has(error)) {
      endConversation();
      stopHandsFree();
      return;
    }
    if (modeRef.current === 'dialog') {
      if (!heard) handleSilence();
      return;
    }
    if (modeRef.current === 'wake' && !conversationRef.current) {
      // Browsers end continuous listening now and then; just start again.
      // Back off a little after errors (e.g. network) to avoid a tight loop.
      setTimeout(listenForWakeWord, error && error !== 'no-speech' ? 2000 : 250);
    }
  };

  const speech = useSpeechRecognition({ onResult: handleResult, onEnd: handleEnd });

  const acquireWakeLock = async () => {
    try {
      wakeLockRef.current = await navigator.wakeLock?.request('screen');
    } catch {
      // Not supported or denied - the screen may turn off
    }
  };

  const startHandsFree = () => {
    handsFreeRef.current = true;
    setHandsFree(true);
    acquireWakeLock();
    say('Handsfree är på. Säg kalender och vad du vill lägga in.');
  };

  function stopHandsFree() {
    handsFreeRef.current = false;
    setHandsFree(false);
    modeRef.current = null;
    speech.stop();
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }

  // The screen lock and microphone are dropped when the tab is hidden;
  // pick them up again when it comes back.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !handsFreeRef.current) return;
      acquireWakeLock();
      if (!conversationRef.current) listenForWakeWord();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  });

  const toggleMic = () => {
    window.speechSynthesis?.cancel();
    speakingRef.current = false;
    if (speech.listening && modeRef.current === 'dialog') {
      endConversation();
      speech.stop();
    } else {
      listenForAnswer();
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
      if (usedVoice) finish(`Sparat. ${draft.title}, ${describeWhen(draft)}.`);
      reset();
    } catch {
      if (conversationRef.current) finish('Det gick inte att spara.');
    } finally {
      setSaving(false);
    }
  };

  const wakeListening = handsFree && speech.listening && modeRef.current === 'wake';
  const dialogListening = speech.listening && modeRef.current === 'dialog';

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
          className={`mic ${dialogListening ? 'mic--on' : ''}`}
          onClick={toggleMic}
          disabled={!speech.supported}
          title={speech.supported ? 'Tala in en händelse' : 'Röstinmatning stöds inte i den här webbläsaren'}
          aria-label={dialogListening ? 'Sluta lyssna' : 'Tala in en händelse'}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
          </svg>
        </button>
        <input
          className="quick-add__input"
          value={dialogListening ? speech.interim : text}
          onChange={(e) => setText(e.target.value)}
          placeholder={dialogListening
            ? 'Lyssnar…'
            : handsFree
              ? 'Säg "Kalender, …" eller skriv här'
              : 'Säg eller skriv t.ex. "Tandläkare på fredag klockan 3"'}
          aria-label="Beskriv händelsen"
        />
        <button type="submit" className="btn btn--primary" disabled={!text.trim() || dialogListening}>
          Tolka
        </button>
      </form>

      {speech.supported && (
        <div className="handsfree">
          <button
            type="button"
            className={`btn handsfree__toggle ${handsFree ? 'handsfree__toggle--on' : ''}`}
            onClick={handsFree ? stopHandsFree : startHandsFree}
            aria-pressed={handsFree}
          >
            🚗 Handsfree {handsFree ? 'på' : 'av'}
          </button>
          <span className="handsfree__status">
            {handsFree ? (
              <>
                {wakeListening && <span className="handsfree__dot" aria-hidden="true" />}
                {wakeListening ? 'Lyssnar efter ”Kalender”…' : 'Handsfree är på.'} Säg t.ex. ”Kalender, tandläkare på fredag klockan 3”.
              </>
            ) : (
              'Slå på för att styra helt med rösten, t.ex. i bilen.'
            )}
          </span>
        </div>
      )}

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
                  {dialogListening ? 'Lyssnar – svara med rösten.' : 'Du kan svara med rösten.'}
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
