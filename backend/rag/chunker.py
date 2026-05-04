"""
Markdown-aware sliding-window chunker.

Why custom: the curated banking knowledge base is structured with `## KB:id`
section headers — those are the anchors we want to cite by. We split the
document on those headers first (semantic boundary), then run a token-aware
sliding window over each section so very long sections get sub-chunks with
controlled overlap (the standard trick to avoid retrieval boundary loss).

Each emitted `Chunk` carries:
* `id`: stable id for citation (`KB:foir-001` or `KB:foir-001#2` for sub-chunks).
* `text`: the chunk body.
* `metadata`: title, source file, parent id, chunk index, tag set.

Chunking choices documented inline so reviewers can see the trade-offs
(target window 280 tokens, 60-token overlap — defensible for short FAQ-style
markdown; lift both if you index long policy PDFs).
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

# Regex matches `## KB:foir-001` style anchors used across the KB.
_HEADER_RE = re.compile(r"^##\s+(KB:[\w-]+)\s*$")
_TITLE_RE = re.compile(r"^#\s+(.+?)\s*$")

# Small/medium chunk sizes are the right default for retrieval over short, dense
# educational content (Anthropic / OpenAI guidance: 200–400 tokens).
_DEFAULT_CHUNK_TOKENS = 280
_DEFAULT_CHUNK_OVERLAP = 60


@dataclass(frozen=True)
class Chunk:
    id: str
    text: str
    source_file: str
    parent_id: str
    chunk_index: int
    title: str
    tags: tuple[str, ...] = field(default_factory=tuple)

    @property
    def metadata(self) -> dict[str, str | int]:
        return {
            "id": self.id,
            "parent_id": self.parent_id,
            "source_file": self.source_file,
            "chunk_index": self.chunk_index,
            "title": self.title,
            "tags": ",".join(self.tags),
        }


def _approx_token_count(text: str) -> int:
    """Rough token estimate; avoids a tiktoken dependency.
    ~4 chars/token is a reasonable proxy for English.
    """
    return max(1, len(text) // 4)


def _word_offsets(text: str) -> list[tuple[int, int]]:
    """Return (start, end) char offsets for each whitespace-delimited word."""
    return [(m.start(), m.end()) for m in re.finditer(r"\S+", text)]


def _sliding_windows(
    text: str,
    *,
    target_tokens: int = _DEFAULT_CHUNK_TOKENS,
    overlap_tokens: int = _DEFAULT_CHUNK_OVERLAP,
) -> list[str]:
    """Split `text` into approximately `target_tokens` chunks with `overlap_tokens` overlap.

    Operates at word boundaries so we never split mid-word. We approximate token
    count with chars/4 (good enough for English; gives consistent ratios).
    """
    text = text.strip()
    if not text:
        return []
    if _approx_token_count(text) <= target_tokens:
        return [text]

    words = _word_offsets(text)
    chunks: list[str] = []
    start_idx = 0
    while start_idx < len(words):
        # walk forward until the running window crosses target_tokens
        end_idx = start_idx
        while end_idx < len(words):
            span = text[words[start_idx][0] : words[end_idx][1]]
            if _approx_token_count(span) >= target_tokens:
                end_idx += 1
                break
            end_idx += 1
        chunk_text = text[words[start_idx][0] : words[min(end_idx, len(words)) - 1][1]]
        chunks.append(chunk_text.strip())
        if end_idx >= len(words):
            break
        # rewind by overlap_tokens worth of words for the next window
        overlap_chars = overlap_tokens * 4
        rewind_idx = end_idx
        while rewind_idx > start_idx:
            span = text[words[rewind_idx - 1][0] : words[end_idx - 1][1]]
            if len(span) >= overlap_chars:
                break
            rewind_idx -= 1
        start_idx = max(start_idx + 1, rewind_idx)
    return chunks


_TAG_HINTS: dict[str, tuple[str, ...]] = {
    "foir": ("foir", "fixed-obligations-to-income", "loan-eligibility"),
    "cibil": ("cibil", "credit-score", "bureau"),
    "pmay": ("pmay", "subsidy", "home-loan"),
    "nach": ("nach", "e-mandate", "auto-debit"),
    "disclaimers": ("policy", "compliance", "boundaries"),
    "home_loan": ("home-loan", "mortgage", "ltv"),
    "personal_loan": ("personal-loan", "unsecured"),
    "sip_mf": ("sip", "mutual-fund", "equity"),
    "tax": ("tax", "80c", "regime"),
    "repo": ("repo-rate", "rbi", "monetary-policy"),
}


def _tags_for_file(file_stem: str) -> tuple[str, ...]:
    return _TAG_HINTS.get(file_stem, (file_stem,))


def _hash8(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:8]


def chunk_markdown_file(
    path: Path,
    *,
    target_tokens: int = _DEFAULT_CHUNK_TOKENS,
    overlap_tokens: int = _DEFAULT_CHUNK_OVERLAP,
) -> list[Chunk]:
    """Split a `.md` knowledge file into citable chunks.

    Strategy:
    1. Honour `## KB:id` headers as semantic boundaries.
    2. For each section, run a sliding-token window if the section is long.
    3. Sub-chunks are namespaced (`KB:foir-001#2`) for reproducible citations.
    """
    raw = path.read_text(encoding="utf-8")
    lines = raw.splitlines()
    title = path.stem.replace("_", " ").title()
    for line in lines[:6]:  # title hint usually in the first heading
        m = _TITLE_RE.match(line.strip())
        if m:
            title = m.group(1)
            break

    sections: list[tuple[str, list[str]]] = []
    current_id = path.stem
    buf: list[str] = []
    for line in lines:
        m = _HEADER_RE.match(line.strip())
        if m:
            if buf:
                sections.append((current_id, buf))
            current_id = m.group(1)
            buf = []
            continue
        buf.append(line)
    if buf:
        sections.append((current_id, buf))

    tags = _tags_for_file(path.stem)
    chunks: list[Chunk] = []
    for parent_id, body_lines in sections:
        body = "\n".join(body_lines).strip()
        if not body:
            continue
        windows = _sliding_windows(body, target_tokens=target_tokens, overlap_tokens=overlap_tokens)
        for i, win in enumerate(windows):
            cid = parent_id if len(windows) == 1 else f"{parent_id}#{i + 1}"
            chunks.append(
                Chunk(
                    id=cid,
                    text=win,
                    source_file=path.name,
                    parent_id=parent_id,
                    chunk_index=i,
                    title=title,
                    tags=tags,
                )
            )
    return chunks


def chunk_directory(
    directory: Path,
    *,
    pattern: str = "*.md",
    target_tokens: int = _DEFAULT_CHUNK_TOKENS,
    overlap_tokens: int = _DEFAULT_CHUNK_OVERLAP,
) -> list[Chunk]:
    out: list[Chunk] = []
    for md in sorted(directory.glob(pattern)):
        out.extend(
            chunk_markdown_file(md, target_tokens=target_tokens, overlap_tokens=overlap_tokens)
        )
    return out


def fingerprint(chunks: Iterable[Chunk]) -> str:
    """Stable hash of all chunk texts — used to invalidate the persistent index."""
    h = hashlib.sha1()
    for c in chunks:
        h.update(c.id.encode("utf-8"))
        h.update(b"\x00")
        h.update(c.text.encode("utf-8"))
        h.update(b"\x01")
    return h.hexdigest()
