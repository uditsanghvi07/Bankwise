"""Async DeepSeek chat client via OpenAI-compatible API."""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any
from urllib.parse import urlparse

import httpx

from core.config import get_settings
from core.system_prompt import SYSTEM_PROMPT


def _offline_assistant_reply(
    user_message: str,
    host: str,
    last_net_err: str | None,
    *,
    dev_mode: bool,
) -> str:
    """Human-readable reply when DeepSeek cannot be reached (network / TLS / DNS)."""
    u = user_message.strip()
    low = u.lower()
    greeting = ""
    if low in {"hi", "hello", "hey", "namaste", "good morning", "good evening", "gm", "ge"}:
        greeting = "Hello — welcome to BankWise AI.\n\n"
    elif len(low) < 24 and any(low.startswith(p) for p in ("hi ", "hello ", "hey ", "namaste")):
        greeting = "Hello — welcome to BankWise AI.\n\n"

    short_ack = ""
    if u and not greeting and len(u) < 160:
        short_ack = f"You wrote: **{u}**. I’ll answer in full as soon as the model link is working.\n\n"

    body = (
        f"{greeting}{short_ack}"
        f"**This server cannot reach the AI model right now** (HTTPS to `{host}`). "
        "That does **not** mean your Wi‑Fi to this page is broken — the **calculators** in the sidebar "
        "still run on this machine.\n\n"
        "**To fix chat:**\n"
        "1. Add a valid **DEEPSEEK_API_KEY** to `backend/.env` or the project root `.env`.\n"
        "2. Allow outbound HTTPS to that host (corporate firewall / VPN / proxy).\n"
        "3. Restart the backend after changing env.\n\n"
        "Once connected, ask about home loans, EMI, FOIR, CIBIL, SIP, FDs, or paste numbers for a quick check."
    )
    if dev_mode and last_net_err:
        body += f"\n\n*Dev:* `{last_net_err}`"
    return body


def _trim_history(history: list[dict[str, str]], max_pairs: int = 10) -> list[dict[str, str]]:
    """Keep last `max_pairs` user+assistant exchanges (max 20 messages)."""
    if len(history) <= max_pairs * 2:
        return history
    return history[-(max_pairs * 2) :]


