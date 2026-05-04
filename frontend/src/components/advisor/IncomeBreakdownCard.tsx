"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HelpCircle, X } from "lucide-react";

function fmt(n: number) {
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(0)}K`;
  return `₹${Math.round(n)}`;
}

interface Slice {
  label: string;
  value: number;
  pct: number;
  color: string;
  bg: string;
  text: string;
}

export function IncomeBreakdownCard({
  monthlyIncome,
  monthlyEmi,
  monthlyExpenses,
  monthlySavings,
  foirPct,
}: {
  monthlyIncome: number;
  monthlyEmi: number;
  monthlyExpenses: number;
  monthlySavings: number;
  foirPct: number;
}) {
  const [open, setOpen] = useState(false);

  const remaining = Math.max(0, monthlyIncome - monthlyEmi - monthlyExpenses - monthlySavings);
  const total = monthlyIncome || 1;

  const slices: Slice[] = [
    {
      label: "EMIs",
      value: monthlyEmi,
      pct: (monthlyEmi / total) * 100,
      color: "#f43f5e",
      bg: "bg-rose-500",
      text: "text-rose-700",
    },
    {
      label: "Expenses",
      value: monthlyExpenses,
      pct: (monthlyExpenses / total) * 100,
      color: "#94a3b8",
      bg: "bg-slate-400",
      text: "text-slate-600",
    },
    {
      label: "Savings",
      value: monthlySavings,
      pct: (monthlySavings / total) * 100,
      color: "#22c55e",
      bg: "bg-emerald-500",
      text: "text-emerald-700",
    },
    {
      label: "Leftover",
      value: remaining,
      pct: (remaining / total) * 100,
      color: "#6366f1",
      bg: "bg-indigo-400",
      text: "text-indigo-700",
    },
  ].filter((s) => s.value > 0);

  const foirBand =
    foirPct >= 50
      ? { label: "High — risky", chip: "bg-rose-100 text-rose-700" }
      : foirPct >= 35
        ? { label: "Moderate — watch it", chip: "bg-amber-100 text-amber-700" }
        : { label: "Comfortable", chip: "bg-emerald-100 text-emerald-700" };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Where your income goes</p>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={`flex h-7 w-7 items-center justify-center rounded-full border transition ${
              open
                ? "border-brand-indigo/40 bg-brand-indigo/10 text-brand-indigo"
                : "border-slate-200 bg-white text-slate-400 hover:border-brand-indigo/30 hover:text-brand-indigo"
            }`}
            aria-label="What does this mean?"
          >
            {open ? <X className="h-3.5 w-3.5" /> : <HelpCircle className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Stacked bar */}
        <div className="mt-4 flex h-8 w-full overflow-hidden rounded-xl">
          {slices.map((s) => (
            <motion.div
              key={s.label}
              className={`${s.bg} flex items-center justify-center`}
              initial={{ width: 0 }}
              animate={{ width: `${s.pct}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              title={`${s.label}: ${fmt(s.value)} (${s.pct.toFixed(0)}%)`}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
          {slices.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-sm ${s.bg}`} />
              <span className="text-xs text-text-muted">{s.label}</span>
              <span className={`ml-auto text-xs font-semibold ${s.text}`}>{fmt(s.value)}</span>
            </div>
          ))}
        </div>

        {/* FOIR callout */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
          <div>
            <p className="text-[11px] text-text-muted">EMIs as % of income</p>
            <p className="mt-0.5 text-xl font-extrabold text-ink">{foirPct.toFixed(0)}%</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${foirBand.chip}`}>
            {foirBand.label}
          </span>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="explain"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-2 border-t border-indigo-100 bg-indigo-50/80 px-4 py-3">
              <p className="text-xs font-semibold text-indigo-800">What you're looking at</p>
              <p className="text-xs leading-relaxed text-indigo-900">
                Every rupee of your monthly income is split across four buckets.
                <strong> EMIs</strong> (loan instalments — banks call this FOIR),{" "}
                <strong>Expenses</strong> (rent, food, bills),{" "}
                <strong>Savings</strong> (what you actively put aside), and{" "}
                <strong>Leftover</strong> (unallocated cash).
              </p>
              <p className="text-xs leading-relaxed text-indigo-900">
                Banks get nervous when EMIs exceed <strong>50% of income</strong>. Below 35% is considered healthy for taking a new home or personal loan.
              </p>
              <p className="rounded-lg bg-white/80 px-3 py-2 text-xs text-text-muted">
                <span className="font-semibold text-ink">Example: </span>
                If you earn ₹80,000/mo and pay ₹5,000 in EMIs, that's 6% — very low. Banks would happily lend you more.
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
