"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AdvisorProjectionPoint } from "@/lib/api";

function formatRupees(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)} K`;
  return `₹${Math.round(n)}`;
}

const LEGEND_ITEMS = [
  {
    key: "contribution_to_date",
    color: "#94a3b8",
    dotStyle: "border-2 border-slate-400 bg-white",
    label: "What you put in",
    shortLabel: "Money invested",
    example: "e.g. if you invest ₹20K/mo for 5 years, this bar reaches ₹12 L — that's purely your contributions, no growth.",
    description: "The total amount of money YOU invest over time — no returns included. Think of it as your personal deposit running total.",
  },
  {
    key: "portfolio_optimistic",
    color: "#22c55e",
    dotStyle: "bg-emerald-500",
    label: "Best-case path",
    shortLabel: "If markets do great",
    example: "e.g. Nifty 50 delivers ~10% CAGR for 10 years — your ₹20K/mo grows to ~₹41 L vs ₹24 L you put in.",
    description: "What your portfolio could be worth if markets perform well (optimistic return assumption). The ceiling of realistic expectations.",
  },
  {
    key: "portfolio_pessimistic",
    color: "#f43f5e",
    dotStyle: "bg-rose-500",
    label: "Worst-case path",
    shortLabel: "If markets are unkind",
    example: "e.g. a decade of weak returns (6%) — your ₹20K/mo grows to only ~₹33 L. Plan for this — if it still works, you're safe.",
    description: "What your portfolio might be worth in a poor-returns scenario. Always check your goal works here too before committing.",
  },
  {
    key: "portfolio_value",
    color: "#6366f1",
    dotStyle: "bg-brand-indigo",
    label: "Most likely path",
    shortLabel: "Expected outcome",
    example: "e.g. realistic long-run blended Indian benchmark (7–8% CAGR) — the line you can roughly bank on.",
    description: "The middle scenario — your base-case portfolio value using realistic Indian benchmark returns (Nifty/EPF/FD blend). The main line to watch.",
  },
  {
    key: "nominal_target",
    color: "#f97316",
    dotStyle: "bg-orange-500",
    label: "Your goal line",
    shortLabel: "What you're aiming for",
    example: "e.g. you want ₹2 Cr in today's money — adjusted for 6% inflation over 12 years, the target becomes ₹4 Cr. Your portfolio must cross this.",
    description: "Your goal amount adjusted upward for inflation. This is what ₹1 Cr today will actually cost you in future rupees. Your portfolio (most-likely path) should cross this line.",
  },
];

export function ProjectionChart({ data }: { data: AdvisorProjectionPoint[] }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const hasBand = data.some(
    (p) => p.portfolio_pessimistic != null && p.portfolio_optimistic != null,
  );

  const activeItem = activeKey ? LEGEND_ITEMS.find((l) => l.key === activeKey) : null;

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="portfolio-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.04} />
              </linearGradient>
              <linearGradient id="opt-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="pess-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="contrib-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#94a3b8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              label={{ value: "Years from now", position: "insideBottom", offset: -2, fontSize: 11, fill: "#64748b" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickFormatter={(v) => formatRupees(Number(v))}
              axisLine={false}
              tickLine={false}
              width={70}
            />
            <Tooltip
              contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0", fontSize: 12 }}
              formatter={(value: number, name: string) => {
                const item = LEGEND_ITEMS.find((l) => l.key === name);
                return [formatRupees(value), item?.shortLabel ?? name];
              }}
              labelFormatter={(y) => `Year ${y}`}
            />
            <Area
              type="monotone"
              dataKey="contribution_to_date"
              name="contribution_to_date"
              stroke="#94a3b8"
              fill="url(#contrib-grad)"
              strokeWidth={1.2}
              legendType="none"
            />
            {hasBand ? (
              <>
                <Area
                  type="monotone"
                  dataKey="portfolio_optimistic"
                  name="portfolio_optimistic"
                  stroke="#22c55e"
                  fill="url(#opt-grad)"
                  strokeWidth={1.4}
                  strokeDasharray="4 4"
                  legendType="none"
                />
                <Area
                  type="monotone"
                  dataKey="portfolio_pessimistic"
                  name="portfolio_pessimistic"
                  stroke="#f43f5e"
                  fill="url(#pess-grad)"
                  strokeWidth={1.4}
                  strokeDasharray="4 4"
                  legendType="none"
                />
              </>
            ) : null}
            <Area
              type="monotone"
              dataKey="portfolio_value"
              name="portfolio_value"
              stroke="#6366f1"
              fill="url(#portfolio-grad)"
              strokeWidth={2.2}
              legendType="none"
            />
            <Line
              type="monotone"
              dataKey="nominal_target"
              name="nominal_target"
              stroke="#f97316"
              strokeDasharray="5 5"
              strokeWidth={1.6}
              dot={false}
              legendType="none"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Custom click-to-explain legend */}
      <div className="flex flex-wrap gap-2 px-1">
        {LEGEND_ITEMS.filter((l) => l.key !== "portfolio_pessimistic" || hasBand)
          .filter((l) => l.key !== "portfolio_optimistic" || hasBand)
          .map((item) => {
            const isActive = activeKey === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveKey(isActive ? null : item.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                  isActive
                    ? "border-slate-300 bg-slate-100 text-ink shadow-sm"
                    : "border-slate-200 bg-white text-text-secondary hover:border-slate-300 hover:text-ink"
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${item.dotStyle}`}
                  style={{ background: item.dotStyle.includes("bg-") ? undefined : item.color }}
                />
                {item.label}
                <span className="ml-0.5 text-[10px] font-semibold text-brand-indigo">?</span>
              </button>
            );
          })}
      </div>

      {/* Inline explanation panel — pushes content down */}
      <AnimatePresence initial={false}>
        {activeItem ? (
          <motion.div
            key={activeItem.key}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div
              className="rounded-xl border px-4 py-3"
              style={{
                borderColor: activeItem.color + "55",
                background: activeItem.color + "0d",
              }}
            >
              <p className="text-xs font-semibold" style={{ color: activeItem.color }}>
                {activeItem.label}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">{activeItem.description}</p>
              <p className="mt-2 rounded-lg bg-white/80 px-3 py-2 text-xs leading-relaxed text-text-muted">
                <span className="font-semibold text-ink">Example: </span>
                {activeItem.example}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
