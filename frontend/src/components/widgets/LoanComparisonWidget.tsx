"use client";

import { Crown, GitCompare, HelpCircle, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { WidgetHelpModal } from "@/components/widgets/WidgetHelpModal";
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

const FIELD_LABEL = "block text-[10px] font-semibold uppercase tracking-wide text-text-muted";
const FIELD_INPUT =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-ink shadow-sm outline-none transition focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/15 numeric";

const ROW_PALETTE = ["#6366f1", "#10b981", "#f59e0b"]; // up to 3 options

function fmtINRShort(n: number) {
  if (!Number.isFinite(n)) return "-";
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(0)}K`;
  return `₹${Math.round(n)}`;
}

type LoanRow = { label: string; principalStr: string; rateStr: string; tenureStr: string };
type LoanParsed = { label: string; principal: number; annual_rate: number; tenure_months: number };
type Opt = LoanParsed & {
  emi: number;
  total_payment: number;
  total_interest: number;
  interest_percentage: number;
};

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
      return [rowFromLoan(a), rowFromLoan({ ...a, label: "Option B", annual_rate: Number(a.annual_rate) + 0.5 })];
    }
    return (base.length >= 2 ? base : defaultLoans).map(rowFromLoan);
  })();

  const [loans, setLoans] = useState<LoanRow[]>(initialRows);
  const [helpOpen, setHelpOpen] = useState(false);
  const [data, setData] = useState<{ options: Opt[]; lowest_total_interest_label: string } | null>(null);

  const parsedLoans: LoanParsed[] = useMemo(
    () =>
      loans.map((row) => ({
        label: row.label,
        principal: parseDigitsInt(row.principalStr),
        annual_rate: parseDecimalInput(row.rateStr),
        tenure_months: parseDigitsInt(row.tenureStr),
      })),
    [loans],
  );

  const loansValid = parsedLoans.every(
    (l) => l.principal > 0 && l.annual_rate >= 1 && l.tenure_months >= 1 && l.tenure_months <= 360,
  );

  useEffect(() => {
    let c = false;
    (async () => {
      if (!loansValid) {
        if (!c) setData(null);
        return;
      }
      const res = (await calculateCompare({ loans: parsedLoans })) as typeof data;
      if (!c && res) setData(res);
    })();
    return () => {
      c = true;
    };
  }, [calculateCompare, loansValid, parsedLoans]);

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

  const removeRow = (i: number) => setLoans((p) => (p.length > 2 ? p.filter((_, idx) => idx !== i) : p));
  const addRow = () =>
    setLoans((p) =>
      p.length < 3
        ? [
            ...p,
            {
              label: `Option ${String.fromCharCode(65 + p.length)}`,
              principalStr: intStringFromNumber(5_000_000),
              rateStr: decimalStringFromNumber(8.75),
              tenureStr: intStringFromNumber(240),
            },
          ]
        : p,
    );

  const chartData = data?.options.map((o, i) => ({
    name: o.label,
    interest: o.total_interest,
    color: ROW_PALETTE[i % ROW_PALETTE.length],
    isBest: o.label === data.lowest_total_interest_label,
  })) ?? [];

  const maxInterest = data?.options.reduce((m, o) => Math.max(m, o.total_interest), 0) ?? 1;
  const minInterest = data?.options.reduce((m, o) => Math.min(m, o.total_interest), Infinity) ?? 0;
  const savings = data ? maxInterest - minInterest : 0;

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-indigo to-brand-violet text-white shadow-sm">
              <GitCompare className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-ink">Loan comparison</h3>
              <p className="text-[11px] text-text-muted">Side-by-side EMI &amp; total interest across up to 3 loan options.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loans.length < 3 ? (
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
              >
                <Plus className="h-3.5 w-3.5" />
                Add option
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-brand-indigo transition hover:border-brand-indigo/40 hover:bg-indigo-50"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              How does this work?
            </button>
          </div>
        </div>

        {/* Loan rows */}
        <div className="mt-4 space-y-2">
          {loans.map((row, i) => {
            const rowColor = ROW_PALETTE[i % ROW_PALETTE.length];
            return (
              <div
                key={i}
                className="rounded-xl border border-slate-200 bg-slate-50/40 p-3"
                style={{ borderLeft: `4px solid ${rowColor}` }}
              >
                <div className="grid gap-2 sm:grid-cols-[120px_1fr_1fr_1fr_auto]">
                  <label className="block">
                    <span className={FIELD_LABEL}>Label</span>
                    <input
                      className={`${FIELD_INPUT} font-semibold`}
                      value={row.label}
                      onChange={(e) => update(i, "label", e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className={FIELD_LABEL}>Principal (₹)</span>
                    <input
                      type="text" inputMode="numeric" autoComplete="off"
                      className={FIELD_INPUT}
                      value={row.principalStr}
                      onChange={(e) => update(i, "principalStr", e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className={FIELD_LABEL}>Rate %</span>
                    <input
                      type="text" inputMode="decimal" autoComplete="off"
                      className={FIELD_INPUT}
                      value={row.rateStr}
                      onChange={(e) => update(i, "rateStr", e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className={FIELD_LABEL}>Tenure (months)</span>
                    <input
                      type="text" inputMode="numeric" autoComplete="off"
                      className={FIELD_INPUT}
                      value={row.tenureStr}
                      onChange={(e) => update(i, "tenureStr", e.target.value)}
                    />
                  </label>
                  {loans.length > 2 ? (
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="self-end rounded-lg border border-rose-200 p-1.5 text-rose-700 transition hover:bg-rose-50"
                      aria-label={`Remove ${row.label}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : <span />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Results */}
        {!loansValid ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-text-muted">
            Enter principal, rate (≥1%), and tenure (1–360 months) for each option.
          </div>
        ) : !data ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-text-muted">
            Comparing…
          </div>
        ) : (
          <>
            {/* Best-value banner */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Crown className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Best value</p>
                  <p className="text-sm font-bold text-ink">
                    {data.lowest_total_interest_label} pays the lowest total interest
                  </p>
                </div>
              </div>
              {savings > 0 ? (
                <div className="text-right">
                  <p className="text-[11px] text-text-muted">You'd save vs the costliest option</p>
                  <p className="text-xl font-extrabold text-emerald-700 numeric">{fmtINRShort(savings)}</p>
                </div>
              ) : null}
            </div>

            {/* KPI cards per option */}
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.options.map((o, i) => {
                const color = ROW_PALETTE[i % ROW_PALETTE.length];
                const isBest = o.label === data.lowest_total_interest_label;
                return (
                  <div
                    key={o.label}
                    className={`rounded-xl border bg-white p-4 shadow-sm ${
                      isBest ? "ring-2 ring-emerald-300 ring-offset-1" : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white"
                        style={{ background: color }}
                      >
                        {o.label}
                      </span>
                      {isBest ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          BEST
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-[11px] text-text-muted">Monthly EMI</p>
                    <p className="text-2xl font-extrabold text-ink numeric">
                      {fmtINRShort(o.emi)}
                      <span className="ml-1 text-xs font-semibold text-text-muted">/mo</span>
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <p className="text-text-muted">Total interest</p>
                        <p className="font-bold text-amber-700 numeric">{fmtINRShort(o.total_interest)}</p>
                      </div>
                      <div>
                        <p className="text-text-muted">Total payment</p>
                        <p className="font-bold text-ink numeric">{fmtINRShort(o.total_payment)}</p>
                      </div>
                    </div>
                    {/* Interest as % of principal */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] text-text-muted">
                        <span>Interest / principal</span>
                        <span className="font-semibold text-ink">{formatPercent(o.interest_percentage, 1)}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, (o.total_interest / maxInterest) * 100)}%`,
                            background: color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bar chart */}
            <div className="mt-4 rounded-xl border border-slate-200 p-3">
              <p className="px-1 text-[11px] font-semibold text-text-muted">
                Total interest paid across the full tenure (lower = cheaper)
              </p>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis fontSize={10} tickFormatter={(v) => fmtINRShort(Number(v))} tickLine={false} axisLine={false} width={56} />
                    <Tooltip
                      contentStyle={{ borderRadius: 10, fontSize: 11, borderColor: "#e2e8f0" }}
                      formatter={(v: number) => [formatINR(v), "Total interest"]}
                    />
                    <Bar dataKey="interest" radius={[8, 8, 0, 0]} maxBarSize={48}>
                      {chartData.map((d) => (
                        <Cell key={d.name} fill={d.isBest ? "#10b981" : d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>

      <WidgetHelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        Icon={GitCompare}
        title="How to compare loan offers fairly"
        subtitle="The same principal at slightly different rates can cost lakhs more — here's why."
        steps={[
          {
            index: 1,
            title: "Don't compare just EMI",
            tone: "indigo",
            body: (
              <>
                A longer tenure makes EMI look smaller, but you pay more total interest. Always compare both
                <strong> EMI</strong> AND <strong>total interest</strong> over the full tenure.
              </>
            ),
          },
          {
            index: 2,
            title: "Total interest is the real cost",
            tone: "emerald",
            body: (
              <>
                Total interest = <strong>EMI × tenure − principal</strong>. The bar chart and best-value badge use
                this single number to flag the cheapest offer. A 0.5% rate gap on a ₹50L home loan = ₹3-5 lakhs
                difference over 20 years.
              </>
            ),
          },
          {
            index: 3,
            title: "Check beyond the headline rate",
            tone: "amber",
            body: (
              <>
                Banks add <strong>processing fees</strong> (0.25–1% of loan), <strong>insurance</strong> bundling,
                and prepayment penalties on fixed-rate loans. A 'cheap' rate can hide expensive fees — always ask
                for the all-in <strong>APR</strong>.
              </>
            ),
          },
        ]}
        formula={
          <>
            EMI = P × r × (1+r)<sup>n</sup> / ((1+r)<sup>n</sup> − 1)
            <br />
            <span className="text-slate-400">P = principal, r = monthly rate (annual / 12), n = tenure in months</span>
            <br />
            Total interest = EMI × n − P
          </>
        }
        example={{
          title: "₹50L home loan, 20-year tenure",
          lines: [
            <><strong>Option A</strong> @ <strong>8.5%</strong> → EMI ≈ <strong>₹43,391</strong>; total interest ≈ <strong className="text-emerald-700">₹54.1 L</strong></>,
            <><strong>Option B</strong> @ <strong>9.0%</strong> → EMI ≈ <strong>₹44,986</strong>; total interest ≈ <strong className="text-amber-700">₹57.9 L</strong></>,
            <>Difference: <strong className="text-rose-700">₹3.8 L</strong> over 20 years on the same loan amount, just 0.5% rate gap.</>,
          ],
        }}
        tips={[
          <><strong>Negotiate the rate</strong> — banks have flex up to 0.25–0.5% for salaried borrowers with 750+ CIBIL.</>,
          <><strong>Watch the spread</strong> — for floating-rate (RLLR) loans, the spread above repo rate is what banks compete on.</>,
          <><strong>Prepayment</strong> on home loans is free for floating rates; saves the most interest in the early years.</>,
          <><strong>Step-up vs flat EMI</strong> — step-up loans look cheap upfront but cost more total interest if your income doesn't actually rise as planned.</>,
        ]}
        footnote="Educational only. Always read the schedule of charges and Most Important Terms (MITC) before signing."
      />
    </>
  );
}
