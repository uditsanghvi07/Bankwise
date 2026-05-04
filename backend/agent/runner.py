"""Orchestrates safety → RAG → LangGraph agent → critic → response envelope."""

from __future__ import annotations

import os
import time
import uuid
from typing import Any

import agent.langchain_shim  # noqa: F401 — before langchain_core

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage

from agent.critic import verify_narration_against_tools
from agent.finalize import extract_display_text, widget_from_messages
from agent.graph import AGENT_SYSTEM_PROMPT, get_compiled_agent
from core.number_extract import extract_financial_hints
from core.safety_guard import REFUSAL_MESSAGE, sanitize_and_check
from core.widget_inference import infer_widget_from_user_message, merge_widget_params
from llm.deepseek_client import should_show_regulatory_footnote
from rag.retriever import get_retriever
from schemas.agent_io import AgentRunResult, TraceStep
from schemas.chat_schemas import ChatMessage


def _history_to_lc(history: list[ChatMessage]) -> list[BaseMessage]:
    out: list[BaseMessage] = []
    for m in history:
        if m.role == "user":
            out.append(HumanMessage(content=m.content))
        elif m.role == "assistant":
            out.append(AIMessage(content=m.content))
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


async def run_bankwise_agent_turn(
    *,
    message: str,
    conversation_id: str | None,
    history: list[ChatMessage],
) -> AgentRunResult:
    conv = conversation_id or str(uuid.uuid4())
    trace: list[TraceStep] = []

    safety = sanitize_and_check(message)
    trace.append(TraceStep(step="safety", detail="sanitize_and_check", meta={"allowed": safety.allowed}))
    if not safety.allowed:
        text = REFUSAL_MESSAGE if safety.refusal_reason == "policy" else "Please enter a message to continue."
        return AgentRunResult(
            text=text,
            widget=None,
            conversation_id=conv,
            show_regulatory_footnote=False,
            trace=trace,
            kb_citations=[],
        )

    user_msg = safety.sanitized_message

    if os.environ.get("BANKWISE_AGENT_TEST_MODE") == "1":
        trace.append(TraceStep(step="test_mode", detail="short_circuit"))
        return AgentRunResult(
            text="Test mode: agent path reachable.",
            widget=None,
            conversation_id=conv,
            show_regulatory_footnote=False,
            trace=trace,
            kb_citations=["KB:disc-001"],
        )

    # --- RAG (hybrid: BM25 + dense + RRF + optional cross-encoder) ---
    t0 = time.perf_counter()
    retriever = get_retriever()
    chunks, rag_trace = retriever.search_with_trace(user_msg, top_k=4, candidate_pool=12)
    kb_lines = [f"[{c.id}] ({c.source_file}) {c.text}" for c in chunks]
    rag_block = "\n\n".join(kb_lines) if kb_lines else ""
    trace.append(
        TraceStep(
            step="retrieve",
            detail=f"hybrid_rag::{rag_trace.backend}",
            meta={
                "ms": round((time.perf_counter() - t0) * 1000, 2),
                "citations": [c.id for c in chunks],
                "scores": [
                    {
                        "id": c.id,
                        "fused": c.score,
                        "bm25": c.bm25_score,
                        "dense": c.dense_score,
                        "rerank": c.rerank_score,
                    }
                    for c in chunks
                ],
                "pipeline": rag_trace.to_dict(),
            },
        )
    )

    try:
        graph = get_compiled_agent()
    except RuntimeError as e:
        # No API key — fall back to informative assistant text without tools
        trace.append(TraceStep(step="finalize", detail="no_llm", meta={"error": str(e)}))
        return AgentRunResult(
            text=(
                "The advisory model is **not configured** — add **DEEPSEEK_API_KEY** to `.env` to enable the "
                "LangGraph tool loop (EMI/eligibility engines). Sidebar calculators still work locally."
            ),
            widget=None,
            conversation_id=conv,
            show_regulatory_footnote=False,
            trace=trace,
            kb_citations=[c.id for c in chunks],
        )

    sys = SystemMessage(
        content=AGENT_SYSTEM_PROMPT
        + "\n\n---\nCurated KB snippets (cite by id when relevant):\n"
        + rag_block
        + "\n---\n",
    )
    seed: list[BaseMessage] = [sys, *_history_to_lc(history), HumanMessage(content=user_msg)]

    t1 = time.perf_counter()
    try:
        out_state = await graph.ainvoke({"messages": seed, "trace": []}, config={"recursion_limit": 14})
    except Exception as e:
        trace.append(TraceStep(step="finalize", detail="graph_error", meta={"error": str(e)}))
        return AgentRunResult(
            text=(
                "The agent could not finish this turn (graph error). Check API connectivity, model tool-calling support, "
                f"and logs. Technical detail: {e!s}"
            ),
            widget=None,
            conversation_id=conv,
            show_regulatory_footnote=True,
            trace=trace,
            kb_citations=[c.id for c in chunks],
        )
    trace_graph = out_state.get("trace") or []
    for row in trace_graph:
        try:
            trace.append(TraceStep(step=row.get("step", "model"), detail=str(row.get("detail", "")), meta=row.get("meta") or {}))
        except Exception:
            continue
    trace.append(
        TraceStep(
            step="finalize",
            detail="graph_complete",
            meta={"graph_ms": round((time.perf_counter() - t1) * 1000, 2)},
        )
    )

    msgs: list[BaseMessage] = list(out_state.get("messages") or [])
    last_ai = ""
    for m in reversed(msgs):
        if not isinstance(m, AIMessage):
            continue
        c = m.content
        if isinstance(c, list):
            c = "".join(str(x) for x in c)
        else:
            c = str(c or "")
        if not c.strip():
            continue
        last_ai = c.strip()
        if not (m.tool_calls or []):
            break

    text, widget = extract_display_text(last_ai, msgs)
    text2, critic_meta = verify_narration_against_tools(text, msgs)
    if critic_meta.get("adjusted"):
        trace.append(TraceStep(step="critic", detail="narration_adjusted", meta=critic_meta))

    hints = extract_financial_hints(user_msg)
    if widget is None:
        inferred = infer_widget_from_user_message(user_msg)
        if inferred:
            widget = inferred
    if widget is not None:
        widget = merge_widget_params(widget, hints)
    if widget is None:
        w2 = widget_from_messages(msgs)
        if w2:
            widget = merge_widget_params(w2, hints)

    nw = _normalize_widget_for_frontend(widget)
    foot = should_show_regulatory_footnote(text2 + " " + user_msg)

    return AgentRunResult(
        text=text2.strip(),
        widget=nw,
        conversation_id=conv,
        show_regulatory_footnote=foot,
        trace=trace,
        kb_citations=[c.id for c in chunks],
    )
