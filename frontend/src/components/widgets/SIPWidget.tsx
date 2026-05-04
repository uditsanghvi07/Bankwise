"use client";

import { HelpCircle, Sparkles, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

export function SIPWidget({ params }: { params: Record<string, unknown> }) {
  const { calculateSip } = useCalculator();
  const [sipStr, setSipStr] = useState(() => intStringFromNumber(Number(params.monthly_sip ?? 10_000)));
  const [rateStr, setRateStr] = useState(() => decimalStringFromNumber(Number(params.annual_rate ?? 12)));
  const [yearsStr, setYearsStr] = useState(() => intStringFromNumber(Number(params.tenure_years ?? 10)));
  const [helpOpen, setHelpOpen] = useState(false);
  const [data, setData] = useState<{
    maturity_amount: number;
    total_invested: number;
    total_gains: number;
    gains_percentage: number;
    yearly: { year: number; corpus: number; invested: number }[];
  } | null>(null);

  const sipNum = parseDigitsInt(sipStr);
  const rateNum = parseDecimalInput(rateStr);
  const yearsNum = parseDigitsInt(yearsStr);
  const canCalc = sipNum > 0 && rateNum >= 0 && yearsNum >= 1 && yearsNum <= 40;

  useEffect(() => {
    let c = false;
    (async () => {
      if (!canCalc) {
        if (!c) setData(null);
        return;
      }
      const res = await calculateSip({ monthly_sip: sipNum, annual_rate: rateNum, tenure_years: yearsNum });
      if (!c && res) setData(res as typeof data);
    })();
    return () => {
      c = true;
    };
  }, [calculateSip, canCalc, rateNum, sipNum, yearsNum]);

  const chart = useMemo(() => {
    if (!data?.yearly) return [];
    return data.yearly.map((y) => ({
      year: `Y${y.year}`,
      invested: y.invested,
      gains: Math.max(y.corpus - y.invested, 0),
    }));
  }, [data]);

  const investedPct = data && data.maturity_amount > 0 ? (data.total_invested / data.maturity_amount) * 100 : 0;
  const gainsPct = 100 - investedPct;
  const multiplier = data && data.total_invested > 0 ? data.maturity_amount / data.total_invested : 0;

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-indigo to-brand-violet text-white shadow-sm">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-ink">SIP planner</h3>
              <p className="text-[11px] text-text-muted">Monthly Systematic Investment Plan growth — compounded.</p>
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
              <span className={FIELD_LABEL}>Monthly SIP (₹)</span>
              <input
                type="text" inputMode="numeric" autoComplete="off"
                className={FIELD_INPUT}
                value={sipStr}
                onChange={(e) => setSipStr(sanitizeDigitString(e.target.value))}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className={FIELD_LABEL}>Return % p.a.</span>
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
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-text-secondary">
              <strong className="text-ink">Tip:</strong> Long-run Indian equity index funds have averaged ~10–12% p.a.
              Plug in <strong>8%</strong> for a conservative plan, <strong>14%</strong> for an optimistic one.
            </div>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {!canCalc ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-text-muted">
                Enter monthly SIP and 1–40 years to project growth.
              </div>
            ) : !data ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-text-muted">
                Projecting…
              </div>
            ) : (
              <>
                {/* KPI cards */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      Maturity in {yearsNum}y
                    </div>
                    <p className="mt-1 text-2xl font-extrabold tracking-tight text-emerald-700 numeric">
                      {fmtINRShort(data.maturity_amount)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-emerald-800/80 numeric">{formatINR(data.maturity_amount)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                      You will invest
                    </div>
                    <p className="mt-1 text-xl font-extrabold tracking-tight text-ink numeric">
                      {fmtINRShort(data.total_invested)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      ₹{Math.round(sipNum / 1000)}K × 12 × {yearsNum}y
                    </p>
                  </div>
                  <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-brand-indigo">
                      Wealth created
                    </div>
                    <p className="mt-1 text-xl font-extrabold tracking-tight text-brand-indigo numeric">
                      {fmtINRShort(data.total_gains)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-indigo-800/80">
                      <Sparkles className="mr-0.5 inline h-3 w-3" />
                      {multiplier.toFixed(2)}× your money
                    </p>
                  </div>
                </div>

                {/* Invested vs Gains breakdown bar */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      What grows your money: capital vs market gains
                    </p>
                    <span className="text-[11px] text-text-muted">100% = maturity corpus</span>
                  </div>
                  <div className="mt-3 flex h-7 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="flex items-center justify-center bg-slate-400 transition-all duration-500"
                      style={{ width: `${investedPct}%` }}
                      title={`Invested · ${investedPct.toFixed(0)}%`}
                    >
                      {investedPct >= 10 ? (
                        <span className="px-1 text-[10px] font-bold text-white">{investedPct.toFixed(0)}%</span>
                      ) : null}
                    </div>
                    <div
                      className="flex items-center justify-center bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500"
                      style={{ width: `${gainsPct}%` }}
                      title={`Market gains · ${gainsPct.toFixed(0)}%`}
                    >
                      {gainsPct >= 10 ? (
                        <span className="px-1 text-[10px] font-bold text-white">{gainsPct.toFixed(0)}%</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-slate-400" />
                      <span className="font-semibold text-ink">Your money in</span>
                      <span className="text-text-muted numeric">{formatINR(data.total_invested)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                      <span className="font-semibold text-ink">Compound growth</span>
                      <span className="text-text-muted numeric">{formatINR(data.total_gains)}</span>
                    </div>
                  </div>
                </div>

                {/* Stacked area chart */}
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="px-1 text-[11px] font-semibold text-text-muted">
                    Year-by-year: invested (grey) vs gains (green) stack up to your corpus.
                  </p>
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chart} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="sip-grad-i" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.6} />
                            <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.1} />
                          </linearGradient>
                          <linearGradient id="sip-grad-g" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.65} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0.1} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="year" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis fontSize={10} tickFormatter={(v) => fmtINRShort(Number(v))} tickLine={false} axisLine={false} width={56} />
                        <Tooltip
                          contentStyle={{ borderRadius: 10, fontSize: 11, borderColor: "#e2e8f0" }}
                          formatter={(v: number, name: string) => [formatINR(v), name === "invested" ? "Invested" : "Gains"]}
                        />
                        <Area type="monotone" dataKey="invested" stackId="1" stroke="#94a3b8" fill="url(#sip-grad-i)" strokeWidth={1.5} />
                        <Area type="monotone" dataKey="gains" stackId="1" stroke="#10b981" fill="url(#sip-grad-g)" strokeWidth={1.5} />
                      </AreaChart>
                    </ResponsiveContainer>
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
        Icon={TrendingUp}
        title="How a SIP grows your money"
        subtitle="Compounding + monthly discipline = the magic."
        steps={[
          {
            index: 1,
            title: "You invest a fixed amount every month",
            tone: "indigo",
            body: (
              <>
                A <strong>SIP</strong> (Systematic Investment Plan) auto-debits ₹X from your bank into a mutual fund
                on a fixed date every month. You buy more units when markets fall, fewer when they rise — this is
                called <strong>rupee-cost averaging</strong>.
              </>
            ),
          },
          {
            index: 2,
            title: "Each instalment grows on its own time scale",
            tone: "emerald",
            body: (
              <>
                The first SIP earns returns for the full duration; the last instalment compounds for only one month.
                Each contribution becomes its own little snowball.
              </>
            ),
          },
          {
            index: 3,
            title: "Maturity = sum of all those snowballs",
            tone: "amber",
            body: (
              <>
                The calculator compounds every month at <strong>r/12</strong> for the remaining months.
                The longer the horizon, the larger the share of <strong>gains</strong> in the bar above.
              </>
            ),
          },
        ]}
        formula={
          <>
            FV = P × [ ((1 + i)<sup>n</sup> − 1) / i ] × (1 + i)
            <br />
            <span className="text-slate-400">where i = r / 12, n = years × 12, P = monthly SIP</span>
          </>
        }
        example={{
          lines: [
            <><strong className="text-ink">SIP</strong> = ₹10,000/mo, <strong>r</strong> = 12%, <strong>n</strong> = 10 years</>,
            <>i = 12% / 12 = <strong>1% per month</strong>; n = <strong>120 months</strong></>,
            <>You invest ₹10,000 × 120 = <strong className="text-ink">₹12 L</strong> total</>,
            <>Maturity ≈ <strong className="text-emerald-700">₹23.2 L</strong> · gains <strong className="text-emerald-700">~₹11.2 L</strong> (almost 2× your capital).</>,
          ],
        }}
        tips={[
          <><strong>Time</strong> is the strongest lever. 5 extra years at the same SIP can almost double the corpus.</>,
          <><strong>Rate</strong> is the second lever — but stay realistic; nobody guarantees 15%.</>,
          <><strong>Step-up SIP</strong> (raise SIP 10% per year) supercharges results — try modelling that yourself.</>,
          <><strong>Inflation</strong> eats ~6% of your real return — a 12% nominal SIP is only ~5.7% real.</>,
        ]}
        footnote="Educational only. Mutual fund returns are not guaranteed; past performance does not predict future results."
      />
    </>
  );
}
