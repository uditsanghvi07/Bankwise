# BankWise AI

BankWise AI is a professional banking and loan advisory chatbot powered by DeepSeek, with FastAPI calculator engines and a Next.js interface tuned for Indian retail banking.

## Quick start

1. **Clone or copy** this repository into your workspace.
2. **Configure API key**: copy `.env.example` to `.env` in the project root and set `DEEPSEEK_API_KEY` to a valid [DeepSeek](https://api.deepseek.com) key.
3. **Run everything**: `docker compose up --build`, then open `http://localhost:3000` (frontend) and `http://localhost:8000/docs` (API).

The frontend proxies `/api/*` to the backend via a Next.js route handler (`frontend/src/app/api/[...path]/route.ts`); the browser only talks to port 3000 for API calls (set `INTERNAL_API_URL` for the Node server if the API is not on `http://127.0.0.1:8000`).

## What it helps with

- **Loans**: home, personal, car, business, gold, LAP, restructuring concepts (educational framing).
- **Calculators**: EMI (with optional partial prepayment), amortization, eligibility (FOIR norms), multi-loan comparison, SIP, FD (with compounding and TDS notes), CIBIL-style directional simulator.
- **Banking & credit**: savings/current/FD/RD concepts, CIBIL factors and improvement paths, NACH, SARFAESI, PMAY at a high level.
- **Investments (secondary)**: SIP vs lump sum, ELSS/80C context, risk profiling — no stock picks or crypto recommendations.

## What it will not do

- No help with **money laundering**, **tax evasion**, **fake documents**, **hiding income**, or **circumventing KYC/AML**.
- No **specific stock picks**, **market timing**, or **crypto investment** recommendations.
- **No fabricated rates** — when rates or schemes are discussed, the assistant reminds you to verify with your bank or RBI.

This is spelled out in the UI and enforced with a **safety pre-filter** before any LLM call.

## Calculator accuracy

- **EMI**: standard reducing-balance formula  
  \(\text{EMI} = P \cdot r \cdot (1+r)^n / ((1+r)^n - 1)\)  
  implemented with Python `Decimal` in `backend/calculators/emi.py`.
- **Eligibility**: FOIR caps per loan type (home scales with income band), then reverse-EMI for max principal — `backend/calculators/eligibility.py`.
- **SIP future value**: ordinary annuity FV with monthly compounding — `investment.py`.
- **FD**: compound interest \(A = P(1 + r/n)^{nt}\) — `investment.py`.
- **CIBIL simulator**: directional bands only, with an explicit disclaimer (not CIBIL’s proprietary model).

## Customising for a specific bank

Edit `backend/core/system_prompt.py` to add your institution’s product names, rate sheets (as *indicative* ranges only), and internal disclaimers. Keep the compliance section intact. Rebuild the backend container after changes.

## Architecture (conceptual)

```text
Browser (Next.js + Zustand + Recharts)
        │  /api/* (Next route → INTERNAL_API_URL)
        ▼
FastAPI (safety guard → DeepSeek → widget JSON parse + optional inference)
        │
        ├── Calculator routes (Decimal math, validation)
        └── Stateless — conversation history is supplied from the browser each call
```

## Development without Docker

- **Backend (recommended)** — picks 8000, or 8001/8002 if 8000 is busy:

  ```bash
  cd backend && ./dev-server.sh
  ```

  First-time setup in that folder: `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`

- **If port 8000 is stuck** (often a root-owned `python` from an old `sudo uvicorn`): free it with `sudo fuser -k 8000/tcp`, then run `./dev-server.sh` again. If `sudo kill` reports “Permission denied”, your shell may not be elevating correctly — use `sudo fuser -k 8000/tcp` or reboot.

- **Frontend**: `cd frontend && npm install && npm run dev`  
  If the API started on **8001** or **8002**, set `export INTERNAL_API_URL=http://127.0.0.1:8001` (or `8002`) in the same terminal before `npm run dev`.

## Checklist (manual)

- `docker compose up --build` succeeds.
- `http://localhost:3000/chat` loads.
- EMI for ₹50 lakh @ 8.5% for 20 years ≈ **₹43,391**/month (engine shows paise-level precision).
- Amortization schedule length matches tenure months (e.g. 240).
- Blocked phrases (e.g. laundering, prompt injection scaffolding) return the refusal or sanitised input.
- `GET http://localhost:8000/health` → 200.
- `POST /api/calculate/emi` with negative principal → **422** with field detail.

---

BankWise AI provides **educational guidance only**. Always confirm rates, fees, and eligibility with your bank, NBFC, or qualified professional before acting.
