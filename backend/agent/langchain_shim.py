"""
Patch incomplete global `langchain` installs (e.g. 1.x meta-package mixed with langchain-core 0.3.x).

`langchain_core.globals` syncs with `langchain.verbose`, `langchain.debug`, and `langchain.llm_cache`
(see get_verbose / get_debug / get_llm_cache). Missing attrs raise AttributeError during LangGraph / ChatOpenAI.

Import this module before any `langchain_core` or `langgraph` import.
"""

from __future__ import annotations

import sys
import types

# Defaults match what langchain_core expects when the legacy root module is absent or partial.
_SHIM_DEFAULTS: dict[str, object] = {
    "verbose": False,
    "debug": False,
    "llm_cache": None,
}


def apply_langchain_shim() -> None:
    """Idempotent: safe to import multiple times."""
    mod = sys.modules.get("langchain")
    if mod is None:
        mod = types.ModuleType("langchain")
        for name, value in _SHIM_DEFAULTS.items():
            setattr(mod, name, value)
        sys.modules["langchain"] = mod
        return
    for name, value in _SHIM_DEFAULTS.items():
        if not hasattr(mod, name):
            setattr(mod, name, value)


apply_langchain_shim()
