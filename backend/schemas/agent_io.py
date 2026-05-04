"""Structured shapes for agent observability (not all fields are LLM-generated — some are filled server-side)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class TraceStep(BaseModel):
    step: Literal[
        "safety",
        "retrieve",
        "model",
        "tool",
        "critic",
        "finalize",
        "test_mode",
    ]
    detail: str = ""
    meta: dict[str, Any] = Field(default_factory=dict)


class AgentRunResult(BaseModel):
    """Validated envelope returned to the HTTP layer."""

    text: str
    widget: dict[str, Any] | None = None
    conversation_id: str
    show_regulatory_footnote: bool = False
    trace: list[TraceStep] = Field(default_factory=list)
    kb_citations: list[str] = Field(default_factory=list)
