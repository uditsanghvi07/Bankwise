"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HelpCircle, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function MetricCard({
  icon: Icon,
  title,
  value,
  hint,
  explanation,
  tone = "default",
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  hint?: string;
  explanation: string;
  tone?: "default" | "danger" | "success" | "warn";
}) {
  const [open, setOpen] = useState(false);

  const valueClass =
    tone === "danger"
      ? "text-rose-700"
      : tone === "success"
        ? "text-emerald-700"
        : tone === "warn"
          ? "text-amber-700"
          : "text-ink";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Fixed top section — never moves */}
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-muted">
            <Icon className="h-4 w-4" />
            {title}
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={`flex h-7 w-7 items-center justify-center rounded-full border transition ${
              open
                ? "border-brand-indigo/40 bg-brand-indigo/10 text-brand-indigo"
                : "border-slate-200 bg-white text-slate-400 hover:border-brand-indigo/30 hover:text-brand-indigo"
            }`}
            aria-label={open ? "Close explanation" : `What is ${title}?`}
          >
            {open ? <X className="h-3.5 w-3.5" /> : <HelpCircle className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className={`mt-3 text-3xl font-extrabold tracking-tight ${valueClass}`}>{value}</p>
        {hint ? <p className="mt-1 text-xs text-text-secondary">{hint}</p> : null}
      </div>

      {/* Expands BELOW — pushes card height down, never overlays */}
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="explain"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-indigo-100 bg-indigo-50/80 px-4 py-3">
              <p className="text-xs leading-relaxed text-indigo-900">{explanation}</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
