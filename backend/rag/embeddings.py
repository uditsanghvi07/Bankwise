"""
Dense embeddings via **sentence-transformers** (BGE-small by default).

This module is **lazy-loaded** and **optional**: if `sentence-transformers`
is not installed, `get_embedder()` returns `None` and the pipeline gracefully
falls back to pure BM25. This keeps the app runnable on machines without the
~120 MB ML stack.

Default model: `BAAI/bge-small-en-v1.5` — top of MTEB for sub-100 MB models,
384-dim, ~33 MB on-disk, English-only. Switch via `RAG_EMBED_MODEL` env var.
"""

from __future__ import annotations

import os
import threading
from functools import lru_cache
from typing import Any, Sequence

import numpy as np

DEFAULT_MODEL = os.environ.get("RAG_EMBED_MODEL", "BAAI/bge-small-en-v1.5")


class Embedder:
    """Wraps a sentence-transformers model and produces L2-normalized vectors."""

    def __init__(self, model_name: str, model: Any) -> None:
        self.model_name = model_name
        self._model = model
        self._lock = threading.Lock()
        self.dim: int = int(model.get_sentence_embedding_dimension())

    def encode(self, texts: Sequence[str], *, batch_size: int = 32) -> np.ndarray:
        """Encode and **L2-normalize** so cosine == dot-product."""
        if not texts:
            return np.zeros((0, self.dim), dtype=np.float32)
        # sentence-transformers is not strictly thread-safe across encode calls
        # for some backends; serialize for safety in async contexts.
        with self._lock:
            vecs = self._model.encode(
                list(texts),
                batch_size=batch_size,
                normalize_embeddings=True,
                convert_to_numpy=True,
                show_progress_bar=False,
            )
        return np.asarray(vecs, dtype=np.float32)


@lru_cache
def get_embedder() -> Embedder | None:
    """Lazy import — returns `None` if `sentence-transformers` is unavailable."""
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore
    except Exception:
        return None
    try:
        model = SentenceTransformer(DEFAULT_MODEL)
    except Exception:
        # Network / disk / model-name issue — fall back silently.
        return None
    return Embedder(DEFAULT_MODEL, model)


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity for already-normalized vectors == plain dot product."""
    return float(np.dot(a, b))
