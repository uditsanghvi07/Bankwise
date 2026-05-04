"""Public retriever facade — delegates to the hybrid RAG pipeline.

The legacy class name ``KnowledgeRetriever`` is preserved so existing call
sites (`agent/runner.py`, tests) keep working. Internally we route through
:mod:`rag.pipeline` which handles BM25 + dense + rerank + telemetry.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from rag.pipeline import HybridRetriever, RetrievalTrace, RetrievedChunk


@dataclass(frozen=True)
class LegacyRetrievedChunk:
    """Backwards-compatible shape for any consumer that pickled / typed the old class."""

    id: str
    text: str
    source_file: str
    score: float


class KnowledgeRetriever:
    """Thin facade kept for backwards compatibility.

    For new code prefer :func:`rag.pipeline.get_pipeline` directly — it returns
    the same retriever and exposes ``return_trace=True`` for telemetry.
    """

    def __init__(self, knowledge_dir: Path | None = None) -> None:
        self._impl = HybridRetriever(knowledge_dir=knowledge_dir)

    @property
    def chunks(self):
        return self._impl.chunks

    @property
    def pipeline(self) -> HybridRetriever:
        return self._impl

    def search(self, query: str, *, top_k: int = 4) -> list[RetrievedChunk]:
        result = self._impl.search(query, top_k=top_k)
        if isinstance(result, tuple):
            return result[0]
        return result

    def search_with_trace(
        self, query: str, *, top_k: int = 4, candidate_pool: int = 12
    ) -> tuple[list[RetrievedChunk], RetrievalTrace]:
        out = self._impl.search(
            query, top_k=top_k, candidate_pool=candidate_pool, return_trace=True
        )
        # mypy-friendly: search() returns a tuple when return_trace=True
        assert isinstance(out, tuple)
        return out


@lru_cache
def get_retriever() -> KnowledgeRetriever:
    return KnowledgeRetriever()


__all__ = [
    "KnowledgeRetriever",
    "RetrievedChunk",
    "RetrievalTrace",
    "LegacyRetrievedChunk",
    "get_retriever",
]
