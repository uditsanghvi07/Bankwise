"""Infer calculator widgets from user text when the model omits <widget> tags."""

from __future__ import annotations

import re
from typing import Any

from core.number_extract import extract_financial_hints


def infer_widget_from_user_message(message: str) -> dict[str, Any] | None:
    low = message.lower()
    hints = extract_financial_hints(message)

    def has_emi_intent() -> bool:
        return bool(
            re.search(r"\bemi\b|equated monthly|monthly payment|monthly instalment", low)
        )

    def has_eligibility_intent() -> bool:
        return bool(re.search(r"eligib|how much loan|how much can i borrow|sanction", low))

    def has_compare_intent() -> bool:
        return bool(re.search(r"compare|versus|vs\.?|against", low)) and re.search(
            r"([\d.]+)\s*%.*?([\d.]+)\s*%", low
        )

    def has_sip_intent() -> bool:
        return bool(re.search(r"\bsip\b|systematic investment", low))

    def has_fd_intent() -> bool:
        return bool(re.search(r"\bfd\b|fixed deposit|deposit maturity", low))

    def has_cibil_intent() -> bool:
        return bool(re.search(r"cibil|credit score|credit bureau", low))

    def has_amort_intent() -> bool:
        return bool(re.search(r"amort|schedule|repayment table", low))

    # EMI / amortization — trigger when user clearly asks EMI/amort OR gives principal+rate+tenure together
    strong_numbers = (
        hints.get("principal") is not None
        and hints.get("annual_rate") is not None
        and hints.get("tenure_months") is not None
    )
    if has_emi_intent() or strong_numbers:
        p = float(hints.get("principal") or 5_000_000)
        r = float(hints.get("annual_rate") or 8.5)
        n = int(hints.get("tenure_months") or 240)
        if p > 0 and r > 0 and n > 0:
            wtype = "amortization_schedule" if has_amort_intent() else "emi_calculator"
            return {"type": wtype, "params": {"principal": p, "annual_rate": r, "tenure_months": n}}

    if has_eligibility_intent():
        mi = hints.get("monthly_income") or 80_000
        pr = hints.get("principal")
        params: dict[str, Any] = {
            "monthly_income": float(mi),
            "monthly_obligations": 0,
            "loan_type": "home",
            "annual_rate": float(hints.get("annual_rate") or 8.5),
            "tenure_months": int(hints.get("tenure_months") or 240),
        }
        if pr:
            params["requested_principal"] = float(pr)
        return {"type": "loan_eligibility", "params": params}

    m = re.search(r"([\d.]+)\s*%.*?([\d.]+)\s*%", low)
    if has_compare_intent() and m:
        r1, r2 = float(m.group(1)), float(m.group(2))
        p = float(hints.get("principal") or 5_000_000)
        n = int(hints.get("tenure_months") or 240)
        return {
            "type": "loan_comparison",
            "params": {
                "loans": [
                    {"label": f"Option A ({r1}%)", "principal": p, "annual_rate": r1, "tenure_months": n},
                    {"label": f"Option B ({r2}%)", "principal": p, "annual_rate": r2, "tenure_months": n},
                ]
            },
        }

    if has_sip_intent():
        sip = hints.get("monthly_income")  # sometimes users say monthly sip same pattern
        monthly = float(sip or 10_000)
        return {
            "type": "sip_calculator",
            "params": {
                "monthly_sip": monthly,
                "annual_rate": float(hints.get("annual_rate") or 12),
                "tenure_years": max(1, int((hints.get("tenure_months") or 120) // 12)),
            },
        }

    if has_fd_intent():
        p = float(hints.get("principal") or 100_000)
        return {
            "type": "fd_calculator",
            "params": {
                "principal": p,
                "annual_rate": float(hints.get("annual_rate") or 7),
                "tenure_years": max(1, int((hints.get("tenure_months") or 60) // 12)),
                "compounding_frequency": 4,
            },
        }

    if has_cibil_intent():
        cur = 650
        mscore = re.search(r"\b([3-8]\d{2}|900)\b", message)
        if mscore:
            cur = int(mscore.group(1))
        return {"type": "cibil_simulator", "params": {"current_score": cur, "actions": []}}

    return None


def merge_widget_params(base: dict[str, Any], hints: dict[str, Any]) -> dict[str, Any]:
    """Overlay extracted numbers onto an existing widget params dict."""
    wtype = base.get("type")
    params = dict(base.get("params") or {})

    def fill(key: str, hint_key: str | None = None) -> None:
        hk = hint_key or key
        if hk in hints and hints[hk] is not None:
            if key not in params or params.get(key) in (None, "", 0):
                params[key] = hints[hk]

    if wtype in ("emi_calculator", "amortization_schedule"):
        fill("principal")
        fill("annual_rate")
        fill("tenure_months")
    elif wtype == "loan_eligibility":
        fill("monthly_income")
        fill("requested_principal", "principal")
        fill("annual_rate")
        fill("tenure_months")
    return {"type": wtype, "params": params}
