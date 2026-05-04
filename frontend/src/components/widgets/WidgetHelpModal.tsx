"use client";

import { useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Calculator, Lightbulb, ShieldCheck, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface HelpStep {
  /** 1 / 2 / 3 etc. — shown in the coloured pill */
  index: number;
  title: string;
  body: ReactNode;
  /** soft tinted accent — defaults to indigo */
  tone?: "indigo" | "emerald" | "amber" | "rose";
}

export interface WidgetHelpModalProps {
  open: boolean;
  onClose: () => void;
  /** Header */
  title: string;
  subtitle?: string;
  Icon?: LucideIcon;
  /** Numbered explanation steps (3-6 work best) */
  steps: HelpStep[];
  /** Optional core formula shown in monospace */
  formula?: ReactNode;
  /** Optional worked example with mini-steps */
  example?: { title?: string; lines: ReactNode[] };
  /** Optional list of tips — shown last in a rose card */
  tips?: ReactNode[];
  /** Extra footnote — small grey text */
  footnote?: ReactNode;
}

const TONE_MAP = {
  indigo: { card: "border-indigo-100 bg-indigo-50/60", pill: "bg-brand-indigo" },
  emerald: { card: "border-emerald-100 bg-emerald-50/60", pill: "bg-emerald-600" },
  amber: { card: "border-amber-100 bg-amber-50/60", pill: "bg-amber-600" },
  rose: { card: "border-rose-100 bg-rose-50/60", pill: "bg-rose-600" },
} as const;

/** Reusable explainer modal used across BankWise widgets (SIP, FD, CIBIL, …). */
export function WidgetHelpModal({
  open,
  onClose,
  title,
  subtitle,
  Icon = BookOpen,
  steps,
  formula,
  example,
  tips,
  footnote,
}: WidgetHelpModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className="relative z-10 max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="widget-help-title"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 rounded-t-2xl bg-gradient-to-r from-brand-indigo via-indigo-600 to-brand-violet px-5 py-4 text-white">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 id="widget-help-title" className="text-lg font-bold">{title}</h3>
                  {subtitle ? (
                    <p className="mt-0.5 text-xs text-indigo-100">{subtitle}</p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-white/25"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 px-5 py-5 text-sm text-text-primary">
              {steps.map((s) => {
                const tone = TONE_MAP[s.tone ?? "indigo"];
                return (
                  <section key={s.index} className={`rounded-xl border ${tone.card} p-4`}>
                    <div className="flex items-center gap-2">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${tone.pill}`}>
                        {s.index}
                      </span>
                      <h4 className="text-sm font-bold text-ink">{s.title}</h4>
                    </div>
                    <div className="mt-2 leading-relaxed text-text-secondary">{s.body}</div>
                  </section>
                );
              })}

              {formula ? (
                <div className="rounded-xl bg-slate-900 p-4 font-mono text-[13px] text-emerald-200 shadow-inner">
                  {formula}
                </div>
              ) : null}

              {example ? (
                <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-brand-indigo" />
                    <h4 className="text-sm font-bold text-ink">{example.title ?? "Worked example"}</h4>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs">
                    {example.lines.map((line, i) => (
                      <li key={i} className="rounded-md bg-white px-3 py-1.5 leading-relaxed">
                        {line}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {tips && tips.length > 0 ? (
                <section className="rounded-xl border border-rose-100 bg-rose-50/60 p-4">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-rose-700" />
                    <h4 className="text-sm font-bold text-ink">Things that move the result</h4>
                  </div>
                  <ul className="mt-2 space-y-1.5 text-xs text-rose-900">
                    {tips.map((t, i) => (
                      <li key={i} className="flex gap-2">
                        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {footnote ? (
                <p className="text-[11px] leading-relaxed text-text-muted">{footnote}</p>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
