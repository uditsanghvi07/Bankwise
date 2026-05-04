"use client";

import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Plus, Trash2 } from "lucide-react";

import type { ConversationSummary } from "@/lib/api";

function formatRelative(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function HistorySidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <button
        type="button"
        onClick={onNew}
        className="m-3 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-indigo to-brand-violet px-3 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-indigo/20 transition hover:opacity-95"
      >
        <Plus className="h-4 w-4" />
        New chat
      </button>
      <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">History</div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {conversations.length === 0 ? (
          <div className="px-3 py-4 text-xs text-text-muted">
            Your past conversations will appear here once you start chatting.
          </div>
        ) : (
          <ul className="space-y-1">
            <AnimatePresence initial={false}>
              {conversations.map((c) => {
                const active = c.id === activeId;
                return (
                  <motion.li
                    key={c.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    className="group relative"
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(c.id)}
                      className={`flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                        active
                          ? "bg-brand-indigo/10 text-ink ring-1 ring-brand-indigo/30"
                          : "text-text-secondary hover:bg-slate-100"
                      }`}
                    >
                      <MessageSquare className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "text-brand-indigo" : "text-slate-400"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 block font-medium">{c.title || "Untitled"}</span>
                        <span className="text-[11px] text-slate-400">{formatRelative(c.updated_at)}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Delete this conversation? This cannot be undone.")) onDelete(c.id);
                      }}
                      className="absolute right-1.5 top-1.5 hidden rounded-md p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600 group-hover:block"
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}
