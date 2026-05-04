"""Chat routes: standard JSON endpoint and SSE streaming endpoint."""

import asyncio
import json
import time
import uuid
from typing import Any, AsyncGenerator

from fastapi import APIRouter, Response
from fastapi.responses import StreamingResponse

from agent.runner import run_bankwise_agent_turn
from schemas.chat_schemas import ChatMessage, ChatRequest, ChatResponse, WidgetPayload
from storage import get_store

router = APIRouter(prefix="/chat", tags=["chat"])


def _normalize_widget_for_frontend(w: dict[str, Any] | None) -> dict[str, Any] | None:
    if not w:
        return None
    t = w.get("type")
    p = dict(w.get("params") or {})
    if t == "loan_eligibility":
        if "existing_emi_obligations" not in p:
            p["existing_emi_obligations"] = float(p.get("monthly_obligations") or 0)
        p.pop("monthly_obligations", None)
        if "requested_tenure_months" not in p and "tenure_months" in p:
            p["requested_tenure_months"] = int(p["tenure_months"])
    return {"type": t, "params": p}


async def _persist_turn(
    *,
    conversation_id: str,
    user_msg: str,
    assistant_text: str,
    widget: dict[str, Any] | None,
    trace: list[dict[str, Any]],
    kb_citations: list[str],
    show_regulatory_footnote: bool,
) -> None:
    """Best-effort persistence — failures must not break the request."""
    try:
        store = get_store()
        await store.add_message(
            conversation_id=conversation_id,
            role="user",
            content=user_msg,
            derive_title=True,
        )
        await store.add_message(
            conversation_id=conversation_id,
            role="assistant",
            content=assistant_text,
            widget=widget,
            trace=trace,
            kb_citations=kb_citations,
            show_regulatory_footnote=show_regulatory_footnote,
        )
    except Exception:
        pass


@router.post("/", response_model=ChatResponse)
async def post_chat(payload: ChatRequest, response: Response):
    conv = payload.conversation_id or str(uuid.uuid4())
    t0 = time.perf_counter()

    history = payload.history
    # If this conversation exists in DB but the client did not send history, hydrate from DB.
    if payload.conversation_id and not history:
        try:
            stored = await get_store().list_messages(payload.conversation_id)
            history = [
                ChatMessage(role=m.role, content=m.content) for m in stored if m.role in ("user", "assistant")
            ]
        except Exception:
            pass

    result = await run_bankwise_agent_turn(
        message=payload.message,
        conversation_id=conv,
        history=history,
    )
    elapsed = time.perf_counter() - t0

    w_payload: WidgetPayload | None = None
    nw: dict[str, Any] | None = None
    if result.widget:
        nw = _normalize_widget_for_frontend(result.widget)
        if nw and nw.get("type"):
            w_payload = WidgetPayload(type=nw["type"], params=nw["params"])

    response.headers["X-Response-Time"] = f"{elapsed:.3f}"
    response.headers["X-Model-Used"] = "deepseek-chat+langgraph"

    await _persist_turn(
        conversation_id=result.conversation_id,
        user_msg=payload.message,
        assistant_text=result.text,
        widget=nw,
        trace=[s.model_dump() for s in result.trace],
        kb_citations=result.kb_citations,
        show_regulatory_footnote=result.show_regulatory_footnote,
    )

    return ChatResponse(
        text=result.text,
        widget=w_payload,
        conversation_id=result.conversation_id,
        show_regulatory_footnote=result.show_regulatory_footnote,
        trace=[s.model_dump() for s in result.trace],
        kb_citations=result.kb_citations,
    )


# ----------------------------- streaming ----------------------------- #

def _sse(event: str, data: dict[str, Any]) -> bytes:
    """Encode one Server-Sent Event frame."""
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n".encode("utf-8")


def _chunk_text(text: str, target_chunks: int = 60) -> list[str]:
    """Split assistant text into ~target_chunks pieces by words for replay-style streaming."""
    if not text:
        return []
    words = text.split(" ")
    if len(words) <= target_chunks:
        return [w + (" " if i < len(words) - 1 else "") for i, w in enumerate(words)]
    chunk_size = max(1, len(words) // target_chunks)
    out: list[str] = []
    for i in range(0, len(words), chunk_size):
        piece = " ".join(words[i : i + chunk_size])
        if i + chunk_size < len(words):
            piece += " "
        out.append(piece)
    return out


async def _stream_generator(payload: ChatRequest) -> AsyncGenerator[bytes, None]:
    conv = payload.conversation_id or str(uuid.uuid4())
    yield _sse("meta", {"conversation_id": conv, "phase": "starting"})

    history = payload.history
    if payload.conversation_id and not history:
        try:
            stored = await get_store().list_messages(payload.conversation_id)
            history = [
                ChatMessage(role=m.role, content=m.content) for m in stored if m.role in ("user", "assistant")
            ]
        except Exception:
            pass

    result = await run_bankwise_agent_turn(
        message=payload.message,
        conversation_id=conv,
        history=history,
    )

    # Emit trace + KB citations early so the UI can render the agent panel before tokens arrive.
    yield _sse(
        "trace",
        {
            "trace": [s.model_dump() for s in result.trace],
            "kb_citations": result.kb_citations,
        },
    )

    nw: dict[str, Any] | None = None
    if result.widget:
        nw = _normalize_widget_for_frontend(result.widget)
        yield _sse("widget", nw or {})

    # Replay-stream the final text. (We compute the full answer first so tool numbers are
    # guaranteed correct; the UI experience is still token-by-token.)
    chunks = _chunk_text(result.text, target_chunks=80)
    for piece in chunks:
        yield _sse("delta", {"text": piece})
        await asyncio.sleep(0.018)

    yield _sse(
        "done",
        {
            "conversation_id": result.conversation_id,
            "show_regulatory_footnote": result.show_regulatory_footnote,
            "kb_citations": result.kb_citations,
            "widget": nw,
        },
    )

    await _persist_turn(
        conversation_id=result.conversation_id,
        user_msg=payload.message,
        assistant_text=result.text,
        widget=nw,
        trace=[s.model_dump() for s in result.trace],
        kb_citations=result.kb_citations,
        show_regulatory_footnote=result.show_regulatory_footnote,
    )


@router.post("/stream")
async def post_chat_stream(payload: ChatRequest):
    headers = {
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(_stream_generator(payload), media_type="text/event-stream", headers=headers)
