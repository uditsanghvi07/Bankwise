"""Professional PDF transcript / report exports using fpdf2."""

from __future__ import annotations

import io
import re
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from fpdf import FPDF
from pydantic import BaseModel, Field

from calculators.emi import compute_emi
from core.widget_parser import strip_widget_markup
from llm.deepseek_client import completion_with_system
from schemas.advisor import AdvisorResponse, AdvisorScenarioRequest
from storage import get_store

router = APIRouter(prefix="/export", tags=["export"])


_PRIMARY = (15, 23, 42)         # ink slate-900
_ACCENT = (79, 70, 229)         # indigo-600
_VIOLET = (124, 58, 237)
_MUTED = (100, 116, 139)        # slate-500
_LINE = (226, 232, 240)         # slate-200
_OK = (5, 150, 105)             # emerald
_WARN = (180, 83, 9)
_DANGER = (185, 28, 28)


def _ascii(text: str) -> str:
    """fpdf2 with built-in fonts is latin-1; collapse common unicode to safe equivalents."""
    if not text:
        return ""
    repl = {
        "\u20b9": "Rs.",  # ₹
        "\u2013": "-",     # –
        "\u2014": "-",     # —
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2026": "...",
        "\u2022": "*",
        "\u00a0": " ",
        "\u2011": "-",
        "\u2192": "->",
    }
    for k, v in repl.items():
        text = text.replace(k, v)
    text = text.encode("latin-1", "replace").decode("latin-1")
    return text


def _flatten_md_tables(text: str) -> str:
    """Turn pipe tables into bullet lines so fpdf2 does not print raw markdown."""
    if not text:
        return ""
    lines = text.splitlines()
    out: list[str] = []
    in_table = False
    for line in lines:
        stripped = line.strip()
        if "|" in stripped and stripped.startswith("|"):
            sep = stripped.replace(" ", "")
            if re.match(r"^\|?[-:|]+\|?$", sep):
                continue
            cells = [c.strip() for c in stripped.strip("|").split("|")]
            if not in_table:
                out.append("")
                in_table = True
            out.append("  * " + " | ".join(cells))
            continue
        if in_table and stripped == "":
            continue
        in_table = False
        out.append(line)
    return "\n".join(out)


def _strip_md(text: str) -> str:
    if not text:
        return ""
    text = strip_widget_markup(text)
    text = _flatten_md_tables(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"\*(.+?)\*", r"\1", text)
    text = re.sub(r"`(.+?)`", r"\1", text)
    text = re.sub(r"\[(.+?)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"^#+\s*", "", text, flags=re.M)
    return text


def _loan_total_interest(loan: dict[str, Any]) -> float:
    try:
        p = float(loan.get("principal") or 0)
        r = float(loan.get("annual_rate") or 0)
        n = int(loan.get("tenure_months") or 0)
    except (TypeError, ValueError):
        return 0.0
    if p <= 0 or n <= 0:
        return 0.0
    try:
        emi = float(compute_emi(p, r, n))
    except Exception:
        return 0.0
    return max(0.0, emi * n - p)


def _render_loan_comparison_bars(pdf: BankWisePDF, params: dict[str, Any]) -> None:
    loans = params.get("loans") if isinstance(params, dict) else None
    if not isinstance(loans, list) or len(loans) < 2:
        return
    interests = [_loan_total_interest(x) if isinstance(x, dict) else 0.0 for x in loans]
    mx = max(interests) or 1.0
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*_MUTED)
    pdf.cell(0, 5, _ascii("Total interest (relative bars)"), ln=1)
    pdf.ln(1)
    y0 = pdf.get_y()
    bar_h = 8.0
    gap = 3.0
    usable = pdf.w - pdf.l_margin - pdf.r_margin
    n = len(loans)
    slot = (usable - gap * max(0, n - 1)) / n if n else usable
    x0 = pdf.l_margin
    for i in range(n):
        x = x0 + i * (slot + gap)
        pct = min(1.0, interests[i] / mx)
        w_bar = max(4.0, (slot - 0.5) * pct)
        pdf.set_fill_color(226, 232, 240)
        pdf.rect(x, y0, slot, bar_h, style="F")
        pdf.set_fill_color(99, 102, 241)
        pdf.rect(x, y0, w_bar, bar_h, style="F")
    y1 = y0 + bar_h + 2
    pdf.set_xy(pdf.l_margin, y1)
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(*_PRIMARY)
    legend: list[str] = []
    for i, loan in enumerate(loans):
        if not isinstance(loan, dict):
            continue
        lab = str(loan.get("label") or f"Option {i + 1}")[:20]
        legend.append(f"{lab}: Rs.{interests[i]:,.0f} interest")
    pdf.multi_cell(0, 4, _ascii("  |  ".join(legend)))
    pdf.ln(1)


