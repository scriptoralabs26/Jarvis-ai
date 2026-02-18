from collections import defaultdict, deque
from threading import Lock
from typing import Deque


Message = dict[str, str]


class ConversationMemory:
    """Thread-safe in-memory chat storage with a bounded history window."""

    def __init__(self, max_messages: int = 15) -> None:
        self._max_messages = max_messages
        self._store: dict[str, Deque[Message]] = defaultdict(lambda: deque(maxlen=max_messages))
        self._lock = Lock()

    def add(self, session_id: str, role: str, content: str) -> None:
        message = {"role": role, "content": content}
        with self._lock:
            self._store[session_id].append(message)

    def get_recent(self, session_id: str) -> list[Message]:
        with self._lock:
            return list(self._store[session_id])

    def clear(self, session_id: str) -> None:
        with self._lock:
            self._store.pop(session_id, None)
