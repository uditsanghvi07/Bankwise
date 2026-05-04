"use client";

import { motion } from "framer-motion";
import {
  Award,
  CheckCircle2,
  Compass,
  Download,
  Lightbulb,
  PartyPopper,
  PiggyBank,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
  Triangle,
  Wallet,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Parse LLM narrative (prose paragraph OR dash/star bullets) into 5–7 clean strings. */
function parseNarrativePoints(text: string): string[] {
  if (!text?.trim()) return [];

  // Try explicit bullet markers first: lines starting with - or * or • or numbered
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const bulletLines = lines
    .filter((l) => /^[-*•]\s+.{8,}/.test(l) || /^\d+[.)]\s+.{8,}/.test(l))
    .map((l) => l.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, "").trim());

  if (bulletLines.length >= 3) return bulletLines.slice(0, 7);

  // Fallback: split prose on sentence boundaries, keep 5–7 non-trivial sentences.
  const sentences = text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z₹"']|\d)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30);

  return sentences.slice(0, 7);
}

import { AllocationPanel } from "@/components/advisor/AllocationPanel";
import { FeasibilityGauge } from "@/components/advisor/FeasibilityGauge";
import { IncomeBreakdownCard } from "@/components/advisor/IncomeBreakdownCard";
import { MetricCard } from "@/components/advisor/MetricCard";
import { ProjectionChart } from "@/components/advisor/ProjectionChart";
import { SavingsVsRequiredChart } from "@/components/advisor/SavingsVsRequiredChart";
import type {
  AdvisorGoalFeasibility,
  AdvisorRequest,
  AdvisorResponse,
  AdvisorVerdictSeverity,
} from "@/lib/api";
import { downloadAdvisorPdf } from "@/lib/api";

function bandFor(score: number) {
  if (score >= 80) return { label: "Top decile", color: "from-emerald-500 to-emerald-600", text: "text-emerald-700", soft: "bg-emerald-50" };
  if (score >= 60) return { label: "Healthy", color: "from-brand-indigo to-brand-violet", text: "text-brand-indigo", soft: "bg-brand-indigo/10" };
  if (score >= 45) return { label: "Stretched", color: "from-amber-500 to-orange-500", text: "text-amber-700", soft: "bg-amber-50" };
  if (score >= 30) return { label: "Concerning", color: "from-orange-500 to-rose-500", text: "text-rose-700", soft: "bg-rose-50" };
  return { label: "Critical", color: "from-rose-600 to-red-700", text: "text-red-800", soft: "bg-red-50" };
}

const VERDICT_STYLE: Record<
  AdvisorVerdictSeverity,
  { bg: string; ring: string; chip: string; icon: typeof PartyPopper; iconBg: string }
> = {
  excellent: {
    bg: "bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600",
    ring: "ring-emerald-300/50",
    chip: "bg-white/15 text-white",
    icon: PartyPopper,
    iconBg: "bg-white/15",
  },
  healthy: {
    bg: "bg-gradient-to-br from-brand-indigo via-indigo-600 to-brand-violet",
    ring: "ring-indigo-300/50",
    chip: "bg-white/15 text-white",
    icon: CheckCircle2,
    iconBg: "bg-white/15",
  },
  stretched: {
    bg: "bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600",
    ring: "ring-amber-300/40",
    chip: "bg-white/15 text-white",
    icon: Triangle,
    iconBg: "bg-white/15",
  },
  concerning: {
    bg: "bg-gradient-to-br from-orange-600 via-rose-500 to-rose-600",
    ring: "ring-rose-300/40",
    chip: "bg-white/15 text-white",
    icon: ShieldAlert,
    iconBg: "bg-white/15",
  },
  critical: {
    bg: "bg-gradient-to-br from-rose-700 via-red-700 to-red-900",
    ring: "ring-red-300/40",
    chip: "bg-white/15 text-white",
    icon: ShieldAlert,
    iconBg: "bg-white/15",
  },
};

const FEASIBILITY_STYLE: Record<AdvisorGoalFeasibility["label"], { dot: string; label: string; tone: string }> = {
  conservative: { dot: "bg-emerald-500", label: "Comfortable", tone: "text-emerald-700" },
  on_track: { dot: "bg-brand-indigo", label: "On track", tone: "text-brand-indigo" },
  ambitious: { dot: "bg-amber-500", label: "Stretched", tone: "text-amber-700" },
  unrealistic: { dot: "bg-rose-600", label: "Unrealistic", tone: "text-rose-700" },
};

