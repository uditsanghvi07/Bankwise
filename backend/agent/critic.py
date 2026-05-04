"""Lightweight rule-based verifier: EMI from tool JSON must not be contradicted by stray amounts in prose."""

from __future__ import annotations

import json
import re
from typing import Any

from langchain_core.messages import BaseMessage, ToolMessage


def _extract_emi_from_tool_messages(messages: list[BaseMessage]) -> float | None:
    for m in reversed(messages):
        if not isinstance(m, ToolMessage):
            continue
        try:
            data = json.loads(str(m.content))
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict) and data.get("tool") == "bankwise_emi_engine":
            emi = data.get("emi_amount")
            if isinstance(emi, (int, float)):
                return float(emi)
    return None


def _rupee_like_numbers(text: str) -> list[float]:
    # Match 43,391 or 43391 or 43,391.50
    out: list[float] = []
    for m in re.finditer(r"(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)|\b([\d,]{4,}(?:\.\d+)?)\b", text, flags=re.I):
        g = m.group(1) or m.group(2)
        if not g:
            continue
        try:
            out.append(float(g.replace(",", "")))
        except ValueError:
            continue
    return out


def verify_narration_against_tools(final_text: str, messages: list[BaseMessage]) -> tuple[str, dict[str, Any]]:
    """
    If tool EMI exists, ensure no other large rupee figure is presented as EMI within ±8% band.
    On conflict, append a single clarification line (no second LLM call).
    """
    emi = _extract_emi_from_tool_messages(messages)
    meta: dict[str, Any] = {"checked": True, "emi_from_tool": emi}
    if emi is None or not final_text.strip():
        return final_text, meta

    nums = _rupee_like_numbers(final_text)
    if not nums:
        return final_text, meta

    # Ignore principals / totals: only treat numbers in a plausible "monthly EMI" band.
    band_lo, band_hi = emi / 40, emi * 3
    candidates = [n for n in nums if band_lo <= n <= band_hi]
    low, high = emi * 0.92, emi * 1.08
    in_band = [n for n in candidates if low <= n <= high]
    outliers = [n for n in candidates if n < low or n > high]
    if len(in_band) >= 1 and outliers:
        meta["adjusted"] = True
        return (
            final_text.rstrip()
            + "\n\n*(Verifier: monthly EMI from the calculator engine is ₹{:,.2f}; "
            "other amounts in a similar monthly range should not be read as a second EMI.)*".format(emi),
            meta,
        )
    return final_text, meta
