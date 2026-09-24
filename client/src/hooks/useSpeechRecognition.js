import { useCallback, useEffect, useRef, useState } from 'react';

const SpeechRecognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : undefined;

const ERROR_MESSAGES = {
  'not-allowed': 'Mikrofonen är blockerad. Tillåt mikrofonen i webbläsarens inställningar.',
  'service-not-allowed': 'Mikrofonen är blockerad. Tillåt mikrofonen i webbläsarens inställningar.',
  'audio-capture': 'Ingen mikrofon hittades.',
  network: 'Taligenkänningen kräver internetanslutning.',
};
// Errors after which restarting the microphone automatically is pointless
export const FATAL_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);

/**
 * Wraps the Web Speech API.
 *
 * - `start()` listens for one utterance; `onResult` gets it when listening ends.
 * - `start({ continuous: true })` keeps listening and calls `onResult` for
 *   every finished phrase as it arrives.
 * - `onEnd({ heard, error })` runs whenever a listening session ends.
 */
export function useSpeechRecognition({ lang = 'sv-SE', onResult, onEnd } = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);
  const pendingStartRef = useRef(null);
  const callbacks = useRef({});
  callbacks.current = { onResult, onEnd };

  useEffect(() => () => {
    pendingStartRef.current = null;
    recognitionRef.current?.abort();
  }, []);

  const start = useCallback(({ continuous = false } = {}) => {
    if (!SpeechRecognition) return;
    if (recognitionRef.current) {
      // Still shutting down: start again as soon as it has ended
      pendingStartRef.current = { continuous };
      recognitionRef.current.stop();
      return;
    }
    setError('');
    setInterim('');
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = continuous;
    let finalText = '';
    let handled = 0;
    let lastError = null;

    recognition.onresult = (event) => {
      let text = '';
      for (let i = handled; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          handled = i + 1;
          const phrase = result[0].transcript.trim();
          if (!phrase) continue;
          if (continuous) callbacks.current.onResult?.(phrase);
          else finalText = `${finalText} ${phrase}`.trim();
        } else {
          text += result[0].transcript;
        }
      }
      setInterim(text);
    };
    recognition.onerror = (event) => {
      lastError = event.error;
      if (ERROR_MESSAGES[event.error]) setError(ERROR_MESSAGES[event.error]);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setInterim('');
      const pending = pendingStartRef.current;
      pendingStartRef.current = null;
      if (finalText) callbacks.current.onResult?.(finalText);
      // A pending start replaces this session, so it isn't reported as ended
      if (pending) start(pending);
      else callbacks.current.onEnd?.({ heard: handled > 0, error: lastError });
    };

    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
    }
  }, [lang]);

  const stop = useCallback(() => {
    pendingStartRef.current = null;
    recognitionRef.current?.stop();
  }, []);

  return { supported: !!SpeechRecognition, listening, interim, error, start, stop };
}

/**
 * Read a short prompt aloud, if the browser can. `onDone` runs when speech
 * has finished (or right away when speech synthesis is unavailable).
 */
export function speak(text, { lang = 'sv-SE', onDone } = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    onDone?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    onDone?.();
  };
  utterance.onend = finish;
  utterance.onerror = finish;
  // Some browsers never fire onend; don't leave the conversation hanging.
  setTimeout(finish, 1500 + text.length * 90);
  window.speechSynthesis.speak(utterance);
}
