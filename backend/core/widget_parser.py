"""Extract and validate <widget> JSON from model output — tolerant of malformed blocks."""

from __future__ import annotations

import json
import re
from typing import Any

# HTML-style blocks the model sometimes emits instead of strict <widget>{json}</widget>
_WIDGET_BLOCK = re.compile(r"<widget\b[\s\S]*?</widget>", re.IGNORECASE)
_WIDGET_SELF_CLOSE = re.compile(r"<widget\b[^>]*/\s*>", re.IGNORECASE)
_ORPHAN_WIDGET_TAIL = re.compile(r"<widget\b[\s\S]*\Z", re.IGNORECASE)

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


def _parse_loose_widget_block(full_block: str) -> dict[str, Any] | None:
    """Parse `<widget ...>...</widget>` where JSON may live in `data=` or as inner text."""
    m = re.match(r"(?is)<widget\b([^>]*)>([\s\S]*)</widget>\s*", full_block.strip())
    if not m:
        return None
    attrs, inner = m.group(1), m.group(2).strip()
    parsed = _try_json(inner)
    if parsed:
        w = _normalize_widget(parsed)
        if w:
            return w
    dm = re.search(r"\bdata\s*=\s*(['\"])([\s\S]*?)\1", attrs, re.IGNORECASE)
    if dm:
        try:
            blob = json.loads(dm.group(2))
        except json.JSONDecodeError:
            blob = None
        if isinstance(blob, dict):
            if isinstance(blob.get("loans"), list):
                return {"type": "loan_comparison", "params": {"loans": blob["loans"]}}
            if "principal" in blob and "annual_rate" in blob:
                return _normalize_widget({"type": "emi_calculator", "params": blob})
    return None


def strip_widget_markup(text: str) -> str:
    """Remove every widget tag variant; use after extracting widget for display/PDF."""
    if not text:
        return ""
    text = _WIDGET_BLOCK.sub("", text)
    text = _WIDGET_SELF_CLOSE.sub("", text)
    text = _ORPHAN_WIDGET_TAIL.sub("", text)
    return text.strip()


def split_text_and_widget(raw: str) -> tuple[str, dict[str, Any] | None]:
    """Return display text (without widget tags) and optional validated widget dict."""
    if not raw:
        return "", None

    text = raw.strip()
    last_widget: dict[str, Any] | None = None
    low = text.lower()

    while True:
        idx = low.find("<widget")
        if idx == -1:
            break
        end = low.find("</widget>", idx)
        if end == -1:
            text = text[:idx].strip()
            low = text.lower()
            break
        end_close = end + len("</widget>")
        block = text[idx:end_close]
        w = _parse_loose_widget_block(block)
        if w:
            last_widget = w
        text = (text[:idx] + text[end_close:]).strip()
        low = text.lower()

    text = _WIDGET_SELF_CLOSE.sub("", text)
    text = _ORPHAN_WIDGET_TAIL.sub("", text)
    return text.strip(), last_widget
