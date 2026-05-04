"""Smoke tests for advisor scenario projections, conversations CRUD, and PDF export."""

from __future__ import annotations

import asyncio
import os

os.environ.setdefault("BANKWISE_AGENT_TEST_MODE", "0")

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture
def client():
    return TestClient(app)


def _patch_chat(monkeypatch, text: str = "Narrative placeholder.") -> None:
    async def _fake_chat_completion(user_message: str, history):
        return (text, 0.0)

    import api.advisor as advisor_mod
    monkeypatch.setattr(advisor_mod, "chat_completion", _fake_chat_completion)


def test_advisor_scenario_returns_projections(client: TestClient, monkeypatch):
    _patch_chat(monkeypatch)
    payload = {
        "age": 30,
        "monthly_income": 100000,
        "monthly_expenses": 50000,
        "monthly_savings": 25000,
        "existing_emi_obligations": 10000,
        "current_savings": 200000,
        "target_corpus": 10000000,
        "horizon_years": 15,
        "risk_appetite": "moderate",
        "primary_goal": "wealth_growth",
    }
    r = client.post("/api/advisor/scenario", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert 0 <= data["health_score"] <= 100
    assert data["expected_return_pct"] > 0
    assert len(data["projections"]) == 16
    assert data["projections"][-1]["age"] == 45
    assert data["recommendations"]
    assert data["disclaimers"]
    # New shape
    assert data["verdict"]["severity"] in {"excellent", "healthy", "stretched", "concerning", "critical"}
    assert data["returns"]["base_pct"] > 0
    assert data["projections"][5]["portfolio_pessimistic"] <= data["projections"][5]["portfolio_value"]
    assert data["projections"][5]["portfolio_optimistic"] >= data["projections"][5]["portfolio_value"]
    assert "goal_feasibility" in data and data["goal_feasibility"] is not None


def test_advisor_flags_debt_trap(client: TestClient, monkeypatch):
    _patch_chat(monkeypatch)
    # FOIR ~71% (50k EMI on 70k income) + only 2k saved → debt-trap territory
    payload = {
        "age": 35,
        "monthly_income": 70000,
        "monthly_expenses": 30000,
        "monthly_savings": 2000,
        "existing_emi_obligations": 50000,
        "current_savings": 8000,
        "target_corpus": 5000000,
        "horizon_years": 12,
        "risk_appetite": "moderate",
        "primary_goal": "wealth_growth",
    }
    r = client.post("/api/advisor/scenario", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["verdict"]["severity"] == "critical"
    assert data["foir_used_pct"] > 60
    assert data["red_flags"], "expected red flags for debt-trap profile"
    assert any("FOIR" in f or "debt" in f.lower() for f in data["red_flags"])


def test_advisor_excellent_profile(client: TestClient, monkeypatch):
    _patch_chat(monkeypatch)
    payload = {
        "age": 32,
        "monthly_income": 250000,
        "monthly_expenses": 90000,
        "monthly_savings": 90000,
        "existing_emi_obligations": 20000,
        "current_savings": 1500000,
        "target_corpus": 20000000,
        "horizon_years": 18,
        "risk_appetite": "moderate",
        "primary_goal": "retirement",
    }
    r = client.post("/api/advisor/scenario", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["verdict"]["severity"] in {"excellent", "healthy"}
    assert data["green_flags"]
    assert data["foir_used_pct"] < 20
    assert data["savings_rate_pct"] >= 30


def test_conversation_lifecycle(client: TestClient):
    r = client.post("/api/conversations/", json={"title": "Test convo"})
    assert r.status_code == 200
    cid = r.json()["id"]

    r = client.get("/api/conversations/")
    assert r.status_code == 200
    ids = [c["id"] for c in r.json()["conversations"]]
    assert cid in ids

    r = client.patch(f"/api/conversations/{cid}", json={"title": "Renamed"})
    assert r.status_code == 200

    r = client.get(f"/api/conversations/{cid}")
    assert r.status_code == 200
    assert r.json()["conversation"]["title"] == "Renamed"

    r = client.delete(f"/api/conversations/{cid}")
    assert r.status_code == 200


def test_export_advisor_pdf(client: TestClient):
    payload = {
        "request": {
            "age": 28,
            "monthly_income": 90000,
            "monthly_expenses": 40000,
            "monthly_savings": 25000,
            "existing_emi_obligations": 5000,
            "current_savings": 150000,
            "target_corpus": 5000000,
            "horizon_years": 10,
            "risk_appetite": "moderate",
            "primary_goal": "wealth_growth",
        },
        "response": {
            "summary": "Healthy savings rate.",
            "health_score": 78,
            "foir_used_pct": 5.5,
            "savings_rate_pct": 27.7,
            "expected_return_pct": 11.0,
            "monthly_sip_required": 22000.0,
            "projections": [
                {"year": 0, "age": 28, "contribution_to_date": 150000, "portfolio_value": 150000, "nominal_target": 5000000},
                {"year": 10, "age": 38, "contribution_to_date": 3150000, "portfolio_value": 5400000, "nominal_target": 8954000},
            ],
            "recommendations": [
                {"title": "Stay the course", "detail": "Automate SIPs.", "weight_pct": 60.0},
                {"title": "Emergency fund", "detail": "6 months expenses.", "weight_pct": 40.0},
            ],
            "risks": ["Markets are volatile."],
            "disclaimers": ["Educational only."],
            "narrative": "Your inputs look balanced.",
        },
    }
    r = client.post("/api/export/advisor", json=payload)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/pdf")
    assert r.content[:4] == b"%PDF"


def test_export_transcript_pdf(client: TestClient, monkeypatch):
    import api.export as export_mod
    from storage import get_store

    async def _fake_summary(*args, **kwargs):
        return (" - User compared two home loan rates.\n - Key difference is total interest over tenure.", 0.01)

    monkeypatch.setattr(export_mod, "completion_with_system", _fake_summary)

    r = client.post("/api/conversations/", json={"title": "PDF transcript test"})
    assert r.status_code == 200
    cid = r.json()["id"]

    async def _seed() -> None:
        store = get_store()
        await store.add_message(
            conversation_id=cid,
            role="user",
            content="Compare 8.5% vs 9%",
            derive_title=True,
        )
        await store.add_message(
            conversation_id=cid,
            role="assistant",
            content="See table:\n| Rate | EMI |\n| --- | --- |\n| 8.5% | x |\n<widget type=\"loan-compare\" data='{\"loans\":[{\"label\":\"A\",\"principal\":3000000,\"annual_rate\":8.5,\"tenure_months\":240},{\"label\":\"B\",\"principal\":3000000,\"annual_rate\":9,\"tenure_months\":240}]}'></widget>",
            widget={
                "type": "loan_comparison",
                "params": {
                    "loans": [
                        {"label": "A", "principal": 3000000, "annual_rate": 8.5, "tenure_months": 240},
                        {"label": "B", "principal": 3000000, "annual_rate": 9, "tenure_months": 240},
                    ]
                },
            },
            kb_citations=["KB:nach-001"],
        )

    asyncio.run(_seed())

    r = client.post("/api/export/transcript", json={"conversation_id": cid, "title": "Export title"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/pdf")
    assert r.content[:4] == b"%PDF"
