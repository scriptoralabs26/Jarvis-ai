# JARVIS AI

JARVIS AI is a production-oriented bilingual AI assistant platform with a modern chat experience and a FastAPI backend. The interface is English-first, while JARVIS can understand both English and Hindi input and respond according to language instructions in the system prompt.

## Tech Stack

- **Frontend:** React (Vite), Tailwind CSS
- **Backend:** Python, FastAPI, async OpenAI client
- **Memory:** In-memory bounded conversation window (future-ready for SQLite/PostgreSQL)

## Features

- Premium dark chat interface with smooth messaging flow
- User messages on right, JARVIS messages on left
- Loading state (`JARVIS is thinking…`) and retry control on network failures
- Session memory abstraction that keeps recent message context
- Centralized backend config via environment variables
- Safe fallback response when AI provider fails

## Project Structure

```text
jarvis-ai/
├── backend/
│   ├── config.py
│   ├── main.py
│   ├── memory.py
│   ├── prompts.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── vite.config.js
└── .env.example
```

## Local Development

### 1) Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `.env` in repo root (or backend root) based on `.env.example`, then run:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2) Frontend

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Open `http://localhost:5173`.

## Environment Setup

Copy `.env.example` and define:

- `OPENAI_API_KEY`
- `MODEL_NAME`
- `TEMPERATURE`
- `MAX_TOKENS`
- `MEMORY_WINDOW`
- `REQUEST_TIMEOUT_SECONDS`
- `VITE_API_BASE_URL`

## Deployment Notes

### Backend (Render / Railway / AWS)

- Use `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Set environment variables in deployment settings
- Keep API keys server-side only

### Frontend (Vercel / Netlify)

- Build command: `npm run build`
- Output directory: `dist`
- Set `VITE_API_BASE_URL` to deployed backend URL

## Future-Ready Architecture

The codebase is structured to support upcoming capabilities such as auth, persistent memory, document ingestion, voice input/output, and broader multilingual expansion.
