"use client";

import { Activity, ArrowRight, HelpCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

import { WidgetHelpModal } from "@/components/widgets/WidgetHelpModal";
import { useCalculator } from "@/hooks/useCalculator";

const ACTIONS: { key: string; label: string; impact: "up" | "down"; subtitle: string }[] = [
  { key: "pay_all_dues_on_time_6_months",     label: "Pay all dues on time (6+ months)",   impact: "up",   subtitle: "Single biggest driver of score" },
  { key: "reduce_credit_utilization_below_30", label: "Reduce credit utilisation below 30%", impact: "up",   subtitle: "Don't max out cards" },
  { key: "add_secured_card",                   label: "Add a secured credit card",          impact: "up",   subtitle: "Builds credit history" },
  { key: "settle_vs_close_loan_closed",        label: "Close a loan normally",              impact: "up",   subtitle: "Better than 'settled'" },
  { key: "close_old_delinquent_account",       label: "Close old delinquent account",       impact: "up",   subtitle: "Stops future damage" },
  { key: "new_credit_inquiry",                 label: "Apply for new credit (hard inquiry)", impact: "down", subtitle: "Each inquiry shaves a few points" },
  { key: "settle_vs_close_loan_settled",       label: "Settle a loan ('settled' status)",   impact: "down", subtitle: "Hurts score for 7+ years" },
];

function bandFor(score: number) {
  if (score < 550) return { color: "#dc2626", label: "Poor",       bgClass: "bg-rose-50 border-rose-200 text-rose-800",      hint: "Most loans declined." };
  if (score < 650) return { color: "#ea580c", label: "Fair",       bgClass: "bg-orange-50 border-orange-200 text-orange-800", hint: "Approvals possible at higher rates." };
  if (score < 750) return { color: "#ca8a04", label: "Good",       bgClass: "bg-amber-50 border-amber-200 text-amber-800",   hint: "Most lenders happy; rate negotiable." };
  if (score < 800) return { color: "#16a34a", label: "Very good",  bgClass: "bg-emerald-50 border-emerald-200 text-emerald-800", hint: "Best rates and pre-approved offers." };
  return                  { color: "#059669", label: "Excellent",  bgClass: "bg-emerald-100 border-emerald-300 text-emerald-900", hint: "Top-tier — every bank wants you." };
}

/** Convert a 300-900 score to a percentage along the half-circle gauge. */
function scoreToPct(score: number) {
  return Math.max(0, Math.min(100, ((score - 300) / 600) * 100));
}

/** SVG semicircle gauge — score 300 to 900 along a 180° sweep. */
function ScoreGauge({ score, projected }: { score: number; projected: number }) {
  const W = 280;
  const H = 168;
  const CX = W / 2;
  const CY = H - 18;
  const R = 100;

  const polar = (deg: number, r: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
  };
  const arcPath = (startDeg: number, endDeg: number, r: number) => {
    const s = polar(startDeg, r);
    const e = polar(endDeg, r);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  };

  const pctToAngle = (pct: number) => -90 + (pct / 100) * 180;
  const SCORE_BANDS = [
    { from: 300, to: 550, color: "#dc2626" },
    { from: 550, to: 650, color: "#ea580c" },
    { from: 650, to: 750, color: "#ca8a04" },
    { from: 750, to: 800, color: "#16a34a" },
    { from: 800, to: 900, color: "#059669" },
  ];

  const projectedBand = bandFor(projected);
  const angle = pctToAngle(scoreToPct(projected));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[300px]" style={{ overflow: "visible" }} aria-hidden>
      {/* Background track */}
      <path
        d={arcPath(-90, 90, R)}
        stroke="#f1f5f9"
        strokeWidth={18}
        fill="none"
        strokeLinecap="round"
      />
      {/* Coloured bands */}
      {SCORE_BANDS.map((b) => {
        const a1 = pctToAngle(scoreToPct(b.from));
        const a2 = pctToAngle(scoreToPct(b.to));
        return (
          <path
            key={b.from}
            d={arcPath(a1, a2, R)}
            stroke={b.color}
            strokeWidth={14}
            fill="none"
            strokeLinecap="butt"
            opacity={0.9}
          />
        );
      })}

      {/* Tick markers */}
      {[300, 450, 600, 750, 900].map((t) => {
        const a = pctToAngle(scoreToPct(t));
        const p1 = polar(a, R - 22);
        const p2 = polar(a, R - 14);
        const lp = polar(a, R - 35);
        return (
          <g key={t}>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#94a3b8" strokeWidth={1.5} />
            <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight={600} fill="#475569">
              {t}
            </text>
          </g>
        );
      })}

      {/* Animated needle */}
      <motion.g
        style={{ originX: `${CX}px`, originY: `${CY}px` }}
        initial={false}
        animate={{ rotate: angle - 90 }}
        transition={{ duration: 0.7, ease: [0.34, 1.4, 0.64, 1] }}
      >
        <line x1={CX} y1={CY} x2={CX} y2={CY - R + 14} stroke="#1e293b" strokeWidth={3} strokeLinecap="round" />
      </motion.g>
      <circle cx={CX} cy={CY} r={9} fill="#1e293b" />
      <circle cx={CX} cy={CY} r={4} fill="#fff" />

      {/* Centre value */}
      <text x={CX} y={CY - 38} textAnchor="middle" fontSize={28} fontWeight={800} fill={projectedBand.color}>
        {projected}
      </text>
      <text x={CX} y={CY - 18} textAnchor="middle" fontSize={10} fontWeight={600} fill="#64748b">
        {projectedBand.label.toUpperCase()}
      </text>
    </svg>
  );
}

