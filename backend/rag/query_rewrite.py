"""
Query expansion helpers.

A single user query is often ambiguous or under-specified — *"FOIR for home
loan?"* could be served by chunks talking about **fixed obligations**,
**eligibility**, **DSR**, or even **PMAY** depending on intent. We mitigate
this with two well-known techniques:

* **Multi-query (synonym) expansion** — generate 2–3 paraphrases of the user
  query, run retrieval on each, and fuse the rankings.
* **Intent keyword expansion** — append banking-specific synonyms based on a
  small handcrafted lexicon (purely deterministic, no LLM, free).

We deliberately keep this *cheap and offline*: the LLM-based rewriter is
optional and only used when an API key is present and `RAG_USE_LLM_REWRITE`
is enabled.
"""

from __future__ import annotations

import os
import re
from typing import Iterable

# Short, curated synonym dictionary covering Indian retail banking jargon.
# This stays maintainable by hand and avoids dragging in WordNet.
_SYNONYM_GROUPS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("foir", ("fixed obligations to income", "fixed obligation ratio", "dsr", "debt service ratio")),
    ("emi", ("equated monthly instalment", "monthly payment", "monthly instalment")),
    ("cibil", ("credit score", "credit bureau", "credit report")),
    ("home loan", ("housing loan", "mortgage", "home finance")),
    ("personal loan", ("unsecured loan", "consumer loan")),
    ("sip", ("systematic investment plan", "monthly mutual fund investment")),
    ("ppf", ("public provident fund", "small savings scheme")),
    ("epf", ("employee provident fund", "epfo")),
    ("nps", ("national pension scheme", "national pension system")),
    ("repo", ("repo rate", "policy rate", "rbi policy rate")),
    ("ltv", ("loan to value", "down payment requirement")),
    ("nach", ("auto debit", "e-mandate", "ecs")),
    ("80c", ("section 80c", "tax saving")),
    ("pmay", ("pradhan mantri awas yojana", "housing subsidy")),
    ("fd", ("fixed deposit", "term deposit")),
    ("rd", ("recurring deposit",)),
    ("tax", ("income tax", "tax regime", "tds")),
    ("eligibility", ("loan eligibility", "qualify for loan", "approval criteria")),
    ("balance transfer", ("loan refinance", "loan switch")),
    ("foreclosure", ("prepayment", "early closure", "loan close")),
)


def _word_set(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def expand_with_synonyms(query: str, *, max_extra: int = 18) -> str:
    """Append (deterministically, idempotently) synonym tokens that match the query."""
    if not query.strip():
        return query
    qw = _word_set(query)
    extras: list[str] = []
    for trigger, synonyms in _SYNONYM_GROUPS:
        trig_tokens = trigger.split()
        if all(t in qw for t in trig_tokens):
            for s in synonyms:
                if s in query.lower():
                    continue
                extras.append(s)
                if len(extras) >= max_extra:
                    break
        if len(extras) >= max_extra:
            break
    if not extras:
        return query
    return query + "  (related: " + ", ".join(extras) + ")"


# Hand-tuned templates that work for short banking queries without any LLM call.
_TEMPLATE_REWRITES: tuple[str, ...] = (
    "{query}",
    "Explain {query} in the context of Indian retail banking",
    "What does a customer need to know about {query}",
)


def template_multi_query(query: str) -> list[str]:
    base = query.strip()
    if not base:
        return []
    out: list[str] = []
    seen: set[str] = set()
    for tmpl in _TEMPLATE_REWRITES:
        rewrite = tmpl.format(query=base)
        if rewrite not in seen:
            out.append(rewrite)
            seen.add(rewrite)
    expanded = expand_with_synonyms(base)
    if expanded != base and expanded not in seen:
        out.append(expanded)
    return out


def use_llm_rewrite_enabled() -> bool:
    return os.environ.get("RAG_USE_LLM_REWRITE", "").lower() in {"1", "true", "yes", "on"}


def split_llm_rewrites(text: str) -> list[str]:
    """Parse LLM output into individual query strings; defensive against formatting drift."""
    if not text:
        return []
    parts: list[str] = []
    for raw in re.split(r"\r?\n", text):
        line = raw.strip().lstrip("-*•").strip()
        line = re.sub(r"^\d+[\.\)]\s*", "", line)
        line = line.strip("'\" ")
        if 3 <= len(line) <= 200:
            parts.append(line)
    return parts[:4]