_PDF_SUMMARY_SYSTEM = (
    "You write executive summaries for PDF exports of a banking education chat (India). "
    "Output plain text only: 4-6 short lines, each starting with ' - '. No markdown tables, no HTML. "
    "Cover: what the user asked, key numbers or products if any, caveats, and sensible next checks. "
    "Stay neutral; this is not personalized financial advice. Max 900 characters."
)


async def _executive_summary_for_transcript(msgs: list[Any]) -> str:
    lines: list[str] = []
    for m in msgs[:40]:
        role = "User" if m.role == "user" else "Assistant"
        body = (m.content or "")[:1500]
        lines.append(f"{role}: {body}")
    blob = "\n\n".join(lines)
    if len(blob) > 12000:
        blob = blob[:12000] + "\n...[truncated]"
    text, _elapsed = await completion_with_system(
        system=_PDF_SUMMARY_SYSTEM,
        user="Conversation transcript:\n\n" + blob,
        max_tokens=480,
    )
    return text.strip()


def _last_loan_comparison_widget(msgs: list[Any]) -> dict[str, Any] | None:
    for m in reversed(msgs):
        w = getattr(m, "widget", None)
        if isinstance(w, dict) and w.get("type") == "loan_comparison":
            return w
    return None


class BankWisePDF(FPDF):
    def __init__(self, *, title: str) -> None:
        super().__init__(orientation="P", unit="mm", format="A4")
        self.title_text = title
        self.set_auto_page_break(auto=True, margin=18)
        self.set_margins(left=15, top=15, right=15)
        self.set_creator("BankWise AI")
        self.set_title(_ascii(title))

    def header(self) -> None:
        self.set_fill_color(*_ACCENT)
        self.rect(0, 0, self.w, 12, style="F")
        self.set_text_color(255, 255, 255)
        self.set_font("Helvetica", "B", 11)
        self.set_xy(15, 3)
        self.cell(0, 6, "BankWise AI", ln=0)
        self.set_font("Helvetica", "", 9)
        self.set_xy(0, 4)
        self.cell(self.w - 15, 5, _ascii(self.title_text), align="R")
        self.ln(15)
        self.set_text_color(*_PRIMARY)

    def footer(self) -> None:
        self.set_y(-12)
        self.set_draw_color(*_LINE)
        self.line(15, self.get_y(), self.w - 15, self.get_y())
        self.set_y(-9)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*_MUTED)
        self.cell(
            0,
            6,
            f"BankWise AI - educational only - page {self.page_no()}/{{nb}}",
            align="C",
        )
        self.set_text_color(*_PRIMARY)

    # ---- helpers ----
    def section_title(self, text: str, *, accent: tuple[int, int, int] = _ACCENT) -> None:
        self.ln(2)
        self.set_text_color(*accent)
        self.set_font("Helvetica", "B", 13)
        self.cell(0, 6, _ascii(text), ln=1)
        self.set_draw_color(*accent)
        self.set_line_width(0.6)
        self.line(self.get_x(), self.get_y(), self.get_x() + 30, self.get_y())
        self.ln(3)
        self.set_text_color(*_PRIMARY)
        self.set_line_width(0.2)

    def body(self, text: str) -> None:
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "", 10.5)
        self.set_text_color(*_PRIMARY)
        avail = self.w - self.l_margin - self.r_margin
        self.multi_cell(avail, 5.5, _ascii(text))
        self.ln(1)

    def muted(self, text: str) -> None:
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "I", 9)
        self.set_text_color(*_MUTED)
        avail = self.w - self.l_margin - self.r_margin
        self.multi_cell(avail, 4.8, _ascii(text))
        self.set_text_color(*_PRIMARY)
        self.ln(1)

    def bullet(self, text: str) -> None:
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "", 10)
        bullet_w = 5
        avail = self.w - self.l_margin - self.r_margin - bullet_w
        self.cell(bullet_w, 5, _ascii("- "))
        self.multi_cell(avail, 5, _ascii(text))

    def kv_row(self, k: str, v: str, *, color: tuple[int, int, int] | None = None) -> None:
        self.set_x(self.l_margin)
        key_w = 55
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(*_MUTED)
        self.cell(key_w, 6, _ascii(k))
        self.set_font("Helvetica", "", 10.5)
        self.set_text_color(*(color or _PRIMARY))
        avail = self.w - self.l_margin - self.r_margin - key_w
        if avail < 20:
            self.ln()
            self.set_x(self.l_margin)
            avail = self.w - self.l_margin - self.r_margin
        self.cell(avail, 6, _ascii(v), ln=1)
        self.set_text_color(*_PRIMARY)


