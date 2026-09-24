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

/**
 * Wraps the Web Speech API. `onFinal` is called with the final transcript;
 * `onSilence` when a listening session ends without any speech.
 */
export function useSpeechRecognition({ lang = 'sv-SE', onFinal, onSilence } = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;
  const onSilenceRef = useRef(onSilence);
  onSilenceRef.current = onSilence;

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const start = useCallback(() => {
    if (!SpeechRecognition || recognitionRef.current) return;
    setError('');
    setInterim('');
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;
    let finalText = '';

    recognition.onresult = (event) => {
      let text = '';
      for (const result of event.results) {
        text += result[0].transcript;
        if (result.isFinal) finalText = text;
      }
      setInterim(text);
    };
    recognition.onerror = (event) => {
      // Silence is reported through onSilence instead
      if (event.error !== 'aborted' && event.error !== 'no-speech') setError(ERROR_MESSAGES[event.error] || `Fel vid taligenkänning: ${event.error}`);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setInterim('');
      if (finalText.trim()) onFinalRef.current?.(finalText.trim());
      else onSilenceRef.current?.();
    };

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [lang]);

  const stop = useCallback(() => recognitionRef.current?.stop(), []);

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
