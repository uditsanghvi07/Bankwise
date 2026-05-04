import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor

import agent.langchain_shim  # noqa: F401 — before routers pull LangGraph / langchain_core

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import advisor, calculators, chat, conversations, export, health
from core.config import get_settings
from storage import init_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bankwise")

app = FastAPI(title="BankWise AI API", version="1.0.0")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(chat.router, prefix="/api")
app.include_router(calculators.router, prefix="/api")
app.include_router(conversations.router, prefix="/api")
app.include_router(advisor.router, prefix="/api")
app.include_router(export.router, prefix="/api")

init_db()

_warmup_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="bankwise-warmup")


def _warmup_rag() -> None:
    """Build the RAG index (BM25 + optional dense) in a background thread at startup."""
    try:
        import time
        t = time.perf_counter()
        from rag.retriever import get_retriever
        r = get_retriever()
        logger.info("RAG warm-up done — %d chunks indexed in %.0f ms", len(r.chunks), (time.perf_counter() - t) * 1000)
    except Exception as exc:
        logger.warning("RAG warm-up failed (non-fatal): %s", exc)


def _warmup_agent() -> None:
    """Compile the LangGraph agent graph at startup so first chat has no compile delay."""
    try:
        import time
        t = time.perf_counter()
        from agent.graph import get_compiled_agent
        get_compiled_agent()
        logger.info("LangGraph warm-up done in %.0f ms", (time.perf_counter() - t) * 1000)
    except RuntimeError as exc:
        logger.warning("LangGraph warm-up skipped (no API key?): %s", exc)
    except Exception as exc:
        logger.warning("LangGraph warm-up failed (non-fatal): %s", exc)


@app.get("/")
def root():
    return {
        "name": "BankWise AI API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }


@app.on_event("startup")
async def startup():
    s = get_settings()
    logger.info(
        "BankWise AI starting model=%s temperature=%s deepseek_key=%s",
        s.deepseek_model,
        s.temperature,
        "configured" if s.deepseek_api_key else "MISSING — chat will not call DeepSeek",
    )
    # Pre-warm RAG index and agent graph in background threads so the first
    # HTTP request to /api/chat/stream or /api/conversations/ is instant.
    loop = asyncio.get_event_loop()
    loop.run_in_executor(_warmup_executor, _warmup_rag)
    loop.run_in_executor(_warmup_executor, _warmup_agent)
