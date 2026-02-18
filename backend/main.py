import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from config import get_settings
from memory import ConversationMemory
from prompts import FALLBACK_MESSAGE, SYSTEM_PROMPT

logger = logging.getLogger("jarvis")
logging.basicConfig(level=logging.INFO)

settings = get_settings()
client = AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None
memory = ConversationMemory(max_messages=settings.memory_window)


class ChatRequest(BaseModel):
    session_id: str = Field(default="default", min_length=1, max_length=128)
    message: str = Field(min_length=1, max_length=4000)


class ChatResponse(BaseModel):
    reply: str


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Starting JARVIS backend")
    yield
    logger.info("Shutting down JARVIS backend")


app = FastAPI(title="JARVIS AI API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "assistant": "JARVIS"}


@app.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest) -> ChatResponse:
    if not client:
        logger.error("OpenAI API key missing")
        return ChatResponse(reply=FALLBACK_MESSAGE)

    memory.add(payload.session_id, "user", payload.message)
    history = memory.get_recent(payload.session_id)

    messages = [{"role": "system", "content": SYSTEM_PROMPT}, *history]

    try:
        completion = await client.chat.completions.create(
            model=settings.model_name,
            messages=messages,
            temperature=settings.temperature,
            max_tokens=settings.max_tokens,
            timeout=settings.request_timeout_seconds,
        )
        reply = completion.choices[0].message.content.strip()
        if not reply:
            raise ValueError("Empty model reply")
        memory.add(payload.session_id, "assistant", reply)
        return ChatResponse(reply=reply)
    except Exception as exc:
        logger.exception("Chat completion failed: %s", exc)
        return ChatResponse(reply=FALLBACK_MESSAGE)


@app.delete("/chat/{session_id}")
async def clear_chat(session_id: str) -> dict[str, str]:
    memory.clear(session_id)
    return {"status": "cleared"}
