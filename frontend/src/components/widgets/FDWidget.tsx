"use client";

import { Landmark } from "lucide-react";
import { useEffect, useState } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

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

export function FDWidget({ params }: { params: Record<string, unknown> }) {
  const { calculateFd } = useCalculator();
  const [principalStr, setPrincipalStr] = useState(() => intStringFromNumber(Number(params.principal ?? 100_000)));
  const [rateStr, setRateStr] = useState(() => decimalStringFromNumber(Number(params.annual_rate ?? 7)));
  const [yearsStr, setYearsStr] = useState(() => intStringFromNumber(Number(params.tenure_years ?? 5)));
  const [freq, setFreq] = useState<number>(Number(params.compounding_frequency ?? 4));
  const [senior, setSenior] = useState(Boolean(params.senior_citizen ?? false));
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

  const pie = data
    ? [
        { name: "Principal", value: principalNum },
        { name: "Interest", value: Math.max(data.total_interest, 0) },
      ]
    : [];

  return (
    <div className="rounded-xl border border-border bg-surface/95 p-4 shadow-card backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-2">
        <Landmark className="h-5 w-5 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">FD maturity</h3>
      </div>
      <div className="grid gap-2 md:grid-cols-4">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="rounded-lg border border-border px-2 py-1 text-sm numeric"
          value={principalStr}
          onChange={(e) => setPrincipalStr(sanitizeDigitString(e.target.value))}
        />
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className="rounded-lg border border-border px-2 py-1 text-sm numeric"
          value={rateStr}
          onChange={(e) => setRateStr(sanitizeDecimalString(e.target.value))}
        />
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="rounded-lg border border-border px-2 py-1 text-sm numeric"
          value={yearsStr}
          onChange={(e) => setYearsStr(sanitizeDigitString(e.target.value))}
        />
        <select className="rounded-lg border border-border px-2 py-1 text-sm" value={freq} onChange={(e) => setFreq(Number(e.target.value))}>
          <option value={4}>Quarterly compounding</option>
          <option value={12}>Monthly compounding</option>
          <option value={1}>Annual compounding</option>
        </select>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
        <input type="checkbox" checked={senior} onChange={(e) => setSenior(e.target.checked)} />
        Senior citizen (TDS threshold)
      </label>
      {!canCalc ? (
        <div className="mt-2 text-sm text-text-muted">Enter principal, rate, and years to see maturity.</div>
      ) : data ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="text-sm">
            <div className="text-xs text-text-secondary">Maturity</div>
            <div className="text-xl font-semibold text-primary numeric">{formatINR(data.maturity_amount)}</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-text-muted">Interest</div>
                <div className="numeric text-warning">{formatINR(data.total_interest)}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted">Effective yield</div>
                <div className="numeric">{formatPercent(data.effective_annual_yield, 2)}</div>
              </div>
            </div>
            {data.tds_note ? <p className="mt-2 text-xs text-text-muted">{data.tds_note}</p> : null}
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" innerRadius={45} outerRadius={65}>
                  <Cell fill="#028174" />
                  <Cell fill="#0AB68B" />
                </Pie>
                <Tooltip formatter={(v: number) => formatINR(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="mt-2 text-sm text-text-muted">Calculating…</div>
      )}
    </div>
  );
}
