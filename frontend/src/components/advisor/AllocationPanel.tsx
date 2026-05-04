"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChevronDown, ChevronUp } from "lucide-react";

import type { AdvisorRecommendation } from "@/lib/api";

const PALETTE = ["#6366f1", "#22c55e", "#f59e0b", "#f43f5e", "#06b6d4", "#8b5cf6"];
const RANK_LABELS = ["1st priority", "2nd priority", "3rd priority", "4th priority", "5th priority"];
const RANK_BG = [
  "bg-indigo-100 text-indigo-800 border-indigo-200",
  "bg-emerald-100 text-emerald-800 border-emerald-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-rose-100 text-rose-800 border-rose-200",
  "bg-cyan-100 text-cyan-800 border-cyan-200",
];

function fmt(n: number) {
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(0)}K`;
  return `₹${Math.round(n)}`;
}

function savingsAmount(pct: number, monthlySavings: number) {
  return (pct / 100) * monthlySavings;
}

export function AllocationPanel({
  recommendations,
  monthlySavings,
}: {
  recommendations: AdvisorRecommendation[];
  monthlySavings: number;
}) {
  const [expanded, setExpanded] = useState<number | null>(0);

  const sorted = [...recommendations].sort((a, b) => b.weight_pct - a.weight_pct);

  const pieData = sorted.map((r, i) => ({
    name: r.title,
    value: r.weight_pct,
    color: PALETTE[i % PALETTE.length],
  }));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-ink">What to focus on first</h3>
          <p className="mt-0.5 text-[11px] text-text-muted">
            Based on your profile — educational defaults, not certified advice.
          </p>
        </div>
        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-indigo">
          {sorted.length} actions
        </span>
      </div>

      {/* Donut + legend side by side */}
      <div className="mt-4 flex items-center gap-4">
        <div className="h-36 w-36 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                innerRadius={38}
                outerRadius={62}
                paddingAngle={3}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
                strokeWidth={0}
              >
                {pieData.map((d, i) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 10, fontSize: 11, borderColor: "#e2e8f0" }}
                formatter={(v: number) => [`${v.toFixed(0)}% of savings`, "Suggested share"]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col gap-1.5 text-xs">
          {sorted.map((r, i) => (
            <div key={r.title} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ background: PALETTE[i % PALETTE.length] }}
              />
              <span className="truncate text-text-secondary" style={{ maxWidth: 140 }}>
                {r.title}
              </span>
              <span className="ml-auto pl-2 font-semibold text-ink">{r.weight_pct.toFixed(0)}%</span>
            </div>
          ))}
          <p className="mt-1 text-[10px] text-text-muted">
            % = share of your monthly savings (₹{Math.round(monthlySavings).toLocaleString("en-IN")}/mo) to direct here.
          </p>
        </div>
      </div>

      {/* Priority action cards */}
      <div className="mt-4 space-y-2">
        {sorted.map((r, i) => {
          const isOpen = expanded === i;
          const color = PALETTE[i % PALETTE.length];
          const rupeeAmt = savingsAmount(r.weight_pct, monthlySavings);
          return (
            <div
              key={r.title}
              className="overflow-hidden rounded-xl border border-slate-100"
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : i)}
                className="flex w-full items-center gap-3 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100"
              >
                {/* Rank badge */}
                <span
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: color }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{r.title}</p>
                  <p className="text-[11px] text-text-muted">{RANK_LABELS[i] ?? `Priority ${i + 1}`}</p>
                </div>
                <div className="flex flex-shrink-0 flex-col items-end">
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${RANK_BG[i] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}>
                    {r.weight_pct.toFixed(0)}% of savings
                  </span>
                  {monthlySavings > 0 ? (
                    <span className="mt-0.5 text-[10px] text-text-muted">≈ {fmt(rupeeAmt)}/mo</span>
                  ) : null}
                </div>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 flex-shrink-0 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-400" />
                )}
              </button>

              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div
                      className="border-t px-4 py-3"
                      style={{ borderColor: color + "33", background: color + "08" }}
                    >
                      <p className="text-xs leading-relaxed text-text-secondary">{r.detail}</p>
                      {monthlySavings > 0 ? (
                        <div
                          className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2"
                          style={{ background: color + "15" }}
                        >
                          <span className="text-[11px] font-semibold" style={{ color }}>
                            Suggested amount:
                          </span>
                          <span className="text-[11px] font-bold text-ink">
                            {fmt(rupeeAmt)}/mo ({r.weight_pct.toFixed(0)}% of your ₹{Math.round(monthlySavings).toLocaleString("en-IN")} savings)
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-text-muted">
        These percentages show how to split your existing monthly savings — not how much extra to invest. They add up to 100% of your current savings amount.
      </p>
    </div>
  );
}
