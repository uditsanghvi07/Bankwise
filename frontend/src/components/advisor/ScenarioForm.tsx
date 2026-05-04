"use client";

import { Loader2, Sparkles } from "lucide-react";

import type { AdvisorRequest } from "@/lib/api";

const FIELD_LABEL = "block text-xs font-semibold uppercase tracking-wide text-text-muted";
const FIELD_INPUT =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-ink shadow-sm outline-none focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/20";

type FieldKey = keyof AdvisorRequest;

const NUMERIC_FIELDS: { key: FieldKey; label: string; placeholder: string; suffix?: string; step?: string }[] = [
  { key: "age", label: "Age", placeholder: "e.g. 28", suffix: "yrs" },
  { key: "monthly_income", label: "Net monthly income", placeholder: "80000", suffix: "₹" },
  { key: "monthly_expenses", label: "Monthly expenses", placeholder: "40000", suffix: "₹" },
  { key: "monthly_savings", label: "Monthly savings", placeholder: "20000", suffix: "₹" },
  { key: "existing_emi_obligations", label: "Existing EMIs", placeholder: "0", suffix: "₹" },
  { key: "current_savings", label: "Current liquid savings", placeholder: "150000", suffix: "₹" },
  { key: "target_corpus", label: "Goal corpus (optional)", placeholder: "10000000", suffix: "₹" },
  { key: "horizon_years", label: "Horizon", placeholder: "10", suffix: "yrs" },
];

const RISK = [
  { value: "low", title: "Low", body: "Capital protection first" },
  { value: "moderate", title: "Moderate", body: "Balanced 60/40 mix" },
  { value: "high", title: "High", body: "Equity-heavy, long horizon" },
] as const;

const GOALS = [
  { value: "wealth_growth", label: "Wealth growth" },
  { value: "retirement", label: "Retirement" },
  { value: "home", label: "Buy a home" },
  { value: "child_education", label: "Child education" },
  { value: "emergency_fund", label: "Emergency fund" },
  { value: "tax_saving", label: "Tax saving" },
] as const;

export function ScenarioForm({
  value,
  onChange,
  onSubmit,
  loading,
}: {
  value: AdvisorRequest;
  onChange: (next: AdvisorRequest) => void;
  onSubmit: (req: AdvisorRequest) => void;
  loading: boolean;
}) {
  const form = value;

  const update = (key: FieldKey, v: string | number) =>
    onChange({ ...form, [key]: v as never });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
      className="space-y-7"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {NUMERIC_FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className={FIELD_LABEL}>
              {f.label}
              {f.suffix ? <span className="ml-1 text-slate-400">({f.suffix})</span> : null}
            </span>
            <input
              type="number"
              inputMode="decimal"
              className={FIELD_INPUT}
              placeholder={f.placeholder}
              value={String(form[f.key] ?? "")}
              onChange={(e) => update(f.key, e.target.value === "" ? 0 : Number(e.target.value))}
              min={0}
            />
          </label>
        ))}
      </div>

      <div>
        <p className={FIELD_LABEL}>Risk appetite</p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {RISK.map((r) => {
            const active = form.risk_appetite === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => update("risk_appetite", r.value)}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  active
                    ? "border-brand-indigo bg-gradient-to-br from-brand-indigo/10 to-brand-violet/5 shadow-md shadow-brand-indigo/10"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <p className={`text-sm font-bold ${active ? "text-brand-indigo" : "text-ink"}`}>{r.title}</p>
                <p className="text-xs text-text-muted">{r.body}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className={FIELD_LABEL}>Primary goal</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {GOALS.map((g) => {
            const active = form.primary_goal === g.value;
            return (
              <button
                key={g.value}
                type="button"
                onClick={() => update("primary_goal", g.value)}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                  active
                    ? "border-brand-indigo bg-brand-indigo text-white shadow-sm"
                    : "border-slate-200 bg-white text-text-secondary hover:border-slate-300"
                }`}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="block">
        <span className={FIELD_LABEL}>Anything else? (optional)</span>
        <textarea
          rows={3}
          className={FIELD_INPUT}
          placeholder="e.g. Planning to switch jobs in a year, or expecting a sibling's wedding cost in 2027."
          value={form.notes ?? ""}
          onChange={(e) => update("notes", e.target.value)}
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs text-text-muted">
          We never store these values on a server unless you save the report. Numbers are computed locally on the
          API and shaped into a balanced opinion by the LLM.
        </p>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-indigo to-brand-violet px-5 py-2.5 text-sm font-semibold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Crunching numbers…" : "Get balanced opinion"}
        </button>
      </div>
    </form>
  );
}
