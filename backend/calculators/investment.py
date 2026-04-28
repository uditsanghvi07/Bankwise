"""SIP and FD calculators (Decimal)."""

from decimal import ROUND_HALF_UP, Decimal

TWO = Decimal("0.01")


def _d(x: float | int | str) -> Decimal:
    return Decimal(str(x))


def sip_maturity(monthly_sip: float, annual_rate_pct: float, tenure_years: int) -> dict:
    pmt = _d(monthly_sip)
    years = int(tenure_years)
    months = years * 12
    r = _d(annual_rate_pct) / Decimal(12) / Decimal(100)
    if months <= 0 or pmt <= 0:
        raise ValueError("Invalid SIP inputs")
    if r == 0:
        fv = pmt * months
        yearly = []
        cum = Decimal(0)
        for y in range(1, years + 1):
            cum += pmt * 12
            yearly.append({"year": y, "corpus": float(cum), "invested": float(pmt * 12 * y)})
        invested = pmt * months
        gains = fv - invested
        return {
            "maturity_amount": float(fv.quantize(TWO, rounding=ROUND_HALF_UP)),
            "total_invested": float(invested.quantize(TWO, rounding=ROUND_HALF_UP)),
            "total_gains": float(gains.quantize(TWO, rounding=ROUND_HALF_UP)),
            "gains_percentage": 0.0,
            "yearly": yearly,
        }

    one_plus = Decimal(1) + r
    pow_n = one_plus**months
    fv = pmt * (pow_n - Decimal(1)) / r * one_plus
    invested = pmt * months
    gains = fv - invested
    pct = ((gains / invested) * 100) if invested > 0 else Decimal(0)

    yearly = []
    for y in range(1, years + 1):
        m = y * 12
        pow_m = one_plus**m
        corpus_y = pmt * (pow_m - Decimal(1)) / r * one_plus
        invested_y = pmt * m
        yearly.append(
            {
                "year": y,
                "corpus": float(corpus_y.quantize(TWO, rounding=ROUND_HALF_UP)),
                "invested": float(invested_y.quantize(TWO, rounding=ROUND_HALF_UP)),
            }
        )

    return {
        "maturity_amount": float(fv.quantize(TWO, rounding=ROUND_HALF_UP)),
        "total_invested": float(invested.quantize(TWO, rounding=ROUND_HALF_UP)),
        "total_gains": float(gains.quantize(TWO, rounding=ROUND_HALF_UP)),
        "gains_percentage": float(pct.quantize(TWO, rounding=ROUND_HALF_UP)),
        "yearly": yearly,
    }


def fd_maturity(
    principal: float,
    annual_rate_pct: float,
    tenure_years: int,
    compounding_frequency: int,
    *,
    senior_citizen: bool = False,
) -> dict:
    p = _d(principal)
    t = _d(tenure_years)
    annual = _d(annual_rate_pct)
    n = int(compounding_frequency)
    if p <= 0 or t <= 0 or n not in (1, 4, 12):
        raise ValueError("Invalid FD inputs")
    r = annual / Decimal(n) / Decimal(100)
    nt = t * Decimal(n)
    amount = p * ((Decimal(1) + r) ** nt)
    interest = amount - p
    eff = ((amount / p) ** (Decimal(1) / t) - Decimal(1)) * Decimal(100)

    annual_interest = interest / t if t > 0 else Decimal(0)
    tds_threshold = Decimal("50000") if senior_citizen else Decimal("40000")
    tds_note = None
    if annual_interest > tds_threshold:
        tds_note = (
            "Interest exceeding ₹40,000 per year (₹50,000 for senior citizens) may attract TDS; "
            "submit Form 15G/15H if applicable and confirm with your bank."
        )

    return {
        "maturity_amount": float(amount.quantize(TWO, rounding=ROUND_HALF_UP)),
        "total_interest": float(interest.quantize(TWO, rounding=ROUND_HALF_UP)),
        "effective_annual_yield": float(eff.quantize(TWO, rounding=ROUND_HALF_UP)),
        "tds_note": tds_note,
    }
