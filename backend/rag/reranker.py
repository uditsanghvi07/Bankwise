"""
Cross-encoder reranker (lazy-loaded, optional).

Bi-encoders (the dense embedding model) score query/doc pairs *independently*,
which is fast but loses fine-grained interaction signal. A **cross-encoder**
takes the (query, doc) pair as a *single* input and produces a relevance score
— much higher precision at top-k, at the cost of being slower.

We only run the cross-encoder on a small candidate set (`fused_top_n`, default
12) so the latency overhead stays small (~50–80 ms on CPU for 12 pairs).

Default model: `cross-encoder/ms-marco-MiniLM-L-6-v2` — small, ~22 MB, trained
for passage ranking on MS MARCO. Switch via `RAG_RERANK_MODEL` env var.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

DEFAULT_MODEL = os.environ.get("RAG_RERANK_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")


class CrossReranker:
    """Thin wrapper around a sentence-transformers `CrossEncoder`."""

    def __init__(self, model_name: str, model: Any) -> None:
        self.model_name = model_name
        self._model = model

    def rerank(self, query: str, docs: list[str], top_k: int) -> list[tuple[int, float]]:
        if not docs:
            return []
        pairs = [(query, d) for d in docs]
        scores = self._model.predict(pairs, convert_to_numpy=True, show_progress_bar=False)
        idx = sorted(range(len(scores)), key=lambda i: float(scores[i]), reverse=True)
        return [(i, float(scores[i])) for i in idx[:top_k]]


@lru_cache
def get_reranker() -> CrossReranker | None:
    """Return a singleton cross-encoder, or `None` if unavailable."""
    try:
        from sentence_transformers import CrossEncoder  # type: ignore
    except Exception:
        return None
    try:
        model = CrossEncoder(DEFAULT_MODEL)
    except Exception:
        return None
    return CrossReranker(DEFAULT_MODEL, model)
