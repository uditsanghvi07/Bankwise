"use client";

import { GitCompare } from "lucide-react";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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

type LoanRow = { label: string; principalStr: string; rateStr: string; tenureStr: string };
type LoanParsed = { label: string; principal: number; annual_rate: number; tenure_months: number };
type Opt = LoanParsed & { emi: number; total_payment: number; total_interest: number; interest_percentage: number };

function rowFromLoan(l: LoanParsed): LoanRow {
  return {
    label: l.label,
    principalStr: intStringFromNumber(l.principal),
    rateStr: decimalStringFromNumber(l.annual_rate),
    tenureStr: intStringFromNumber(l.tenure_months),
  };
}

export function LoanComparisonWidget({ params }: { params: Record<string, unknown> }) {
  const { calculateCompare } = useCalculator();
  const defaultLoans: LoanParsed[] = [
    { label: "Option A", principal: 5_000_000, annual_rate: 8.5, tenure_months: 240 },
    { label: "Option B", principal: 5_000_000, annual_rate: 9, tenure_months: 240 },
  ];
  const fromParams = params.loans as LoanParsed[] | undefined;
  const initialRows: LoanRow[] = (() => {
    const base = fromParams?.length ? fromParams.slice(0, 3) : defaultLoans;
    if (base.length === 1) {
      const a = base[0];
      return [
        rowFromLoan(a),
        rowFromLoan({ ...a, label: "Option B", annual_rate: Number(a.annual_rate) + 0.5 }),
      ];
    }
    return (base.length >= 2 ? base : defaultLoans).map(rowFromLoan);
  })();

  const [loans, setLoans] = useState<LoanRow[]>(initialRows);
  const [data, setData] = useState<{ options: Opt[]; lowest_total_interest_label: string } | null>(null);

  const parsedLoans: LoanParsed[] = loans.map((row) => ({
    label: row.label,
    principal: parseDigitsInt(row.principalStr),
    annual_rate: parseDecimalInput(row.rateStr),
    tenure_months: parseDigitsInt(row.tenureStr),
  }));

  const loansValid = parsedLoans.every(
    (l) => l.principal > 0 && l.annual_rate >= 1 && l.tenure_months >= 1 && l.tenure_months <= 360,
  );

  useEffect(() => {
    let c = false;
    (async () => {
      const parsed = loans.map((row) => ({
        label: row.label,
        principal: parseDigitsInt(row.principalStr),
        annual_rate: parseDecimalInput(row.rateStr),
        tenure_months: parseDigitsInt(row.tenureStr),
      }));
      const valid = parsed.every(
        (l) => l.principal > 0 && l.annual_rate >= 1 && l.tenure_months >= 1 && l.tenure_months <= 360,
      );
      if (!valid) {
        if (!c) setData(null);
        return;
      }
      const res = (await calculateCompare({ loans: parsed })) as typeof data;
      if (!c && res) setData(res);
    })();
    return () => {
      c = true;
    };
  }, [calculateCompare, loans]);

  const chartData =
    data?.options.map((o) => ({
      name: o.label,
      interest: o.total_interest,
    })) ?? [];

  const update = (i: number, field: keyof LoanRow, raw: string) => {
    setLoans((prev) => {
      const n = [...prev];
      const row = { ...n[i] };
      if (field === "label") row.label = raw;
      else if (field === "principalStr") row.principalStr = sanitizeDigitString(raw);
      else if (field === "rateStr") row.rateStr = sanitizeDecimalString(raw);
      else if (field === "tenureStr") row.tenureStr = sanitizeDigitString(raw);
      n[i] = row;
      return n;
    });
  };

  return (
    <div className="rounded-xl border border-border bg-surface/95 p-4 shadow-card backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GitCompare className="h-5 w-5 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Loan comparison</h3>
        </div>
        {loans.length < 3 ? (
          <button
            type="button"
            className="text-xs text-primary underline"
            onClick={() =>
              setLoans((p) => [
                ...p,
                {
                  label: `Option ${String.fromCharCode(65 + p.length)}`,
                  principalStr: intStringFromNumber(5_000_000),
                  rateStr: decimalStringFromNumber(8.75),
                  tenureStr: intStringFromNumber(240),
                },
              ])
            }
          >
            Add row
          </button>
        ) : null}
      </div>
      <div className="space-y-2">
        {loans.map((row, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-border p-2 text-xs md:grid-cols-4">
            <input className="rounded border border-border px-1" value={row.label} onChange={(e) => update(i, "label", e.target.value)} />
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="numeric rounded border border-border px-1"
              value={row.principalStr}
              onChange={(e) => update(i, "principalStr", e.target.value)}
            />
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className="numeric rounded border border-border px-1"
              value={row.rateStr}
              onChange={(e) => update(i, "rateStr", e.target.value)}
            />
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="numeric rounded border border-border px-1"
              value={row.tenureStr}
              onChange={(e) => update(i, "tenureStr", e.target.value)}
            />
          </div>
        ))}
      </div>
      {!loansValid ? (
        <div className="mt-2 text-sm text-text-muted">Enter principal, rate (≥1%), and tenure (1–360) for each option.</div>
      ) : data ? (
        <>
          <div className="mt-3 h-44 w-full max-w-md mx-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="40%" margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={10} />
                <YAxis fontSize={10} tickFormatter={(v) => `${(v / 1e5).toFixed(0)}L`} width={36} />
                <Tooltip formatter={(v: number) => formatINR(v)} />
                <Legend />
                <Bar dataKey="interest" fill="#b45309" name="Total interest" maxBarSize={28} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 max-h-48 overflow-auto text-xs">
            <table className="w-full text-left">
              <thead className="bg-primary-light/50">
                <tr>
                  <th className="p-1">Label</th>
                  <th className="p-1">EMI</th>
                  <th className="p-1">Total pay</th>
                  <th className="p-1">Interest</th>
                  <th className="p-1">Int %</th>
                </tr>
              </thead>
              <tbody>
                {data.options.map((o) => (
                  <tr key={o.label} className="border-t border-border">
                    <td className="p-1">
                      {o.label}
                      {o.label === data.lowest_total_interest_label ? (
                        <span className="ml-2 rounded bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">Best value</span>
                      ) : null}
                    </td>
                    <td className="numeric p-1">{formatINR(o.emi)}</td>
                    <td className="numeric p-1">{formatINR(o.total_payment)}</td>
                    <td className="numeric p-1">{formatINR(o.total_interest)}</td>
                    <td className="numeric p-1">{formatPercent(o.interest_percentage, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="mt-2 text-sm text-text-muted">Comparing…</div>
      )}
    </div>
  );
}
