"""Realistic Indian-retail advisor engine."""

from advisor.engine import (
    BLENDED_PROFILES,
    INFLATION_LONG_TERM,
    analyse_scenario,
    health_score,
    verdict_from_signals,
)

__all__ = [
    "BLENDED_PROFILES",
    "INFLATION_LONG_TERM",
    "analyse_scenario",
    "health_score",
    "verdict_from_signals",
]