def _intro_block(pdf: BankWisePDF, *, title: str, subtitle: str) -> None:
    pdf.set_fill_color(248, 250, 252)
    pdf.set_draw_color(*_LINE)
    pdf.rect(15, pdf.get_y(), pdf.w - 30, 22, style="DF")
    pdf.set_xy(20, pdf.get_y() + 4)
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(*_PRIMARY)
    pdf.cell(0, 7, _ascii(title), ln=1)
    pdf.set_x(20)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*_MUTED)
    pdf.cell(0, 6, _ascii(subtitle), ln=1)
    pdf.set_text_color(*_PRIMARY)
    pdf.ln(8)


# ---------------- transcript export ---------------- #

class TranscriptExportRequest(BaseModel):
    conversation_id: str | None = None
    title: str | None = Field(default=None, max_length=140)


@router.post("/transcript")
async def export_transcript(payload: TranscriptExportRequest):
    if not payload.conversation_id:
        raise HTTPException(status_code=400, detail="conversation_id is required")
    store = get_store()
    conv = await store.get_conversation(payload.conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="conversation not found")
    msgs = await store.list_messages(payload.conversation_id)

    pdf = BankWisePDF(title=payload.title or conv.title or "Conversation")
    pdf.alias_nb_pages()
    pdf.add_page()

    when = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    _intro_block(
        pdf,
        title=payload.title or conv.title or "Banking advisory transcript",
        subtitle=f"Generated by BankWise AI - {when}",
    )

    exec_text = await _executive_summary_for_transcript(msgs)
    if not exec_text:
        exec_text = (
            " - Configure DEEPSEEK_API_KEY to generate an AI-written executive summary.\n"
            " - The sections below still include a cleaned transcript and any loan comparison snapshot."
        )

    pdf.section_title("Executive summary")
    pdf.body(_strip_md(exec_text))

    lcw = _last_loan_comparison_widget(msgs)
    if lcw and isinstance(lcw.get("params"), dict):
        pdf.section_title("Key figures")
        _render_loan_comparison_bars(pdf, lcw["params"])
        pdf.ln(2)

    pdf.section_title("At a glance")
    pdf.kv_row("Conversation", f"{conv.id[:8]}…")
    pdf.kv_row("Messages", str(len(msgs)))
    pdf.kv_row(
        "Created",
        datetime.fromtimestamp(conv.created_at / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
    )

    pdf.section_title("Conversation")
    if not msgs:
        pdf.muted("No messages in this conversation yet.")
    for m in msgs:
        is_user = m.role == "user"
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*(_VIOLET if is_user else _ACCENT))
        pdf.cell(0, 6, _ascii(("You" if is_user else "BankWise AI") + " - " + datetime.fromtimestamp(m.created_at / 1000, tz=timezone.utc).strftime("%H:%M:%S")), ln=1)
        pdf.set_text_color(*_PRIMARY)
        pdf.body(_strip_md(m.content))
        if m.widget:
            wt = str(m.widget.get("type") or "chart")
            if wt == "loan_comparison":
                pdf.muted("Includes loan comparison (see Key figures for a visual snapshot).")
            else:
                pdf.muted(f"Includes structured figure: {wt}")
        if m.kb_citations:
            pdf.muted("Sources: " + ", ".join(m.kb_citations))
        pdf.set_draw_color(*_LINE)
        pdf.line(15, pdf.get_y() + 1, pdf.w - 15, pdf.get_y() + 1)
        pdf.ln(3)

    pdf.section_title("Disclaimer")
    pdf.muted(
        "BankWise AI provides educational guidance only. Verify rates, fees, and eligibility with your bank, NBFC, or qualified professional. "
        "This document is not investment, tax, or legal advice."
    )

    buf = io.BytesIO(bytes(pdf.output()))
    buf.seek(0)
    filename = f"bankwise-transcript-{conv.id[:8]}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=\"{filename}\""},
    )


