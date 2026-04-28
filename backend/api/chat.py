import uuid
from typing import Any

from fastapi import APIRouter, Response

from core.number_extract import extract_financial_hints
from core.safety_guard import REFUSAL_MESSAGE, sanitize_and_check
from core.widget_inference import infer_widget_from_user_message, merge_widget_params
from core.widget_parser import split_text_and_widget
from llm.deepseek_client import chat_completion, should_show_regulatory_footnote
from schemas.chat_schemas import ChatRequest, ChatResponse, WidgetPayload

router = APIRouter(prefix="/chat", tags=["chat"])


def _history_to_llm(history: list) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for m in history:
        if m.role in ("user", "assistant") and m.content:
            out.append({"role": m.role, "content": m.content})
    return out


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


@router.post("/", response_model=ChatResponse)
async def post_chat(payload: ChatRequest, response: Response):
    conv = payload.conversation_id or str(uuid.uuid4())

    safety = sanitize_and_check(payload.message)
    if not safety.allowed:
        text = REFUSAL_MESSAGE if safety.refusal_reason == "policy" else "Please enter a message to continue."
        response.headers["X-Response-Time"] = "0"
        response.headers["X-Model-Used"] = "none"
        return ChatResponse(
            text=text,
            widget=None,
            conversation_id=conv,
            show_regulatory_footnote=False,
        )

    user_msg = safety.sanitized_message
    hist = _history_to_llm(payload.history)
    raw_text, elapsed = await chat_completion(user_msg, hist)
    display_text, widget = split_text_and_widget(raw_text)

    hints = extract_financial_hints(user_msg)
    if widget is None:
        inferred = infer_widget_from_user_message(user_msg)
        if inferred:
            widget = inferred
    if widget is not None:
        widget = merge_widget_params(widget, hints)

    footnote = should_show_regulatory_footnote(display_text + " " + user_msg)
    response.headers["X-Response-Time"] = f"{elapsed:.3f}"
    response.headers["X-Model-Used"] = "deepseek-chat"

    w_payload: WidgetPayload | None = None
    if widget:
        nw = _normalize_widget_for_frontend(widget)
        if nw and nw.get("type"):
            w_payload = WidgetPayload(type=nw["type"], params=nw["params"])

    return ChatResponse(
        text=display_text,
        widget=w_payload,
        conversation_id=conv,
        show_regulatory_footnote=footnote,
    )
