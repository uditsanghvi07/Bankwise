"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AdvisorGoalFeasibility } from "@/lib/api";

function formatINR(n: number) {
  if (!Number.isFinite(n)) return "-";
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(0)}K`;
  return `₹${Math.round(n)}`;
}

export function SavingsVsRequiredChart({
  monthlySavings,
  feasibility,
}: {
  monthlySavings: number;
  feasibility: AdvisorGoalFeasibility;
}) {
  const data = [
    { name: "What you save now", value: monthlySavings, color: "#6366f1", isYou: true },
    { name: "If markets do badly", value: feasibility.sip_required_pessimistic, color: "#f43f5e", isYou: false },
    { name: "Most likely needed", value: feasibility.sip_required_base, color: "#7c3aed", isYou: false },
    { name: "If markets do great", value: feasibility.sip_required_optimistic, color: "#22c55e", isYou: false },
  ];

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#475569" }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={(v) => formatINR(Number(v))}
            axisLine={false}
            tickLine={false}
            width={70}
          />
          <Tooltip
            contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0", fontSize: 12 }}
            formatter={(v: number) => [`${formatINR(v)} / month`, "Amount"]}
          />
          <Bar dataKey="value" radius={[10, 10, 4, 4]}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
            <LabelList
              dataKey="value"
              position="top"
              formatter={(v: number) => formatINR(v)}
              style={{ fill: "#0f172a", fontSize: 11, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