# ---------------- advisor report export ---------------- #

class AdvisorReportRequest(BaseModel):
    request: AdvisorScenarioRequest
    response: AdvisorResponse


@router.post("/advisor")
async def export_advisor(payload: AdvisorReportRequest):
    req = payload.request
    res = payload.response
    pdf = BankWisePDF(title="Personal advisory report")
    pdf.alias_nb_pages()
    pdf.add_page()

    when = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    _intro_block(pdf, title="Personal advisory report", subtitle=f"Generated by BankWise AI - {when}")

    pdf.section_title("Profile")
    pdf.kv_row("Age / horizon", f"{req.age} years / {req.horizon_years}-year horizon")
    pdf.kv_row("Monthly income", f"Rs. {req.monthly_income:,.0f}")
    pdf.kv_row("Monthly expenses", f"Rs. {req.monthly_expenses:,.0f}")
    pdf.kv_row("Monthly savings", f"Rs. {req.monthly_savings:,.0f}")
    pdf.kv_row("Existing EMIs", f"Rs. {req.existing_emi_obligations:,.0f}")
    pdf.kv_row("Current savings", f"Rs. {req.current_savings:,.0f}")
    pdf.kv_row("Risk appetite", req.risk_appetite.title())
    pdf.kv_row("Primary goal", req.primary_goal.replace("_", " ").title())
    if req.target_corpus > 0:
        pdf.kv_row("Target corpus", f"Rs. {req.target_corpus:,.0f}")

    pdf.ln(2)
    if res.verdict:
        pdf.section_title(f"Verdict: {res.verdict.label}", accent=_VIOLET)
        pdf.body(_strip_md(res.verdict.headline))
        pdf.muted(_strip_md(res.verdict.one_liner))

    pdf.section_title("Headline numbers", accent=_VIOLET)
    score_color = _OK if res.health_score >= 70 else (_WARN if res.health_score >= 40 else _DANGER)
    pdf.kv_row("Health score", f"{res.health_score} / 100", color=score_color)
    pdf.kv_row("FOIR used", f"{res.foir_used_pct:.1f}%")
    pdf.kv_row("Savings rate", f"{res.savings_rate_pct:.1f}%")
    if res.emergency_fund_months:
        pdf.kv_row("Emergency cover", f"{res.emergency_fund_months:.1f} months")
    pdf.kv_row("Expected return", f"{res.expected_return_pct:.1f}% p.a.")
    if res.returns:
        pdf.kv_row(
            "Scenario band",
            f"{res.returns.pessimistic_pct:.1f}% / {res.returns.base_pct:.1f}% / {res.returns.optimistic_pct:.1f}%",
        )
    if res.monthly_sip_required > 0:
        pdf.kv_row("SIP required (base)", f"Rs. {res.monthly_sip_required:,.0f} / month")
    if res.goal_feasibility:
        pdf.kv_row(
            "Goal feasibility",
            f"{res.goal_feasibility.label.replace('_', ' ').title()} "
            f"({res.goal_feasibility.pct_of_current_savings:.0f}% of monthly savings)",
        )

    if res.red_flags:
        pdf.section_title("Red flags", accent=_DANGER)
        for f in res.red_flags:
            pdf.bullet(_strip_md(f))
    if res.green_flags:
        pdf.section_title("Working in your favour", accent=_OK)
        for f in res.green_flags:
            pdf.bullet(_strip_md(f))

    pdf.section_title("Summary")
    pdf.body(_strip_md(res.summary))

    pdf.section_title("Honest narrative", accent=_VIOLET)
    pdf.body(_strip_md(res.narrative))

    pdf.section_title("Recommendations")
    for rec in res.recommendations:
        pdf.set_font("Helvetica", "B", 10.5)
        pdf.set_text_color(*_PRIMARY)
        pdf.cell(0, 5.5, _ascii(f"{rec.title}  ({rec.weight_pct:.0f}%)"), ln=1)
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*_MUTED)
        pdf.multi_cell(0, 5, _ascii(_strip_md(rec.detail)))
        pdf.ln(1)
    pdf.set_text_color(*_PRIMARY)

    def _fmt_inr(v: float | None) -> str:
        """Short Indian-format number for PDF table cells — keeps columns narrow."""
        if v is None:
            return "-"
        n = float(v)
        if n >= 1e7:
            return f"Rs.{n / 1e7:.2f}Cr"
        if n >= 1e5:
            return f"Rs.{n / 1e5:.1f}L"
        if n >= 1e3:
            return f"Rs.{n / 1e3:.1f}K"
        return f"Rs.{int(n)}"

    # Column widths that sum exactly to usable width (180mm on A4 with 15mm each margin)
    _CW = {"yr": 10, "age": 10, "cont": 36, "pess": 31, "base": 31, "opt": 31, "tgt": 31}
    assert sum(_CW.values()) == 180

    pdf.section_title("Projections (3-path)")
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(241, 245, 249)
    pdf.set_draw_color(*_LINE)
    pdf.set_text_color(*_MUTED)
    row_h = 6
    pdf.cell(_CW["yr"],   row_h, "Yr",           border="B", fill=True, align="C")
    pdf.cell(_CW["age"],  row_h, "Age",           border="B", fill=True, align="C")
    pdf.cell(_CW["cont"], row_h, "Contributions", border="B", fill=True, align="C")
    pdf.cell(_CW["pess"], row_h, "Pessimistic",   border="B", fill=True, align="C")
    pdf.cell(_CW["base"], row_h, "Base",          border="B", fill=True, align="C")
    pdf.cell(_CW["opt"],  row_h, "Optimistic",    border="B", fill=True, align="C")
    pdf.cell(_CW["tgt"],  row_h, "Target",        border="B", fill=True, align="C")
    pdf.ln()
    pdf.set_text_color(*_PRIMARY)
    pdf.set_font("Helvetica", "", 9)

    points = res.projections
    if len(points) > 13:
        step = max(1, len(points) // 13)
        sliced = points[::step]
        if sliced[-1] is not points[-1]:
            sliced.append(points[-1])
    else:
        sliced = points

    for i, p in enumerate(sliced):
        pess = p.portfolio_pessimistic if p.portfolio_pessimistic is not None else p.portfolio_value
        opt  = p.portfolio_optimistic  if p.portfolio_optimistic  is not None else p.portfolio_value
        if i % 2 == 0:
            pdf.set_fill_color(248, 250, 252)
            fill = True
        else:
            fill = False
        data_h = 5.5
        pdf.cell(_CW["yr"],   data_h, str(p.year),              align="C",  fill=fill)
        pdf.cell(_CW["age"],  data_h, str(p.age),               align="C",  fill=fill)
        pdf.cell(_CW["cont"], data_h, _ascii(_fmt_inr(p.contribution_to_date)), align="R", fill=fill)
        pdf.cell(_CW["pess"], data_h, _ascii(_fmt_inr(pess)),               align="R", fill=fill)
        pdf.cell(_CW["base"], data_h, _ascii(_fmt_inr(p.portfolio_value)),  align="R", fill=fill)
        pdf.cell(_CW["opt"],  data_h, _ascii(_fmt_inr(opt)),                align="R", fill=fill)
        pdf.cell(_CW["tgt"],  data_h, _ascii(_fmt_inr(p.nominal_target)),   align="R", fill=fill)
        pdf.ln()
    pdf.ln(1)

    pdf.section_title("Risks to keep in mind")
    for r in res.risks:
        pdf.bullet(_strip_md(r))

    pdf.section_title("Disclaimer")
    for d in res.disclaimers:
        pdf.muted(_strip_md(d))

    buf = io.BytesIO(bytes(pdf.output()))
    buf.seek(0)
    filename = f"bankwise-advisor-{int(datetime.now(timezone.utc).timestamp())}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=\"{filename}\""},
    )