async def chat_completion(user_message: str, history: list[dict[str, str]]) -> tuple[str, float]:
    settings = get_settings()
    if not settings.deepseek_api_key:
        u = user_message.strip().lower()
        hi = "Hello! " if u in {"hello", "hi", "hey", "namaste", "gm", "ge"} else ""
        return (
            f"{hi}The advisory model is **not configured** — add **DEEPSEEK_API_KEY** to `backend/.env` "
            "or the project root `.env`, then restart the backend. Quick tools (EMI, eligibility, etc.) "
            "in the sidebar still work without it.",
            0.0,
        )

    messages: list[dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(_trim_history(history))
    messages.append({"role": "user", "content": user_message})

    url = f"{settings.deepseek_base_url.rstrip('/')}/v1/chat/completions"
    payload: dict[str, Any] = {
        "model": settings.deepseek_model,
        "messages": messages,
        "temperature": settings.temperature,
        "max_tokens": settings.max_tokens,
    }

    t0 = time.perf_counter()
    host = urlparse(settings.deepseek_base_url).hostname or settings.deepseek_base_url
    data: dict[str, Any] | None = None
    last_net_err: str | None = None

    # trust_env=True: respect HTTP_PROXY / HTTPS_PROXY / NO_PROXY (corporate networks).
    # http2=False: avoids rare HTTP/2 + MITM issues; DeepSeek works fine on HTTP/1.1.
    _timeout = httpx.Timeout(120.0, connect=30.0, read=110.0, write=30.0, pool=10.0)
    _limits = httpx.Limits(max_keepalive_connections=8, max_connections=16)

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(
                timeout=_timeout,
                trust_env=True,
                http2=False,
                limits=_limits,
            ) as client:
                resp = await client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {settings.deepseek_api_key}",
                        "Content-Type": "application/json",
                    },
                    content=json.dumps(payload),
                )
                resp.raise_for_status()
                data = resp.json()
                break
        except httpx.HTTPStatusError as e:
            code = e.response.status_code
            if code in (401, 403):
                return (
                    "The model provider **rejected the API key** (HTTP "
                    f"{code}). Check **DEEPSEEK_API_KEY** in `backend/.env` or the project root `.env`, "
                    "restart the backend, and confirm the key is active on your DeepSeek account.",
                    time.perf_counter() - t0,
                )
            return (
                "The advisory service returned an unexpected response. Please try again in a moment, "
                f"or verify your API credentials if this persists. (HTTP {code})",
                time.perf_counter() - t0,
            )
        except httpx.RequestError as e:
            last_net_err = f"{type(e).__name__}: {e}"
            if attempt < 2:
                await asyncio.sleep(0.6 * (attempt + 1))
                continue
            dev = settings.environment.lower() in ("development", "dev")
            if settings.llm_network_fallback:
                return (
                    _offline_assistant_reply(user_message, host, last_net_err, dev_mode=dev),
                    time.perf_counter() - t0,
                )
            return (
                "The model API could not be reached from this machine (HTTPS to "
                f"{host}). Check internet, VPN or firewall, proxy settings, and that "
                "DEEPSEEK_API_KEY is set in `backend/.env` or the project root `.env`. "
                f"Technical detail: {last_net_err}",
                time.perf_counter() - t0,
            )
        except Exception:
            return (
                "Something went wrong while generating a response. Please try again shortly.",
                time.perf_counter() - t0,
            )

    if data is None:
        return (
            "Something went wrong while generating a response. Please try again shortly.",
            time.perf_counter() - t0,
        )

    elapsed = time.perf_counter() - t0
    try:
        choice = data["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, TypeError):
        return ("The model returned an empty response. Please try rephrasing your question.", elapsed)

    return (str(choice).strip(), elapsed)


_PDF_SUMMARY_MAX_TOKENS = 520


async def completion_with_system(
    *,
    system: str,
    user: str,
    max_tokens: int | None = None,
) -> tuple[str, float]:
    """Single-turn completion with a custom system prompt (e.g. PDF executive summary)."""
    settings = get_settings()
    if not settings.deepseek_api_key:
        return ("", 0.0)

    mt = min(max_tokens or _PDF_SUMMARY_MAX_TOKENS, settings.max_tokens)
    messages: list[dict[str, str]] = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
    url = f"{settings.deepseek_base_url.rstrip('/')}/v1/chat/completions"
    payload: dict[str, Any] = {
        "model": settings.deepseek_model,
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": mt,
    }
    t0 = time.perf_counter()
    host = urlparse(settings.deepseek_base_url).hostname or settings.deepseek_base_url
    data: dict[str, Any] | None = None
    last_net_err: str | None = None
    _timeout = httpx.Timeout(90.0, connect=20.0, read=80.0, write=20.0, pool=10.0)
    _limits = httpx.Limits(max_keepalive_connections=4, max_connections=8)

    for attempt in range(2):
        try:
            async with httpx.AsyncClient(
                timeout=_timeout,
                trust_env=True,
                http2=False,
                limits=_limits,
            ) as client:
                resp = await client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {settings.deepseek_api_key}",
                        "Content-Type": "application/json",
                    },
                    content=json.dumps(payload),
                )
                resp.raise_for_status()
                data = resp.json()
                break
        except httpx.HTTPStatusError:
            return ("", time.perf_counter() - t0)
        except httpx.RequestError as e:
            last_net_err = f"{type(e).__name__}: {e}"
            if attempt < 1:
                await asyncio.sleep(0.4 * (attempt + 1))
                continue
            return ("", time.perf_counter() - t0)
        except Exception:
            return ("", time.perf_counter() - t0)

    if data is None:
        return ("", time.perf_counter() - t0)
    elapsed = time.perf_counter() - t0
    try:
        choice = data["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, TypeError):
        return ("", elapsed)
    return (str(choice).strip(), elapsed)


def should_show_regulatory_footnote(text: str) -> bool:
    low = text.lower()
    triggers = (
        "rbi",
        "repo",
        "pmay",
        "subsidy",
        "section 80",
        "80c",
        "80d",
        "80e",
        "24(b)",
        "tds",
        "cibil",
        "nach",
        "sarfaesi",
        "mudra",
        "guideline",
        "regulation",
        "scheme",
    )
    if any(t in low for t in triggers):
        return True
    if "%" in text and any(x in low for x in ("interest", "rate", "roi", "apr")):
        return True
    return False
