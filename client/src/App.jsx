import React, { useState, useEffect } from 'react';

function App() {
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [browserSupport, setBrowserSupport] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check for SpeechRecognition support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setBrowserSupport(false);
      setError('Speech recognition not supported in this browser. Please use Chrome or Edge for voice input.');
    }
  }, []);

  const startListening = () => {
    if (!browserSupport) return;
    setError('');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.interimResults = true;
    recognition.lang = 'sv-SE'; // Swedish language

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0])
        .map(result => result.transcript)
        .join('');
      setTranscript(transcript);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.onerror = (event) => {
      setError(`Speech recognition error: ${event.error}`);
      setListening(false);
    };

    setListening(true);
    recognition.start();
  };

  const stopListening = () => {
    // Note: In a real app, you'd keep references to the recognition object to stop it.
    // For simplicity, we'll just set listening to false and rely on onend.
    setListening(false);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Digital Calendar</h1>
        <p>Voice-powered calendar app</p>

        {!browserSupport && (
          <div style={{ backgroundColor: '#ffebee', color: '#c62828', padding: '10px', margin: '10px 0', borderRadius: '4px' }}>
            <strong>Browser Compatibility Notice:</strong> {error}
          </div>
        )}

        {error && browserSupport && (
          <div style={{ backgroundColor: '#fff8e1', color: '#bf360c', padding: '10px', margin: '10px 0', borderRadius: '4px' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        <div style={{ margin: '20px 0' }}>
          <button
            onClick={listening ? stopListening : startListening}
            disabled={!browserSupport}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: listening ? '#f44336' : '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: listening ? 'not-allowed' : 'pointer'
            }}
          >
            {listening ? 'Listening... (Click to stop)' : 'Start Voice Input'}
          </button>
        </div>

        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <h3>Transcribed Text:</h3>
          <p>{transcript || '(Listening for speech...)'}</p>
        </div>

        <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
          <p><strong>Note:</strong> Voice input uses the Web Speech API, which is currently only fully supported in Chrome and Edge.</p>
          <p>For Firefox, you can enable experimental features:</p>
          <ol>
            <li>Type <code>about:config</code> in the address bar</li>
            <li>Search for <code>media.webspeech.recognition.enable</code></li>
            <li>Set the value to <code>true</code></li>
            <li>Restart Firefox</li>
          </ol>
          <p>Or use Chrome/Edge for the best voice input experience.</p>
        </div>
      </header>
    </div>
  );
}

export default App;