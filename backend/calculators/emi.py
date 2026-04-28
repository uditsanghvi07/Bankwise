"""EMI and amortization using Decimal — rounding-accurate."""

from decimal import ROUND_HALF_UP, Decimal

TWO = Decimal("0.01")


def _d(x: float | int | str) -> Decimal:
    return Decimal(str(x))


def monthly_rate(annual_rate_pct: float | Decimal) -> Decimal:
    return _d(annual_rate_pct) / Decimal(12) / Decimal(100)


def compute_emi(principal: float, annual_rate_pct: float, tenure_months: int) -> Decimal:
    """Standard reducing-balance EMI = P × r × (1+r)^n / ((1+r)^n − 1)."""
    p = _d(principal)
    n = int(tenure_months)
    r = monthly_rate(annual_rate_pct)
    if n <= 0:
        raise ValueError("Tenure must be positive")
    if p <= 0:
        raise ValueError("Principal must be positive")
    if r == 0:
        return (p / n).quantize(TWO, rounding=ROUND_HALF_UP)
    one_plus = Decimal(1) + r
    pow_n = one_plus ** n
    emi = p * r * pow_n / (pow_n - Decimal(1))
    return emi.quantize(TWO, rounding=ROUND_HALF_UP)


def reverse_principal_from_emi(emi: Decimal, annual_rate_pct: float, tenure_months: int) -> Decimal:
    """P = EMI × ((1+r)^n − 1) / (r × (1+r)^n)."""
    e = _d(emi)
    n = int(tenure_months)
    r = monthly_rate(annual_rate_pct)
    if n <= 0 or e <= 0:
        raise ValueError("Invalid EMI or tenure")
    if r == 0:
        return (e * n).quantize(TWO, rounding=ROUND_HALF_UP)
    one_plus = Decimal(1) + r
    pow_n = one_plus ** n
    p = e * (pow_n - Decimal(1)) / (r * pow_n)
    return p.quantize(TWO, rounding=ROUND_HALF_UP)


def _build_rows(
    opening: Decimal,
    annual_rate_pct: float,
    emi: Decimal,
    max_months: int,
    *,
    prepayment_amount: Decimal | None = None,
    prepayment_after_month: int | None = None,
) -> tuple[list[dict], Decimal]:
    r = monthly_rate(annual_rate_pct)
    balance = opening
    rows: list[dict] = []
    total_interest = Decimal(0)
    prepay = prepayment_amount or Decimal(0)
    prepay_m = prepayment_after_month

    for month in range(1, max_months + 1):
        if balance <= TWO:
            break

        opening_b = balance

        if r == 0:
            interest_c = Decimal(0)
            # Last instalment: pay only what's left
            principal_c = emi if balance > emi else balance
        else:
            interest_c = (balance * r).quantize(TWO, rounding=ROUND_HALF_UP)
            principal_c = (emi - interest_c).quantize(TWO, rounding=ROUND_HALF_UP)
            if principal_c < 0:
                principal_c = Decimal(0)
            # Cap principal to remaining balance (handles rounding on final row)
            if principal_c > balance:
                principal_c = balance

        closing = (balance - principal_c).quantize(TWO, rounding=ROUND_HALF_UP)
        actual_payment = (interest_c + principal_c).quantize(TWO, rounding=ROUND_HALF_UP)
        total_interest += interest_c

        rows.append(
            {
                "month": month,
                "opening_balance": float(opening_b.quantize(TWO, rounding=ROUND_HALF_UP)),
                # 'emi' field stores the actual cash outflow for that month
                "emi": float(actual_payment),
                "principal": float(principal_c),
                "interest": float(interest_c),
                "closing_balance": float(max(closing, Decimal(0)).quantize(TWO, rounding=ROUND_HALF_UP)),
            }
        )
        balance = closing

        # Apply lump-sum prepayment after specified month
        if prepay_m is not None and month == prepay_m and prepay > 0:
            balance = (balance - prepay).quantize(TWO, rounding=ROUND_HALF_UP)
            if balance < 0:
                balance = Decimal(0)

    # ── Rounding residual fix ──────────────────────────────────────────────────
    # Due to ROUND_HALF_UP on each row, a tiny residual (typically < ₹2) may
    # remain after the final row.  Absorb it into the last row's principal so
    # the schedule closes to exactly ₹0 and totals tie out precisely.
    if balance > 0 and rows:
        residual = balance
        last = rows[-1]
        adj_principal = Decimal(str(last["principal"])) + residual
        adj_payment = Decimal(str(last["emi"])) + residual
        rows[-1] = dict(
            last,
            principal=float(adj_principal.quantize(TWO, rounding=ROUND_HALF_UP)),
            emi=float(adj_payment.quantize(TWO, rounding=ROUND_HALF_UP)),
            closing_balance=0.0,
        )
        # residual is principal, not interest — total_interest unchanged

    return rows, total_interest


