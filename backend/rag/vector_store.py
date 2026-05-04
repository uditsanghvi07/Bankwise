"""
Vector store backends.

Two implementations, both implementing the same minimal interface:

* `ChromaVectorStore`  — persistent Chroma collection (the default in production-ish
  deployments). Lazy-imported so `chromadb` stays optional.
* `NumpyVectorStore`   — pure-NumPy in-memory index used as a fallback when
  Chroma is missing or for unit tests. Same interface, slightly slower at very
  large scale but perfectly fine for our ≲1000-chunk KB.

Both expose:

    upsert(ids, vectors, metadatas, documents)
    query(vector, top_k) -> list[(id, score, metadata, document)]

The store stays *vector-only* — chunk payloads are also kept in NumPy/Chroma so
the downstream retriever can rebuild full `RetrievedChunk` objects without
re-reading the markdown.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence

import numpy as np


@dataclass
class StoredHit:
    id: str
    score: float
    metadata: dict[str, Any]
    document: str


class NumpyVectorStore:
    """Tiny pure-NumPy cosine vector store. Always available."""

    def __init__(self, dim: int) -> None:
        self.dim = dim
        self._ids: list[str] = []
        self._vecs: list[np.ndarray] = []
        self._meta: list[dict[str, Any]] = []
        self._docs: list[str] = []

    def reset(self) -> None:
        self._ids.clear()
        self._vecs.clear()
        self._meta.clear()
        self._docs.clear()

    def upsert(
        self,
        ids: Sequence[str],
        vectors: np.ndarray,
        metadatas: Sequence[dict[str, Any]],
        documents: Sequence[str],
    ) -> None:
        for cid, vec, meta, doc in zip(ids, vectors, metadatas, documents):
            self._ids.append(cid)
            self._vecs.append(np.asarray(vec, dtype=np.float32))
            self._meta.append(dict(meta))
            self._docs.append(doc)

    def query(self, vector: np.ndarray, top_k: int = 6) -> list[StoredHit]:
        if not self._vecs:
            return []
        mat = np.stack(self._vecs)  # (N, D)
        # vectors are L2-normalised so cosine == dot product
        scores = mat @ np.asarray(vector, dtype=np.float32)
        order = np.argsort(-scores)[:top_k]
        return [
            StoredHit(
                id=self._ids[i],
                score=float(scores[i]),
                metadata=self._meta[i],
                document=self._docs[i],
            )
            for i in order
            if scores[i] > 0
        ]

    def __len__(self) -> int:
        return len(self._ids)


def make_chroma_store(persist_dir: Path, collection_name: str = "bankwise_kb") -> Any | None:
    """Try to build a persistent Chroma collection; return None if unavailable."""
    try:
        import chromadb  # type: ignore
        from chromadb.config import Settings  # type: ignore
    except Exception:
        return None
    try:
        persist_dir.mkdir(parents=True, exist_ok=True)
        client = chromadb.PersistentClient(
            path=str(persist_dir),
            settings=Settings(anonymized_telemetry=False),
        )
        collection = client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        return ChromaVectorStore(collection)
    except Exception:
        return None


class ChromaVectorStore:
    """Wraps a Chroma collection in the same interface as NumpyVectorStore."""

    def __init__(self, collection: Any) -> None:
        self._collection = collection

    def reset(self) -> None:
        try:
            ids = self._collection.get(include=[]).get("ids", [])
            if ids:
                self._collection.delete(ids=ids)
        except Exception:
            pass

    def upsert(
        self,
        ids: Sequence[str],
        vectors: np.ndarray,
        metadatas: Sequence[dict[str, Any]],
        documents: Sequence[str],
    ) -> None:
        self._collection.upsert(
            ids=list(ids),
            embeddings=[v.tolist() for v in vectors],
            metadatas=[dict(m) for m in metadatas],
            documents=list(documents),
        )

    def query(self, vector: np.ndarray, top_k: int = 6) -> list[StoredHit]:
        res = self._collection.query(
            query_embeddings=[np.asarray(vector, dtype=np.float32).tolist()],
            n_results=top_k,
            include=["metadatas", "documents", "distances"],
        )
        ids = (res.get("ids") or [[]])[0]
        docs = (res.get("documents") or [[]])[0]
        metas = (res.get("metadatas") or [[]])[0]
        dists = (res.get("distances") or [[]])[0]
        out: list[StoredHit] = []
        for cid, doc, meta, dist in zip(ids, docs, metas, dists):
            # Chroma returns cosine *distance* in [0, 2]; convert to similarity in [-1, 1].
            score = 1.0 - float(dist)
            out.append(StoredHit(id=cid, score=score, metadata=meta or {}, document=doc or ""))
        return out

    def __len__(self) -> int:
        try:
            return int(self._collection.count())
        except Exception:
            return 0
