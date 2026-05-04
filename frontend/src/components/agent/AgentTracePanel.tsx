"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Cpu, Shield, Wrench } from "lucide-react";

import { useChatStore } from "@/store/chatStore";

function iconFor(step: string) {
  const s = step.toLowerCase();
  if (s === "safety") return Shield;
  if (s === "retrieve") return BookOpen;
  if (s === "tool") return Wrench;
  if (s === "critic") return Cpu;
  return Cpu;
}

export function AgentTracePanel() {
  const trace = useChatStore((s) => s.lastAgentTrace);
  const kbCitations = useChatStore((s) => s.lastKbCitations);

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-slate-200/80 bg-white/90 shadow-inner backdrop-blur-md lg:max-w-sm">
      <div className="shrink-0 border-b border-slate-200/80 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-indigo">Agent trace</p>
        <p className="text-xs text-text-muted">Observability · LangGraph steps</p>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        <AnimatePresence initial={false}>
          {trace.length === 0 ? (
            <p className="px-1 text-sm text-text-muted">Send a message to see safety → retrieval → model/tool loop.</p>
          ) : (
            trace.map((t, i) => {
              const Icon = iconFor(t.step || "");
              return (
                <motion.div
                  key={`${t.step}-${i}-${String(t.detail)}`}
                  layout
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                      <Icon className="h-4 w-4 text-brand-indigo" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink">{t.step}</p>
                      {t.detail ? <p className="text-xs text-text-secondary">{t.detail}</p> : null}
                      {t.meta && Object.keys(t.meta).length > 0 ? (
                        <pre className="mt-1 max-h-28 overflow-auto rounded-lg bg-slate-900/90 p-2 text-[10px] leading-snug text-slate-100">
                          {JSON.stringify(t.meta)}
                        </pre>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
      <div className="shrink-0 border-t border-slate-200/80 px-4 py-3">
        <p className="text-xs font-semibold text-text-secondary">KB citations</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {kbCitations.length === 0 ? (
            <span className="text-xs text-text-muted">—</span>
          ) : (
            kbCitations.map((c) => (
              <span key={c} className="rounded-md bg-brand-indigo/10 px-2 py-0.5 text-[11px] font-medium text-brand-indigo">
                {c}
              </span>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
