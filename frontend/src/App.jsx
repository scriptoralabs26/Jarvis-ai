import { useEffect, useMemo, useRef, useState } from 'react';

const WELCOME = { role: 'assistant', content: 'नमस्ते! मैं JARVIS हूँ। बताइए, मैं आपकी क्या मदद करूँ?' };
const DEFAULT_API = import.meta.env.VITE_API_BASE_URL || 'https://jarvis-ai-1464.onrender.com';
function normalizeBackendUrl(value) {
  let raw = String(value || '').trim();
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  const parsed = new URL(raw);
  if (parsed.protocol !== 'https:') throw new Error('सुरक्षा के लिए https:// वाला URL डालें।');
  parsed.search = '';
  parsed.hash = '';
  parsed.pathname = parsed.pathname.replace(/\/(healthz?|api\/health)\/?$/i, '').replace(/\/+$/, '');
  return parsed.origin + (parsed.pathname === '/' ? '' : parsed.pathname);
}

function makeSessionId() {
  try {
    let id = window.localStorage.getItem('jarvis_session_id');
    if (!id) {
      id = globalThis.crypto?.randomUUID?.() || 'jarvis-' + Date.now();
      window.localStorage.setItem('jarvis_session_id', id);
    }
    return id;
  } catch { return 'jarvis-' + Date.now(); }
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [serverUrl, setServerUrl] = useState(() => {
    try { return window.localStorage.getItem('jarvis_api_base_url') || DEFAULT_API; }
    catch { return DEFAULT_API; }
  });
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState('checking');
  const [serverInfo, setServerInfo] = useState('');
  const sessionId = useMemo(makeSessionId, []);
  const listRef = useRef(null);
  const recognitionRef = useRef(null);

  const baseUrl = (() => { try { return normalizeBackendUrl(serverUrl); } catch { return ''; } })();

  useEffect(() => {
    try { window.localStorage.setItem('jarvis_chat_history', JSON.stringify(messages.slice(-100))); }
    catch { setError('फोन की स्टोरेज में जगह कम है; चैट सेव नहीं हो पाई।'); }
  }, [messages]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isLoading]);

  useEffect(() => {
    if (!baseUrl) { setServerStatus('missing'); setServerInfo('सेटिंग में Render URL जोड़ें'); return; }
    let cancelled = false;
    setServerStatus('checking');
    const checkHealth = async () => {
      let lastError = 'Health endpoint नहीं मिला';
      for (const path of ['/health', '/healthz', '/api/health']) {
        try {
          const response = await fetch(baseUrl + path, { method: 'GET', headers: { Accept: 'application/json' } });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) { lastError = 'HTTP ' + response.status + ' (' + path + ')'; continue; }
          if (!cancelled) {
            setServerStatus('online');
            setServerInfo(data.api_key_configured === false ? 'सर्वर चालू · API key बाकी' : 'सर्वर कनेक्टेड');
          }
          return;
        } catch (err) { lastError = err?.message || 'Network request failed'; }
      }
      if (!cancelled) {
        setServerStatus('offline');
        setServerInfo(lastError);
      }
    };
    checkHealth();
    return () => { cancelled = true; };
  }, [baseUrl]);

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

  const openServerSettings = () => {
    setUrlDraft(serverUrl);
    setSettingsMessage('');
    setSettingsOpen(true);
  };

  const saveServerUrl = (event) => {
    event.preventDefault();
    let clean = '';
    try {
      clean = normalizeBackendUrl(urlDraft);
    } catch (err) {
      setSettingsMessage(err?.message || 'कृपया सही Render URL डालें।');
      return;
    }
    setServerUrl(clean);
    setError('');
    try {
      window.localStorage.setItem('jarvis_api_base_url', clean);
      const check = window.localStorage.getItem('jarvis_api_base_url');
      if (check !== clean) throw new Error('Saved value could not be verified');
      setSettingsMessage('URL इस फोन में सेव हो गया है।');
    } catch {
      setSettingsMessage('URL अभी ऐप में लागू हुआ, लेकिन फोन की स्टोरेज में सेव नहीं हो पाया।');
    }
    setTimeout(() => setSettingsOpen(false), 900);
  };

  const sendMessage = async (rawMessage) => {
    const trimmed = rawMessage.trim();
    if (!trimmed || isLoading) return;
    if (!baseUrl) { setError('पहले ⚙ सेटिंग में Render Backend URL सेव करें।'); return; }
    setError('');
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    try {
      const response = await fetch(baseUrl + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          message: trimmed,
          history: [...messages, { role: 'user', content: trimmed }]
            .filter(item => item.role === 'user' || item.role === 'assistant')
            .slice(-30)
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = typeof data.detail === 'string' ? data.detail : 'HTTP ' + response.status;
        throw new Error(detail);
      }
      const reply = data.reply || 'मुझे जवाब नहीं मिला। कृपया फिर कोशिश करें।';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      setServerStatus('online');
      setServerInfo('AI जवाब मिल रहा है');
      speak(reply);
    } catch (err) {
      const message = err?.message || 'Network request failed';
      setError('कनेक्शन/AI त्रुटि: ' + message);
      setServerStatus('offline');
      setServerInfo(message);
    } finally { setIsLoading(false); }
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setError('इस ब्राउज़र में आवाज़ पहचान उपलब्ध नहीं है। Chrome में माइक्रोफोन अनुमति जाँचें।'); return; }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = event => { setInput(event.results?.[0]?.[0]?.transcript || ''); setIsListening(false); };
    recognition.onerror = () => { setError('आवाज़ सुनने में समस्या आई। माइक्रोफोन अनुमति जाँचें।'); setIsListening(false); };
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

  const statusLabel = serverStatus === 'online' ? 'SYSTEM ONLINE' : serverStatus === 'checking' ? 'CHECKING SERVER' : serverStatus === 'missing' ? 'SERVER NOT CONFIGURED' : 'SERVER OFFLINE';

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
            <button className="tool" onClick={openServerSettings} aria-label="Server settings" title="AI सर्वर सेटिंग">⚙</button>
            <button className="tool" onClick={clearChat} aria-label="Clear chat" title="चैट मिटाएँ">⌫</button>
          </div>
        </header>

        <div className="status-strip"><span className={serverStatus === 'online' ? 'status-dot' : 'status-dot status-dot-off'} /> {statusLabel} <span className="status-divider">|</span> DEVICE MEMORY</div>
        <div className="server-detail" role="status">{serverInfo || 'JARVIS सिस्टम की जाँच हो रही है'}</div>

        <main ref={listRef} className="chat-area">
          <div className="date-chip">SECURE LOCAL SESSION</div>
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

        {settingsOpen && (
          <div className="settings-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) setSettingsOpen(false); }}>
            <form className="settings-panel" onSubmit={saveServerUrl}>
              <div className="settings-heading"><div><span className="settings-kicker">SYSTEM CONFIGURATION</span><h2>JARVIS Server</h2></div><button type="button" className="settings-close" onClick={() => setSettingsOpen(false)} aria-label="Close">×</button></div>
              <label className="settings-label" htmlFor="jarvis-backend-url">Backend URL (Render)</label>
              <input id="jarvis-backend-url" className="settings-url-input" type="url" inputMode="url" autoComplete="url" placeholder="https://your-service.onrender.com" value={urlDraft} onChange={e => setUrlDraft(e.target.value)} />
              <p className="settings-help">सिर्फ https://your-service.onrender.com डालें। /health, /healthz या ?utm... मत जोड़ें — JARVIS उन्हें खुद ठीक कर देगा।</p>
              {settingsMessage && <p className="settings-message" role="status">{settingsMessage}</p>}
              <div className="settings-actions"><button type="button" className="settings-cancel" onClick={() => setSettingsOpen(false)}>रद्द करें</button><button type="submit" className="settings-save">SAVE URL</button></div>
            </form>
          </div>
        )}

        {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}

        <footer className="composer-wrap">
          <form className="composer" onSubmit={e => { e.preventDefault(); sendMessage(input); }}>
            <button type="button" className={isListening ? 'mic-button listening' : 'mic-button'} onClick={startListening} aria-label="Voice input" title="बोलकर पूछें">{isListening ? '■' : '🎙'}</button>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="JARVIS से कुछ भी पूछें…" autoComplete="off" />
            <button type="submit" className="send-button" disabled={isLoading || !input.trim()} aria-label="Send">➤</button>
          </form>
          <div className="footer-note">चैट इस डिवाइस में सेव · AI जवाब के लिए इंटरनेट आवश्यक</div>
        </footer>
      </div>
    </div>
  );
}
