from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_REPO_ROOT = _BACKEND_DIR.parent
# Load backend/.env first, then repo-root .env (later overrides) so keys work whether you start
# uvicorn from `backend/` or put secrets only in the monorepo root `.env`.
_ENV_FILES: tuple[Path, ...] = tuple(
    p for p in (_BACKEND_DIR / ".env", _REPO_ROOT / ".env") if p.is_file()
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILES if _ENV_FILES else (".env",),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"
    max_tokens: int = 2048
    temperature: float = 0.3
    environment: str = "development"
    cors_origins: str = "http://localhost:3000"
    # When True, unreachable DeepSeek returns a full BankWise-style message instead of a bare error.
    llm_network_fallback: bool = True

    @field_validator("deepseek_api_key", mode="before")
    @classmethod
    def strip_api_key(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("deepseek_base_url", mode="before")
    @classmethod
    def strip_base_url(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip().rstrip("/")
        return v

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


def clear_settings_cache() -> None:
    """Call after changing .env at runtime (tests / reload tooling)."""
    get_settings.cache_clear()
