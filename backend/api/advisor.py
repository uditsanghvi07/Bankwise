"""Advisor route — deterministic financial diagnosis + opinionated LLM narrative."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter

from advisor.engine import (
    BLENDED_PROFILES,
    INFLATION_LONG_TERM,
    ScenarioOutcome,
    analyse_scenario,
)
from llm.deepseek_client import chat_completion
from schemas.advisor import (
    AdvisorGoalFeasibility,
    AdvisorRecommendation,
    AdvisorResponse,
    AdvisorScenarioRequest,
    AdvisorScenarioReturns,
    AdvisorVerdict,
    ProjectionPoint,
)

router = APIRouter(prefix="/advisor", tags=["advisor"])


# ---------------------------------------------------------------------------
# Recommendation builder — opinionated, severity-aware.
# Recommendations follow the user's *current* state, not generic templates.
# ---------------------------------------------------------------------------


def _recommendations(outcome: ScenarioOutcome) -> list[AdvisorRecommendation]:
    recs: list[AdvisorRecommendation] = []
    sev = outcome.verdict.severity
    foir = outcome.foir_pct
    sr = outcome.savings_rate_pct
    ef_months = outcome.emergency_fund_months
    age = outcome.age
    risk = outcome.risk_appetite
    expenses = outcome.monthly_expenses

    # 1. Crisis-first ordering --------------------------------------------------
    if sev == "critical":
        recs.append(
            AdvisorRecommendation(
                title="Stop new EMIs and triage existing debt",
                detail=(
                    f"FOIR is {foir:.0f}%. Make a list of every EMI with its interest rate and prepay the most "
                    "expensive (credit cards, personal loans > 14%) using any liquid savings beyond ~1 month of "
                    "expenses. Refinance / consolidate where possible. No new tenure-extending debt for 12 months."
                ),
                weight_pct=35,
            )
        )
        recs.append(
            AdvisorRecommendation(
                title="Rebuild a 1-month survival buffer first",
                detail=(
                    f"Park ~₹{expenses:,.0f} in a sweep-in FD or liquid fund before *any* equity exposure. "
                    "Without it, the next medical or job shock will force fresh high-cost borrowing."
                ),
                weight_pct=25,
            )
        )

    elif sev in ("concerning", "stretched"):
        if ef_months < 6:
            target = expenses * 6
            recs.append(
                AdvisorRecommendation(
                    title="Finish the 6-month emergency fund",
                    detail=(
                        f"You have ~{ef_months:.1f} months of cover; target is ₹{target:,.0f}. Use a sweep-in FD or "
                        "liquid fund — earn 6–7% while keeping it accessible."
                    ),
                    weight_pct=22,
                )
            )
        if foir > 45:
            recs.append(
                AdvisorRecommendation(
                    title="Lower your debt load",
                    detail=(
                        f"FOIR is {foir:.0f}%. Channel any annual bonus or windfall into prepaying the highest-rate "
                        "loan first. Refinance home loans if your repo-linked rate is more than 75bps above the "
                        "current best on the market."
                    ),
                    weight_pct=20,
                )
            )
        if sr < 15:
            recs.append(
                AdvisorRecommendation(
                    title="Lift the savings rate to 20%+",
                    detail=(
                        f"You currently save {sr:.1f}% of income. Aim for 20% in 12 months — review subscriptions, "
                        "food delivery, and lifestyle EMIs first; they are the usual culprits in Indian metros."
                    ),
                    weight_pct=18,
                )
            )

    else:  # healthy / excellent — push for optimisation, not basics
        if risk == "high" and age <= 40:
            recs.append(
                AdvisorRecommendation(
                    title="70/20/10 long-horizon SIP",
                    detail=(
                        "Default to ~70% diversified equity (Nifty 50 / multi-cap), 20% debt (PPF + medium-duration), "
                        "10% gold ETF. Step up SIPs by 10% each year — that single habit adds ~30% to terminal corpus "
                        "over 20 years."
                    ),
                    weight_pct=30,
                )
            )
        elif risk == "moderate":
            recs.append(
                AdvisorRecommendation(
                    title="Balanced 60/30/10 with annual rebalancing",
                    detail=(
                        "60% equity / 30% debt (EPF + PPF + corporate-bond fund) / 10% gold. Rebalance once a year "
                        "when any sleeve drifts > 10pp; no market-timing required."
                    ),
                    weight_pct=26,
                )
            )
        else:
            recs.append(
                AdvisorRecommendation(
                    title="Capital-protection portfolio",
                    detail=(
                        "Keep equity at 20–30%, the rest in PPF + EPF + short-duration debt + senior-citizen FD if "
                        "applicable. Returns will trail inflation by 1–2pp; that is the price of low volatility."
                    ),
                    weight_pct=24,
                )
            )

    # 2. Goal-specific guidance -------------------------------------------------
    if outcome.primary_goal == "tax_saving":
        recs.append(
            AdvisorRecommendation(
                title="Section 80C: max ELSS + EPF + PPF first",
                detail=(
                    "Hit the ₹1.5L 80C limit using ELSS (3-yr lock-in, equity), EPF, PPF and home-loan principal "
                    "before chasing other instruments. Compare with the new tax regime each March — 80C only matters "
                    "if you are on the old regime."
                ),
                weight_pct=14,
            )
        )
    elif outcome.primary_goal == "home" and foir < 35:
        recs.append(
            AdvisorRecommendation(
                title="Stay under 40% FOIR when sizing the home loan",
                detail=(
                    "Banks may sanction up to 60%, but real-life buffer for repairs, school fees, and rate hikes "
                    "needs FOIR ≤ 40%. Keep the down-payment ≥ 20% to avoid LTV penalties."
                ),
                weight_pct=14,
            )
        )
    elif outcome.primary_goal == "retirement" and outcome.horizon_years >= 15:
        recs.append(
            AdvisorRecommendation(
                title="Add NPS Tier-I for retirement",
                detail=(
                    "NPS gives an extra ₹50K 80CCD(1B) deduction and forces a long-tenure equity-debt mix. "
                    "Pair it with EPF/VPF — the equity sleeve does the heavy compounding to age 60."
                ),
                weight_pct=12,
            )
        )

    # 3. Universal hygiene reminder when the plan is otherwise clean -----------
    if not recs:
        recs.append(
            AdvisorRecommendation(
                title="Maintain the engine — don't tinker",
                detail=(
                    "Inputs look strong. Automate SIPs, rebalance once a year, top up term + health cover when "
                    "income jumps, and resist hot tips."
                ),
                weight_pct=20,
            )
        )

    # Normalise weights to 100%
    total = sum(r.weight_pct for r in recs)
    if total > 0:
        for r in recs:
            r.weight_pct = round(r.weight_pct * 100 / total, 1)
    return recs


# ---------------------------------------------------------------------------
# Risk callouts
# ---------------------------------------------------------------------------


def _risks(outcome: ScenarioOutcome) -> list[str]:
    out = [
        f"All projections assume a constant base return of {outcome.base_pct:.1f}% p.a. (with ±2pp scenarios). "
        "Real outcomes will swing more than this band, especially in equity-heavy plans.",
        f"Inflation modelled at {INFLATION_LONG_TERM:.0f}% — if CPI runs hotter your real corpus shrinks faster than the chart suggests.",
    ]
    if outcome.risk_appetite == "high":
        out.append("Equity-heavy portfolios can lose 30–50% in a bad year. Only commit money you do not need within 5 years.")
    if outcome.existing_emi_obligations > 0:
        out.append("Missed EMIs hurt CIBIL more than missed SIPs — never let an investment plan starve a loan repayment.")
    if outcome.emergency_fund_months < 6:
        out.append("Without 6 months of expenses in liquid form, any market drawdown forces you to redeem at the worst time.")
    if outcome.target_corpus > 0 and outcome.goal_feasibility and outcome.goal_feasibility.label in {"ambitious", "unrealistic"}:
        out.append(
            f"At the pessimistic return ({outcome.pessimistic_pct:.1f}%), you would need ₹{outcome.goal_feasibility.sip_required_pessimistic:,.0f}/mo "
            "instead — significantly more than the base figure."
        )
    return out


def _disclaimers() -> list[str]:
    return [
        "**Educational guidance only** — not investment, tax, or legal advice.",
        "Tax rules, slab choices, and product features change every Budget. Verify with your bank, AMC, or a SEBI-registered adviser before acting.",
        "BankWise AI does not recommend specific stocks, funds, NFOs, or crypto.",
    ]


# ---------------------------------------------------------------------------
# LLM narrative — opinionated, grounded in the deterministic facts
# ---------------------------------------------------------------------------


_NARRATIVE_SYSTEM = (
    "You are BankWise AI's senior advisor. The deterministic engine has already produced a verdict, "
    "red flags, green flags, and goal feasibility. Your job is to write an HONEST NARRATIVE.\n\n"
    "FORMAT — mandatory:\n"
    "* Output exactly 5–7 bullet points using a markdown dash list (- point one\\n- point two\\n...).\n"
    "* Each bullet is ONE sentence — 12–20 words. Direct, plain, human. No sub-bullets.\n"
    "* No intro line, no heading, no disclaimer, no closing summary. Just the bullets.\n\n"
    "CONTENT rules:\n"
    "* Lead with the most important truth (red flag first if any, green flag first if healthy).\n"
    "* At least 3 bullets must contain a real number from the data (FOIR%, savings rate%, "
    "SIP required, EF months, required income, etc.).\n"
    "* If the goal is unrealistic or needs adjustment, say so plainly in one bullet with the exact shortfall.\n"
    "* If the setup is strong, say so — but give one concrete 'next upgrade' action.\n"
    "* Sound like a senior banker friend — direct, no jargon walls, no therapy tone.\n"
    "* Do NOT invent percentages, products, or tax rules — only use the numbers provided.\n"
    "* Indian context: rupees, FOIR, EPF/PPF, SIP, CIBIL."
)


def _narrative_prompt(outcome: ScenarioOutcome) -> str:
    feas = outcome.goal_feasibility
    parts = [
        f"Verdict: {outcome.verdict.label} ({outcome.verdict.severity}, tone={outcome.verdict.tone}).",
        f"Headline: {outcome.verdict.headline}",
        f"Score: {outcome.health_score}/100, FOIR {outcome.foir_pct:.1f}%, savings rate {outcome.savings_rate_pct:.1f}%, "
        f"emergency cover {outcome.emergency_fund_months:.1f} months, net cash-flow ₹{outcome.net_cashflow:,.0f}/mo.",
        f"Risk profile: {outcome.risk_appetite} (base return {outcome.base_pct:.1f}% p.a., "
        f"pessimistic {outcome.pessimistic_pct:.1f}%, optimistic {outcome.optimistic_pct:.1f}%).",
        f"Horizon: {outcome.horizon_years} years; primary goal: {outcome.primary_goal}.",
        f"Income ₹{outcome.monthly_income:,.0f}/mo, expenses ₹{outcome.monthly_expenses:,.0f}/mo, "
        f"savings ₹{outcome.monthly_savings:,.0f}/mo, existing EMIs ₹{outcome.existing_emi_obligations:,.0f}/mo, "
        f"liquid savings ₹{outcome.current_savings:,.0f}.",
    ]
    if outcome.target_corpus > 0 and feas:
        parts.append(
            f"Goal: ₹{outcome.target_corpus:,.0f} → SIP needed at base {feas.sip_required_base:,.0f}/mo "
            f"({feas.label}, {feas.pct_of_current_savings:.0f}% of current monthly savings)."
        )
    if outcome.red_flags:
        parts.append("Red flags: " + " | ".join(outcome.red_flags))
    if outcome.green_flags:
        parts.append("Green flags: " + " | ".join(outcome.green_flags))
    if outcome.notes:
        parts.append(f"User note: {outcome.notes[:300]}")
    parts.append("Write the narrative now.")
    return "\n".join(parts)


async def _llm_narrative(outcome: ScenarioOutcome) -> str:
    """Try DeepSeek with the opinionated prompt; fall back to a deterministic narrative."""
    user = _NARRATIVE_SYSTEM + "\n\n---\n" + _narrative_prompt(outcome)
    try:
        text, _ = await chat_completion(user, history=[])
        if text and text.strip():
            return text.strip()
    except Exception:
        pass
    # Deterministic fallback — bullet points, never bland.
    bullets: list[str] = []
    bullets.append(outcome.verdict.headline)
    bullets.append(outcome.verdict.one_liner)
    if outcome.red_flags:
        bullets.append(outcome.red_flags[0])
    if outcome.green_flags:
        bullets.append(outcome.green_flags[0])
    if outcome.goal_feasibility:
        bullets.append(outcome.goal_feasibility.note)
    bullets.append(
        f"Emergency cover is {outcome.emergency_fund_months:.1f} months — aim for 6 before "
        "increasing SIPs or taking on new EMIs."
    )
    return "\n".join(f"- {b}" for b in bullets[:7])


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------


def _outcome_to_response(outcome: ScenarioOutcome, narrative: str) -> AdvisorResponse:
    profile = BLENDED_PROFILES.get(outcome.risk_appetite, BLENDED_PROFILES["moderate"])
    sip_required = outcome.goal_feasibility.sip_required_base if outcome.goal_feasibility else 0.0
    return AdvisorResponse(
        summary=outcome.verdict.headline,
        health_score=outcome.health_score,
        foir_used_pct=outcome.foir_pct,
        savings_rate_pct=outcome.savings_rate_pct,
        net_cashflow=outcome.net_cashflow,
        emergency_fund_months=outcome.emergency_fund_months,
        expected_return_pct=outcome.base_pct,
        monthly_sip_required=sip_required,
        inflation_adjusted_target=outcome.inflation_adjusted_target,
        real_corpus_at_horizon=outcome.real_corpus_at_horizon,
        returns=AdvisorScenarioReturns(
            profile=outcome.risk_appetite,  # type: ignore[arg-type]
            base_pct=outcome.base_pct,
            pessimistic_pct=outcome.pessimistic_pct,
            optimistic_pct=outcome.optimistic_pct,
            inflation_pct=INFLATION_LONG_TERM,
            profile_stdev_pct=float(profile["stdev"]),
        ),
        verdict=AdvisorVerdict(
            label=outcome.verdict.label,
            severity=outcome.verdict.severity,
            tone=outcome.verdict.tone,
            headline=outcome.verdict.headline,
            one_liner=outcome.verdict.one_liner,
        ),
        goal_feasibility=(
            AdvisorGoalFeasibility(
                feasible=outcome.goal_feasibility.feasible,
                sip_required_base=outcome.goal_feasibility.sip_required_base,
                sip_required_pessimistic=outcome.goal_feasibility.sip_required_pessimistic,
                sip_required_optimistic=outcome.goal_feasibility.sip_required_optimistic,
                pct_of_current_savings=outcome.goal_feasibility.pct_of_current_savings,
                label=outcome.goal_feasibility.label,  # type: ignore[arg-type]
                note=outcome.goal_feasibility.note,
            )
            if outcome.goal_feasibility
            else None
        ),
        red_flags=outcome.red_flags,
        green_flags=outcome.green_flags,
        projections=[
            ProjectionPoint(
                year=p.year,
                age=p.age,
                contribution_to_date=p.contribution_to_date,
                portfolio_value=p.portfolio_value,
                portfolio_pessimistic=p.portfolio_pessimistic,
                portfolio_optimistic=p.portfolio_optimistic,
                nominal_target=p.nominal_target,
            )
            for p in outcome.projections
        ],
        recommendations=_recommendations(outcome),
        risks=_risks(outcome),
        disclaimers=_disclaimers(),
        narrative=narrative,
    )


@router.post("/scenario", response_model=AdvisorResponse)
async def advisor_scenario(req: AdvisorScenarioRequest):
    outcome = analyse_scenario(req.model_dump())
    narrative_task = asyncio.create_task(_llm_narrative(outcome))
    narrative = await narrative_task
    return _outcome_to_response(outcome, narrative)
