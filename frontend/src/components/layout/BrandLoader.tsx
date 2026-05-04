"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

const TIPS = [
  "Tightening the EMI math…",
  "Crunching FOIR against your income…",
  "Stress-testing 3 return paths (Nifty / EPF / FD)…",
  "Adjusting for ~6% inflation drag…",
  "Cross-checking RBI repo rate context…",
  "Drafting an honest verdict, not a sales pitch…",
  "Citing the knowledge base before answering…",
  "Looking up the cheapest realistic SIP for your goal…",
];

export function BrandLoader({
  title = "BankWise is thinking…",
  subtitle,
  variant = "page",
  tips = TIPS,
}: {
  title?: string;
  subtitle?: string;
  variant?: "page" | "panel";
  tips?: string[];
}) {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTipIndex((i) => (i + 1) % tips.length), 1800);
    return () => clearInterval(id);
  }, [tips.length]);

  const wrapper =
    variant === "page"
      ? "fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white"
      : "flex w-full items-center justify-center rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-6 py-10 text-white shadow-xl";

  const orbits = useMemo(
    () => [
      { size: 120, duration: 6, color: "rgba(165,180,252,0.65)" },
      { size: 168, duration: 9, color: "rgba(167,139,250,0.5)" },
      { size: 220, duration: 14, color: "rgba(244,114,182,0.35)" },
    ],
    [],
  );

  return (
    <div className={wrapper}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-1/3 h-72 w-72 rounded-full bg-indigo-500/25 blur-[120px]" />
        <div className="absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-[140px]" />
      </div>

      <div className="relative flex flex-col items-center gap-6 px-6 text-center">
        <div className="relative flex h-56 w-56 items-center justify-center">
          {orbits.map((o, idx) => (
            <motion.span
              key={idx}
              aria-hidden
              className="absolute rounded-full border"
              style={{
                width: o.size,
                height: o.size,
                borderColor: o.color,
                borderStyle: idx === 1 ? "dashed" : "solid",
              }}
              animate={{ rotate: idx % 2 === 0 ? 360 : -360 }}
              transition={{ duration: o.duration, repeat: Infinity, ease: "linear" }}
            />
          ))}

          {orbits.map((o, idx) => (
            <motion.span
              key={`dot-${idx}`}
              aria-hidden
              className="absolute h-2.5 w-2.5 rounded-full"
              style={{
                background: idx === 0 ? "#a5b4fc" : idx === 1 ? "#c4b5fd" : "#f0abfc",
                boxShadow: `0 0 14px ${o.color}`,
              }}
              animate={{ rotate: idx % 2 === 0 ? 360 : -360 }}
              transition={{ duration: o.duration, repeat: Infinity, ease: "linear" }}
              initial={false}
            >
              <span
                className="absolute"
                style={{ transform: `translate(${o.size / 2}px, -1px)` }}
              />
            </motion.span>
          ))}

          <motion.div
            className="relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-500 shadow-[0_0_28px_rgba(167,139,250,0.55),0_0_60px_rgba(99,102,241,0.45)]"
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="h-9 w-9 text-white" />
          </motion.div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-indigo-300">BankWise AI</p>
          <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h2>
          {subtitle ? (
            <p className="mx-auto max-w-md text-sm leading-relaxed text-slate-300">{subtitle}</p>
          ) : null}
        </div>

        <div className="relative h-6 w-full max-w-md overflow-hidden">
          {tips.map((tip, i) => (
            <motion.p
              key={tip}
              className="absolute inset-0 text-center text-sm text-indigo-200"
              initial={{ opacity: 0, y: 14 }}
              animate={{
                opacity: i === tipIndex ? 1 : 0,
                y: i === tipIndex ? 0 : -14,
              }}
              transition={{ duration: 0.5 }}
            >
              {tip}
            </motion.p>
          ))}
        </div>

        <div className="relative h-1 w-56 overflow-hidden rounded-full bg-white/10">
          <motion.span
            className="absolute inset-y-0 w-24 rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400"
            animate={{ x: ["-100%", "260%"] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </div>
    </div>
  );
}
