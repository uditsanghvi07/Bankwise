"""Extract and validate <widget> JSON from model output — tolerant of malformed blocks."""

from __future__ import annotations

import json
import re
from typing import Any

WIDGET_TYPES = frozenset(
    {
        "emi_calculator",
        "loan_eligibility",
        "loan_comparison",
        "amortization_schedule",
        "sip_calculator",
        "fd_calculator",
        "cibil_simulator",
    }
)


def _try_json(s: str) -> dict[str, Any] | None:
    s = s.strip()
    if not s:
        return None
    try:
        obj = json.loads(s)
    except json.JSONDecodeError:
        start = s.find("{")
        end = s.rfind("}")
        if start == -1 or end <= start:
            return None
        frag = s[start : end + 1]
        try:
            obj = json.loads(frag)
        except json.JSONDecodeError:
            return None
    if not isinstance(obj, dict):
        return None
    return obj


def _normalize_widget(obj: dict[str, Any]) -> dict[str, Any] | None:
    wtype = obj.get("type")
    params = obj.get("params")
    if not isinstance(wtype, str) or wtype not in WIDGET_TYPES:
        return None
    if not isinstance(params, dict):
        return None
    return {"type": wtype, "params": params}


def split_text_and_widget(raw: str) -> tuple[str, dict[str, Any] | None]:
    """Return display text (without widget tags) and optional validated widget dict."""
    if not raw or "<widget>" not in raw:
        return (raw or "").strip(), None

    parts = raw.split("<widget>", 1)
    text_before = parts[0]
    rest = parts[1] if len(parts) > 1 else ""

    if "</widget>" in rest:
        inner, _, after = rest.partition("</widget>")
        tail = after
    else:
        inner = rest
        tail = ""

    inner_stripped = inner.strip()
    parsed = _try_json(inner_stripped)
    widget = _normalize_widget(parsed) if parsed else None

    combined_text = (text_before + tail).strip()
    return combined_text, widget
