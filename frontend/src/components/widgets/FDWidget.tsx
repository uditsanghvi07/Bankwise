"use client";

import { HelpCircle, Landmark } from "lucide-react";
import { useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { WidgetHelpModal } from "@/components/widgets/WidgetHelpModal";
import { useCalculator } from "@/hooks/useCalculator";
import { formatINR } from "@/lib/formatters";
import {
  decimalStringFromNumber,
  intStringFromNumber,
  parseDecimalInput,
  parseDigitsInt,
  sanitizeDecimalString,
  sanitizeDigitString,
} from "@/lib/inputParsers";

const FIELD_LABEL = "block text-[11px] font-semibold uppercase tracking-wide text-text-muted";
const FIELD_INPUT =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink shadow-sm outline-none transition focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/15 numeric";

function fmtINRShort(n: number) {
  if (!Number.isFinite(n)) return "-";
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(0)}K`;
  return `₹${Math.round(n)}`;
}

export function FDWidget({ params }: { params: Record<string, unknown> }) {
  const { calculateFd } = useCalculator();
  const [principalStr, setPrincipalStr] = useState(() => intStringFromNumber(Number(params.principal ?? 100_000)));
  const [rateStr, setRateStr] = useState(() => decimalStringFromNumber(Number(params.annual_rate ?? 7)));
  const [yearsStr, setYearsStr] = useState(() => intStringFromNumber(Number(params.tenure_years ?? 5)));
  const [freq, setFreq] = useState<number>(Number(params.compounding_frequency ?? 4));
  const [senior, setSenior] = useState(Boolean(params.senior_citizen ?? false));
  const [helpOpen, setHelpOpen] = useState(false);
  const [data, setData] = useState<{
    maturity_amount: number;
    total_interest: number;
    effective_annual_yield: number;
    tds_note: string | null;
  } | null>(null);

  const principalNum = parseDigitsInt(principalStr);
  const rateNum = parseDecimalInput(rateStr);
  const yearsNum = parseDigitsInt(yearsStr);
  const canCalc = principalNum > 0 && rateNum >= 1 && yearsNum >= 1 && yearsNum <= 50;

  useEffect(() => {
    let c = false;
    (async () => {
      if (!canCalc) {
        if (!c) setData(null);
        return;
      }
      const res = await calculateFd({
        principal: principalNum,
        annual_rate: rateNum,
        tenure_years: yearsNum,
        compounding_frequency: freq,
        senior_citizen: senior,
      });
      if (!c && res) setData(res as typeof data);
    })();
    return () => {
      c = true;
    };
  }, [calculateFd, canCalc, freq, principalNum, rateNum, senior, yearsNum]);

  const principalPct = data && data.maturity_amount > 0 ? (principalNum / data.maturity_amount) * 100 : 100;
  const interestPct = 100 - principalPct;
  const yieldBoost = data ? data.effective_annual_yield - rateNum : 0;

  const pieData = data
    ? [
        { name: "Principal", value: principalNum, color: "#94a3b8" },
        { name: "Interest", value: Math.max(data.total_interest, 0), color: "#10b981" },
      ]
    : [];

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-indigo to-brand-violet text-white shadow-sm">
              <Landmark className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-ink">FD maturity</h3>
              <p className="text-[11px] text-text-muted">Fixed Deposit growth with compounding interest.</p>
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

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
          {/* Inputs */}
          <div className="space-y-2.5">
            <label className="block">
              <span className={FIELD_LABEL}>Principal (₹)</span>
              <input
                type="text" inputMode="numeric" autoComplete="off"
                className={FIELD_INPUT}
                value={principalStr}
                onChange={(e) => setPrincipalStr(sanitizeDigitString(e.target.value))}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className={FIELD_LABEL}>Rate %</span>
                <input
                  type="text" inputMode="decimal" autoComplete="off"
                  className={FIELD_INPUT}
                  value={rateStr}
                  onChange={(e) => setRateStr(sanitizeDecimalString(e.target.value))}
                />
              </label>
              <label className="block">
                <span className={FIELD_LABEL}>Years</span>
                <input
                  type="text" inputMode="numeric" autoComplete="off"
                  className={FIELD_INPUT}
                  value={yearsStr}
                  onChange={(e) => setYearsStr(sanitizeDigitString(e.target.value))}
                />
              </label>
            </div>
            <label className="block">
              <span className={FIELD_LABEL}>Compounding</span>
              <select
                className={`${FIELD_INPUT} cursor-pointer pr-7`}
                value={freq}
                onChange={(e) => setFreq(Number(e.target.value))}
              >
                <option value={4}>Quarterly (most banks)</option>
                <option value={12}>Monthly</option>
                <option value={1}>Annual</option>
              </select>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <input
                type="checkbox"
                checked={senior}
                onChange={(e) => setSenior(e.target.checked)}
                className="h-4 w-4 accent-brand-indigo"
              />
              <span className="text-text-secondary">
                <strong className="text-ink">Senior citizen</strong> — extra 0.5% rate +
                ₹50K TDS exemption
              </span>
            </label>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {!canCalc ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-text-muted">
                Enter principal, rate (≥1%), and tenure (1–50 years).
              </div>
            ) : !data ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-text-muted">
                Calculating…
              </div>
            ) : (
              <>
                {/* KPI cards */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Maturity</div>
                    <p className="mt-1 text-2xl font-extrabold tracking-tight text-emerald-700 numeric">
                      {fmtINRShort(data.maturity_amount)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-emerald-800/80 numeric">{formatINR(data.maturity_amount)}</p>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Interest earned</div>
                    <p className="mt-1 text-2xl font-extrabold tracking-tight text-amber-700 numeric">
                      {fmtINRShort(data.total_interest)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-amber-800/80">over {yearsNum} year{yearsNum > 1 ? "s" : ""}</p>
                  </div>
                  <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-brand-indigo">Effective yield</div>
                    <p className="mt-1 text-2xl font-extrabold tracking-tight text-brand-indigo numeric">
                      {data.effective_annual_yield.toFixed(2)}%
                    </p>
                    <p className="mt-0.5 text-[11px] text-indigo-800/80">
                      {yieldBoost > 0.005 ? `+${yieldBoost.toFixed(2)}% from compounding` : `Quoted rate ${rateNum}%`}
                    </p>
                  </div>
                </div>

                {/* Principal vs Interest breakdown bar */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      Principal vs interest in your maturity
                    </p>
                    <span className="text-[11px] text-text-muted">100% = maturity amount</span>
                  </div>
                  <div className="mt-3 flex h-7 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="flex items-center justify-center bg-slate-400 transition-all duration-500"
                      style={{ width: `${principalPct}%` }}
                    >
                      {principalPct >= 10 ? (
                        <span className="px-1 text-[10px] font-bold text-white">{principalPct.toFixed(0)}%</span>
                      ) : null}
                    </div>
                    <div
                      className="flex items-center justify-center bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500"
                      style={{ width: `${interestPct}%` }}
                    >
                      {interestPct >= 10 ? (
                        <span className="px-1 text-[10px] font-bold text-white">{interestPct.toFixed(0)}%</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-slate-400" />
                      <span className="font-semibold text-ink">Your money in</span>
                      <span className="text-text-muted numeric">{formatINR(principalNum)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                      <span className="font-semibold text-ink">Interest accrued</span>
                      <span className="text-text-muted numeric">{formatINR(data.total_interest)}</span>
                    </div>
                  </div>
                </div>

                {/* Donut + footnote */}
                <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" innerRadius={42} outerRadius={62} startAngle={90} endAngle={-270} strokeWidth={0}>
                          {pieData.map((d) => (
                            <Cell key={d.name} fill={d.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: 10, fontSize: 11, borderColor: "#e2e8f0" }}
                          formatter={(v: number) => formatINR(v)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 text-[11.5px] leading-relaxed">
                    <p className="text-text-secondary">
                      Your <strong className="text-ink">{formatINR(principalNum)}</strong> grows to{" "}
                      <strong className="text-emerald-700">{formatINR(data.maturity_amount)}</strong> in {yearsNum} year
                      {yearsNum > 1 ? "s" : ""} thanks to compounding{" "}
                      <strong>{freq === 12 ? "monthly" : freq === 4 ? "quarterly" : "annually"}</strong>.
                    </p>
                    {data.tds_note ? (
                      <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-amber-900">
                        <strong>TDS:</strong> {data.tds_note}
                      </p>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <WidgetHelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        Icon={Landmark}
        title="How a Fixed Deposit grows"
        subtitle="Bank-guaranteed compounding — predictable but tax-eligible."
        steps={[
          {
            index: 1,
            title: "You lock in a principal at a fixed rate",
            tone: "indigo",
            body: (
              <>
                You hand the bank a lump sum (the <strong>principal</strong>) for a fixed period. The bank
                guarantees a quoted <strong>annual rate</strong> for that whole tenure — even if rates fall outside.
              </>
            ),
          },
          {
            index: 2,
            title: "Interest is added back at each compounding step",
            tone: "emerald",
            body: (
              <>
                Most banks compound <strong>quarterly</strong> (4× / year). At each step, the bank pays interest on
                principal <em>plus</em> interest already accrued — that's why{" "}
                <strong>effective yield</strong> is slightly higher than the quoted rate.
              </>
            ),
          },
          {
            index: 3,
            title: "TDS may apply on the interest",
            tone: "amber",
            body: (
              <>
                Banks deduct <strong>10% TDS</strong> if FD interest crosses ₹40,000 per financial year (₹50,000 for
                senior citizens). You can submit Form 15G/15H to skip this if your total income is below the taxable
                threshold.
              </>
            ),
          },
        ]}
        formula={
          <>
            Maturity = P × (1 + r/n)<sup>n × t</sup>
            <br />
            <span className="text-slate-400">P = principal, r = annual rate, n = compounding/year, t = years</span>
          </>
        }
        example={{
          lines: [
            <><strong className="text-ink">Principal</strong> = ₹1,00,000, <strong>r</strong> = 7%, <strong>t</strong> = 5y, quarterly compounding (n=4)</>,
            <>(1 + 0.07/4) = 1.0175 per quarter</>,
            <>1.0175<sup>20</sup> ≈ <strong>1.4148</strong></>,
            <>Maturity ≈ <strong className="text-emerald-700">₹1,41,478</strong> · interest <strong className="text-amber-700">₹41,478</strong> (effective yield ≈ <strong>7.19%</strong>)</>,
          ],
        }}
        tips={[
          <><strong>Compounding frequency</strong> matters — monthly beats quarterly beats annual at the same rate.</>,
          <><strong>Senior citizen FDs</strong> usually pay 0.5% extra. Use a parent's account if applicable.</>,
          <><strong>Premature withdrawal</strong> typically costs 0.5–1% rate penalty — only break if essential.</>,
          <><strong>Laddering</strong> (split FD into 3–4 maturities) gives you liquidity without losing rate.</>,
        ]}
        footnote="Educational only. Actual rates vary by bank and tenure; check your bank's current rate card before locking in."
      />
    </>
  );
}
