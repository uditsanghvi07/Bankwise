"""
Hybrid retrieval pipeline.

Pipeline shape (top-down):

    user query
        │
        ├── multi-query expansion (template + optional LLM)
        │
        ├── BM25 (always on)             ─┐
        │                                  ├── Reciprocal Rank Fusion (RRF, k=60)
        ├── dense vector search           ─┘
        │   (sentence-transformers + Chroma/NumPy)
        │
        ├── MMR diversity (λ=0.7) — optional, on by default for top-K candidate pool
        │
        ├── cross-encoder rerank (lazy/optional)
        │
        └── top-k chunks  →  agent system prompt

We track every stage in `RetrievalTrace`, so the agent UI can show a real
retrieval ladder in the trace panel.

The pipeline degrades gracefully:

* No `sentence-transformers`  → BM25-only mode (still better than the previous
  pure token-overlap retriever, because BM25 normalises by document length).
* No `chromadb`               → in-memory NumPy vector store (same interface).
* No cross-encoder            → skip rerank step, return the fused top-k.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np

from rag.bm25 import BM25Index, tokenize
from rag.chunker import Chunk, chunk_directory, fingerprint
from rag.embeddings import Embedder, get_embedder
from rag.query_rewrite import (
    expand_with_synonyms,
    template_multi_query,
)
from rag.reranker import CrossReranker, get_reranker
from rag.vector_store import NumpyVectorStore, StoredHit, make_chroma_store

# RRF constant — Cormack et al. (2009) showed k=60 is robust across datasets.
RRF_K = 60


@dataclass(frozen=True)
class RetrievedChunk:
    """Public result type — kept structurally compatible with the legacy retriever."""

    id: str
    text: str
    source_file: str
    score: float
    parent_id: str = ""
    title: str = ""
    bm25_score: float | None = None
    dense_score: float | None = None
    rerank_score: float | None = None


@dataclass
class RetrievalTrace:
    """Telemetry the agent attaches to its trace panel."""

    queries: list[str] = field(default_factory=list)
    bm25_top: list[tuple[str, float]] = field(default_factory=list)
    dense_top: list[tuple[str, float]] = field(default_factory=list)
    fused_top: list[tuple[str, float]] = field(default_factory=list)
    reranked_top: list[tuple[str, float]] = field(default_factory=list)
    used_dense: bool = False
    used_rerank: bool = False
    backend: str = "bm25_only"
    embed_model: str | None = None
    rerank_model: str | None = None
    chunks_indexed: int = 0
    timings_ms: dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "queries": self.queries,
            "bm25_top": self.bm25_top,
            "dense_top": self.dense_top,
            "fused_top": self.fused_top,
            "reranked_top": self.reranked_top,
            "used_dense": self.used_dense,
            "used_rerank": self.used_rerank,
            "backend": self.backend,
            "embed_model": self.embed_model,
            "rerank_model": self.rerank_model,
            "chunks_indexed": self.chunks_indexed,
            "timings_ms": self.timings_ms,
        }


def _rrf_fuse(rankings: list[list[tuple[str, float]]], *, k: int = RRF_K) -> list[tuple[str, float]]:
    """Reciprocal Rank Fusion over an arbitrary number of ranked lists.

    score(d) = sum_r 1 / (k + rank_r(d)).
    """
    fused: dict[str, float] = {}
    for ranking in rankings:
        for rank_idx, (cid, _score) in enumerate(ranking):
            fused[cid] = fused.get(cid, 0.0) + 1.0 / (k + rank_idx + 1)
    return sorted(fused.items(), key=lambda kv: kv[1], reverse=True)


def _mmr(
    candidates: list[tuple[str, float]],
    embeddings: dict[str, np.ndarray] | None,
    *,
    top_k: int,
    lambda_: float = 0.7,
) -> list[tuple[str, float]]:
    """Maximal Marginal Relevance for diversity. Falls back to identity if no embeddings."""
    if embeddings is None or len(candidates) <= top_k:
        return candidates[:top_k]
    selected: list[tuple[str, float]] = []
    selected_ids: list[str] = []
    pool = list(candidates)
    while pool and len(selected) < top_k:
        best_idx = -1
        best_score = -1e18
        for i, (cid, sim) in enumerate(pool):
            if cid not in embeddings:
                # If no embedding available, fall back to relevance only.
                redundancy = 0.0
            else:
                v = embeddings[cid]
                redundancy = max(
                    (float(np.dot(v, embeddings[s])) for s in selected_ids if s in embeddings),
                    default=0.0,
                )
            score = lambda_ * sim - (1.0 - lambda_) * redundancy
            if score > best_score:
                best_score = score
                best_idx = i
        if best_idx < 0:
            break
        chosen = pool.pop(best_idx)
        selected.append(chosen)
        selected_ids.append(chosen[0])
    return selected


class HybridRetriever:
    """End-to-end retrieval driver. Build once at startup, share across requests."""

    def __init__(
        self,
        knowledge_dir: Path | None = None,
        *,
        persist_dir: Path | None = None,
        enable_dense: bool = True,
        enable_rerank: bool = True,
    ) -> None:
        self.knowledge_dir = knowledge_dir or Path(__file__).resolve().parent.parent / "knowledge"
        self.persist_dir = persist_dir or (Path(__file__).resolve().parent.parent / "data" / "rag")

        self._chunks: list[Chunk] = chunk_directory(self.knowledge_dir)
        self._chunk_by_id: dict[str, Chunk] = {c.id: c for c in self._chunks}

        # Sparse index — always available.
        self._bm25 = BM25Index()
        for c in self._chunks:
            self._bm25.add(c.id, f"{c.title}. {c.text}")
        self._bm25.finalize()

        # Dense stack — best-effort, falls back to None.
        self._enable_dense = enable_dense and not _disabled_via_env("RAG_DISABLE_DENSE")
        self._enable_rerank = enable_rerank and not _disabled_via_env("RAG_DISABLE_RERANK")
        self._embedder: Embedder | None = None
        self._vector_store: Any | None = None
        self._dense_vectors: dict[str, np.ndarray] = {}
        self._reranker: CrossReranker | None = None
        self._index_fingerprint: str = fingerprint(self._chunks)
        self._initialised_dense = False

    # ---------------- public API ---------------- #

    @property
    def chunks(self) -> list[Chunk]:
        return list(self._chunks)

    def build_dense_index(self) -> None:
        """Eagerly build (or refresh) the dense vector index. Safe to call repeatedly."""
        if not self._enable_dense:
            return
        embedder = get_embedder()
        if embedder is None:
            return
        self._embedder = embedder
        store = make_chroma_store(self.persist_dir) or NumpyVectorStore(dim=embedder.dim)
        store.reset()
        ids = [c.id for c in self._chunks]
        docs = [c.text for c in self._chunks]
        metas = [c.metadata | {"fingerprint": self._index_fingerprint} for c in self._chunks]
        vectors = embedder.encode([f"{c.title}. {c.text}" for c in self._chunks])
        store.upsert(ids, vectors, metas, docs)
        self._vector_store = store
        self._dense_vectors = {cid: vectors[i] for i, cid in enumerate(ids)}
        self._initialised_dense = True

    def search(
        self,
        query: str,
        *,
        top_k: int = 4,
        candidate_pool: int = 12,
        with_rerank: bool | None = None,
        with_mmr: bool = True,
        return_trace: bool = False,
    ) -> list[RetrievedChunk] | tuple[list[RetrievedChunk], RetrievalTrace]:
        trace = RetrievalTrace(chunks_indexed=len(self._chunks), backend="bm25_only")
        rankings: list[list[tuple[str, float]]] = []

        # 1. Multi-query expansion -------------------------------------------
        queries = template_multi_query(query) or [query]
        trace.queries = queries

        # 2. BM25 retrieval (always on) --------------------------------------
        t0 = time.perf_counter()
        bm25_aggregate: dict[str, float] = {}
        bm25_per_query: list[list[tuple[str, float]]] = []
        for q in queries:
            hits = self._bm25.search(expand_with_synonyms(q), top_k=candidate_pool)
            bm25_per_query.append(hits)
            for cid, score in hits:
                bm25_aggregate[cid] = max(bm25_aggregate.get(cid, 0.0), score)
        for ranking in bm25_per_query:
            rankings.append(ranking)
        bm25_sorted = sorted(bm25_aggregate.items(), key=lambda kv: kv[1], reverse=True)
        trace.bm25_top = bm25_sorted[:candidate_pool]
        trace.timings_ms["bm25_ms"] = round((time.perf_counter() - t0) * 1000, 2)

        # 3. Dense retrieval (lazy) ------------------------------------------
        dense_aggregate: dict[str, float] = {}
        if self._enable_dense:
            if not self._initialised_dense:
                self.build_dense_index()
            if self._embedder is not None and self._vector_store is not None:
                t1 = time.perf_counter()
                trace.used_dense = True
                trace.embed_model = self._embedder.model_name
                trace.backend = "hybrid"
                vecs = self._embedder.encode(queries)
                for i in range(len(queries)):
                    hits: list[StoredHit] = self._vector_store.query(vecs[i], top_k=candidate_pool)
                    rankings.append([(h.id, h.score) for h in hits])
                    for h in hits:
                        dense_aggregate[h.id] = max(dense_aggregate.get(h.id, 0.0), h.score)
                trace.dense_top = sorted(dense_aggregate.items(), key=lambda kv: kv[1], reverse=True)[:candidate_pool]
                trace.timings_ms["dense_ms"] = round((time.perf_counter() - t1) * 1000, 2)

        # 4. RRF fusion ------------------------------------------------------
        t2 = time.perf_counter()
        fused = _rrf_fuse(rankings)[:candidate_pool]
        trace.fused_top = fused
        trace.timings_ms["fuse_ms"] = round((time.perf_counter() - t2) * 1000, 2)

        # 5. MMR diversity ---------------------------------------------------
        if with_mmr and self._dense_vectors:
            fused = _mmr(fused, self._dense_vectors, top_k=candidate_pool, lambda_=0.7)

        # 6. Optional cross-encoder rerank -----------------------------------
        do_rerank = self._enable_rerank if with_rerank is None else with_rerank
        rerank_pairs: list[tuple[str, float]] = []
        if do_rerank and fused:
            if self._reranker is None:
                self._reranker = get_reranker()
            if self._reranker is not None:
                t3 = time.perf_counter()
                docs_for_rerank = [self._chunk_by_id[cid].text for cid, _ in fused if cid in self._chunk_by_id]
                ids_for_rerank = [cid for cid, _ in fused if cid in self._chunk_by_id]
                ranked = self._reranker.rerank(query, docs_for_rerank, top_k=len(ids_for_rerank))
                rerank_pairs = [(ids_for_rerank[i], score) for i, score in ranked]
                trace.reranked_top = rerank_pairs[:candidate_pool]
                trace.used_rerank = True
                trace.rerank_model = self._reranker.model_name
                trace.timings_ms["rerank_ms"] = round((time.perf_counter() - t3) * 1000, 2)

        final_ranking = rerank_pairs if rerank_pairs else fused
        results: list[RetrievedChunk] = []
        for cid, score in final_ranking[:top_k]:
            chunk = self._chunk_by_id.get(cid)
            if not chunk:
                continue
            results.append(
                RetrievedChunk(
                    id=chunk.id,
                    text=chunk.text,
                    source_file=chunk.source_file,
                    parent_id=chunk.parent_id,
                    title=chunk.title,
                    score=round(float(score), 4),
                    bm25_score=round(bm25_aggregate.get(cid), 4) if cid in bm25_aggregate else None,
                    dense_score=round(dense_aggregate.get(cid), 4) if cid in dense_aggregate else None,
                    rerank_score=next((round(s, 4) for c2, s in rerank_pairs if c2 == cid), None),
                )
            )

        if not results:
            # Last-resort: return shortest chunks so we never starve the LLM context.
            for c in self._chunks[:top_k]:
                results.append(
                    RetrievedChunk(
                        id=c.id,
                        text=c.text,
                        source_file=c.source_file,
                        parent_id=c.parent_id,
                        title=c.title,
                        score=0.0,
                    )
                )

        if return_trace:
            return results, trace
        return results


def _disabled_via_env(name: str) -> bool:
    return os.environ.get(name, "").lower() in {"1", "true", "yes", "on"}


@lru_cache
def get_pipeline() -> HybridRetriever:
    return HybridRetriever()


def reset_pipeline_cache() -> None:
    """Useful in tests after monkeypatching dependencies."""
    get_pipeline.cache_clear()
