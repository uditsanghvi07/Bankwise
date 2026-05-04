# BankWise AI

**BankWise AI** is a full-stack **GenAI banking console** for Indian retail banking. It combines a **DeepSeek**-powered **LangGraph** agent with **deterministic Python `Decimal` calculators**, an **advanced RAG** layer over a curated KB, **SSE streaming chat**, **SQLite history**, a **scenario advisor** (verdicts, 3-path projections, PDFs), and **PDF export** for chats.

---

## At a glance

| You want… | Go here |
|-----------|---------|
| **Chat** with calculators, KB citations, and agent trace | **`/chat`** |
| **Advisor** — FOIR, savings, goal feasibility, charts, honest verdict | **`/advisor`** |
| **How the stack works** (RAG, streaming, safety) | **`/docs`** |
| **Landing** | **`/`** |

| Page | What it is |
|------|------------|
| **`/`** | Marketing landing — hero, feature grid, gradients |
| **`/chat`** | Streaming chat, history sidebar, agent trace, KB citations, widgets (EMI, compare, etc.) |
| **`/advisor`** | Scenario form → health score, **verdict** (excellent → critical), red/green flags, **3-path** projections, PDF |
| **`/docs`** | In-app walkthrough: agent loop, RAG, streaming, advisor, PDF, safety |

---

## Quick start

