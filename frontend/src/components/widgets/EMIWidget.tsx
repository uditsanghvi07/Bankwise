"use client";

import { Calculator, Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { useCalculator } from "@/hooks/useCalculator";
import { formatINR, formatLargeINR, formatMonths, formatPercent } from "@/lib/formatters";
import {
  decimalStringFromNumber,
  intStringFromNumber,
  parseDecimalInput,
  parseDigitsInt,
  sanitizeDecimalString,
  sanitizeDigitString,
} from "@/lib/inputParsers";

type EmiResult = {
  emi_amount: number;
  total_payment: number;
  total_interest: number;
  interest_percentage: number;
  schedule: Array<Record<string, number>>;
  prepayment?: {
    amount: number;
    after_month: number;
    new_tenure_months: number;
    original_tenure_months: number;
    interest_saved: number;
  };
};

export function EMIWidget({ params }: { params: Record<string, unknown> }) {
  const { calculateEmi, loading } = useCalculator();
  const defaultMonths = Number(params.tenure_months ?? 240);
  const [principalStr, setPrincipalStr] = useState(() => intStringFromNumber(Number(params.principal ?? 5_000_000)));
  const [rateStr, setRateStr] = useState(() => decimalStringFromNumber(Number(params.annual_rate ?? 8.5)));
  const [useYears, setUseYears] = useState(true);
  const [tenureStr, setTenureStr] = useState(() =>
    intStringFromNumber(Math.max(1, Math.round(defaultMonths / 12))),
  );
  const [prepayAmtStr, setPrepayAmtStr] = useState(() =>
    params.prepayment_amount != null ? intStringFromNumber(Number(params.prepayment_amount)) : "",
  );
  const [prepayMonthStr, setPrepayMonthStr] = useState(() =>
    params.prepayment_after_month != null ? intStringFromNumber(Number(params.prepayment_after_month)) : "",
  );
  const [data, setData] = useState<EmiResult | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);

  const tenureMonths = useMemo(() => {
    const v = parseDigitsInt(tenureStr);
    return useYears ? v * 12 : v;
  }, [tenureStr, useYears]);

  const principalNum = parseDigitsInt(principalStr);
  const rateNum = parseDecimalInput(rateStr);
  const prepayAmtNum = parseDigitsInt(prepayAmtStr);
  const prepayMonthNum = parseDigitsInt(prepayMonthStr);
  const canCalc = principalNum > 0 && rateNum >= 1 && tenureMonths >= 1 && tenureMonths <= 360;
  const prepayComplete =
    prepayAmtStr !== "" && prepayMonthStr !== "" && prepayAmtNum > 0 && prepayMonthNum > 0 && prepayMonthNum <= tenureMonths;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!canCalc) {
        if (!cancelled) setData(null);
        return;
      }
      const body: Record<string, unknown> = {
        principal: principalNum,
        annual_rate: rateNum,
        tenure_months: tenureMonths,
      };
      if (prepayComplete) {
        body.prepayment_amount = prepayAmtNum;
        body.prepayment_after_month = prepayMonthNum;
      }
      const res = (await calculateEmi(body)) as EmiResult | null;
      if (!cancelled && res) setData(res);
    })();
    return () => {
      cancelled = true;
    };
  }, [calculateEmi, canCalc, prepayAmtNum, prepayComplete, prepayMonthNum, principalNum, rateNum, tenureMonths]);

  const pieData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Principal", value: principalNum },
      { name: "Total interest", value: Math.max(data.total_interest, 0) },
    ];
  }, [data, principalNum]);

  const copySummary = async () => {
    if (!data || !canCalc) return;
    const t = useYears ? `${parseDigitsInt(tenureStr) || 0} years` : `${tenureMonths} months`;
    const prep = data.prepayment
      ? ` | Prepay ${formatINR(data.prepayment.amount)} after month ${data.prepayment.after_month} → interest saved ~${formatINR(data.prepayment.interest_saved)}`
      : "";
    const text = `Home Loan ${formatLargeINR(principalNum)} at ${formatPercent(rateNum)} for ${t} → EMI: ${formatINR(data.emi_amount)} | Total Payment: ${formatINR(data.total_payment)} | Total Interest: ${formatINR(data.total_interest)}${prep}`;
    await navigator.clipboard.writeText(text);
  };

  const tenureLabel = useYears
    ? `${parseDigitsInt(tenureStr) || 0} years`
    : formatMonths(tenureMonths);

  const toggleUnits = () => {
    const m = parseDigitsInt(tenureStr);
    if (useYears) {
      setTenureStr(intStringFromNumber(Math.max(m, 1) * 12));
    } else {
      setTenureStr(intStringFromNumber(Math.max(1, Math.round(m / 12))));
    }
    setUseYears((y) => !y);
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-indigo-50/35 p-5 shadow-sm backdrop-blur-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-indigo/12 to-brand-violet/10 text-brand-indigo">
            <Calculator className="h-5 w-5" strokeWidth={2} />
          </span>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/70">EMI calculator</h3>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              void (async () => {
                if (!canCalc) return;
                const body: Record<string, unknown> = {
                  principal: principalNum,
                  annual_rate: rateNum,
                  tenure_months: tenureMonths,
                };
                if (prepayComplete) {
                  body.prepayment_amount = prepayAmtNum;
                  body.prepayment_after_month = prepayMonthNum;
                }
                const res = (await calculateEmi(body)) as EmiResult | null;
                if (res) setData(res);
              })();
            }}
            className="text-xs font-medium text-brand-indigo underline decoration-brand-indigo/35 underline-offset-2 hover:text-brand-violet"
          >
            Recalculate
          </button>
          <button
            type="button"
            onClick={() => void copySummary()}
            className="text-xs font-medium text-text-muted underline decoration-slate-300 underline-offset-2 hover:text-brand-indigo"
          >
            <span className="inline-flex items-center gap-1">
              <Copy className="h-3 w-3" /> Copy summary
            </span>
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="text-text-secondary">Loan amount</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-ink shadow-sm outline-none transition-colors numeric focus:border-brand-indigo/45 focus:ring-2 focus:ring-brand-indigo/15"
              value={principalStr}
              onChange={(e) => setPrincipalStr(sanitizeDigitString(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="text-text-secondary">Interest rate (% p.a.)</span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-ink shadow-sm outline-none transition-colors numeric focus:border-brand-indigo/45 focus:ring-2 focus:ring-brand-indigo/15"
              value={rateStr}
              onChange={(e) => setRateStr(sanitizeDecimalString(e.target.value))}
            />
          </label>
          <div className="flex items-center gap-2">
            <label className="flex flex-1 flex-col">
              <span className="text-text-secondary">{useYears ? "Tenure (years)" : "Tenure (months)"}</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-ink shadow-sm outline-none transition-colors numeric focus:border-brand-indigo/45 focus:ring-2 focus:ring-brand-indigo/15"
                value={tenureStr}
                onChange={(e) => setTenureStr(sanitizeDigitString(e.target.value))}
              />
            </label>
            <button
              type="button"
              className="mt-6 shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-text-secondary shadow-sm transition-colors hover:border-brand-indigo/35 hover:bg-indigo-50/50 hover:text-ink"
              onClick={toggleUnits}
            >
              Toggle units
            </button>
          </div>
          <div className="rounded-xl border border-dashed border-indigo-200/70 bg-indigo-50/25 p-3">
            <p className="mb-2 text-xs font-medium text-ink/70">What if I prepay? (optional)</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Amount ₹"
                autoComplete="off"
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-brand-indigo/45 focus:ring-1 focus:ring-brand-indigo/15"
                value={prepayAmtStr}
                onChange={(e) => setPrepayAmtStr(sanitizeDigitString(e.target.value))}
              />
              <input
                type="text"
                inputMode="numeric"
                placeholder="After month #"
                autoComplete="off"
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-brand-indigo/45 focus:ring-1 focus:ring-brand-indigo/15"
                value={prepayMonthStr}
                onChange={(e) => setPrepayMonthStr(sanitizeDigitString(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div>
          {!canCalc ? (
            <div className="text-sm text-text-muted">Enter loan amount, rate, and tenure to see EMI.</div>
          ) : loading || !data ? (
            <div className="text-sm text-text-muted">Calculating…</div>
          ) : (
            <div className="space-y-2">
              <div>
                <div className="text-xs font-medium text-text-muted">Monthly EMI</div>
                <div className="bg-gradient-to-r from-brand-indigo to-brand-violet bg-clip-text text-2xl font-semibold tracking-tight text-transparent numeric">
                  {formatINR(data.emi_amount)}
                </div>
                <div className="text-xs text-text-muted">{tenureLabel}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-text-muted">Total payable</div>
                  <div className="numeric font-medium text-ink">{formatINR(data.total_payment)}</div>
                </div>
                <div>
                  <div className="text-text-muted">Total interest</div>
                  <div className="numeric font-semibold text-brand-coral">{formatINR(data.total_interest)}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-text-muted">Interest as % of principal</div>
                  <div className="numeric font-medium">{formatPercent(data.interest_percentage, 2)}</div>
                </div>
              </div>
              {data.prepayment ? (
                <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-2.5 text-xs text-ink">
                  After prepayment: new tenure ~{data.prepayment.new_tenure_months} months, interest saved ~{" "}
                  {formatINR(data.prepayment.interest_saved)} vs original {data.prepayment.original_tenure_months}{" "}
                  months.
                </div>
              ) : null}
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie dataKey="value" data={pieData} innerRadius={50} outerRadius={70} paddingAngle={2}>
                      <Cell fill="#4f46e5" />
                      <Cell fill="#fb7185" />
                    </Pie>
                    <Tooltip formatter={(v: number) => formatINR(v)} />
                    <Legend wrapperStyle={{ fontSize: "12px", color: "#475569" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <button
                type="button"
                className="text-xs font-medium text-brand-indigo underline decoration-brand-indigo/35 underline-offset-2 hover:text-brand-violet"
                onClick={() => setShowSchedule((s) => !s)}
              >
                {showSchedule ? "Hide" : "View"} first 12 months of schedule
              </button>
              {showSchedule ? (
                <div className="max-h-48 overflow-auto rounded-xl border border-slate-200 text-xs shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-indigo-50/80 text-ink">
                      <tr>
                        <th className="p-1">M</th>
                        <th className="p-1">Principal</th>
                        <th className="p-1">Interest</th>
                        <th className="p-1">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.schedule.slice(0, 12).map((r) => (
                        <tr key={r.month} className="border-t border-border">
                          <td className="p-1">{r.month}</td>
                          <td className="numeric p-1">{formatINR(r.principal)}</td>
                          <td className="numeric p-1">{formatINR(r.interest)}</td>
                          <td className="numeric p-1">{formatINR(r.closing_balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
