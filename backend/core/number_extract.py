"""Conversational number extraction for Indian banking phrases (INR, lakh, crore)."""

from __future__ import annotations

import re
from typing import Any


def _parse_money_token(num: str, unit: str | None) -> float | None:
    try:
        v = float(num.replace(",", ""))
    except ValueError:
        return None
    if not unit:
        return v
    u = unit.lower().strip()
    if u in ("l", "lac", "lakh", "lakhs"):
        return v * 100_000
    if u in ("cr", "crore", "crores"):
        return v * 10_000_000
    if u in ("k", "thousand"):
        return v * 1000
    return v


def extract_financial_hints(text: str) -> dict[str, Any]:
    """Best-effort extraction of income, loan amount, rate, tenure from free text."""
    t = text.lower()
    out: dict[str, Any] = {}

    # Income: "60 thousand", "80k", "₹50000", "50k per month"
    for m in re.finditer(
        r"(?:earn|earning|salary|income)\s*(?:of|is|around|about)?\s*₹?\s*([\d,.]+)\s*(k|thousand|lac|lakh|l|lacs|lakhs)?(?:\s*/\s*month|\s*per\s*month|\s*a\s*month|\s*monthly)?",
        t,
    ):
        val = _parse_money_token(m.group(1), m.group(2))
        if val:
            out["monthly_income"] = val
            break
    if "monthly_income" not in out:
        m = re.search(r"₹?\s*([\d,.]+)\s*(k|thousand)\s*(?:per\s*)?(?:month|monthly)", t)
        if m:
            val = _parse_money_token(m.group(1), m.group(2))
            if val:
                out["monthly_income"] = val
    if "monthly_income" not in out:
        m = re.search(
            r"(?:earn|earning|salary|income)\s+(?:of|is|around|about)?\s*([\d,.]+)\s*thousand(?:\s+rupees)?(?:\s+per\s*month|\s+a\s*month|\s+monthly)?",
            t,
        )
        if m:
            val = _parse_money_token(m.group(1), "thousand")
            if val:
                out["monthly_income"] = val

    # Loan amount: "40 lakhs", "50 lakh", "1 cr"
    for m in re.finditer(
        r"(?:loan|borrow|principal|amount)\s*(?:of|for)?\s*₹?\s*([\d,.]+)\s*(lac|lakh|l|lacs|lakhs|cr|crore|crores)?",
        t,
    ):
        val = _parse_money_token(m.group(1), m.group(2))
        if val and val >= 50_000:
            out["principal"] = val
            break
    if "principal" not in out:
        m = re.search(r"₹?\s*([\d,.]+)\s*(lac|lakh|l|lacs|lakhs|cr|crore|crores)\b", t)
        if m:
            val = _parse_money_token(m.group(1), m.group(2))
            if val:
                out["principal"] = val

    # Rate: "8.5%", "8.5 percent"
    m = re.search(r"([\d.]+)\s*%", t)
    if m:
        try:
            r = float(m.group(1))
            if 1 <= r <= 50:
                out["annual_rate"] = r
        except ValueError:
            pass

    # Tenure: "20 years", "240 months"
    m = re.search(r"(\d+)\s*years?", t)
    if m:
        out["tenure_months"] = int(m.group(1)) * 12
    m = re.search(r"(\d+)\s*months?", t)
    if m:
        out["tenure_months"] = int(m.group(1))

    return out
