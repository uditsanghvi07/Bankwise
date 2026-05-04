"""Map executed tool calls + tool outputs to frontend widget payloads; merge with <widget> parsing."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import AIMessage, BaseMessage, ToolMessage

from core.widget_parser import split_text_and_widget


def _tool_call_args(tc: Any) -> dict[str, Any]:
    if isinstance(tc, dict):
        args = tc.get("args") or tc.get("arguments") or {}
        if isinstance(args, str):
            try:
                return json.loads(args) if args else {}
            except json.JSONDecodeError:
                return {}
        return dict(args) if isinstance(args, dict) else {}
    args = getattr(tc, "args", None)
    if isinstance(args, str):
        try:
            return json.loads(args) if args else {}
        except json.JSONDecodeError:
            return {}
    return dict(args or {})


def _tool_call_name(tc: Any) -> str:
    if isinstance(tc, dict):
        return str(tc.get("name") or "")
    return str(getattr(tc, "name", "") or "")


def widget_from_messages(messages: list[BaseMessage]) -> dict[str, Any] | None:
    """Walk AIMessage.tool_calls + following ToolMessages in order; last mappable widget wins."""
    last_widget: dict[str, Any] | None = None
    i = 0
    while i < len(messages):
        m = messages[i]
        if isinstance(m, AIMessage) and m.tool_calls:
            calls = [(_tool_call_name(tc), _tool_call_args(tc)) for tc in m.tool_calls]
            i += 1
            for name, args in calls:
                if i >= len(messages) or not isinstance(messages[i], ToolMessage):
                    break
                tm = messages[i]
                i += 1
                try:
                    data = json.loads(str(tm.content))
                except json.JSONDecodeError:
                    data = {}
                w = _map_tool_to_widget(name, args, data)
                if w:
                    last_widget = w
            continue
        i += 1
    return last_widget


def _map_tool_to_widget(name: str, args: dict[str, Any], data: dict[str, Any]) -> dict[str, Any] | None:
    _ = data  # reserved for future validation against tool JSON
    if name == "bankwise_emi_engine":
        return {
            "type": "emi_calculator",
            "params": {
                "principal": float(args.get("principal", 0)),
                "annual_rate": float(args.get("annual_rate", 0)),
                "tenure_months": int(args.get("tenure_months", 0)),
                "prepayment_amount": args.get("prepayment_amount"),
                "prepayment_after_month": args.get("prepayment_after_month"),
            },
        }
    if name == "bankwise_eligibility_engine":
        return {
            "type": "loan_eligibility",
            "params": {
                "monthly_income": float(args.get("monthly_income", 0)),
                "monthly_obligations": float(args.get("existing_emi_obligations", 0)),
                "loan_type": str(args.get("loan_type", "home")),
                "annual_rate": float(args.get("annual_rate", 0)),
                "tenure_months": int(args.get("requested_tenure_months", 0)),
                "requested_principal": args.get("requested_principal"),
            },
        }
    if name == "bankwise_sip_engine":
        return {
            "type": "sip_calculator",
            "params": {
                "monthly_sip": float(args.get("monthly_sip", 0)),
                "annual_rate": float(args.get("annual_rate", 0)),
                "tenure_years": int(args.get("tenure_years", 0)),
            },
        }
    if name == "bankwise_fd_engine":
        return {
            "type": "fd_calculator",
            "params": {
                "principal": float(args.get("principal", 0)),
                "annual_rate": float(args.get("annual_rate", 0)),
                "tenure_years": float(args.get("tenure_years", 0)),
                "compounding_frequency": int(args.get("compounding_frequency", 12)),
                "senior_citizen": bool(args.get("senior_citizen", False)),
            },
        }
    if name == "bankwise_loan_compare_engine":
        try:
            loans = json.loads(str(args.get("loans_json", "[]")))
        except json.JSONDecodeError:
            loans = []
        if isinstance(loans, list) and loans:
            return {"type": "loan_comparison", "params": {"loans": loans}}
        return None
    if name == "bankwise_cibil_directional_engine":
        try:
            actions = json.loads(str(args.get("actions_json", "[]")))
        except json.JSONDecodeError:
            actions = []
        return {
            "type": "cibil_simulator",
            "params": {
                "current_score": int(args.get("current_score", 700)),
                "actions": actions if isinstance(actions, list) else [],
            },
        }
    return None


def extract_display_text(raw_ai: str, messages: list[BaseMessage]) -> tuple[str, dict[str, Any] | None]:
    text, w_tag = split_text_and_widget(raw_ai)
    w_tool = widget_from_messages(messages)
    # Tool output is authoritative when present; model may still echo a leaky <widget> tag.
    return text, w_tool or w_tag
