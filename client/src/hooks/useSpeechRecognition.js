import { useCallback, useEffect, useRef, useState } from 'react';

const SpeechRecognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : undefined;

const ERROR_MESSAGES = {
  'not-allowed': 'Mikrofonen är blockerad. Tillåt mikrofonen i webbläsarens inställningar.',
  'service-not-allowed': 'Mikrofonen är blockerad. Tillåt mikrofonen i webbläsarens inställningar.',
  'no-speech': 'Jag hörde inget. Försök igen.',
  'audio-capture': 'Ingen mikrofon hittades.',
  network: 'Taligenkänningen kräver internetanslutning.',
};

/** Wraps the Web Speech API. `onFinal` is called with the final transcript. */
export function useSpeechRecognition({ lang = 'sv-SE', onFinal } = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

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
      if (event.error !== 'aborted') setError(ERROR_MESSAGES[event.error] || `Fel vid taligenkänning: ${event.error}`);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setInterim('');
      if (finalText.trim()) onFinalRef.current?.(finalText.trim());
    };

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [lang]);

  const stop = useCallback(() => recognitionRef.current?.stop(), []);

  return { supported: !!SpeechRecognition, listening, interim, error, start, stop };
}

/** Read a short prompt aloud, if the browser can. */
export function speak(text, lang = 'sv-SE') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  window.speechSynthesis.speak(utterance);
}
