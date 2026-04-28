import html
import re
from dataclasses import dataclass

MAX_INPUT_LEN = 2000

INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior)\s+instructions?",
    r"disregard\s+(all\s+)?(previous|prior)\s+instructions?",
    r"you\s+are\s+now",
    r"new\s+instructions?:",
    r"\bdan\s+mode\b",
    r"developer\s+mode",
    r"jailbreak",
    r"system\s*:\s*",
]

LOAN_FRAUD = [
    r"hide\s+income",
    r"fake\s+salary",
    r"dummy\s+bank\s+statement",
    r"benami",
    r"misrepresent\s+income",
    r"forge",
]

MONEY_LAUNDERING = [
    r"convert\s+black\s+money",
    r"launder",
    r"cash\s+transaction\s+no\s+trace",
    r"avoid\s+itr\b",
    r"unaccounted\s+cash",
]

EVASION = [
    r"avoid\s+tds",
    r"not\s+declare",
    r"under\s+the\s+table",
    r"tax\s+evasion",
    r"undeclared\s+income",
]

HARASSMENT = [
    r"threaten\s+borrower",
    r"pressure\s+collection",
    r"harass\s+debtor",
]


def _compile_group(patterns: list[str]) -> re.Pattern[str]:
    return re.compile("|".join(f"(?:{p})" for p in patterns), re.IGNORECASE)


_INJECTION_RE = _compile_group(INJECTION_PATTERNS)
_LOAN_FRAUD_RE = _compile_group(LOAN_FRAUD)
_ML_RE = _compile_group(MONEY_LAUNDERING)
_EVASION_RE = _compile_group(EVASION)
_HARASS_RE = _compile_group(HARASSMENT)

REFUSAL_MESSAGE = (
    "That's not something I can help with — it touches on practices that aren't "
    "compliant with RBI and tax regulations. What I can help you with is understanding "
    "loan eligibility, EMI planning, credit health, or lawful tax-saving instruments "
    "in general terms. Would that be useful?"
)


@dataclass
class SafetyResult:
    allowed: bool
    sanitized_message: str
    refusal_reason: str | None = None


def strip_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text)
    return text


def sanitize_and_check(raw: str) -> SafetyResult:
    msg = raw.strip()
    if len(msg) > MAX_INPUT_LEN:
        msg = msg[:MAX_INPUT_LEN]

    msg = strip_html(msg)
    msg = html.unescape(msg)

    lower = msg.lower()
    if _LOAN_FRAUD_RE.search(lower) or _ML_RE.search(lower) or _EVASION_RE.search(lower) or _HARASS_RE.search(lower):
        return SafetyResult(allowed=False, sanitized_message="", refusal_reason="policy")

    msg = _INJECTION_RE.sub(" ", msg)
    msg = re.sub(r"\s+", " ", msg).strip()

    if not msg:
        return SafetyResult(allowed=False, sanitized_message="", refusal_reason="empty")

    return SafetyResult(allowed=True, sanitized_message=msg, refusal_reason=None)
