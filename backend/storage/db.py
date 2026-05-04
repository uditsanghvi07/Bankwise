"""Tiny SQLite store for chat history (conversations + messages).

Designed for a personal/demo product: synchronous sqlite3 wrapped in async helpers via
`asyncio.to_thread`. Production: switch to aiosqlite or Postgres + connection pool.
"""

from __future__ import annotations

import asyncio
import json
import sqlite3
import time
import uuid
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any


_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "bankwise.sqlite3"

SCHEMA = """
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'New chat',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    widget_json TEXT,
    trace_json TEXT,
    kb_citations_json TEXT,
    show_regulatory_footnote INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conv_updated ON conversations (updated_at DESC);
"""


@dataclass
class Conversation:
    id: str
    title: str
    created_at: int
    updated_at: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


@dataclass
class StoredMessage:
    id: str
    conversation_id: str
    role: str
    content: str
    widget: dict[str, Any] | None
    trace: list[dict[str, Any]]
    kb_citations: list[str]
    show_regulatory_footnote: bool
    created_at: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "role": self.role,
            "content": self.content,
            "widget": self.widget,
            "trace": self.trace,
            "kb_citations": self.kb_citations,
            "show_regulatory_footnote": self.show_regulatory_footnote,
            "created_at": self.created_at,
        }


def _row_to_conversation(row: sqlite3.Row) -> Conversation:
    return Conversation(id=row["id"], title=row["title"], created_at=row["created_at"], updated_at=row["updated_at"])


def _row_to_message(row: sqlite3.Row) -> StoredMessage:
    return StoredMessage(
        id=row["id"],
        conversation_id=row["conversation_id"],
        role=row["role"],
        content=row["content"],
        widget=json.loads(row["widget_json"]) if row["widget_json"] else None,
        trace=json.loads(row["trace_json"]) if row["trace_json"] else [],
        kb_citations=json.loads(row["kb_citations_json"]) if row["kb_citations_json"] else [],
        show_regulatory_footnote=bool(row["show_regulatory_footnote"]),
        created_at=row["created_at"],
    )


class ChatStore:
    def __init__(self, db_path: Path = _DB_PATH) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_sync()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        return conn

    def _init_sync(self) -> None:
        with self._connect() as conn:
            conn.executescript(SCHEMA)

    # ---------- conversations ----------
    def _create_conversation(self, conv_id: str | None = None, title: str = "New chat") -> Conversation:
        cid = conv_id or str(uuid.uuid4())
        now = int(time.time() * 1000)
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (cid, title, now, now),
            )
        return Conversation(id=cid, title=title, created_at=now, updated_at=now)

    async def create_conversation(self, conv_id: str | None = None, title: str = "New chat") -> Conversation:
        return await asyncio.to_thread(self._create_conversation, conv_id, title)

    def _list_conversations(self, limit: int = 100) -> list[Conversation]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [_row_to_conversation(r) for r in rows]

    async def list_conversations(self, limit: int = 100) -> list[Conversation]:
        return await asyncio.to_thread(self._list_conversations, limit)

    def _get_conversation(self, conv_id: str) -> Conversation | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?",
                (conv_id,),
            ).fetchone()
        return _row_to_conversation(row) if row else None

    async def get_conversation(self, conv_id: str) -> Conversation | None:
        return await asyncio.to_thread(self._get_conversation, conv_id)

    def _rename_conversation(self, conv_id: str, title: str) -> bool:
        now = int(time.time() * 1000)
        with self._connect() as conn:
            cur = conn.execute(
                "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
                (title.strip()[:120] or "Untitled", now, conv_id),
            )
            return cur.rowcount > 0

    async def rename_conversation(self, conv_id: str, title: str) -> bool:
        return await asyncio.to_thread(self._rename_conversation, conv_id, title)

    def _delete_conversation(self, conv_id: str) -> bool:
        with self._connect() as conn:
            cur = conn.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
            return cur.rowcount > 0

    async def delete_conversation(self, conv_id: str) -> bool:
        return await asyncio.to_thread(self._delete_conversation, conv_id)

    def _ensure_conversation(self, conv_id: str, *, derive_title_from: str | None = None) -> Conversation:
        existing = self._get_conversation(conv_id)
        if existing:
            return existing
        title = "New chat"
        if derive_title_from:
            t = derive_title_from.strip().splitlines()[0] if derive_title_from.strip() else "New chat"
            title = (t[:60] + "…") if len(t) > 60 else (t or "New chat")
        return self._create_conversation(conv_id, title)

    # ---------- messages ----------
    def _add_message(
        self,
        *,
        conversation_id: str,
        role: str,
        content: str,
        widget: dict[str, Any] | None = None,
        trace: list[dict[str, Any]] | None = None,
        kb_citations: list[str] | None = None,
        show_regulatory_footnote: bool = False,
        derive_title: bool = False,
    ) -> StoredMessage:
        if derive_title:
            self._ensure_conversation(conversation_id, derive_title_from=content)
        else:
            self._ensure_conversation(conversation_id)
        mid = str(uuid.uuid4())
        now = int(time.time() * 1000)
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO messages
                    (id, conversation_id, role, content, widget_json, trace_json,
                     kb_citations_json, show_regulatory_footnote, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    mid,
                    conversation_id,
                    role,
                    content,
                    json.dumps(widget) if widget else None,
                    json.dumps(trace) if trace else None,
                    json.dumps(kb_citations) if kb_citations else None,
                    1 if show_regulatory_footnote else 0,
                    now,
                ),
            )
            conn.execute(
                "UPDATE conversations SET updated_at = ? WHERE id = ?",
                (now, conversation_id),
            )
        return StoredMessage(
            id=mid,
            conversation_id=conversation_id,
            role=role,
            content=content,
            widget=widget,
            trace=trace or [],
            kb_citations=kb_citations or [],
            show_regulatory_footnote=show_regulatory_footnote,
            created_at=now,
        )

    async def add_message(self, **kwargs: Any) -> StoredMessage:
        return await asyncio.to_thread(self._add_message, **kwargs)

    def _list_messages(self, conv_id: str) -> list[StoredMessage]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, conversation_id, role, content, widget_json, trace_json,
                       kb_citations_json, show_regulatory_footnote, created_at
                FROM messages WHERE conversation_id = ?
                ORDER BY created_at ASC, id ASC
                """,
                (conv_id,),
            ).fetchall()
        return [_row_to_message(r) for r in rows]

    async def list_messages(self, conv_id: str) -> list[StoredMessage]:
        return await asyncio.to_thread(self._list_messages, conv_id)


@lru_cache
def get_store() -> ChatStore:
    return ChatStore()


def init_db() -> None:
    get_store()
