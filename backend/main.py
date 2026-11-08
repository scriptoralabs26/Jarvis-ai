import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from config import get_settings
from memory import ConversationMemory
from prompts import SYSTEM_PROMPT

logger = logging.getLogger("jarvis")
logging.basicConfig(level=logging.INFO)

settings = get_settings()
client = AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None
memory = ConversationMemory(max_messages=settings.memory_window)


class ChatMessage(BaseModel):
    role: str
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    session_id: str = Field(default="default", min_length=1, max_length=128)
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=30)


class ChatResponse(BaseModel):
    reply: str


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Starting JARVIS backend")
    logger.info("OpenAI API key configured: %s", bool(settings.openai_api_key))
    yield
    logger.info("Shutting down JARVIS backend")


app = FastAPI(title="JARVIS AI API", version="1.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, object]:
    return {
        "status": "ok",
        "assistant": "JARVIS",
        "api_key_configured": bool(settings.openai_api_key),
        "model": settings.model_name,
    }


@app.get("/api/status")
async def api_status() -> dict[str, object]:
    return await health()


@app.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest) -> ChatResponse:
    if not client:
        raise HTTPException(
            status_code=503,
            detail="OPENAI_API_KEY is not configured in the Render service environment.",
        )

    safe_history = [
        {"role": item.role, "content": item.content}
        for item in payload.history
        if item.role in ("user", "assistant")
    ][-30:]

    if safe_history:
        conversation = safe_history
    else:
        memory.add(payload.session_id, "user", payload.message)
        conversation = memory.get_recent(payload.session_id)

    messages = [{"role": "system", "content": SYSTEM_PROMPT}, *conversation]

    try:
        completion = await client.chat.completions.create(
            model=settings.model_name,
            messages=messages,
            temperature=settings.temperature,
            max_tokens=settings.max_tokens,
            timeout=settings.request_timeout_seconds,
        )
        reply = (completion.choices[0].message.content or "").strip()
        if not reply:
            raise ValueError("Empty model reply")
        memory.add(payload.session_id, "assistant", reply)
        return ChatResponse(reply=reply)
    except Exception as exc:
        logger.exception("Chat completion failed")
        raise HTTPException(
            status_code=502,
            detail="The AI provider request failed. Check the Render logs and API key/model settings.",
        ) from exc


@app.delete("/chat/{session_id}")
async def clear_chat(session_id: str) -> dict[str, str]:
    memory.clear(session_id)
    return {"status": "cleared"}


# The React app is served from this same container when the frontend build exists.
_frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
if os.path.isdir(_frontend_dist):
    app.mount("/", StaticFiles(directory=_frontend_dist, html=True), name="frontend")