function formatINR(value: number) {
  if (!Number.isFinite(value)) return "-";
  if (Math.abs(value) >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr`;
  if (Math.abs(value) >= 1e5) return `₹${(value / 1e5).toFixed(1)} L`;
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function plainEnglishSummary(response: AdvisorResponse, request: AdvisorRequest): string[] {
  const lines: string[] = [];
  const cashflow = response.net_cashflow ?? request.monthly_income - request.monthly_expenses - request.existing_emi_obligations;

  if (response.savings_rate_pct >= 25) {
    lines.push(`You save ${response.savings_rate_pct.toFixed(0)}% of your income — that's better than most Indian households.`);
  } else if (response.savings_rate_pct >= 15) {
    lines.push(`You save ${response.savings_rate_pct.toFixed(0)}% of your income — decent, but a bit more would speed things up.`);
  } else {
    lines.push(`You save only ${response.savings_rate_pct.toFixed(0)}% of your income — that's the first thing to fix.`);
  }

  if (response.foir_used_pct >= 50) {
    lines.push(`Your EMIs already eat ${response.foir_used_pct.toFixed(0)}% of income — banks treat anything above 50% as risky.`);
  } else if (response.foir_used_pct >= 35) {
    lines.push(`EMIs use ${response.foir_used_pct.toFixed(0)}% of your income — there's some room, but not a lot.`);
  } else {
    lines.push(`EMIs use only ${response.foir_used_pct.toFixed(0)}% of your income — banks see this as comfortable.`);
  }

  if (response.emergency_fund_months !== undefined) {
    if (response.emergency_fund_months < 3) {
      lines.push(`Your emergency cover is only ${response.emergency_fund_months.toFixed(1)} months — aim for at least 6.`);
    } else if (response.emergency_fund_months < 6) {
      lines.push(`Your emergency cover is ${response.emergency_fund_months.toFixed(1)} months — keep building toward 6.`);
    } else {
      lines.push(`Your emergency cover is ${response.emergency_fund_months.toFixed(1)} months — that's a solid cushion.`);
    }
  }

  if (response.goal_feasibility) {
    const f = response.goal_feasibility;
    if (f.label === "unrealistic") {
      lines.push(`Your goal needs ${formatINR(f.sip_required_base)}/mo, far above what you save now — push the deadline or trim the target.`);
    } else if (f.label === "ambitious") {
      lines.push(`Your goal needs ${formatINR(f.sip_required_base)}/mo — possible, but it'll demand discipline.`);
    } else {
      lines.push(`Your goal looks reachable — needs ~${formatINR(f.sip_required_base)}/mo at the base case.`);
    }
  }

  if (cashflow < 0) {
    lines.push(`You spend more than you earn each month — this is the most urgent fix.`);
  }

  return lines.slice(0, 4);
}

