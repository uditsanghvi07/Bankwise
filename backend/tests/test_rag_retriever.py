"""Tests for the hybrid RAG pipeline (chunker, BM25, fusion, retriever facade).

These tests run in **BM25-only mode** by setting `RAG_DISABLE_DENSE=1` and
`RAG_DISABLE_RERANK=1`. CI machines without GPUs / model cache should not be
forced to download ~50 MB of weights just to run unit tests; the dense path is
covered separately by the build-index CLI.
"""

from __future__ import annotations

import os
from pathlib import Path

os.environ.setdefault("RAG_DISABLE_DENSE", "1")
os.environ.setdefault("RAG_DISABLE_RERANK", "1")

from rag.bm25 import BM25Index, tokenize  # noqa: E402
from rag.chunker import chunk_directory, chunk_markdown_file, fingerprint  # noqa: E402
from rag.pipeline import HybridRetriever, _rrf_fuse  # noqa: E402
from rag.query_rewrite import expand_with_synonyms, template_multi_query  # noqa: E402
from rag.retriever import KnowledgeRetriever  # noqa: E402


KNOWLEDGE = Path(__file__).resolve().parent.parent / "knowledge"


# ---------- chunker ---------- #


def test_chunker_emits_kb_ids():
    chunks = chunk_markdown_file(KNOWLEDGE / "foir.md")
    ids = [c.id for c in chunks]
    assert any(i.startswith("KB:foir-001") for i in ids)
    # Title should be lifted from the H1
    assert all("FOIR" in c.title or "Foir" in c.title for c in chunks)


def test_chunker_directory_covers_all_kb_files():
    chunks = chunk_directory(KNOWLEDGE)
    files = {c.source_file for c in chunks}
    # KB has at least these files now — additional ones are fine.
    assert {"foir.md", "cibil.md", "home_loan.md", "sip_mf.md"}.issubset(files)
    fp = fingerprint(chunks)
    assert len(fp) == 40  # sha1 hex


# ---------- BM25 ---------- #


def test_bm25_ranks_relevant_doc_first():
    bm = BM25Index()
    bm.add("foir-doc", "FOIR is the fixed obligations to income ratio used in home loan underwriting.")
    bm.add("cibil-doc", "CIBIL is a credit bureau that publishes credit scores between 300 and 900.")
    bm.add("nach-doc", "NACH handles e-mandate auto-debits for EMIs and SIPs in India.")
    bm.finalize()
    hits = bm.search("home loan FOIR", top_k=2)
    assert hits[0][0] == "foir-doc"
    assert hits[0][1] > 0


def test_tokenize_drops_stopwords():
    toks = tokenize("What is the FOIR for a home loan in India?")
    assert "foir" in toks
    assert "home" in toks
    assert "the" not in toks


# ---------- query rewrite ---------- #


def test_template_multi_query_includes_expansion():
    rewrites = template_multi_query("FOIR for home loan")
    assert any("home loan" in r.lower() for r in rewrites)
    expanded = expand_with_synonyms("FOIR for home loan")
    assert "fixed obligations to income" in expanded.lower()


# ---------- RRF fusion ---------- #


def test_rrf_rewards_documents_appearing_in_multiple_lists():
    """`b` is the only id present in both lists — RRF should rank it first."""
    rankings = [
        [("a", 0.9), ("b", 0.7), ("x", 0.4)],
        [("y", 0.95), ("b", 0.6), ("z", 0.3)],
    ]
    fused = _rrf_fuse(rankings)
    assert fused[0][0] == "b"


def test_rrf_score_drops_with_lower_rank():
    rankings = [
        [("a", 1.0), ("b", 0.5)],
        [("a", 0.9), ("b", 0.3)],
    ]
    fused = _rrf_fuse(rankings)
    score_map = dict(fused)
    assert score_map["a"] > score_map["b"]


# ---------- pipeline (BM25-only mode) ---------- #


def test_pipeline_bm25_only_returns_relevant_chunk():
    retriever = HybridRetriever(enable_dense=False, enable_rerank=False)
    out = retriever.search("What FOIR do banks use for home loans?", top_k=4, return_trace=True)
    assert isinstance(out, tuple)
    chunks, trace = out
    assert chunks
    assert any("foir" in c.id.lower() for c in chunks)
    assert trace.backend == "bm25_only"
    assert not trace.used_dense
    assert trace.queries
    # No exception even with dense disabled
    assert trace.timings_ms.get("bm25_ms", 0) >= 0


def test_pipeline_handles_unrelated_query_without_starving():
    retriever = HybridRetriever(enable_dense=False, enable_rerank=False)
    chunks = retriever.search("xyzzy plugh", top_k=3)
    assert isinstance(chunks, list)
    assert chunks  # never empty


def test_legacy_retriever_facade_still_works():
    r = KnowledgeRetriever()
    hits = r.search("CIBIL credit score for personal loan", top_k=3)
    assert hits
    ids = [h.id for h in hits]
    assert any("cibil" in i.lower() or "personal_loan" in i.lower() for i in ids)


def test_legacy_retriever_search_with_trace():
    r = KnowledgeRetriever()
    chunks, trace = r.search_with_trace("home loan EBLR repo rate", top_k=3)
    assert chunks
    assert trace.queries
    assert trace.fused_top
