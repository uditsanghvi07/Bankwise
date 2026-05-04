"""
Pure-Python **BM25 Okapi** sparse retriever.

Why pure-Python: BM25 is the industry-standard lexical baseline (Lucene,
Elasticsearch, OpenSearch all use it). Implementing it locally gives us a
fast, dependency-free retriever that always works — even if the user does not
have `sentence-transformers` / `chromadb` installed. In hybrid search we fuse
its ranking with the dense retriever via Reciprocal Rank Fusion.

Math:
    score(q, d) = sum_t IDF(t) * (f_td * (k1 + 1)) / (f_td + k1 * (1 - b + b * |d| / avgdl))

with default `k1=1.5`, `b=0.75` (Robertson defaults). IDF here is the
Robertson-Spärck Jones variant with floor at 0 to avoid negatives.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass

_TOKEN_RE = re.compile(r"[A-Za-z0-9_%]+")

_STOPWORDS = frozenset(
    """a an the and or of for in on to with by from at as is are was were be been
    being it its this that these those what which who how when where why
    can could should would will shall may might do does did done has have had
    i me my you your we us our they them their he she his her""".split()
)


def tokenize(text: str) -> list[str]:
    if not text:
        return []
    return [t for t in (m.group(0).lower() for m in _TOKEN_RE.finditer(text)) if t not in _STOPWORDS and len(t) > 1]


@dataclass
class BM25Doc:
    id: str
    tokens: list[str]


class BM25Index:
    """In-memory BM25 Okapi index. Build once, query many times."""

    def __init__(self, k1: float = 1.5, b: float = 0.75) -> None:
        self.k1 = k1
        self.b = b
        self._docs: list[BM25Doc] = []
        self._doc_freqs: list[Counter[str]] = []
        self._doc_lens: list[int] = []
        self._df: Counter[str] = Counter()
        self._avgdl: float = 0.0
        self._idf: dict[str, float] = {}

    def add(self, doc_id: str, text: str) -> None:
        toks = tokenize(text)
        self._docs.append(BM25Doc(id=doc_id, tokens=toks))
        freqs: Counter[str] = Counter(toks)
        self._doc_freqs.append(freqs)
        self._doc_lens.append(len(toks))
        for t in freqs:
            self._df[t] += 1

    def finalize(self) -> None:
        n = max(1, len(self._docs))
        self._avgdl = sum(self._doc_lens) / n
        self._idf = {}
        for term, df in self._df.items():
            # Robertson-Spärck Jones IDF with `+1` smoothing; floored at 0.
            idf = math.log((n - df + 0.5) / (df + 0.5) + 1.0)
            self._idf[term] = max(0.0, idf)

    def __len__(self) -> int:
        return len(self._docs)

    def search(self, query: str, top_k: int = 6) -> list[tuple[str, float]]:
        if not self._docs:
            return []
        q_terms = tokenize(query)
        if not q_terms:
            return []
        scored: list[tuple[str, float]] = []
        for i, doc in enumerate(self._docs):
            freqs = self._doc_freqs[i]
            dl = self._doc_lens[i]
            score = 0.0
            for term in q_terms:
                f_td = freqs.get(term, 0)
                if f_td == 0:
                    continue
                idf = self._idf.get(term, 0.0)
                denom = f_td + self.k1 * (1 - self.b + self.b * dl / max(self._avgdl, 1e-9))
                score += idf * (f_td * (self.k1 + 1)) / denom
            if score > 0:
                scored.append((doc.id, score))
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]
