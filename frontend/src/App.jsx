import { useEffect, useMemo, useRef, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const makeSessionId = () => {
  const existing = window.sessionStorage.getItem('jarvis_session_id');
  if (existing) {
    return existing;
  }
  const created = crypto.randomUUID();
  window.sessionStorage.setItem('jarvis_session_id', created);
  return created;
};

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello, I am JARVIS. How can I help you today?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastFailedMessage, setLastFailedMessage] = useState('');
  const sessionId = useMemo(() => makeSessionId(), []);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const sendMessage = async (rawMessage) => {
    const trimmed = rawMessage.trim();
    if (!trimmed || isLoading) {
      return;
    }

    setError('');
    setLastFailedMessage('');
    setIsLoading(true);
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setInput('');

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: trimmed })
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setError('Network issue detected.');
      setLastFailedMessage(trimmed);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'I’m temporarily unable to respond. Please try again.' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-slate-900 text-slate-100">
      <div className="mx-auto flex h-screen w-full max-w-5xl flex-col px-4 py-6 md:px-8">
        <header className="mb-4 border-b border-white/10 pb-4">
          <h1 className="text-2xl font-semibold tracking-wide">JARVIS AI</h1>
          <p className="mt-1 text-sm text-slate-400">Professional AI Assistant</p>
        </header>

        <main
          ref={listRef}
          className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-4 shadow-2xl backdrop-blur"
        >
          {messages.map((message, idx) => (
            <div
              key={`${message.role}-${idx}`}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed md:max-w-[70%] ${
                  message.role === 'user'
                    ? 'bg-blue-600/70 text-white'
                    : 'border border-white/10 bg-zinc-900/80 text-slate-100'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start animate-pulse">
              <div className="rounded-2xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm text-slate-300">
                JARVIS is thinking…
              </div>
            </div>
          )}
        </main>

        <footer className="mt-4 space-y-3">
          {error && (
            <div className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-2 text-sm text-red-200">
              <span>{error}</span>
              {lastFailedMessage && (
                <button
                  type="button"
                  onClick={() => sendMessage(lastFailedMessage)}
                  className="rounded-md border border-red-300/40 px-3 py-1 text-xs font-medium transition hover:bg-red-400/20"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage(input);
            }}
            className="flex items-center gap-3"
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask JARVIS anything…"
              className="flex-1 rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-blue-500"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Send
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
}