export function AdvisorReport({
  request,
  response,
}: {
  request: AdvisorRequest;
  response: AdvisorResponse;
}) {
  const band = bandFor(response.health_score);
  const verdict = response.verdict;
  const verdictStyle = verdict ? VERDICT_STYLE[verdict.severity] : VERDICT_STYLE.healthy;
  const VerdictIcon = verdictStyle.icon;
  const redFlags = response.red_flags ?? [];
  const greenFlags = response.green_flags ?? [];
  const feasibility = response.goal_feasibility ?? null;
  const returns = response.returns ?? null;
  const baseRet = (returns?.base_pct ?? response.expected_return_pct).toFixed(1);
  const pessRet = (returns?.pessimistic_pct ?? response.expected_return_pct - 2.5).toFixed(1);
  const optRet = (returns?.optimistic_pct ?? response.expected_return_pct + 2.0).toFixed(1);
  const inflRet = returns?.inflation_pct.toFixed(1) ?? "6.0";
  const summaryBullets = plainEnglishSummary(response, request);

  async function exportPdf() {
    try {
      await downloadAdvisorPdf(request, response);
    } catch (e) {
      alert("Could not generate PDF. Please retry.");
      console.error(e);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {verdict ? (
        <div className={`relative overflow-hidden rounded-3xl p-6 text-white shadow-xl ring-1 md:p-7 ${verdictStyle.bg} ${verdictStyle.ring}`}>
          <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/15 blur-2xl" aria-hidden />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-1 items-start gap-4">
              <span className={`mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${verdictStyle.iconBg} backdrop-blur`}>
                <VerdictIcon className="h-6 w-6" strokeWidth={1.9} />
              </span>
              <div className="min-w-0 flex-1">
                <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${verdictStyle.chip}`}>
                  Verdict · {verdict.label}
                </span>
                <h2 className="mt-3 text-xl font-bold leading-snug md:text-2xl">{verdict.headline}</h2>
                <p className="mt-2 text-sm leading-relaxed opacity-95 md:text-[15px]">{verdict.one_liner}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={exportPdf}
              className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-white/20 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/30"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-5 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-indigo">
          <Lightbulb className="h-4 w-4" />
          In plain English
        </div>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink">
          {summaryBullets.map((s) => (
            <li key={s} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-indigo" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-text-muted">
          Tap the <span className="font-semibold">?</span> on any card below to see what each number actually means.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-muted">
            <Award className="h-4 w-4" />
            Health score
          </div>
          <p className={`mt-3 bg-gradient-to-r ${band.color} bg-clip-text text-5xl font-extrabold tracking-tight text-transparent`}>
            {response.health_score}
            <span className="ml-1 text-base font-semibold text-text-muted">/100</span>
          </p>
          <span className={`mt-3 inline-flex rounded-full px-3 py-0.5 text-xs font-semibold ${band.soft} ${band.text}`}>
            {band.label}
          </span>
          <p className="mt-2 text-[11px] text-text-muted">A blended score from FOIR, savings rate, emergency cover, and goal-fit.</p>
        </div>

        <IncomeBreakdownCard
          monthlyIncome={request.monthly_income}
          monthlyEmi={request.existing_emi_obligations}
          monthlyExpenses={request.monthly_expenses}
          monthlySavings={request.monthly_savings}
          foirPct={response.foir_used_pct}
        />

        <MetricCard
          icon={PiggyBank}
          title="How much you save"
          value={`${response.savings_rate_pct.toFixed(0)}%`}
          hint={response.savings_rate_pct >= 25 ? "Better than most Indian households" : response.savings_rate_pct >= 15 ? "Okay, push higher" : "Try to lift this above 15%"}
          tone={response.savings_rate_pct >= 20 ? "success" : response.savings_rate_pct >= 12 ? "default" : "danger"}
          explanation="The slice of your income that doesn't get spent. 20–30% is a common target in India. Higher saving rates compound your goals dramatically faster."
        />

        {response.emergency_fund_months !== undefined ? (
          <MetricCard
            icon={ShieldAlert}
            title="Emergency cover"
            value={`${response.emergency_fund_months.toFixed(1)} mo`}
            hint={response.emergency_fund_months >= 6 ? "Solid cushion" : response.emergency_fund_months >= 3 ? "Almost there" : "Build to 6 months"}
            tone={response.emergency_fund_months >= 6 ? "success" : response.emergency_fund_months >= 3 ? "warn" : "danger"}
            explanation="If you lost income tomorrow, how many months of expenses your liquid savings cover. The rule of thumb in India is 6 months for salaried, 9–12 for variable income."
          />
        ) : (
          <MetricCard
            icon={Wallet}
            title="Money left each month"
            value={`${(response.net_cashflow ?? 0) >= 0 ? "+" : ""}${formatINR(response.net_cashflow ?? 0)}`}
            hint="After expenses + EMIs"
            tone={(response.net_cashflow ?? 0) < 0 ? "danger" : "default"}
            explanation="Income minus all expenses and EMIs each month. Negative numbers mean you spend more than you earn — fix this before adding new EMIs or SIPs."
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard
          icon={TrendingDown}
          title="Worst-case return"
          value={`${pessRet}% p.a.`}
          tone="danger"
          hint="If markets are unkind"
          explanation="A pessimistic long-run blended return for your risk profile (e.g. weak Nifty + EPF + FD years). Plan with this number — if the goal still works here, you're truly safe."
        />
        <MetricCard
          icon={Compass}
          title="Most-likely return"
          value={`${baseRet}% p.a.`}
          tone="default"
          hint="Base case"
          explanation="The middle scenario for your risk profile, blending realistic Indian benchmarks. Use this for the headline plan, but always sanity-check against the worst case."
        />
        <MetricCard
          icon={TrendingUp}
          title="Best-case return"
          value={`${optRet}% p.a.`}
          tone="success"
          hint={`Inflation drag: ~${inflRet}% p.a.`}
          explanation="An optimistic but still realistic long-run return. Don't anchor your plan here — markets rarely deliver the best case for the full horizon."
        />
      </div>

      {redFlags.length || greenFlags.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {redFlags.length ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-rose-800">
                <TrendingDown className="h-4 w-4" />
                Things to fix ({redFlags.length})
              </div>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-rose-900">
                {redFlags.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-600" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {greenFlags.length ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                Working in your favour ({greenFlags.length})
              </div>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-emerald-900">
                {greenFlags.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {feasibility ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-muted">
              <Target className="h-4 w-4" />
              Can you actually hit this goal?
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold">
              <span className={`h-2 w-2 rounded-full ${FEASIBILITY_STYLE[feasibility.label].dot}`} />
              <span className={FEASIBILITY_STYLE[feasibility.label].tone}>{FEASIBILITY_STYLE[feasibility.label].label}</span>
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">{feasibility.note}</p>

          <div className="mt-5 grid gap-6 lg:grid-cols-[280px_1fr]">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">How heavy is this goal?</p>
              <div className="mt-2">
                <FeasibilityGauge pctOfCurrentSavings={feasibility.pct_of_current_savings} label={feasibility.label} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">What you save vs what you'd need</p>
                <p className="text-[11px] text-text-muted">Higher bar = more SIP required</p>
              </div>
              <SavingsVsRequiredChart monthlySavings={request.monthly_savings} feasibility={feasibility} />
              <div className="mt-3 grid gap-2 text-xs text-text-secondary sm:grid-cols-3">
                <div className="rounded-lg border border-rose-100 bg-rose-50/60 px-3 py-2">
                  <span className="font-semibold text-rose-700">Worst case · {pessRet}%</span> — needs <span className="font-semibold">{formatINR(feasibility.sip_required_pessimistic)}</span>/mo
                </div>
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2">
                  <span className="font-semibold text-brand-indigo">Most likely · {baseRet}%</span> — needs <span className="font-semibold">{formatINR(feasibility.sip_required_base)}</span>/mo
                </div>
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                  <span className="font-semibold text-emerald-700">Best case · {optRet}%</span> — needs <span className="font-semibold">{formatINR(feasibility.sip_required_optimistic)}</span>/mo
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-muted">
            <Compass className="h-4 w-4" />
            How your money grows over {request.horizon_years} years
          </div>
          <p className="text-xs text-text-muted">
            Three paths · {pessRet}% / {baseRet}% / {optRet}% p.a.
          </p>
        </div>
        <ProjectionChart data={response.projections} />
        <p className="mt-3 text-xs leading-relaxed text-text-secondary">
          The <span className="font-semibold text-brand-indigo">solid indigo line</span> is the most likely path. The
          dashed lines show the range if markets do better or worse. The
          <span className="font-semibold text-orange-600"> orange dashed line</span> is your goal grown for inflation —
          your portfolio needs to land above it.
        </p>
        {response.real_corpus_at_horizon ? (
          <p className="mt-2 text-xs text-text-muted">
            In today's money: base case lands at <span className="font-semibold text-ink">{formatINR(response.real_corpus_at_horizon)}</span>
            {response.inflation_adjusted_target
              ? ` against an inflation-adjusted target of ${formatINR(response.inflation_adjusted_target)}.`
              : "."}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Honest narrative
          </h3>
          <ul className="narrative-ul mt-2">
            {parseNarrativePoints(response.narrative).map((point, i) => (
              <li key={i} className="narrative-li">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <span>{children}</span>,
                    strong: ({ children }) => (
                      <strong className="font-semibold text-slate-900">{children}</strong>
                    ),
                  }}
                >
                  {point}
                </ReactMarkdown>
              </li>
            ))}
          </ul>
        </div>
        <AllocationPanel
          recommendations={response.recommendations}
          monthlySavings={request.monthly_savings}
        />
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
          <ShieldAlert className="h-4 w-4" />
          Risks to keep in mind
        </div>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-xs text-amber-900">
          {response.risks.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-amber-700">{response.disclaimers.join(" ")}</p>
      </div>
    </motion.div>
  );
}
