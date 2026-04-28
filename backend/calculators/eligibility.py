"""Loan eligibility from FOIR and reverse EMI (Decimal)."""

from decimal import ROUND_HALF_UP, Decimal

from calculators.emi import compute_emi, reverse_principal_from_emi


def _foir_fraction(loan_type: str, monthly_income: float) -> Decimal:
    inc = Decimal(str(monthly_income))
    lt = loan_type.lower().strip()
    if lt == "home":
        return Decimal("0.40") if inc < Decimal("50000") else Decimal("0.50")
    if lt == "personal":
        return Decimal("0.35")
    if lt == "car":
        return Decimal("0.45")
    if lt == "business":
        return Decimal("0.50")
    return Decimal("0.40")


def cibil_note_for_loan_type(loan_type: str) -> str:
    lt = loan_type.lower().strip()
    if lt == "home":
        return "Home loans are often sanctioned from around 650+ CIBIL for many lenders; competitive pricing is more typical from 700+."
    if lt == "personal":
        return "Personal loans are unsecured; lenders commonly prefer 700–750+ CIBIL depending on income and employer."
    if lt == "car":
        return "Car loans are secured by the vehicle; 650–700+ is often workable with strong income documentation."
    if lt == "business":
        return "Business loans rely heavily on cash flows and banking; CIBIL 700+ helps but GST/ITR quality matters equally."
    return "A healthy CIBIL (typically 700+) improves approval odds across products."


def compute_eligibility(
    monthly_income: float,
    existing_emi_obligations: float,
    loan_type: str,
    annual_rate_pct: float,
    requested_tenure_months: int,
    *,
    requested_principal: float | None = None,
) -> dict:
    inc = Decimal(str(monthly_income))
    existing = Decimal(str(existing_emi_obligations))
    foir = _foir_fraction(loan_type, monthly_income)
    max_obligations = (inc * foir).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    eligible_emi = max_obligations - existing
    if eligible_emi <= 0:
        return {
            "eligible_amount": 0.0,
            "max_emi": 0.0,
            "foir_used": float(foir * 100),
            "monthly_income_required_for_requested_amount": None,
            "cibil_note": cibil_note_for_loan_type(loan_type),
            "message": "Existing obligations exceed typical FOIR headroom for this income and loan type.",
        }

    emi_dec = eligible_emi.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    max_principal = reverse_principal_from_emi(emi_dec, annual_rate_pct, int(requested_tenure_months))
    eligible_amount = float(max_principal)

    income_required = None
    if requested_principal and requested_principal > 0:
        req_emi = compute_emi(requested_principal, annual_rate_pct, int(requested_tenure_months))
        needed_obligation_headroom = req_emi + existing
        if foir > 0:
            needed_income = (needed_obligation_headroom / foir).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            income_required = float(max(needed_income, Decimal(0)))

    return {
        "eligible_amount": eligible_amount,
        "max_emi": float(emi_dec),
        "foir_used": float(foir * 100),
        "monthly_income_required_for_requested_amount": income_required,
        "cibil_note": cibil_note_for_loan_type(loan_type),
    }