export function CIBILWidget({ params }: { params: Record<string, unknown> }) {
  const { calculateCibil } = useCalculator();
  const [score, setScore] = useState(Number(params.current_score ?? 650));
  const [selected, setSelected] = useState<string[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
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
  const delta = projected - score;
  const currentBand = bandFor(score);
  const projectedBand = bandFor(projected);

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-indigo to-brand-violet text-white shadow-sm">
              <Activity className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-ink">CIBIL simulator</h3>
              <p className="text-[11px] text-text-muted">See how your actions move your credit score (directional).</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-brand-indigo transition hover:border-brand-indigo/40 hover:bg-indigo-50"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            How does this work?
          </button>
        </div>

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
          {/* Gauge + slider */}
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Projected score</p>
              <div className="mt-2 flex justify-center">
                <ScoreGauge score={score} projected={projected} />
              </div>
              {delta !== 0 ? (
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[11px]">
                  <span className="rounded-full bg-slate-200 px-2.5 py-0.5 font-semibold text-text-secondary">
                    From {score}
                  </span>
                  <ArrowRight className="h-3 w-3 text-text-muted" />
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-semibold ${
                      delta > 0
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {delta > 0 ? "+" : ""}{delta} pts
                  </span>
                </div>
              ) : null}
            </div>

            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Your current score
              </span>
              <input
                type="range"
                min={300}
                max={900}
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
                className="mt-2 w-full accent-brand-indigo"
              />
              <div className="mt-1 flex items-center justify-between text-[10px] font-semibold text-text-muted">
                <span>300</span>
                <span style={{ color: currentBand.color }}>
                  {score} · {currentBand.label}
                </span>
                <span>900</span>
              </div>
            </label>

            <div className={`rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${currentBand.bgClass}`}>
              <strong>{currentBand.label}:</strong> {currentBand.hint}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Tick the actions you'll take or are doing
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {ACTIONS.map((a) => {
                const checked = selected.includes(a.key);
                const isPositive = a.impact === "up";
                return (
                  <label
                    key={a.key}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-[12px] transition ${
                      checked
                        ? isPositive
                          ? "border-emerald-300 bg-emerald-50/70 shadow-sm"
                          : "border-rose-300 bg-rose-50/70 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked ? [...prev, a.key] : prev.filter((x) => x !== a.key),
                        )
                      }
                      className={`mt-0.5 h-4 w-4 ${isPositive ? "accent-emerald-600" : "accent-rose-600"}`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-ink">{a.label}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                            isPositive ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {isPositive ? "+ Boosts" : "− Hurts"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-text-muted">{a.subtitle}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            {data ? (
              <div className={`rounded-xl border px-4 py-3 ${projectedBand.bgClass}`}>
                <div className="flex items-start gap-2 text-[12px] leading-relaxed">
                  <Activity className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p>
                      <strong>{String(data.timeline_estimate ?? "Realistic timeline")}</strong>
                    </p>
                    {data.disclaimer ? (
                      <p className="mt-1 text-[11px] opacity-90">{String(data.disclaimer)}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <WidgetHelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        Icon={Activity}
        title="How CIBIL credit scores work"
        subtitle="The 300–900 number every Indian lender checks before approving a loan."
        steps={[
          {
            index: 1,
            title: "Five factors decide your CIBIL score",
            tone: "indigo",
            body: (
              <>
                <strong>Payment history</strong> (~35%) is by far the biggest. Then <strong>credit utilisation</strong>
                (~30%), <strong>credit-history length</strong> (~15%), <strong>credit mix</strong> (~10%) and{" "}
                <strong>new inquiries</strong> (~10%).
              </>
            ),
          },
          {
            index: 2,
            title: "Score bands that matter to lenders",
            tone: "emerald",
            body: (
              <>
                <strong>750+</strong> unlocks the best rates and pre-approved offers.{" "}
                <strong>650–749</strong> is okay but expect higher rates. <strong>Below 650</strong> is risky territory —
                most banks decline or push you to NBFCs at 14–20%.
              </>
            ),
          },
          {
            index: 3,
            title: "Score moves slowly — measured in months",
            tone: "amber",
            body: (
              <>
                CIBIL recalculates monthly when banks report your data. Most positive actions take{" "}
                <strong>3–6 months</strong> to show. Hard inquiries shave a few points instantly but recover in 6–12 months.
              </>
            ),
          },
          {
            index: 4,
            title: "What this simulator is (and isn't)",
            tone: "rose",
            body: (
              <>
                It's <strong>directional</strong> — built on public guidance from CIBIL/RBI, not the actual proprietary
                model. Use it to plan; for the real number, get your free annual report at{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">cibil.com</code>.
              </>
            ),
          },
        ]}
        example={{
          title: "Realistic improvement path",
          lines: [
            <>Start at <strong>620</strong> (Fair — many rejections).</>,
            <>Pay every EMI on time for <strong>6 months</strong> + drop card use to under 30% → +30–40 pts.</>,
            <>Add a <strong>secured credit card</strong> if you have only 1 line of credit → +15–25 pts.</>,
            <>Avoid any new <strong>hard inquiry</strong> while building.</>,
            <>Result: <strong className="text-emerald-700">~660–680 in 6 months, 720+ in 12 months</strong>.</>,
          ],
        }}
        tips={[
          <><strong>Never miss an EMI</strong>, even by a day. One missed payment kills 50–80 points instantly.</>,
          <><strong>Don't max out cards</strong> — keep utilisation below 30% (use multiple cards if needed).</>,
          <><strong>Don't apply</strong> to 5 banks at once when shopping for a loan; each is a hard inquiry.</>,
          <><strong>"Settled"</strong> status on a loan is a red flag for 7+ years; always close a loan properly.</>,
          <><strong>Old credit cards help</strong> — closing your oldest card shortens history, can drop score.</>,
        ]}
        footnote="Educational only. Actual scoring uses TransUnion CIBIL's proprietary model and varies by bureau (CIBIL / Experian / Equifax / CRIF)."
      />
    </>
  );
}