def amortization_schedule(
    principal: float,
    annual_rate_pct: float,
    tenure_months: int,
    *,
    prepayment_amount: float | None = None,
    prepayment_after_month: int | None = None,
) -> dict:
    p = _d(principal)
    n = int(tenure_months)
    emi = compute_emi(principal, annual_rate_pct, tenure_months)
    prepay = _d(prepayment_amount) if prepayment_amount else Decimal(0)
    prepay_month = int(prepayment_after_month) if prepayment_after_month else None

    baseline_rows, baseline_interest = _build_rows(p, annual_rate_pct, emi, n)

    if prepay <= 0 or prepay_month is None or not (1 <= prepay_month <= n):
        rows, total_interest = baseline_rows, baseline_interest
        original_interest_saved = None
    else:
        rows, total_interest = _build_rows(
            p,
            annual_rate_pct,
            emi,
            n + 600,
            prepayment_amount=prepay,
            prepayment_after_month=prepay_month,
        )
        original_interest_saved = float(
            (baseline_interest - total_interest).quantize(TWO, rounding=ROUND_HALF_UP)
        )

    # Total payment = sum of actual cash paid each month (interest + principal)
    total_payment = sum(
        _d(str(rw["emi"])) for rw in rows
    )

    # Year summary — cumulative % paid tracks running total, not per-year slice
    by_year: dict[int, dict] = {}
    for rw in rows:
        y = (rw["month"] - 1) // 12 + 1
        if y not in by_year:
            by_year[y] = {
                "year": y,
                "principal_paid": Decimal(0),
                "interest_paid": Decimal(0),
                "end_balance": Decimal(0),
            }
        by_year[y]["principal_paid"] += _d(str(rw["principal"]))
        by_year[y]["interest_paid"] += _d(str(rw["interest"]))
        by_year[y]["end_balance"] = _d(str(rw["closing_balance"]))

    # Cumulative principal paid at end of each year
    cumulative_principal = Decimal(0)
    year_summary: list[dict] = []
    for y, v in sorted(by_year.items()):
        cumulative_principal += v["principal_paid"]
        cum_pct = (cumulative_principal / p * 100) if p > 0 else Decimal(0)
        year_summary.append(
            {
                "year": y,
                "principal_paid": float(v["principal_paid"].quantize(TWO, rounding=ROUND_HALF_UP)),
                "interest_paid": float(v["interest_paid"].quantize(TWO, rounding=ROUND_HALF_UP)),
                "balance_remaining": float(v["end_balance"].quantize(TWO, rounding=ROUND_HALF_UP)),
                # Cumulative % of original principal repaid by end of this year
                "percent_loan_paid": float(cum_pct.quantize(TWO, rounding=ROUND_HALF_UP)),
            }
        )

    result = {
        "emi_amount": float(emi),
        "total_payment": float(total_payment.quantize(TWO, rounding=ROUND_HALF_UP)),
        "total_interest": float(total_interest.quantize(TWO, rounding=ROUND_HALF_UP)),
        "interest_percentage": float(
            ((total_interest / p) * 100).quantize(TWO, rounding=ROUND_HALF_UP) if p > 0 else 0
        ),
        "schedule": rows,
        "year_summary": year_summary,
    }

    if prepay > 0 and prepay_month is not None and 1 <= prepay_month <= n:
        result["prepayment"] = {
            "amount": float(prepay),
            "after_month": prepay_month,
            "new_tenure_months": len(rows),
            "original_tenure_months": n,
            "interest_saved": max(original_interest_saved or 0.0, 0.0),
        }

    return result
