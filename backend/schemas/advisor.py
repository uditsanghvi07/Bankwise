"""Schemas for the structured Advisor (scenario-based opinionated assessment)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class AdvisorScenarioRequest(BaseModel):
    age: int = Field(..., ge=18, le=80)
    monthly_income: float = Field(..., gt=0)
    monthly_expenses: float = Field(..., ge=0)
    monthly_savings: float = Field(..., ge=0)
    existing_emi_obligations: float = Field(default=0, ge=0)
    current_savings: float = Field(default=0, ge=0)
    target_corpus: float = Field(default=0, ge=0)
    horizon_years: int = Field(default=10, ge=1, le=40)
    risk_appetite: Literal["low", "moderate", "high"] = "moderate"
    primary_goal: Literal[
        "retirement",
        "home",
        "child_education",
        "wealth_growth",
        "emergency_fund",
        "tax_saving",
    ] = "wealth_growth"
    notes: str | None = Field(default=None, max_length=1000)


class ProjectionPoint(BaseModel):
    year: int
    age: int
    contribution_to_date: float
    portfolio_value: float
    portfolio_pessimistic: float | None = None
    portfolio_optimistic: float | None = None
    nominal_target: float | None = None


class AdvisorRecommendation(BaseModel):
    title: str
    detail: str
    weight_pct: float = Field(..., ge=0, le=100)


class AdvisorVerdict(BaseModel):
    label: str
    severity: Literal["excellent", "healthy", "stretched", "concerning", "critical"]
    tone: Literal["celebrate", "encourage", "caution", "alarm"]
    headline: str
    one_liner: str


class AdvisorGoalFeasibility(BaseModel):
    feasible: bool
    sip_required_base: float
    sip_required_pessimistic: float
    sip_required_optimistic: float
    pct_of_current_savings: float
    label: Literal["conservative", "on_track", "ambitious", "unrealistic"]
    note: str


class AdvisorScenarioReturns(BaseModel):
    """Return assumptions surfaced to the UI so users see *where* the numbers come from."""

    profile: Literal["low", "moderate", "high"]
    base_pct: float
    pessimistic_pct: float
    optimistic_pct: float
    inflation_pct: float
    profile_stdev_pct: float


class AdvisorResponse(BaseModel):
    summary: str
    health_score: int = Field(..., ge=0, le=100)
    foir_used_pct: float
    savings_rate_pct: float
    # Newer fields are optional so older client payloads (e.g. PDF export round-trips) keep working.
    net_cashflow: float = 0.0
    emergency_fund_months: float = 0.0
    expected_return_pct: float
    monthly_sip_required: float
    inflation_adjusted_target: float | None = None
    real_corpus_at_horizon: float = 0.0
    returns: AdvisorScenarioReturns | None = None
    verdict: AdvisorVerdict | None = None
    goal_feasibility: AdvisorGoalFeasibility | None = None
    red_flags: list[str] = Field(default_factory=list)
    green_flags: list[str] = Field(default_factory=list)
    projections: list[ProjectionPoint]
    recommendations: list[AdvisorRecommendation]
    risks: list[str]
    disclaimers: list[str]
    narrative: str
