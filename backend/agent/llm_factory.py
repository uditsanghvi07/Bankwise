"""LangChain Chat model wired to DeepSeek's OpenAI-compatible API."""

from __future__ import annotations

import agent.langchain_shim  # noqa: F401 — before langchain_openai / langchain_core

from langchain_openai import ChatOpenAI

from core.config import get_settings


def get_agent_chat_model() -> ChatOpenAI:
    s = get_settings()
    if not s.deepseek_api_key:
        raise RuntimeError("DEEPSEEK_API_KEY is not configured")
    base = s.deepseek_base_url.rstrip("/")
    if not base.endswith("/v1"):
        base = f"{base}/v1"
    return ChatOpenAI(
        model=s.deepseek_model,
        api_key=s.deepseek_api_key,
        base_url=base,
        temperature=s.temperature,
        max_tokens=s.max_tokens,
        timeout=110,
    )
