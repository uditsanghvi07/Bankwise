import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import calculators, chat, health
from core.config import get_settings

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
