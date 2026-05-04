"""Conversation history routes — list, fetch messages, rename, delete."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from storage import get_store

router = APIRouter(prefix="/conversations", tags=["conversations"])


class CreateConversationRequest(BaseModel):
    title: str = Field(default="New chat", max_length=120)


class RenameRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)


@router.get("/")
async def list_conversations():
    store = get_store()
    rows = await store.list_conversations()
    return {"conversations": [r.to_dict() for r in rows]}


@router.post("/")
async def create_conversation(payload: CreateConversationRequest):
    store = get_store()
    conv = await store.create_conversation(title=payload.title or "New chat")
    return conv.to_dict()


@router.get("/{conversation_id}")
async def get_conversation(conversation_id: str):
    store = get_store()
    conv = await store.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="conversation not found")
    msgs = await store.list_messages(conversation_id)
    return {
        "conversation": conv.to_dict(),
        "messages": [m.to_dict() for m in msgs],
    }


@router.patch("/{conversation_id}")
async def rename_conversation(conversation_id: str, payload: RenameRequest):
    store = get_store()
    ok = await store.rename_conversation(conversation_id, payload.title)
    if not ok:
        raise HTTPException(status_code=404, detail="conversation not found")
    return {"ok": True}


@router.delete("/{conversation_id}")
async def delete_conversation(conversation_id: str):
    store = get_store()
    ok = await store.delete_conversation(conversation_id)
    if not ok:
        raise HTTPException(status_code=404, detail="conversation not found")
    return {"ok": True}
