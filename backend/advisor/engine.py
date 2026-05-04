"""
Realistic Indian retail advisor engine.

Design intent
-------------
The previous advisor produced calm, vaguely positive narratives. Real users need a
*direct, opinionated* read on whether their setup is healthy, stretched, or already
in a debt-trap zone. This module provides:

* Blended portfolio return assumptions grounded in long-run Indian benchmarks
  (Nifty 50 / multi-cap funds, EPF/PPF, FD, gold) instead of single hand-picked rates.
* Three-path projections (pessimistic, base, optimistic) so users see a realistic
  *range* instead of one optimistic line.
* A `Verdict` with severity (`excellent`, `healthy`, `stretched`, `concerning`,
  `critical`) so the UI can scream when something is wrong.
* Hard red flags: negative net cash-flow, FOIR > 50/60%, no emergency fund, savings
  rate < 10%, goal SIP > 1.5x current monthly savings, etc.
* Green flags so good behaviour is highlighted and the LLM can congratulate
  truthfully when warranted.

All numbers are deterministic — the LLM is only asked to *narrate* what is already
computed, never to invent percentages.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

# ---------------------------------------------------------------------------
# Realistic Indian benchmarks (long-run, post-expense, pre-tax indicative).
# Sources informed by 15-yr CAGR of Nifty 50 TRI, AMFI flexi/multi-cap medians,
# EPFO declared rates, RBI repo-linked FD spreads, RBI inflation prints.
# ---------------------------------------------------------------------------

INFLATION_LONG_TERM: float = 6.0  # CPI ~5.5% but plan with 6% headroom

# Blended portfolio profiles (mean nominal return %, std-dev %, equity weight %).
BLENDED_PROFILES: dict[str, dict[str, float]] = {
    # Capital preservation — heavy debt + small equity / gold tilt.
    "low": {"mean": 7.8, "stdev": 5.0, "equity_pct": 25.0},
    # Default Indian middle-class plan — 60/30/10 (equity / debt / gold).
    "moderate": {"mean": 10.5, "stdev": 10.0, "equity_pct": 60.0},
    # Long-horizon equity tilt — flexi/multi-cap heavy.
    "high": {"mean": 12.5, "stdev": 14.0, "equity_pct": 85.0},
}

# Spread used for pessimistic / optimistic paths around the base mean.
_PESSIMISTIC_DELTA = -2.5  # ~ -1σ averaged over 10+ years
_OPTIMISTIC_DELTA = 2.0  # ~ +0.7σ — keeps the band realistic, not euphoric

VerdictSeverity = Literal["excellent", "healthy", "stretched", "concerning", "critical"]
Tone = Literal["celebrate", "encourage", "caution", "alarm"]


@dataclass
class Verdict:
    label: str
    severity: VerdictSeverity
    tone: Tone
    headline: str
    one_liner: str


@dataclass
class GoalFeasibility:
    feasible: bool
    sip_required_base: float
    sip_required_pessimistic: float
    sip_required_optimistic: float
    pct_of_current_savings: float  # 100 = exactly meets, 200 = needs 2x more
    label: str  # 'conservative' | 'on_track' | 'ambitious' | 'unrealistic'
    note: str


@dataclass
class PathPoint:
    year: int
    age: int
    contribution_to_date: float
    portfolio_value: float
    portfolio_pessimistic: float
    portfolio_optimistic: float
    nominal_target: float | None


@dataclass
class ScenarioOutcome:
    age: int
    horizon_years: int
    monthly_income: float
    monthly_expenses: float
    monthly_savings: float
    existing_emi_obligations: float
    current_savings: float
    target_corpus: float
    risk_appetite: str
    primary_goal: str
    notes: str | None
    profile_mean_pct: float
    profile_stdev_pct: float
    pessimistic_pct: float
    base_pct: float
    optimistic_pct: float
    foir_pct: float
    savings_rate_pct: float
    net_cashflow: float  # income - expenses - existing emi - declared savings
    emergency_fund_months: float
    health_score: int
    verdict: Verdict
    red_flags: list[str] = field(default_factory=list)
    green_flags: list[str] = field(default_factory=list)
    projections: list[PathPoint] = field(default_factory=list)
    inflation_adjusted_target: float | None = None
    real_corpus_at_horizon: float = 0.0  # base path, deflated by inflation
    goal_feasibility: GoalFeasibility | None = None


# ---------------------------------------------------------------------------
# Pure math helpers
# ---------------------------------------------------------------------------


def required_monthly_sip(target: float, years: int, annual_rate_pct: float) -> float:
    """Solve M from FV = M * ((1+r)^n - 1)/r * (1+r) where r is monthly rate."""
    n = years * 12
    if target <= 0 or n <= 0:
        return 0.0
    r = annual_rate_pct / 100.0 / 12.0
    if r <= 0:
        return target / n
    factor = ((1 + r) ** n - 1) / r * (1 + r)
    return target / factor if factor > 0 else 0.0


def _grow(portfolio: float, monthly_savings: float, monthly_rate: float) -> float:
    for _ in range(12):
        portfolio = portfolio * (1 + monthly_rate) + max(monthly_savings, 0.0)
    return portfolio


def _three_path_projection(
    *,
    age: int,
    horizon_years: int,
    monthly_savings: float,
    current_savings: float,
    base_pct: float,
    pessimistic_pct: float,
    optimistic_pct: float,
    target_corpus: float,
) -> list[PathPoint]:
    base = pess = opt = max(current_savings, 0.0)
    contributed = max(current_savings, 0.0)
    out: list[PathPoint] = []
    rb = base_pct / 100.0 / 12.0
    rp = pessimistic_pct / 100.0 / 12.0
    ro = optimistic_pct / 100.0 / 12.0
    for y in range(horizon_years + 1):
        nominal_target = (
            target_corpus * ((1 + INFLATION_LONG_TERM / 100.0) ** y) if target_corpus > 0 else None
        )
        out.append(
            PathPoint(
                year=y,
                age=age + y,
                contribution_to_date=round(contributed, 2),
                portfolio_value=round(base, 2),
                portfolio_pessimistic=round(pess, 2),
                portfolio_optimistic=round(opt, 2),
                nominal_target=round(nominal_target, 2) if nominal_target is not None else None,
            )
        )
        base = _grow(base, monthly_savings, rb)
        pess = _grow(pess, monthly_savings, rp)
        opt = _grow(opt, monthly_savings, ro)
        contributed += max(monthly_savings, 0.0) * 12
    return out


# ---------------------------------------------------------------------------
# Diagnostic logic
# ---------------------------------------------------------------------------


def _foir_pct(income: float, emi: float) -> float:
    return (max(emi, 0.0) / max(income, 1.0)) * 100.0


def _savings_rate_pct(income: float, savings: float) -> float:
    return (max(savings, 0.0) / max(income, 1.0)) * 100.0


def _emergency_fund_months(current_savings: float, monthly_expenses: float) -> float:
    if monthly_expenses <= 0:
        return 0.0
    return max(0.0, current_savings / monthly_expenses)


def _net_cashflow(income: float, expenses: float, emi: float, savings: float) -> float:
    """How much is *unaccounted* (positive) or overspent (negative) per month."""
    return income - expenses - emi - savings


def health_score(
    *,
    foir_pct: float,
    savings_rate_pct: float,
    emergency_months: float,
    age: int,
    net_cashflow: float,
    risk_appetite: str,
    horizon_years: int,
) -> int:
    """0–100 score combining cash-flow, debt load, EF coverage, and lifecycle fit."""
    score = 50.0

    # Savings discipline
    if savings_rate_pct >= 30:
        score += 22
    elif savings_rate_pct >= 20:
        score += 16
    elif savings_rate_pct >= 12:
        score += 8
    elif savings_rate_pct >= 5:
        score += 0
    else:
        score -= 18

    # Debt load (FOIR)
    if foir_pct <= 25:
        score += 14
    elif foir_pct <= 35:
        score += 8
    elif foir_pct <= 45:
        score += 0
    elif foir_pct <= 55:
        score -= 12
    else:
        score -= 24  # debt-trap territory

    # Emergency fund
    if emergency_months >= 9:
        score += 14
    elif emergency_months >= 6:
        score += 10
    elif emergency_months >= 3:
        score += 4
    elif emergency_months >= 1:
        score -= 4
    else:
        score -= 12

    # Cash flow consistency — punishing if monthly savings claim cannot mathematically be true
    if net_cashflow < -2000:
        score -= 14  # overspend
    elif net_cashflow < 0:
        score -= 6
    elif net_cashflow > 0.4 * max(savings_rate_pct, 1):
        score += 2  # disciplined buffer

    # Lifecycle / horizon
    if age <= 30 and horizon_years >= 15:
        score += 4
    elif age >= 55 and risk_appetite == "high":
        score -= 6  # high risk near retirement is fragile

    return int(max(0, min(100, round(score))))


def _detect_red_flags(
    *,
    income: float,
    expenses: float,
    emi: float,
    savings: float,
    current_savings: float,
    foir_pct: float,
    savings_rate_pct: float,
    emergency_months: float,
    net_cashflow: float,
    age: int,
    risk_appetite: str,
    sip_required_base: float,
) -> list[str]:
    red: list[str] = []
    if expenses + emi > income:
        red.append(
            f"Your expenses (₹{expenses:,.0f}) plus EMIs (₹{emi:,.0f}) already exceed income "
            f"(₹{income:,.0f}) — every month adds to debt."
        )
    if foir_pct > 60:
        red.append(
            f"FOIR is {foir_pct:.0f}% — you are in debt-trap territory. New EMIs of any kind are dangerous "
            "until existing loans shrink."
        )
    elif foir_pct > 50:
        red.append(
            f"FOIR is {foir_pct:.0f}% — banks treat anything above 50% as high stress. Avoid new EMIs."
        )
    if savings_rate_pct < 5:
        red.append(
            f"You save under {max(savings_rate_pct, 0):.1f}% of income — far below the 20% Indian middle-class "
            "benchmark. Most goals are unreachable at this pace."
        )
    if emergency_months < 1 and current_savings < expenses * 1.5:
        red.append(
            "You have less than one month of expenses in liquid savings — a single medical or job "
            "shock will force you into high-cost borrowing."
        )
    if savings > 0 and net_cashflow < -2000:
        red.append(
            f"The numbers don't add up: income minus expenses, EMIs and stated savings is ₹{net_cashflow:,.0f}/mo. "
            "Either expenses are under-reported or savings overstated."
        )
    if sip_required_base > 0 and savings > 0 and sip_required_base > savings * 1.5:
        red.append(
            f"Your goal needs ₹{sip_required_base:,.0f}/mo SIP but you save only ₹{savings:,.0f}/mo — "
            "the target is unrealistic at this horizon and risk profile."
        )
    if age >= 55 and risk_appetite == "high":
        red.append(
            "High equity risk this close to retirement can wipe out 5+ years of savings in a bad year."
        )
    if income > 0 and current_savings < income * 1.0 and age >= 35:
        red.append(
            f"By age {age} most planners expect 1–3x of annual income as savings; you have under one "
            "month's income — net-worth runway is dangerously thin."
        )
    return red


def _detect_green_flags(
    *,
    foir_pct: float,
    savings_rate_pct: float,
    emergency_months: float,
    sip_required_base: float,
    monthly_savings: float,
    age: int,
    horizon_years: int,
    risk_appetite: str,
) -> list[str]:
    green: list[str] = []
    if savings_rate_pct >= 25:
        green.append(f"Excellent savings rate of {savings_rate_pct:.1f}% — better than ~80% of urban Indian households.")
    elif savings_rate_pct >= 15:
        green.append(f"Healthy savings rate of {savings_rate_pct:.1f}%, above the typical 10–12% benchmark.")
    if foir_pct <= 30:
        green.append(f"FOIR of {foir_pct:.1f}% leaves comfortable headroom for new goals or a home loan if needed.")
    if emergency_months >= 6:
        green.append(f"Emergency fund covers ~{emergency_months:.1f} months of expenses — strong shock absorber.")
    if (
        sip_required_base > 0
        and monthly_savings > 0
        and sip_required_base <= 0.7 * monthly_savings
    ):
        green.append("Your goal is achievable comfortably within your current monthly savings — room to aim higher.")
    if age <= 30 and horizon_years >= 15 and risk_appetite in {"moderate", "high"}:
        green.append("Long horizon + reasonable risk = compounding will do the heavy lifting if you stay disciplined.")
    return green


def verdict_from_signals(
    *,
    score: int,
    foir_pct: float,
    savings_rate_pct: float,
    emergency_months: float,
    net_cashflow: float,
    expenses: float,
    emi: float,
    income: float,
    sip_required_base: float,
    monthly_savings: float,
) -> Verdict:
    # --- Critical: existing debt trap or unsustainable cash flow ---
    if foir_pct > 60 or expenses + emi > income or (foir_pct > 45 and savings_rate_pct < 5):
        return Verdict(
            label="Debt-trap risk",
            severity="critical",
            tone="alarm",
            headline=f"You are in financial overload — FOIR {foir_pct:.0f}%, savings {savings_rate_pct:.1f}%.",
            one_liner=(
                "Stop adding new EMIs immediately. Pay down the most expensive loan first, "
                "rebuild a 1-month buffer, and only then think about investing."
            ),
        )

    # --- Concerning: stretched + thin EF ---
    if score < 45 or (foir_pct > 50 and emergency_months < 3) or savings_rate_pct < 8:
        return Verdict(
            label="Concerning",
            severity="concerning",
            tone="caution",
            headline=(
                f"Score {score}/100 with FOIR {foir_pct:.0f}% and savings rate {savings_rate_pct:.1f}% "
                "— stretched and fragile."
            ),
            one_liner=(
                "Cut one or two large discretionary line items, redirect to an emergency buffer, "
                "and avoid new long-tenure loans for the next 12 months."
            ),
        )

    # --- Stretched: workable but with clear gaps ---
    if score < 60 or (
        sip_required_base > monthly_savings and monthly_savings > 0
    ) or emergency_months < 3:
        return Verdict(
            label="Stretched",
            severity="stretched",
            tone="caution",
            headline=(
                f"Score {score}/100 — workable, but a few gaps will hurt if you don't address them this year."
            ),
            one_liner=(
                "Lift the savings rate above 20% and finish the emergency fund before expanding "
                "EMIs or chasing equity exposure."
            ),
        )

    # --- Healthy: solid baseline ---
    if score < 78:
        return Verdict(
            label="Healthy",
            severity="healthy",
            tone="encourage",
            headline=f"Score {score}/100 — you are on a sound, repeatable plan.",
            one_liner=(
                "Automate SIPs, review allocation once a year, and resist the urge to time markets. "
                "Aim for one structural improvement (income, EF months, or asset mix) every 12 months."
            ),
        )

    # --- Excellent: top decile setup ---
    return Verdict(
        label="Excellent",
        severity="excellent",
        tone="celebrate",
        headline=(
            f"Score {score}/100 — savings rate {savings_rate_pct:.0f}%, FOIR {foir_pct:.0f}%, "
            f"emergency fund {emergency_months:.1f} months."
        ),
        one_liner=(
            "You're in the top decile of Indian household balance sheets. Protect the streak: "
            "rebalance annually, don't over-leverage, and keep raising the goal as income grows."
        ),
    )


def _goal_feasibility(
    *,
    target: float,
    horizon_years: int,
    base_pct: float,
    pessimistic_pct: float,
    optimistic_pct: float,
    monthly_savings: float,
) -> GoalFeasibility | None:
    if target <= 0:
        return None
    sip_b = required_monthly_sip(target, horizon_years, base_pct)
    sip_p = required_monthly_sip(target, horizon_years, pessimistic_pct)
    sip_o = required_monthly_sip(target, horizon_years, optimistic_pct)
    if monthly_savings <= 0:
        return GoalFeasibility(
            feasible=False,
            sip_required_base=round(sip_b, 0),
            sip_required_pessimistic=round(sip_p, 0),
            sip_required_optimistic=round(sip_o, 0),
            pct_of_current_savings=10000.0,
            label="unrealistic",
            note=(
                f"You report no monthly savings; reaching ₹{target:,.0f} in {horizon_years} years would "
                f"need ₹{sip_b:,.0f}/mo at the base return."
            ),
        )
    pct = sip_b / monthly_savings * 100.0
    if pct <= 50:
        label, note = (
            "conservative",
            f"Comfortably within reach — only {pct:.0f}% of your monthly savings is needed at the base return.",
        )
    elif pct <= 100:
        label, note = (
            "on_track",
            f"On track. About {pct:.0f}% of your monthly savings goes to this goal at the base return.",
        )
    elif pct <= 150:
        label, note = (
            "ambitious",
            f"Ambitious — needs {pct:.0f}% of current monthly savings. A 2–3 year horizon extension or income "
            "growth makes it reachable.",
        )
    else:
        label, note = (
            "unrealistic",
            f"Unrealistic at this pace — base case needs {pct:.0f}% of current monthly savings. "
            "Cut target, push horizon out, or boost income before committing.",
        )
    return GoalFeasibility(
        feasible=pct <= 110,
        sip_required_base=round(sip_b, 0),
        sip_required_pessimistic=round(sip_p, 0),
        sip_required_optimistic=round(sip_o, 0),
        pct_of_current_savings=round(pct, 1),
        label=label,
        note=note,
    )


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def analyse_scenario(req: dict[str, Any]) -> ScenarioOutcome:
    """Pure function: scenario request dict → ScenarioOutcome."""
    risk = str(req.get("risk_appetite") or "moderate")
    profile = BLENDED_PROFILES.get(risk, BLENDED_PROFILES["moderate"])
    base_pct = float(profile["mean"])
    stdev = float(profile["stdev"])
    pessimistic_pct = max(2.0, base_pct + _PESSIMISTIC_DELTA)
    optimistic_pct = base_pct + _OPTIMISTIC_DELTA

    income = float(req.get("monthly_income") or 0)
    expenses = float(req.get("monthly_expenses") or 0)
    savings = float(req.get("monthly_savings") or 0)
    emi = float(req.get("existing_emi_obligations") or 0)
    current = float(req.get("current_savings") or 0)
    target = float(req.get("target_corpus") or 0)
    horizon = int(req.get("horizon_years") or 10)
    age = int(req.get("age") or 30)

    foir = round(_foir_pct(income, emi), 2)
    sr = round(_savings_rate_pct(income, savings), 2)
    ef = round(_emergency_fund_months(current, expenses), 2)
    nc = round(_net_cashflow(income, expenses, emi, savings), 2)

    sip_b = required_monthly_sip(target, horizon, base_pct)

    score = health_score(
        foir_pct=foir,
        savings_rate_pct=sr,
        emergency_months=ef,
        age=age,
        net_cashflow=nc,
        risk_appetite=risk,
        horizon_years=horizon,
    )

    red = _detect_red_flags(
        income=income,
        expenses=expenses,
        emi=emi,
        savings=savings,
        current_savings=current,
        foir_pct=foir,
        savings_rate_pct=sr,
        emergency_months=ef,
        net_cashflow=nc,
        age=age,
        risk_appetite=risk,
        sip_required_base=sip_b,
    )
    green = _detect_green_flags(
        foir_pct=foir,
        savings_rate_pct=sr,
        emergency_months=ef,
        sip_required_base=sip_b,
        monthly_savings=savings,
        age=age,
        horizon_years=horizon,
        risk_appetite=risk,
    )

    verdict = verdict_from_signals(
        score=score,
        foir_pct=foir,
        savings_rate_pct=sr,
        emergency_months=ef,
        net_cashflow=nc,
        expenses=expenses,
        emi=emi,
        income=income,
        sip_required_base=sip_b,
        monthly_savings=savings,
    )

    projections = _three_path_projection(
        age=age,
        horizon_years=horizon,
        monthly_savings=savings,
        current_savings=current,
        base_pct=base_pct,
        pessimistic_pct=pessimistic_pct,
        optimistic_pct=optimistic_pct,
        target_corpus=target,
    )

    inflation_target = (
        round(target * ((1 + INFLATION_LONG_TERM / 100.0) ** horizon), 2) if target > 0 else None
    )
    real_corpus = (
        projections[-1].portfolio_value / ((1 + INFLATION_LONG_TERM / 100.0) ** horizon)
        if projections
        else 0.0
    )

    feasibility = _goal_feasibility(
        target=target,
        horizon_years=horizon,
        base_pct=base_pct,
        pessimistic_pct=pessimistic_pct,
        optimistic_pct=optimistic_pct,
        monthly_savings=savings,
    )

    return ScenarioOutcome(
        age=age,
        horizon_years=horizon,
        monthly_income=income,
        monthly_expenses=expenses,
        monthly_savings=savings,
        existing_emi_obligations=emi,
        current_savings=current,
        target_corpus=target,
        risk_appetite=risk,
        primary_goal=str(req.get("primary_goal") or "wealth_growth"),
        notes=(req.get("notes") or None),
        profile_mean_pct=base_pct,
        profile_stdev_pct=stdev,
        pessimistic_pct=round(pessimistic_pct, 2),
        base_pct=round(base_pct, 2),
        optimistic_pct=round(optimistic_pct, 2),
        foir_pct=foir,
        savings_rate_pct=sr,
        net_cashflow=nc,
        emergency_fund_months=ef,
        health_score=score,
        verdict=verdict,
        red_flags=red,
        green_flags=green,
        projections=projections,
        inflation_adjusted_target=inflation_target,
        real_corpus_at_horizon=round(real_corpus, 2),
        goal_feasibility=feasibility,
    )
