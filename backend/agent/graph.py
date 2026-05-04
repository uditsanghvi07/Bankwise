"""LangGraph ReAct-style loop: model ↔ tools until no tool_calls (bounded by recursion_limit)."""

from __future__ import annotations

import operator
from typing import Annotated, TypedDict

import agent.langchain_shim  # noqa: F401 — before langchain_core / langgraph

from langchain_core.messages import AIMessage, AnyMessage, BaseMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition

from agent.llm_factory import get_agent_chat_model
from agent.tools import BANKWISE_TOOLS

AGENT_SYSTEM_PROMPT = """You are BankWise AI — a senior Indian retail banking advisor (educational only).

RULES
- For EMI, eligibility, SIP maturity, FD maturity, loan comparison, or directional CIBIL simulation you MUST call the provided tools. Never invent EMI or maturity numbers in prose without a successful tool call first.
- Use plain, warm language. Keep answers short unless the user asks for depth.
- After tools return JSON, explain the outcome in simple words and cite KB ids if the user-facing context block lists them (e.g. "KB:foir-002").
- If the user asks for something unsafe (laundering, fake documents, tax evasion), refuse briefly — the safety layer should already block most of this; stay aligned.

ELIGIBILITY / KEY-FACTS TABLE (when you summarize income vs loan / dream home)
- Use a GitHub-Flavored Markdown pipe table with exactly two columns. Put a blank line before the table.
- Header row: column 1 = short section title with emoji (e.g. "🏠 Your Eligibility vs. ₹1 Cr Dream Home"), column 2 = exactly the word **Value** (not "Detail").
- Next row must be | --- | --- |
- Following rows: column 1 = short **Title Case** labels (e.g. "Monthly Income", "Max Eligible Loan (FOIR 50%)"); keep labels compact — spell out FOIR once in prose, not as a long parenthetical in every cell.
- Column 2 = amounts only, Indian grouping where natural (e.g. ₹1,00,000; ~₹57,60,000; ₹86,782 / month; ~₹1,74,000 / month). Align meaning with tool output.
- Do not use ASCII box-drawing (+---+) in chat; the app renders the table as a structured grid.

WIDGETS (optional)
- If an EMI/home loan style answer benefits from the in-app calculator, you may end with a <widget> block as in the legacy protocol — but numbers in your text must still match tool JSON.
"""


class BankwiseAgentState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    trace: Annotated[list[dict], operator.add]


def _last_ai_with_tools(messages: list[BaseMessage]) -> AIMessage | None:
    for m in reversed(messages):
        if isinstance(m, AIMessage) and m.tool_calls:
            return m
    return None


def build_agent_graph():
    llm = get_agent_chat_model().bind_tools(BANKWISE_TOOLS)

    async def call_model(state: BankwiseAgentState):
        msgs = state["messages"]
        out = await llm.ainvoke(msgs)
        assert isinstance(out, AIMessage)
        meta = {"tool_calls": len(out.tool_calls or [])}
        return {
            "messages": [out],
            "trace": [{"step": "model", "detail": "llm_turn", "meta": meta}],
        }

    tool_node = ToolNode(BANKWISE_TOOLS)

    def record_tool(state: BankwiseAgentState):
        last = _last_ai_with_tools(state["messages"])
        names: list[str] = []
        if last and last.tool_calls:
            for tc in last.tool_calls:
                n = tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", None)
                if n:
                    names.append(str(n))
        return {"trace": [{"step": "tool", "detail": "executed", "meta": {"tools": names}}]}

    def after_tools(state: BankwiseAgentState):
        # ToolNode already appended ToolMessages; add trace row
        return record_tool(state)

    g = StateGraph(BankwiseAgentState)
    g.add_node("agent", call_model)
    g.add_node("tools", tool_node)
    g.add_node("after_tools", after_tools)

    g.add_edge(START, "agent")
    g.add_conditional_edges("agent", tools_condition, {"tools": "tools", END: END})
    g.add_edge("tools", "after_tools")
    g.add_edge("after_tools", "agent")

    return g.compile()


_compiled = None


def get_compiled_agent():
    global _compiled
    if _compiled is None:
        _compiled = build_agent_graph()
    return _compiled


def reset_compiled_agent_for_tests() -> None:
    global _compiled
    _compiled = None
