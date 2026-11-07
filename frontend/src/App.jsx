import { useEffect, useMemo, useRef, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const WELCOME = { role: 'assistant', content: 'नमस्ते! मैं JARVIS हूँ। बताइए, मैं आपकी क्या मदद करूँ?' };

function makeSessionId() {
  try {
    let id = window.localStorage.getItem('jarvis_session_id');
    if (!id) {
      id = globalThis.crypto?.randomUUID?.() || 'jarvis-' + Date.now();
      window.localStorage.setItem('jarvis_session_id', id);
    }
    return id;
  } catch {
    return 'jarvis-' + Date.now();
  }
}

export default function App() {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = window.localStorage.getItem('jarvis_chat_history');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) && parsed.length ? parsed.slice(-100) : [WELCOME];
    } catch { return [WELCOME]; }
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(false);
  const [error, setError] = useState('');
  const sessionId = useMemo(makeSessionId, []);
  const listRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    try { window.localStorage.setItem('jarvis_chat_history', JSON.stringify(messages.slice(-100))); }
    catch { setError('फोन की स्टोरेज में जगह कम है; चैट सेव नहीं हो पाई।'); }
  }, [messages]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isLoading]);

  useEffect(() => () => {
    try { recognitionRef.current?.stop(); } catch {}
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  const speak = (text) => {
    if (!speakReplies || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = /[\u0900-\u097F]/.test(text) ? 'hi-IN' : 'en-IN';
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  };

  const sendMessage = async (rawMessage) => {
    const trimmed = rawMessage.trim();
    if (!trimmed || isLoading) return;
    setError('');
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: trimmed })
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      const reply = data.reply || 'मुझे जवाब नहीं मिला। कृपया फिर कोशिश करें।';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      speak(reply);
    } catch {
      setError('JARVIS सर्वर से कनेक्शन नहीं हो पाया। इंटरनेट और backend सेटिंग जाँचें।');
      setMessages(prev => [...prev, { role: 'assistant', content: 'अभी AI सर्वर से संपर्क नहीं हो पा रहा है। सर्वर जुड़ने के बाद मैं जवाब दे पाऊँगा। आपकी चैट फोन में सुरक्षित है।' }]);
    } finally { setIsLoading(false); }
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('इस ब्राउज़र में आवाज़ पहचान उपलब्ध नहीं है। Chrome में माइक्रोफोन अनुमति देकर कोशिश करें।');
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = event => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      setInput(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => {
      setError('आवाज़ सुनने में समस्या आई। माइक्रोफोन अनुमति जाँचें।');
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    try { recognition.start(); setIsListening(true); }
    catch { setError('माइक्रोफोन शुरू नहीं हो पाया।'); setIsListening(false); }
  };

  const clearChat = () => {
    if (!window.confirm('क्या आप इस फोन की सेव की हुई चैट मिटाना चाहते हैं?')) return;
    setMessages([WELCOME]);
    setError('');
    try { window.localStorage.removeItem('jarvis_chat_history'); } catch {}
  };

  return (
    <div className="jarvis-shell">
      <div className="app-frame">
        <header className="topbar">
          <div className="brand-mark">J</div>
          <div className="brand-copy">
            <h1>JARVIS <span>AI</span></h1>
            <p><i /> PERSONAL ASSISTANT</p>
          </div>
          <div className="top-actions">
            <button className={speakReplies ? 'tool active' : 'tool'} onClick={() => setSpeakReplies(v => !v)} aria-label="Toggle voice replies" title="आवाज़ में जवाब">{speakReplies ? '🔊' : '🔈'}</button>
            <button className="tool" onClick={clearChat} aria-label="Clear chat" title="चैट मिटाएँ">⌫</button>
          </div>
        </header>

        <div className="status-strip"><span className="status-dot" /> LOCAL CHAT MEMORY <span className="status-divider">|</span> DEVICE STORAGE</div>

        <main ref={listRef} className="chat-area">
          <div className="date-chip">SESSION STARTED</div>
          {messages.map((message, idx) => (
            <div key={idx} className={`message-row ${message.role === 'user' ? 'user-row' : 'assistant-row'}`}>
              {message.role !== 'user' && <div className="avatar">J</div>}
              <div className={`bubble ${message.role === 'user' ? 'user-bubble' : 'assistant-bubble'}`}>
                <div className="bubble-label">{message.role === 'user' ? 'YOU' : 'JARVIS'}</div>
                <div className="bubble-text">{message.content}</div>
              </div>
            </div>
          ))}
          {isLoading && <div className="message-row assistant-row"><div className="avatar">J</div><div className="bubble assistant-bubble"><div className="bubble-label">JARVIS</div><div className="thinking"><span/><span/><span/> सोच रहा हूँ…</div></div></div>}
        </main>

        {error && <div className="error-banner">{error}<button onClick={() => setError('')}>×</button></div>}

        <footer className="composer-wrap">
          <form className="composer" onSubmit={e => { e.preventDefault(); sendMessage(input); }}>
            <button type="button" className={isListening ? 'mic-button listening' : 'mic-button'} onClick={startListening} aria-label="Voice input" title="बोलकर पूछें">{isListening ? '■' : '🎙'}</button>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="JARVIS से कुछ भी पूछें…" autoComplete="off" />
            <button type="submit" className="send-button" disabled={isLoading || !input.trim()} aria-label="Send">➤</button>
          </form>
          <div className="footer-note">आपकी चैट इस डिवाइस में सेव होती है · AI जवाब के लिए इंटरनेट चाहिए</div>
        </footer>
      </div>
    </div>
  );
}
