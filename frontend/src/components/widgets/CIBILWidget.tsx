"use client";

import { Activity } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useCalculator } from "@/hooks/useCalculator";

const ACTIONS: { key: string; label: string }[] = [
  { key: "pay_all_dues_on_time_6_months", label: "Pay all dues on time (6+ months)" },
  { key: "reduce_credit_utilization_below_30", label: "Reduce utilization below 30%" },
  { key: "close_old_delinquent_account", label: "Close old delinquent account" },
  { key: "new_credit_inquiry", label: "New hard inquiry" },
  { key: "add_secured_card", label: "Add secured credit card" },
  { key: "settle_vs_close_loan_settled", label: "Settle a loan (settled status)" },
  { key: "settle_vs_close_loan_closed", label: "Close loan normally" },
];

function bandColor(score: number) {
  if (score < 550) return "#b91c1c";
  if (score < 650) return "#b45309";
  if (score < 750) return "#a16207";
  if (score < 800) return "#028174";
  return "#0AB68B";
}

export function CIBILWidget({ params }: { params: Record<string, unknown> }) {
  const { calculateCibil } = useCalculator();
  const [score, setScore] = useState(Number(params.current_score ?? 650));
  const [selected, setSelected] = useState<string[]>([]);
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const actionKey = useMemo(() => selected.slice().sort().join("|"), [selected]);

  useEffect(() => {
    let c = false;
    (async () => {
      const actionsPayload = selected.map((action) => ({ action, impact: null as number | null }));
      const res = await calculateCibil({ current_score: score, actions: actionsPayload });
      if (!c && res) setData(res as Record<string, unknown>);
    })();
    return () => {
      c = true;
    };
  }, [actionKey, calculateCibil, score, selected]);

  const projected = typeof data?.projected_score === "number" ? data.projected_score : score;

  return (
    <div className="rounded-xl border border-border bg-surface/95 p-4 shadow-card backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">CIBIL simulator</h3>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm text-text-secondary">Current score</label>
          <input
            type="range"
            min={300}
            max={900}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="mt-2 w-full"
          />
          <div className="mt-2 flex items-center gap-3">
            <div className="text-3xl font-bold numeric" style={{ color: bandColor(score) }}>
              {score}
            </div>
            <div className="h-2 flex-1 rounded-full bg-border">
              <div
                className="h-2 rounded-full"
                style={{ width: `${((score - 300) / 600) * 100}%`, background: bandColor(score) }}
              />
            </div>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            {ACTIONS.map((a) => (
              <label key={a.key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.includes(a.key)}
                  onChange={(e) => {
                    setSelected((prev) =>
                      e.target.checked ? [...prev, a.key] : prev.filter((x) => x !== a.key),
                    );
                  }}
                />
                {a.label}
              </label>
            ))}
          </div>
        </div>
        <div className="text-sm">
          {data ? (
            <div className="space-y-2">
              <div>
                <div className="text-xs text-text-secondary">Projected score</div>
                <div className="text-2xl font-semibold numeric" style={{ color: bandColor(projected) }}>
                  {projected}
                </div>
                <div className="text-xs text-text-muted">Band: {String(data.projected_band)}</div>
              </div>
              <p className="text-xs text-text-secondary">{String(data.timeline_estimate ?? "")}</p>
              <div className="h-2 w-full rounded-full bg-border">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${((projected - 300) / 600) * 100}%` }}
                />
              </div>
              <p className="text-[11px] leading-snug text-text-muted">{String(data.disclaimer ?? "")}</p>
            </div>
          ) : (
            <div className="text-text-muted">Simulating…</div>
          )}
        </div>
      </div>
    </div>
  );
}
