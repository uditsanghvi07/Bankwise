"""
CLI: rebuild the persistent RAG vector index.

Usage::

    cd backend
    py -m scripts.build_rag_index           # build with defaults
    py -m scripts.build_rag_index --probe   # build then run a sample query

The script chunks every markdown file in `backend/knowledge/`, encodes the
chunks with the embedding model, and writes the result to a Chroma persistent
collection at `backend/data/rag/`. Embeddings + cross-encoder are optional —
without them the script still validates BM25 indexing and prints stats.

This is the same code path the live server uses; the only difference is that
the live server lazy-builds on the first query, while this CLI is eager and
reports timings.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

# Ensure `backend/` is on sys.path when running as `py -m scripts.build_rag_index`.
THIS = Path(__file__).resolve()
BACKEND = THIS.parent.parent
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from rag.chunker import chunk_directory  # noqa: E402
from rag.embeddings import get_embedder  # noqa: E402
from rag.pipeline import HybridRetriever, reset_pipeline_cache  # noqa: E402
from rag.reranker import get_reranker  # noqa: E402


def _print_pipeline_status(retriever: HybridRetriever) -> None:
    embedder = retriever._embedder  # type: ignore[attr-defined]
    print()
    print("Pipeline status")
    print("---------------")
    print(f"  knowledge_dir : {retriever.knowledge_dir}")
    print(f"  persist_dir   : {retriever.persist_dir}")
    print(f"  chunks        : {len(retriever.chunks)}")
    print(f"  embedder      : {embedder.model_name if embedder else 'disabled (BM25-only mode)'}")
    print(f"  vector_store  : {type(retriever._vector_store).__name__ if retriever._vector_store else 'none'}")  # type: ignore[attr-defined]
    rer = retriever._reranker  # type: ignore[attr-defined]
    print(f"  reranker      : {rer.model_name if rer else 'lazy (will load on first rerank)'}")


def _probe(retriever: HybridRetriever, query: str, *, top_k: int = 4) -> None:
    print()
    print(f"Probe query: {query!r}")
    print("---------------")
    out = retriever.search(query, top_k=top_k, candidate_pool=12, return_trace=True)
    assert isinstance(out, tuple)
    chunks, trace = out
    for i, c in enumerate(chunks, 1):
        snip = c.text.replace("\n", " ")[:120]
        print(
            f"  {i}. [{c.id:<22}] fused={c.score:>6.4f} "
            f"bm25={c.bm25_score!s:>7} dense={c.dense_score!s:>7} rerank={c.rerank_score!s:>7}"
        )
        print(f"     {snip}…")
    print()
    print(f"  backend       : {trace.backend}")
    print(f"  used_dense    : {trace.used_dense}")
    print(f"  used_rerank   : {trace.used_rerank}")
    print(f"  timings (ms)  : {trace.timings_ms}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the BankWise RAG index.")
    parser.add_argument("--probe", action="store_true", help="Run a sample query after building.")
    parser.add_argument("--query", default="What FOIR do banks use for home loans?")
    parser.add_argument("--no-dense", action="store_true", help="Disable dense embeddings (BM25 only).")
    parser.add_argument("--no-rerank", action="store_true", help="Disable cross-encoder rerank.")
    args = parser.parse_args()

    reset_pipeline_cache()

    knowledge_dir = BACKEND / "knowledge"
    print(f"Chunking {knowledge_dir} ...")
    chunks = chunk_directory(knowledge_dir)
    print(f"  {len(chunks)} chunks across {len({c.source_file for c in chunks})} files")

    if not args.no_dense:
        print()
        print("Loading embedding model (this may download a few MB on first run) ...")
        t0 = time.perf_counter()
        embedder = get_embedder()
        if embedder is None:
            print("  ! sentence-transformers not available — falling back to BM25-only mode")
        else:
            print(f"  loaded {embedder.model_name} in {(time.perf_counter() - t0) * 1000:.0f} ms")

    if not args.no_rerank:
        print()
        print("Loading cross-encoder reranker (lazy) ...")
        t0 = time.perf_counter()
        rer = get_reranker()
        if rer is None:
            print("  ! cross-encoder not available — rerank step will be skipped at query time")
        else:
            print(f"  loaded {rer.model_name} in {(time.perf_counter() - t0) * 1000:.0f} ms")

    print()
    print("Building hybrid retriever and persisting vector store ...")
    t0 = time.perf_counter()
    retriever = HybridRetriever(
        knowledge_dir=knowledge_dir,
        enable_dense=not args.no_dense,
        enable_rerank=not args.no_rerank,
    )
    retriever.build_dense_index()
    print(f"  done in {(time.perf_counter() - t0) * 1000:.0f} ms")

    _print_pipeline_status(retriever)

    if args.probe:
        _probe(retriever, args.query)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
