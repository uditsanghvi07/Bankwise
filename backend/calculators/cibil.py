"""CIBIL score impact simulation (directional)."""

DISCLAIMER = (
    "These are directional estimates based on how CIBIL-style scoring is generally understood. "
    "Actual score changes depend on your full credit history and the bureau's proprietary algorithm."
)

ACTION_EFFECTS = {
    "pay_all_dues_on_time_6_months": (40, 60),
    "reduce_credit_utilization_below_30": (20, 40),
    "close_old_delinquent_account": (-10, 20),
    "new_credit_inquiry": (-10, -5),
    "add_secured_card": (15, 25),
    "settle_vs_close_loan_settled": (-100, -50),
    "settle_vs_close_loan_closed": (0, 20),
}


def _band(score: int) -> str:
    if score < 550:
        return "poor"
    if score < 650:
        return "fair"
    if score < 750:
        return "good"
    if score < 800:
        return "very_good"
    return "excellent"


def simulate(current_score: int, actions: list[dict]) -> dict:
    score = max(300, min(900, int(current_score)))
    timeline_parts: list[str] = []
    steps: list[dict] = []

    for raw in actions:
        action = (raw.get("action") or "").strip()
        impact = raw.get("impact")
        low, high = ACTION_EFFECTS.get(action, (0, 0))
        if impact is not None:
            delta = int(impact)
        else:
            delta = (low + high) // 2
        new_score = max(300, min(900, score + delta))
        steps.append(
            {
                "action": action,
                "delta": delta,
                "score_after": new_score,
            }
        )
        score = new_score
        if "inquiry" in action:
            timeline_parts.append("Hard inquiries: effect is often within a few months.")
        elif "6_months" in action or "pay_all" in action:
            timeline_parts.append("Sustained on-time payments: assess over 6–12 months.")
        elif "secured_card" in action:
            timeline_parts.append("Secured card history: typically 9–12 months to reflect fully.")
        else:
            timeline_parts.append("Credit behaviour changes: allow several billing cycles to reflect.")

    timeline = " ".join(timeline_parts) if timeline_parts else "Expect gradual updates over 3–12 months depending on the action."

    return {
        "current_score": int(current_score),
        "projected_score": score,
        "projected_band": _band(score),
        "steps": steps,
        "timeline_estimate": timeline,
        "disclaimer": DISCLAIMER,
    }
