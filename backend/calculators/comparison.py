"""Multi-loan comparison."""

from calculators.emi import amortization_schedule, compute_emi


def compare_loans(loans: list[dict]) -> dict:
    options: list[dict] = []
    for opt in loans:
        label = opt.get("label", "Loan")
        p = float(opt["principal"])
        r = float(opt["annual_rate"])
        n = int(opt["tenure_months"])
        emi_d = compute_emi(p, r, n)
        emi_f = float(emi_d)
        sch = amortization_schedule(p, r, n)
        options.append(
            {
                "label": label,
                "principal": p,
                "annual_rate": r,
                "tenure_months": n,
                "emi": emi_f,
                "total_payment": sch["total_payment"],
                "total_interest": sch["total_interest"],
                "interest_percentage": sch["interest_percentage"],
            }
        )

    lowest_emi = min(options, key=lambda x: x["emi"])
    lowest_interest = min(options, key=lambda x: x["total_interest"])
    lowest_payment = min(options, key=lambda x: x["total_payment"])

    return {
        "options": options,
        "lowest_emi_label": lowest_emi["label"],
        "lowest_total_interest_label": lowest_interest["label"],
        "lowest_total_payment_label": lowest_payment["label"],
    }
