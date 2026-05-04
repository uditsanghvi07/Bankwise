"""LangChain tools wrapping Decimal calculator engines — LLM proposes args; Python is source of truth."""

from __future__ import annotations

import json
from typing import Literal

from langchain_core.tools import tool

from calculators import cibil as cibil_calc
from calculators import comparison as comparison_calc
from calculators import eligibility as eligibility_calc
from calculators import emi as emi_calc
from calculators import investment as investment_calc


@tool
def bankwise_emi_engine(
    principal: float,
    annual_rate: float,
    tenure_months: int,
    prepayment_amount: float | None = None,
    prepayment_after_month: int | None = None,
) -> str:
    """Compute home/personal/car-style EMI using the official reducing-balance engine. Returns JSON with emi_amount."""
    out = emi_calc.amortization_schedule(
        principal,
        annual_rate,
        tenure_months,
        prepayment_amount=prepayment_amount,
        prepayment_after_month=prepayment_after_month,
    )
    return json.dumps(
        {
            "tool": "bankwise_emi_engine",
            "emi_amount": out["emi_amount"],
            "total_interest": out["total_interest"],
            "total_payment": out["total_payment"],
            "schedule_months": len(out.get("schedule") or []),
        },
        ensure_ascii=False,
    )


@tool
def bankwise_eligibility_engine(
    monthly_income: float,
    existing_emi_obligations: float,
    loan_type: Literal["home", "personal", "car", "business"],
    annual_rate: float,
    requested_tenure_months: int,
    requested_principal: float | None = None,
) -> str:
    """FOIR-based max loan estimate using internal underwriting norms (illustrative)."""
    res = eligibility_calc.compute_eligibility(
        monthly_income,
        existing_emi_obligations,
        loan_type,
        annual_rate,
        requested_tenure_months,
        requested_principal=requested_principal,
    )
    return json.dumps({"tool": "bankwise_eligibility_engine", "result": res}, default=str, ensure_ascii=False)


@tool
def bankwise_sip_engine(monthly_sip: float, annual_rate: float, tenure_years: int) -> str:
    """SIP future value (ordinary annuity, monthly compounding)."""
    res = investment_calc.sip_maturity(monthly_sip, annual_rate, tenure_years)
    return json.dumps({"tool": "bankwise_sip_engine", "result": res}, default=str, ensure_ascii=False)


@tool
def bankwise_fd_engine(
    principal: float,
    annual_rate: float,
    tenure_years: float,
    compounding_frequency: Literal[1, 4, 12],
    senior_citizen: bool = False,
) -> str:
    """FD maturity with compounding."""
    res = investment_calc.fd_maturity(
        principal,
        annual_rate,
        int(tenure_years),
        compounding_frequency,
        senior_citizen=senior_citizen,
    )
    return json.dumps({"tool": "bankwise_fd_engine", "result": res}, default=str, ensure_ascii=False)


@tool
def bankwise_cibil_directional_engine(current_score: int, actions_json: str) -> str:
    """Directional credit score simulation (not CIBIL proprietary). actions_json is a JSON array of {action, impact}."""
    try:
        raw = json.loads(actions_json or "[]")
    except json.JSONDecodeError:
        return json.dumps({"error": "invalid actions_json"})
    actions = []
    for a in raw if isinstance(raw, list) else []:
        if isinstance(a, dict):
            actions.append({"action": str(a.get("action", "")), "impact": a.get("impact")})
    res = cibil_calc.simulate(current_score, actions)
    return json.dumps({"tool": "bankwise_cibil_directional_engine", "result": res}, default=str, ensure_ascii=False)


@tool
def bankwise_loan_compare_engine(loans_json: str) -> str:
    """Compare 2–3 loans. loans_json: array of {label, principal, annual_rate, tenure_months}."""
    try:
        raw = json.loads(loans_json or "[]")
    except json.JSONDecodeError:
        return json.dumps({"error": "invalid loans_json"})
    if not isinstance(raw, list) or len(raw) < 2:
        return json.dumps({"error": "need at least two loans"})
    loans = []
    for x in raw[:3]:
        if isinstance(x, dict):
            loans.append(
                {
                    "label": str(x.get("label", "Loan")),
                    "principal": float(x["principal"]),
                    "annual_rate": float(x["annual_rate"]),
                    "tenure_months": int(x["tenure_months"]),
                }
            )
    res = comparison_calc.compare_loans(loans)
    return json.dumps({"tool": "bankwise_loan_compare_engine", "result": res}, default=str, ensure_ascii=False)


BANKWISE_TOOLS = [
    bankwise_emi_engine,
    bankwise_eligibility_engine,
    bankwise_sip_engine,
    bankwise_fd_engine,
    bankwise_cibil_directional_engine,
    bankwise_loan_compare_engine,
]
