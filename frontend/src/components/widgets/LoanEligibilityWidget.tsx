"use client";

import { BadgeIndianRupee, HelpCircle, ShieldAlert, ShieldCheck, ShieldQuestion, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EligibilityHelpModal } from "@/components/widgets/EligibilityHelpModal";
import { useCalculator } from "@/hooks/useCalculator";
import { formatINR } from "@/lib/formatters";
import {
  decimalStringFromNumber,
  intStringFromNumber,
  parseDecimalInput,
  parseDigitsInt,
  sanitizeDecimalString,
  sanitizeDigitString,
} from "@/lib/inputParsers";

const FIELD_LABEL = "block text-[11px] font-semibold uppercase tracking-wide text-text-muted";
const FIELD_INPUT =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink shadow-sm outline-none transition focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/15 numeric";

function fmtINRShort(n: number) {
  if (!Number.isFinite(n)) return "-";
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(0)}K`;
  return `₹${Math.round(n)}`;
}

function affordabilityFromFoir(foirPct: number): {
  label: string;
  tone: "good" | "ok" | "warn" | "bad";
  Icon: typeof ShieldCheck;
  message: string;
} {
  if (foirPct < 35) {
    return {
      label: "Excellent headroom",
      tone: "good",
      Icon: ShieldCheck,
      message: "Plenty of room — you could even take a slightly larger loan if you really need to.",
    };
  }
  if (foirPct < 45) {
    return {
      label: "Healthy",
      tone: "ok",
      Icon: ShieldCheck,
      message: "Comfortable balance — most banks will sanction this without much fuss.",
    };
  }
  if (foirPct < 55) {
    return {
      label: "Stretched",
      tone: "warn",
      Icon: ShieldQuestion,
      message: "You're near the cap. Banks may approve but rates can be steeper. Keep some buffer.",
    };
  }
  return {
    label: "Too risky",
    tone: "bad",
    Icon: ShieldAlert,
    message: "Beyond healthy limits — close another EMI first or ask a co-applicant to join.",
  };
}

const TONE_STYLE = {
  good: { chip: "bg-emerald-100 text-emerald-800 border-emerald-200", value: "text-emerald-700" },
  ok:   { chip: "bg-indigo-100 text-indigo-800 border-indigo-200",     value: "text-brand-indigo" },
  warn: { chip: "bg-amber-100 text-amber-800 border-amber-200",        value: "text-amber-700" },
  bad:  { chip: "bg-rose-100 text-rose-800 border-rose-200",           value: "text-rose-700" },
} as const;

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
  const [helpOpen, setHelpOpen] = useState(false);

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

  const eligibleAmount = Number(data?.eligible_amount ?? 0);
  const maxEmi = Number(data?.max_emi ?? 0);
  const foirCap = Number(data?.foir_cap_pct ?? data?.foir_cap ?? (loanType === "personal" ? 40 : loanType === "home" ? 50 : 45));
  const requiredIncome = data?.monthly_income_required_for_requested_amount;

  /** Income breakdown — every rupee of income split into 3 buckets, in % of income. */
  const breakdown = useMemo(() => {
    if (incomeNum <= 0) return null;
    const existingPct = Math.min(100, (existingNum / incomeNum) * 100);
    const newEmiPct = Math.min(100 - existingPct, (maxEmi / incomeNum) * 100);
    const freePct = Math.max(0, 100 - existingPct - newEmiPct);
    return { existingPct, newEmiPct, freePct };
  }, [incomeNum, existingNum, maxEmi]);

  const totalFoirAfter = breakdown ? breakdown.existingPct + breakdown.newEmiPct : 0;
  const verdict = affordabilityFromFoir(totalFoirAfter);
  const VerdictIcon = verdict.Icon;
  const tone = TONE_STYLE[verdict.tone];

  const requestedRatio =
    requestedNum > 0 && eligibleAmount > 0 ? Math.min(150, (requestedNum / eligibleAmount) * 100) : 0;

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-indigo to-brand-violet text-white shadow-sm">
              <BadgeIndianRupee className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-ink">Loan eligibility</h3>
              <p className="text-[11px] text-text-muted">Educational estimate — banks add their own underwriting.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-brand-indigo transition hover:border-brand-indigo/40 hover:bg-indigo-50"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            How does this work?
          </button>
        </div>

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
          {/* Inputs */}
          <div className="space-y-2.5">
            <label className="block">
              <span className={FIELD_LABEL}>Monthly income (₹)</span>
              <input
                type="text" inputMode="numeric" autoComplete="off"
                className={FIELD_INPUT}
                value={incomeStr}
                onChange={(e) => setIncomeStr(sanitizeDigitString(e.target.value))}
              />
            </label>
            <label className="block">
              <span className={FIELD_LABEL}>Existing EMIs (₹)</span>
              <input
                type="text" inputMode="numeric" autoComplete="off"
                className={FIELD_INPUT}
                value={existingStr}
                onChange={(e) => setExistingStr(sanitizeDigitString(e.target.value))}
              />
            </label>
            <label className="block">
              <span className={FIELD_LABEL}>Loan type</span>
              <select
                className={`${FIELD_INPUT} cursor-pointer pr-7`}
                value={loanType}
                onChange={(e) => setLoanType(e.target.value)}
              >
                <option value="home">Home</option>
                <option value="personal">Personal</option>
                <option value="car">Car</option>
                <option value="business">Business</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className={FIELD_LABEL}>Rate %</span>
                <input
                  type="text" inputMode="decimal" autoComplete="off"
                  className={FIELD_INPUT}
                  value={rateStr}
                  onChange={(e) => setRateStr(sanitizeDecimalString(e.target.value))}
                />
              </label>
              <label className="block">
                <span className={FIELD_LABEL}>Tenure (mo)</span>
                <input
                  type="text" inputMode="numeric" autoComplete="off"
                  className={FIELD_INPUT}
                  value={tenureStr}
                  onChange={(e) => setTenureStr(sanitizeDigitString(e.target.value))}
                />
              </label>
            </div>
            <label className="block">
              <span className={FIELD_LABEL}>Want a specific amount? (optional)</span>
              <input
                type="text" inputMode="numeric" autoComplete="off"
                className={FIELD_INPUT}
                placeholder="e.g. 2500000"
                value={requestedStr}
                onChange={(e) => setRequestedStr(sanitizeDigitString(e.target.value))}
              />
            </label>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {!canCalc ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-text-muted">
                Enter income, rate (≥1%), and tenure (1–360 months) to see your eligibility.
              </div>
            ) : !data ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-text-muted">
                Estimating…
              </div>
            ) : (
              <>
                {/* KPI cards */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      <Target className="h-3.5 w-3.5" />
                      Max loan you qualify for
                    </div>
                    <p className="mt-2 text-2xl font-extrabold tracking-tight text-emerald-700 numeric">
                      {fmtINRShort(eligibleAmount)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-emerald-800/80 numeric">
                      {formatINR(eligibleAmount)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-indigo">
                      <BadgeIndianRupee className="h-3.5 w-3.5" />
                      Max new EMI possible
                    </div>
                    <p className="mt-2 text-2xl font-extrabold tracking-tight text-brand-indigo numeric">
                      {formatINR(maxEmi)}
                      <span className="ml-1 text-xs font-semibold text-text-muted">/mo</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-indigo-800/80">
                      Cap: <strong>{foirCap.toFixed(0)}% FOIR</strong> for {loanType} loans
                    </p>
                  </div>
                </div>

                {/* Verdict chip */}
                <div className={`flex items-start gap-3 rounded-xl border p-3 ${tone.chip}`}>
                  <VerdictIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{verdict.label} — {totalFoirAfter.toFixed(0)}% of income on EMIs</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed">{verdict.message}</p>
                  </div>
                </div>

                {/* Income breakdown bar */}
                {breakdown ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-text-muted">
                        Where your ₹{Math.round(incomeNum / 1000)}K income goes after this loan
                      </p>
                      <span className="text-[11px] text-text-muted">100% = your monthly income</span>
                    </div>

                    <div className="mt-3 flex h-7 w-full overflow-hidden rounded-full bg-slate-200">
                      {breakdown.existingPct > 0 ? (
                        <div
                          className="flex items-center justify-center bg-rose-500 transition-all duration-500"
                          style={{ width: `${breakdown.existingPct}%` }}
                          title={`Existing EMIs · ${breakdown.existingPct.toFixed(0)}%`}
                        >
                          {breakdown.existingPct >= 8 ? (
                            <span className="px-1 text-[10px] font-bold text-white">
                              {breakdown.existingPct.toFixed(0)}%
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      {breakdown.newEmiPct > 0 ? (
                        <div
                          className="flex items-center justify-center bg-gradient-to-r from-brand-indigo to-brand-violet transition-all duration-500"
                          style={{ width: `${breakdown.newEmiPct}%` }}
                          title={`Headroom for new EMI · ${breakdown.newEmiPct.toFixed(0)}%`}
                        >
                          {breakdown.newEmiPct >= 8 ? (
                            <span className="px-1 text-[10px] font-bold text-white">
                              {breakdown.newEmiPct.toFixed(0)}%
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      {breakdown.freePct > 0 ? (
                        <div
                          className="flex items-center justify-center bg-emerald-400 transition-all duration-500"
                          style={{ width: `${breakdown.freePct}%` }}
                          title={`Free for expenses & savings · ${breakdown.freePct.toFixed(0)}%`}
                        >
                          {breakdown.freePct >= 8 ? (
                            <span className="px-1 text-[10px] font-bold text-white">
                              {breakdown.freePct.toFixed(0)}%
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                      <Legend
                        color="bg-rose-500"
                        label="Existing EMIs"
                        sub={`${formatINR(existingNum)} (${breakdown.existingPct.toFixed(0)}%)`}
                      />
                      <Legend
                        color="bg-gradient-to-r from-brand-indigo to-brand-violet"
                        label="New EMI headroom"
                        sub={`${formatINR(maxEmi)} (${breakdown.newEmiPct.toFixed(0)}%)`}
                      />
                      <Legend
                        color="bg-emerald-400"
                        label="Free for life"
                        sub={`${formatINR(incomeNum - existingNum - maxEmi)} (${breakdown.freePct.toFixed(0)}%)`}
                      />
                    </div>

                    <p className="mt-3 text-[11px] leading-relaxed text-text-secondary">
                      Banks cap EMIs at <strong>{foirCap.toFixed(0)}%</strong> of income for {loanType} loans
                      (this is called <strong>FOIR</strong>). The indigo bar shows the largest new EMI that fits
                      under that cap, given your {existingNum > 0 ? "existing EMIs" : "zero existing EMIs"}.
                    </p>
                  </div>
                ) : null}

                {/* Requested-vs-eligible comparison */}
                {requestedNum > 0 && eligibleAmount > 0 ? (
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-text-muted">
                        Your requested amount vs eligibility
                      </p>
                      <span
                        className={`text-xs font-bold ${
                          requestedRatio <= 100 ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {requestedRatio.toFixed(0)}% of eligible
                      </span>
                    </div>
                    <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          requestedRatio <= 90
                            ? "bg-emerald-500"
                            : requestedRatio <= 110
                              ? "bg-amber-500"
                              : "bg-rose-500"
                        }`}
                        style={{ width: `${Math.min(100, requestedRatio)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[11.5px] leading-relaxed text-text-secondary">
                      You asked for <strong>{formatINR(requestedNum)}</strong>; banks can lend you{" "}
                      <strong>{formatINR(eligibleAmount)}</strong>.{" "}
                      {requestedRatio <= 100 ? (
                        <span className="text-emerald-700">Comfortably within reach.</span>
                      ) : (
                        <>
                          <span className="text-rose-700">Short by {formatINR(requestedNum - eligibleAmount)}.</span>
                          {requiredIncome != null ? (
                            <>
                              {" "}You'd need an income of at least{" "}
                              <strong className="numeric">{formatINR(Number(requiredIncome))}/mo</strong> for the full amount.
                            </>
                          ) : null}
                        </>
                      )}
                    </p>
                  </div>
                ) : null}

                {data?.cibil_note ? (
                  <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-text-secondary">
                    <strong className="text-ink">Note:</strong> {String(data.cibil_note)}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      <EligibilityHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}

function Legend({ color, label, sub }: { color: string; label: string; sub: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className={`mt-0.5 h-3 w-3 shrink-0 rounded-sm ${color}`} />
      <div className="min-w-0">
        <p className="font-semibold text-ink">{label}</p>
        <p className="text-text-muted numeric">{sub}</p>
      </div>
    </div>
  );
}
