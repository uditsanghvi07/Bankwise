"use client";

import { BadgeIndianRupee } from "lucide-react";
import { useEffect, useState } from "react";

import { useCalculator } from "@/hooks/useCalculator";
import { formatINR, formatPercent } from "@/lib/formatters";
import {
  decimalStringFromNumber,
  intStringFromNumber,
  parseDecimalInput,
  parseDigitsInt,
  sanitizeDecimalString,
  sanitizeDigitString,
} from "@/lib/inputParsers";

export function LoanEligibilityWidget({ params }: { params: Record<string, unknown> }) {
  const { calculateEligibility } = useCalculator();
  const [incomeStr, setIncomeStr] = useState(() => intStringFromNumber(Number(params.monthly_income ?? 80_000)));
  const [existingStr, setExistingStr] = useState(() =>
    intStringFromNumber(Number(params.existing_emi_obligations ?? params.monthly_obligations ?? 0)),
  );
  const [loanType, setLoanType] = useState(String(params.loan_type ?? "home"));
  const [rateStr, setRateStr] = useState(() => decimalStringFromNumber(Number(params.annual_rate ?? 8.5)));
  const [tenureStr, setTenureStr] = useState(() =>
    intStringFromNumber(Number(params.requested_tenure_months ?? params.tenure_months ?? 240)),
  );
  const [requestedStr, setRequestedStr] = useState(() =>
    params.requested_principal != null ? intStringFromNumber(Number(params.requested_principal)) : "",
  );
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const incomeNum = parseDigitsInt(incomeStr);
  const existingNum = parseDigitsInt(existingStr);
  const rateNum = parseDecimalInput(rateStr);
  const tenureNum = parseDigitsInt(tenureStr);
  const requestedNum = parseDigitsInt(requestedStr);
  const canCalc = incomeNum > 0 && rateNum >= 1 && tenureNum >= 1 && tenureNum <= 360;

  useEffect(() => {
    let c = false;
    (async () => {
      if (!canCalc) {
        if (!c) setData(null);
        return;
      }
      const body: Record<string, unknown> = {
        monthly_income: incomeNum,
        existing_emi_obligations: existingNum,
        loan_type: loanType,
        annual_rate: rateNum,
        requested_tenure_months: tenureNum,
      };
      if (requestedStr !== "" && requestedNum > 0) body.requested_principal = requestedNum;
      const res = (await calculateEligibility(body)) as Record<string, unknown> | null;
      if (!c && res) setData(res);
    })();
    return () => {
      c = true;
    };
  }, [calculateEligibility, canCalc, existingNum, incomeNum, loanType, rateNum, requestedNum, requestedStr, tenureNum]);

  const foir = typeof data?.foir_used === "number" ? data.foir_used : 0;
  const obligationRatio = incomeNum > 0 ? Math.min(100, ((existingNum + Number(data?.max_emi ?? 0)) / incomeNum) * 100) : 0;
  const gaugeColor =
    obligationRatio < 40 ? "bg-accent" : obligationRatio < 55 ? "bg-warning" : "bg-danger";

  return (
    <div className="rounded-xl border border-border bg-surface/95 p-4 shadow-card backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-2">
        <BadgeIndianRupee className="h-5 w-5 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Loan eligibility</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2 text-sm">
          <label className="block">
            <span className="text-text-secondary">Monthly income</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-border px-2 py-1 numeric"
              value={incomeStr}
              onChange={(e) => setIncomeStr(sanitizeDigitString(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="text-text-secondary">Existing EMIs</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-border px-2 py-1 numeric"
              value={existingStr}
              onChange={(e) => setExistingStr(sanitizeDigitString(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="text-text-secondary">Loan type</span>
            <select className="mt-1 w-full rounded-lg border border-border px-2 py-1" value={loanType} onChange={(e) => setLoanType(e.target.value)}>
              <option value="home">Home</option>
              <option value="personal">Personal</option>
              <option value="car">Car</option>
              <option value="business">Business</option>
            </select>
          </label>
          <label className="block">
            <span className="text-text-secondary">Rate %</span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-border px-2 py-1 numeric"
              value={rateStr}
              onChange={(e) => setRateStr(sanitizeDecimalString(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="text-text-secondary">Tenure (months)</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-border px-2 py-1 numeric"
              value={tenureStr}
              onChange={(e) => setTenureStr(sanitizeDigitString(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="text-text-secondary">Requested loan (optional)</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-border px-2 py-1 numeric"
              value={requestedStr}
              onChange={(e) => setRequestedStr(sanitizeDigitString(e.target.value))}
            />
          </label>
        </div>
        <div className="space-y-3">
          {!canCalc ? (
            <div className="text-sm text-text-muted">Enter income, rate (≥1%), and tenure (1–360 months).</div>
          ) : data ? (
            <>
              <div>
                <div className="text-xs text-text-secondary">Max eligible loan</div>
                <div className="text-2xl font-semibold text-primary numeric">{formatINR(Number(data.eligible_amount ?? 0))}</div>
              </div>
              <div>
                <div className="text-xs text-text-secondary">Max eligible EMI</div>
                <div className="numeric text-lg font-medium">{formatINR(Number(data.max_emi ?? 0))}</div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-text-secondary">
                  <span>FOIR used (norm)</span>
                  <span>{formatPercent(foir, 0)}</span>
                </div>
                <div className="h-3 w-full rounded-full bg-border">
                  <div className={`h-3 rounded-full ${gaugeColor}`} style={{ width: `${Math.min(100, obligationRatio)}%` }} />
                </div>
                <p className="mt-1 text-xs text-text-muted">Illustrative obligations / income after max new EMI.</p>
              </div>
              {data.monthly_income_required_for_requested_amount != null ? (
                <p className="text-sm text-text-primary">
                  To get {formatINR(requestedNum)}, you typically need monthly income of at least{" "}
                  <span className="font-semibold numeric">{formatINR(Number(data.monthly_income_required_for_requested_amount))}</span>{" "}
                  under these assumptions.
                </p>
              ) : null}
              <p className="text-xs text-text-secondary">{String(data.cibil_note ?? "")}</p>
            </>
          ) : (
            <div className="text-sm text-text-muted">Estimating…</div>
          )}
        </div>
      </div>
    </div>
  );
}
