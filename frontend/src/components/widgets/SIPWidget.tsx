"use client";

import { TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useCalculator } from "@/hooks/useCalculator";
import { formatINR, formatPercent } from "@/lib/formatters";
import {
  decimalStringFromNumber,
  intStringFromNumber,
  parseDecimalInput,
  parseDigitsInt,
  sanitizeDecimalString,
  sanitizeDigitString,
} from "@/lib/inputParsers";

export function SIPWidget({ params }: { params: Record<string, unknown> }) {
  const { calculateSip } = useCalculator();
  const [sipStr, setSipStr] = useState(() => intStringFromNumber(Number(params.monthly_sip ?? 10_000)));
  const [rateStr, setRateStr] = useState(() => decimalStringFromNumber(Number(params.annual_rate ?? 12)));
  const [yearsStr, setYearsStr] = useState(() => intStringFromNumber(Number(params.tenure_years ?? 10)));
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
      corpus: y.corpus,
    }));
  }, [data]);

  return (
    <div className="rounded-xl border border-border bg-surface/95 p-4 shadow-card backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">SIP planner</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm">
          <span className="text-text-secondary">Monthly SIP</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-border px-2 py-1 numeric"
            value={sipStr}
            onChange={(e) => setSipStr(sanitizeDigitString(e.target.value))}
          />
        </label>
        <label className="text-sm">
          <span className="text-text-secondary">Expected return % p.a.</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-border px-2 py-1 numeric"
            value={rateStr}
            onChange={(e) => setRateStr(sanitizeDecimalString(e.target.value))}
          />
        </label>
        <label className="text-sm">
          <span className="text-text-secondary">Years</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-border px-2 py-1 numeric"
            value={yearsStr}
            onChange={(e) => setYearsStr(sanitizeDigitString(e.target.value))}
          />
        </label>
      </div>
      {!canCalc ? (
        <div className="mt-2 text-sm text-text-muted">Enter monthly SIP and years to project (rate can be 0).</div>
      ) : data ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="space-y-1 text-sm">
            <div>
              <div className="text-xs text-text-secondary">Maturity corpus</div>
              <div className="text-xl font-semibold text-primary numeric">{formatINR(data.maturity_amount)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-text-muted">Invested</div>
                <div className="numeric">{formatINR(data.total_invested)}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted">Gains</div>
                <div className="numeric text-accent">{formatINR(data.total_gains)}</div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-text-muted">Gain %</div>
                <div className="numeric font-medium">{formatPercent(data.gains_percentage, 2)}</div>
              </div>
            </div>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" fontSize={10} />
                <YAxis fontSize={10} tickFormatter={(v) => `${(v / 1e5).toFixed(0)}L`} />
                <Tooltip formatter={(v: number) => formatINR(v)} />
                <Legend />
                <Area type="monotone" dataKey="invested" stackId="1" stroke="#028174" fill="#028174" name="Invested" />
                <Area type="monotone" dataKey="gains" stackId="1" stroke="#0AB68B" fill="#0AB68B" name="Gains" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="mt-2 text-sm text-text-muted">Projecting…</div>
      )}
    </div>
  );
}
