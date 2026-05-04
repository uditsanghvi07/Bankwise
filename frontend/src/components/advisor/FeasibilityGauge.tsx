"use client";

import { motion } from "framer-motion";

/**
 * Professional semi-circle gauge showing "how hard is this goal?"
 *
 * Zones:
 *   0 – 80%   → GREEN   "Easy: fits your current savings"
 *   80 – 130% → AMBER   "Stretched: possible with discipline"
 *   130 – 200%→ RED     "Rethink: goal is too big for now"
 *
 * The needle angle goes from -90° (left = 0%) to +90° (right = 200%).
 */

const W = 320;
const H = 195;
const CX = W / 2;
const CY = 165;
const R_OUTER = 130;
const R_INNER = 90;

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

function annularSlice(
  cx: number, cy: number,
  r1: number, r2: number,
  startDeg: number, endDeg: number,
) {
  const s1 = polar(cx, cy, r1, startDeg);
  const e1 = polar(cx, cy, r1, endDeg);
  const s2 = polar(cx, cy, r2, endDeg);
  const e2 = polar(cx, cy, r2, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${s1.x} ${s1.y}`,
    `A ${r1} ${r1} 0 ${large} 1 ${e1.x} ${e1.y}`,
    `L ${s2.x} ${s2.y}`,
    `A ${r2} ${r2} 0 ${large} 0 ${e2.x} ${e2.y}`,
    "Z",
  ].join(" ");
}

// Total arc: -135° → +135° (270° sweep) mapped to 0% → 200%
const ARC_START = -135;
const ARC_END = 135;
const ARC_RANGE = ARC_END - ARC_START; // 270

function pctToAngle(pct: number) {
  const clamped = Math.max(0, Math.min(200, pct));
  return ARC_START + (clamped / 200) * ARC_RANGE;
}

const ZONES = [
  { from: 0, to: 80, color: "#22c55e", label: "Easy", labelPct: 40 },
  { from: 80, to: 130, color: "#f59e0b", label: "Stretched", labelPct: 105 },
  { from: 130, to: 200, color: "#f43f5e", label: "Hard", labelPct: 165 },
];

const TICKS = [0, 50, 100, 150, 200];

export function FeasibilityGauge({
  pctOfCurrentSavings,
  label,
}: {
  pctOfCurrentSavings: number;
  label: "conservative" | "on_track" | "ambitious" | "unrealistic";
}) {
  const needleAngle = pctToAngle(pctOfCurrentSavings);

  const moodText =
    label === "conservative"
      ? "Fits inside what you already save — no lifestyle change needed."
      : label === "on_track"
        ? "Very close to what your current savings can handle."
        : label === "ambitious"
          ? "Possible but tight. Push your deadline or grow your income."
          : "This goal needs far more than you save today — resize it.";

  const moodColor =
    label === "conservative" || label === "on_track"
      ? "text-emerald-700"
      : label === "ambitious"
        ? "text-amber-700"
        : "text-rose-700";

  const valueBg =
    label === "conservative" || label === "on_track"
      ? "bg-emerald-50 border-emerald-200"
      : label === "ambitious"
        ? "bg-amber-50 border-amber-200"
        : "bg-rose-50 border-rose-200";

  const valueTextColor =
    label === "conservative" || label === "on_track"
      ? "text-emerald-800"
      : label === "ambitious"
        ? "text-amber-800"
        : "text-rose-800";

  const friendly =
    pctOfCurrentSavings <= 100
      ? `${pctOfCurrentSavings.toFixed(0)}% of your savings`
      : `${(pctOfCurrentSavings / 100).toFixed(1)}× your monthly savings`;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xs" aria-hidden>
        <defs>
          {ZONES.map((z) => (
            <linearGradient
              key={z.color}
              id={`zone-grad-${z.color.replace("#", "")}`}
              x1="0%" y1="0%" x2="100%" y2="0%"
            >
              <stop offset="0%" stopColor={z.color} stopOpacity={0.7} />
              <stop offset="100%" stopColor={z.color} stopOpacity={1} />
            </linearGradient>
          ))}
        </defs>

        {/* Background track */}
        <path
          d={arcPath(CX, CY, (R_OUTER + R_INNER) / 2, ARC_START, ARC_END)}
          stroke="#e2e8f0"
          strokeWidth={R_OUTER - R_INNER}
          fill="none"
          strokeLinecap="butt"
        />

        {/* Coloured zone slices */}
        {ZONES.map((z) => (
          <path
            key={z.color}
            d={annularSlice(CX, CY, R_OUTER, R_INNER, pctToAngle(z.from), pctToAngle(z.to))}
            fill={z.color}
            opacity={0.85}
          />
        ))}

        {/* Tick marks */}
        {TICKS.map((t) => {
          const a = pctToAngle(t);
          const inner = polar(CX, CY, R_INNER - 6, a);
          const outer = polar(CX, CY, R_INNER - 1, a);
          const lp = polar(CX, CY, R_INNER - 18, a);
          return (
            <g key={t}>
              <line
                x1={inner.x} y1={inner.y}
                x2={outer.x} y2={outer.y}
                stroke="#fff" strokeWidth={2} strokeLinecap="round"
              />
              <text
                x={lp.x} y={lp.y}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={9} fill="#1e293b" fontWeight={700}
              >
                {t}%
              </text>
            </g>
          );
        })}

        {/* Zone labels inside the arc */}
        {ZONES.map((z) => {
          const mid = pctToAngle(z.labelPct);
          const p = polar(CX, CY, (R_OUTER + R_INNER) / 2, mid);
          return (
            <text
              key={z.label}
              x={p.x} y={p.y}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={9.5} fill="#1e293b" fontWeight={700}
            >
              {z.label}
            </text>
          );
        })}

        {/* Needle */}
        <motion.g
          initial={{ rotate: pctToAngle(0) - 90 }}
          animate={{ rotate: needleAngle - 90 }}
          style={{ originX: `${CX}px`, originY: `${CY}px` }}
          transition={{ duration: 1.1, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <line
            x1={CX} y1={CY}
            x2={CX} y2={CY - R_INNER + 8}
            stroke="#0f172a" strokeWidth={3} strokeLinecap="round"
          />
          <line
            x1={CX} y1={CY}
            x2={CX} y2={CY + 12}
            stroke="#0f172a" strokeWidth={2} strokeLinecap="round"
            opacity={0.3}
          />
        </motion.g>

        {/* Hub */}
        <circle cx={CX} cy={CY} r={9} fill="#0f172a" />
        <circle cx={CX} cy={CY} r={5} fill="#fff" />

        {/* Centre value */}
        <text
          x={CX} y={CY - 35}
          textAnchor="middle"
          fontSize={28} fontWeight={800} fill="#0f172a"
        >
          {Math.round(pctOfCurrentSavings)}%
        </text>
        <text
          x={CX} y={CY - 16}
          textAnchor="middle"
          fontSize={10} fill="#1e293b" fontWeight={600}
        >
          of monthly savings needed
        </text>
      </svg>

      {/* Value badge */}
      <span className={`inline-flex rounded-full border px-4 py-1 text-sm font-bold ${valueBg} ${valueTextColor}`}>
        {friendly}
      </span>

      {/* Plain-English verdict */}
      <p className={`text-center text-xs leading-relaxed ${moodColor}`}>{moodText}</p>

      {/* Zone reference legend */}
      <div className="mt-1 flex w-full justify-between px-2">
        {ZONES.map((z) => (
          <div key={z.label} className="flex items-center gap-1">
            <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: z.color }} />
            <span className="text-[10px] text-text-muted">{z.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
