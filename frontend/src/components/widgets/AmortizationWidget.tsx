"use client";

import { Layers } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

type Row = { month: number; opening_balance: number; emi: number; principal: number; interest: number; closing_balance: number };
type YearRow = { year: number; principal_paid: number; interest_paid: number; balance_remaining: number; percent_loan_paid: number };

export function AmortizationWidget({ params }: { params: Record<string, unknown> }) {
  const { calculateEmi } = useCalculator();
  const [principalStr, setPrincipalStr] = useState(() => intStringFromNumber(Number(params.principal ?? 5_000_000)));
  const [rateStr, setRateStr] = useState(() => decimalStringFromNumber(Number(params.annual_rate ?? 8.5)));
  const [tenureStr, setTenureStr] = useState(() => intStringFromNumber(Number(params.tenure_months ?? 240)));
  const [mode, setMode] = useState<"monthly" | "yearly">("yearly");
  const [page, setPage] = useState(0);
  const [schedule, setSchedule] = useState<Row[]>([]);
  const [yearSummary, setYearSummary] = useState<YearRow[]>([]);

  const principalNum = parseDigitsInt(principalStr);
  const rateNum = parseDecimalInput(rateStr);
  const tenureMonths = parseDigitsInt(tenureStr);
  const canCalc = principalNum > 0 && rateNum >= 1 && tenureMonths >= 1 && tenureMonths <= 360;

  useEffect(() => {
    let c = false;
    (async () => {
      if (!canCalc) {
        if (!c) {
          setSchedule([]);
          setYearSummary([]);
        }
        return;
      }
      const res = (await calculateEmi({
        principal: principalNum,
        annual_rate: rateNum,
        tenure_months: tenureMonths,
      })) as { schedule: Row[]; year_summary: YearRow[] } | null;
      if (!c && res) {
        setSchedule(res.schedule);
        setYearSummary(res.year_summary);
      }
    })();
    return () => {
      c = true;
    };
  }, [calculateEmi, canCalc, principalNum, rateNum, tenureMonths]);

  const chartData = useMemo(
    () => yearSummary.map((y) => ({ name: `Y${y.year}`, principal: y.principal_paid, interest: y.interest_paid })),
    [yearSummary],
  );

  const pageRows = schedule.slice(page * 12, page * 12 + 12);
  const maxPage = Math.max(0, Math.ceil(schedule.length / 12) - 1);

  return (
    <div className="rounded-xl border border-border bg-surface/95 p-4 shadow-card backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-2">
        <Layers className="h-5 w-5 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Amortization schedule</h3>
      </div>
      <div className="mb-3 grid gap-2 md:grid-cols-3">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Principal ₹"
          className="rounded-lg border border-border px-2 py-1 text-sm numeric"
          value={principalStr}
          onChange={(e) => setPrincipalStr(sanitizeDigitString(e.target.value))}
        />
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="Rate %"
          className="rounded-lg border border-border px-2 py-1 text-sm numeric"
          value={rateStr}
          onChange={(e) => setRateStr(sanitizeDecimalString(e.target.value))}
        />
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Months"
          className="rounded-lg border border-border px-2 py-1 text-sm numeric"
          value={tenureStr}
          onChange={(e) => setTenureStr(sanitizeDigitString(e.target.value))}
        />
      </div>
      {!canCalc ? (
        <div className="mb-3 text-sm text-text-muted">Enter principal, rate, and tenure to load the schedule.</div>
      ) : null}
      <div className="mb-3 h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" fontSize={10} />
            <YAxis fontSize={10} tickFormatter={(v) => `${(v / 1e5).toFixed(1)}L`} />
            <Tooltip formatter={(v: number) => formatINR(v)} />
            <Legend />
            <Bar dataKey="principal" stackId="a" fill="#028174" name="Principal" />
            <Bar dataKey="interest" stackId="a" fill="#b45309" name="Interest" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mb-2 flex gap-2 text-xs">
        <button
          type="button"
          className={`rounded-full px-3 py-1 ${mode === "yearly" ? "bg-primary text-white" : "border border-border"}`}
          onClick={() => setMode("yearly")}
        >
          Yearly summary
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1 ${mode === "monthly" ? "bg-primary text-white" : "border border-border"}`}
          onClick={() => setMode("monthly")}
        >
          Monthly view
        </button>
      </div>
      {mode === "yearly" ? (
        <div className="max-h-56 overflow-auto text-xs">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-primary-light/60">
              <tr>
                <th className="p-1">Year</th>
                <th className="p-1">Principal</th>
                <th className="p-1">Interest</th>
                <th className="p-1">Balance</th>
                <th className="p-1">% paid</th>
              </tr>
            </thead>
            <tbody>
              {yearSummary.map((y) => (
                <tr key={y.year} className="border-t border-border">
                  <td className="p-1">{y.year}</td>
                  <td className="numeric p-1">{formatINR(y.principal_paid)}</td>
                  <td className="numeric p-1">{formatINR(y.interest_paid)}</td>
                  <td className="numeric p-1">{formatINR(y.balance_remaining)}</td>
                  <td className="numeric p-1">{y.percent_loan_paid.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          <div className="mb-2 flex items-center justify-between text-xs">
            <button type="button" disabled={page <= 0} className="text-primary disabled:opacity-30" onClick={() => setPage((p) => p - 1)}>
              Prev year
            </button>
            <span>
              Months {page * 12 + 1}–{Math.min((page + 1) * 12, schedule.length)}
            </span>
            <button
              type="button"
              disabled={page >= maxPage}
              className="text-primary disabled:opacity-30"
              onClick={() => setPage((p) => p + 1)}
            >
              Next year
            </button>
          </div>
          <div className="max-h-56 overflow-auto text-xs">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-primary-light/60">
                <tr>
                  <th className="p-1">M</th>
                  <th className="p-1">Open</th>
                  <th className="p-1">EMI</th>
                  <th className="p-1">Prin</th>
                  <th className="p-1">Int</th>
                  <th className="p-1">Close</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.month} className="border-t border-border">
                    <td className="p-1">{r.month}</td>
                    <td className="numeric p-1">{formatINR(r.opening_balance)}</td>
                    <td className="numeric p-1">{formatINR(r.emi)}</td>
                    <td className="numeric p-1">{formatINR(r.principal)}</td>
                    <td className="numeric p-1">{formatINR(r.interest)}</td>
                    <td className="numeric p-1">{formatINR(r.closing_balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