1. **Clone** the repo.
2. **API key**: copy `.env.example` → `.env` (project root) and set **`DEEPSEEK_API_KEY`** ([DeepSeek](https://api.deepseek.com)).
3. **Run**: `docker compose up --build` → open **`http://localhost:9002`**. API docs: **`http://localhost:9001/docs`**. Chat: **`/chat`**.

The browser only calls **port 9002**; Next.js proxies `/api/*` to the backend (`frontend/src/app/api/[...path]/route.ts`). Set **`INTERNAL_API_URL`** if the API is not `http://127.0.0.1:9001`.

---

## Tech stack & how layers integrate

Use this when you explain the system to a **senior engineer** or in a **architecture / system-design** chat: who owns HTTP, where state lives, and how the UI and Python service connect.

### End-to-end flow (browser → Next.js → FastAPI → model & DB)

```text
  Browser
     │
     │  User opens http://localhost:9002 — only the Next.js origin in typical dev
     ▼
  Next.js 14 (Node.js) — UI + thin BFF
     • React (TypeScript/TSX) renders pages: landing, chat, advisor, docs.
     • App Router: routes live under `frontend/src/app/.../page.tsx`.
     • The catch-all route `frontend/src/app/api/[...path]/route.ts` is a **reverse proxy**:
       the browser calls `POST /api/chat/stream` on **9002** → Next `fetch`es the same path on
       **FastAPI** (`INTERNAL_API_URL`, default **9001**).
       **Why:** one origin for the UI, no browser CORS to Python in dev, API key stays server-side.
     ▼
  FastAPI (Python 3) — served by **Uvicorn** (ASGI)
     • `backend/main.py` mounts routers under `/api/...`.
     • Handlers in `backend/api/*.py`: chat, stream, conversations, advisor, export, calculators.
     • Request path: safety → RAG → LangGraph (DeepSeek) ↔ **tools** (Python `Decimal` engines) → critic → SQLite; SSE streams tokens back through the same HTTP response.
     • Outbound HTTPS from this process to **DeepSeek** when a turn needs the LLM.
```

### What each technology does here

| Technology | Purpose in BankWise | Where it shows up |
|------------|---------------------|-------------------|
| **React** | Build interactive UI: messages, forms, charts, streaming text. | `frontend/src/components/**`, hooks |
| **Next.js 14** | File-based routing, dev server on **9002**, **API route proxy** to Python. | `frontend/src/app/**`, `api/[...path]/route.ts` |
| **TypeScript** | Types for props and API shapes so UI matches FastAPI contracts. | `*.ts`, `*.tsx` |
| **Tailwind CSS** | Utility-first styling (layout, typography, dark mode). | `globals.css`, `tailwind.config.ts` |
| **Zustand** | Lightweight client store for chat UI state. | `frontend/src/store/**` |
| **Recharts / Framer Motion** | Advisor charts and light motion on landing/chat. | advisor + landing components |
| **Python 3** | Entire backend: math, RAG, agent, persistence, PDF. | `backend/**` |
| **FastAPI** | REST + **SSE** endpoints, Pydantic validation, auto **OpenAPI** at `/docs`. | `backend/main.py`, `backend/api/` |
| **Uvicorn** | ASGI **server process** that runs the FastAPI application. | Docker CMD / local `uvicorn` |
| **SQLite** | Persist conversations and messages on disk. | `backend/storage/`, `backend/data/*.sqlite3` |
| **LangChain** | Chat model client (OpenAI-compatible → DeepSeek base URL). | `backend/agent/llm_factory.py`, graph wiring |
| **LangGraph** | **Stateful agent graph**: model proposes tool calls → `ToolNode` runs Python tools → loop until finish. | `backend/agent/graph.py` |
| **DeepSeek** | External LLM API for reasoning and natural-language answers. | Env `DEEPSEEK_API_KEY` |
| **Optional:** `sentence-transformers`, `chromadb`, `numpy` | Dense embeddings, vector store, numerics for RAG pipeline. | `backend/rag/` |

**One integration sentence:** *The browser only talks to **Next.js**; Next forwards `/api/*` to **FastAPI**; **FastAPI** owns calculators, RAG, agent orchestration, SQLite, and PDF generation.*

---

## How it works (simple)

1. **You send a message** → `/api/chat/stream` (SSE).
2. **Safety** runs first — fraud / KYC bypass / obvious injection is blocked without calling the model.
3. **RAG** pulls the best matching chunks from `backend/knowledge/*.md` (see [RAG architecture](#rag-architecture-advanced)) and injects them into the prompt with **`KB:id`** citations.
4. **LangGraph** runs: the model can call **tools** (`bankwise_emi_engine`, etc.) → Python returns JSON → model writes the answer.
5. **Critic** checks that EMI-style numbers in the text do not contradict tool output.
6. **Stream** returns tokens as `delta` events; the UI appends them live. Turns are saved to **SQLite** (`backend/data/bankwise.sqlite3`).

**Advisor** (`/api/advisor/scenario`): Python computes FOIR, savings rate, emergency months, **three return paths** (pessimistic / base / optimistic), goal feasibility, and a **verdict**; the LLM writes a **direct narrative** from those facts (not generic marketing text).

---

## What it helps with

- **Loans**: home, personal, FOIR, LTV, balance transfer, repo-linked rates (educational).
- **Calculators**: EMI (prepay), amortization, eligibility, loan compare, SIP, FD, CIBIL-style simulator.
- **Banking**: NACH, PMAY (high level), disclaimers.
- **Investments (light)**: SIP vs lump sum, 80C context — **no** stock picks or crypto advice.

## What it will not do

- No **money laundering**, **tax evasion**, **fake documents**, or **KYC/AML** circumvention.
- No **specific stocks**, **timing**, or **crypto** recommendations.
- No **made-up rates** — always verify with your bank or RBI.

---

## Calculator accuracy

- **EMI**: \( \text{EMI} = P \cdot r \cdot (1+r)^n / ((1+r)^n - 1) \) — `backend/calculators/emi.py` (`Decimal`).
- **Eligibility**: FOIR bands + reverse EMI — `backend/calculators/eligibility.py`.
- **SIP / FD**: `investment.py`.
- **CIBIL “simulator”**: directional only, not the real bureau model.

---

## Customising for a bank

- Prompts: `backend/core/system_prompt.py` or `backend/agent/graph.py` (`AGENT_SYSTEM_PROMPT`).
- Knowledge: add or edit `backend/knowledge/*.md` with `## KB:your-id` headers.

---

## Architecture (GenAI / agentic)

```text
Browser (Next.js 14 · Zustand · Recharts · Framer Motion)
        │  /api/*  →  INTERNAL_API_URL (Next proxy)
        ▼
FastAPI
   ├─ safety pre-filter
   ├─ RAG: chunk → BM25 + dense → RRF → MMR → rerank → citations
   ├─ LangGraph: ChatOpenAI(DeepSeek) ↔ ToolNode → bankwise_*_engines (Decimal)
   ├─ critic (narration vs tool JSON)
   ├─ SQLite (conversations + messages)
   ├─ SSE: /api/chat/stream
   ├─ /api/advisor/scenario
   └─ PDF: /api/export/transcript | /api/export/advisor
```

### LangChain vs LangGraph vs RAG vs agent *(in this repo)*

| Piece | Role here |
|-------|-----------|
| **LangChain** | Library used to call the chat model (`langchain-openai` → DeepSeek API) and wire messages. |
| **LangGraph** | **Orchestration**: bounded tool loop, state, `ToolNode` — see `backend/agent/graph.py`. |
| **RAG** | **Retrieval** before the graph runs: load relevant KB text into the system message — `backend/rag/`. |
| **Agent** | The model **deciding** when to call EMI / eligibility / compare tools and then answering from tool JSON. |

There is no NestJS in this project — backend is **FastAPI** (`backend/main.py`).

---

## API surface

| Method · Path | Purpose |
|--------------|---------|
| `POST /api/chat/` | One-shot JSON chat (+ SQLite) |
| `POST /api/chat/stream` | **SSE** — `meta`, `trace`, `widget`, `delta`, `done` |
| `GET/POST/PATCH/DELETE /api/conversations/...` | Chat history CRUD |
| `POST /api/advisor/scenario` | Advisor JSON (verdict, projections, narrative) |
| `POST /api/export/transcript` | Chat → PDF |
| `POST /api/export/advisor` | Advisor → PDF |
| `POST /api/calculate/{emi,...}` | Direct calculator APIs |

---

## RAG architecture (advanced)

Code lives under **`backend/rag/`**. Goal: **interview-grade** retrieval — chunking, sparse + dense, fusion, diversity, rerank — while still running if optional ML deps are missing.

| Stage | File | What it does |
|-------|------|----------------|
| **Chunk** | `chunker.py` | Splits on `## KB:id` headers; sliding window ~280 tokens, 60 overlap for long sections. |
| **Sparse** | `bm25.py` | **BM25 Okapi** (pure Python, always on). |
| **Embed** | `embeddings.py` | **`BAAI/bge-small-en-v1.5`** (384-d) if `sentence-transformers` is installed. |
| **Vectors** | `vector_store.py` | **Chroma** on disk under `backend/data/rag/`, or **NumPy** in-memory fallback. |
| **Queries** | `query_rewrite.py` | Multi-query + banking synonym expansion (no LLM by default). |
| **Fusion** | `pipeline.py` | **RRF** (k=60) across BM25 + dense lists. |
| **Diversity** | `pipeline.py` | **MMR** (λ=0.7) on the candidate pool. |
| **Rerank** | `reranker.py` | **`cross-encoder/ms-marco-MiniLM-L-6-v2`** on top candidates (lazy). |
| **Trace** | `RetrievalTrace` | Timings + per-chunk scores → shows under **retrieve** in the chat trace UI. |

**Graceful fallback:** no `sentence-transformers` → **BM25-only**; no `chromadb` → **NumPy** store; no cross-encoder → skip rerank.

### Environment variables (RAG)

| Variable | Effect |
|----------|--------|
| `RAG_DISABLE_DENSE=1` | Skip embeddings + vector search (BM25 only; good for CI). |
| `RAG_DISABLE_RERANK=1` | Skip cross-encoder rerank. |
| `RAG_EMBED_MODEL` | Override embedding model id (default `BAAI/bge-small-en-v1.5`). |
| `RAG_RERANK_MODEL` | Override reranker id (default `cross-encoder/ms-marco-MiniLM-L-6-v2`). |
| `RAG_USE_LLM_REWRITE=1` | Allow LLM-based query rewrite (off by default). |

### Build / probe the RAG index

```powershell
cd backend
py -m scripts.build_rag_index --probe --query "What FOIR do banks use for home loans?"
```

### Knowledge base files

`backend/knowledge/` — e.g. `foir.md`, `cibil.md`, `home_loan.md`, `personal_loan.md`, `sip_mf.md`, `tax.md`, `repo.md`, `pmay.md`, `nach.md`, `disclaimers.md`. Each citable block starts with **`## KB:some-id`**.

### Optional Python deps (full hybrid)

In `backend/requirements.txt`, **`numpy`** is required. **`sentence-transformers`** and **`chromadb`** are commented — uncomment and `pip install` when you want dense + persistent vector search without relying on the NumPy fallback.

---

## Threat model (short)

| Risk | Mitigation |
|------|------------|
| Prompt injection | Pre-filter + tools as source of truth for numbers |
| Wrong EMI in text | Critic vs tool JSON |
| Invented regulation | Curated KB + cite `KB:id` |
| Export privacy | PDF built on server from your conversation id; SQLite is local |

This is **educational demo software**, not a certified compliance product.

---

## Tests

```bash
cd backend
py -3 -m pytest tests/ -q
```

Covers safety, calculators (`422`), **RAG** (chunker, BM25, RRF, hybrid), conversations, advisor, PDF export — **no live LLM** in CI. Use `BANKWISE_AGENT_TEST_MODE=1` only if you add automation that needs it.

**RAG in CI:** tests set `RAG_DISABLE_DENSE=1` and `RAG_DISABLE_RERANK=1` so CI does not download embedding models. Remove those locally to exercise the full hybrid path.

---

## Development without Docker

**Backend** — `./dev-server.sh` from `backend/` (ports **9001** / **9003** / **9004** if busy). First time: `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`.

**LangChain quirks:** if a global `langchain` 1.x clashes with `langchain-core` 0.3.x, `agent/langchain_shim.py` patches missing attrs — still prefer a **clean venv**.

**Frontend:** `cd frontend && npm install && npm run dev` (**9002**). Set `INTERNAL_API_URL` if the API is not on 9001.

---

## Run on Windows (PowerShell)

**Terminal 1 — API**

```powershell
cd C:\Users\udits\Bankwise-ai\backend
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 9001
```

**Terminal 2 — UI**

```powershell
cd C:\Users\udits\Bankwise-ai\frontend
npm install
npm run dev
```

Open **http://localhost:9002**.

---

## Project layout (where things live)

```text
Bankwise-ai/
├── backend/
│   ├── agent/           # LangGraph, tools, critic, runner
│   ├── api/             # FastAPI routes (chat, advisor, export, conversations)
│   ├── calculators/     # Decimal EMI, eligibility, SIP, FD, …
│   ├── knowledge/       # RAG markdown KB (## KB:id sections)
│   ├── rag/             # chunker, bm25, embeddings, vector_store, pipeline, retriever
│   ├── scripts/         # e.g. build_rag_index.py
│   ├── storage/         # SQLite chat store
│   └── main.py
├── frontend/
│   └── src/app/         # pages: chat, advisor, docs, …
├── docker-compose.yml
└── .env.example
```

---

## Interview: how to describe this project (concise)

Memorise or adapt these lines — they are **accurate to this repo** and short enough for live coding / panel interviews.

**Elevator (~20 seconds)**  
*BankWise AI is an educational Indian banking console: a **Next.js + React** frontend talks to a **FastAPI** backend on Python 3. The backend runs **hybrid RAG** over curated markdown, a **LangGraph** agent backed by **DeepSeek**, and **deterministic Decimal tool** engines for EMI and eligibility. Answers **stream over SSE**, history lives in **SQLite**, and there is a separate **advisor** path with FOIR-style metrics, three return scenarios, and **PDF export**.*

**Architecture (one breath)**  
*Thin Next **API proxy** for same-origin calls; all domain logic in **FastAPI**; **LangGraph** for the tool loop; **RAG** before the graph; **critic** after to align text with tool JSON; calculators never trust the model for raw math.*

**RAG (if they dig in)**  
*Chunked KB with `## KB:id` headers; **BM25** always on; optional **dense vectors** (BGE-small) with **RRF** fusion and **MMR**; optional **cross-encoder rerank**; retrieval **trace** returned to the UI for transparency.*

**Why tools + critic?**  
*LLMs hallucinate numbers; we force **structured tool JSON** from Python `Decimal` code and use a **critic** so the streamed narrative does not contradict those results.*

**Why Next.js in front of Python?**  
*Developer UX and deployment: **one browser origin**, env-based backend URL, and keeping secrets on the server that talks to DeepSeek.*

**Testing / CI angle**  
*Pytest covers safety, calculators, RAG fusion paths, conversations, advisor, and PDF routes **without** a live LLM; RAG tests can disable dense/rerank so CI does not download large models.*

---

## Manual checklist

- `docker compose up --build` works.
- `/`, `/chat`, `/advisor`, `/docs` load.
- EMI ₹50L @ 8.5% × 20y ≈ **₹43,391**/mo (engine).
- Streaming + trace + KB citations visible.
- History loads past conversations.
- PDF export on chat and advisor downloads.
- `GET /health` → 200.
- `POST /api/calculate/emi` with bad input → **422**.

---

BankWise AI provides **educational guidance only**. Confirm rates, fees, and eligibility with your bank, NBFC, or a qualified professional before acting.
