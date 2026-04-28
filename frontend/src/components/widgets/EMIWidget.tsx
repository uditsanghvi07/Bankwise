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
    <div className="rounded-xl border border-border bg-surface/95 p-4 shadow-card backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">EMI calculator</h3>
        </div>
        <div className="flex gap-2">
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
            className="text-xs text-primary underline"
          >
            Recalculate
          </button>
          <button type="button" onClick={() => void copySummary()} className="text-xs text-text-secondary underline">
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
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 numeric"
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
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 numeric"
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
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 numeric"
                value={tenureStr}
                onChange={(e) => setTenureStr(sanitizeDigitString(e.target.value))}
              />
            </label>
            <button type="button" className="mt-6 rounded-lg border border-border px-2 py-1 text-xs text-text-secondary" onClick={toggleUnits}>
              Toggle units
            </button>
          </div>
          <div className="rounded-lg border border-dashed border-border p-3">
            <p className="mb-2 text-xs font-medium text-text-secondary">What if I prepay? (optional)</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Amount ₹"
                autoComplete="off"
                className="rounded border border-border px-2 py-1 text-xs"
                value={prepayAmtStr}
                onChange={(e) => setPrepayAmtStr(sanitizeDigitString(e.target.value))}
              />
              <input
                type="text"
                inputMode="numeric"
                placeholder="After month #"
                autoComplete="off"
                className="rounded border border-border px-2 py-1 text-xs"
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
                <div className="text-xs text-text-secondary">Monthly EMI</div>
                <div className="text-2xl font-semibold text-primary numeric">{formatINR(data.emi_amount)}</div>
                <div className="text-xs text-text-muted">{tenureLabel}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-text-muted">Total payable</div>
                  <div className="numeric font-medium">{formatINR(data.total_payment)}</div>
                </div>
                <div>
                  <div className="text-text-muted">Total interest</div>
                  <div className="numeric font-medium text-warning">{formatINR(data.total_interest)}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-text-muted">Interest as % of principal</div>
                  <div className="numeric font-medium">{formatPercent(data.interest_percentage, 2)}</div>
                </div>
              </div>
              {data.prepayment ? (
                <div className="rounded-lg bg-primary-light/50 p-2 text-xs text-text-primary">
                  After prepayment: new tenure ~{data.prepayment.new_tenure_months} months, interest saved ~{" "}
                  {formatINR(data.prepayment.interest_saved)} vs original {data.prepayment.original_tenure_months}{" "}
                  months.
                </div>
              ) : null}
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie dataKey="value" data={pieData} innerRadius={50} outerRadius={70} paddingAngle={2}>
                      <Cell fill="#028174" />
                      <Cell fill="#b45309" />
                    </Pie>
                    <Tooltip formatter={(v: number) => formatINR(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <button type="button" className="text-xs text-primary underline" onClick={() => setShowSchedule((s) => !s)}>
                {showSchedule ? "Hide" : "View"} first 12 months of schedule
              </button>
              {showSchedule ? (
                <div className="max-h-48 overflow-auto rounded border border-border text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-primary-light/40">
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
