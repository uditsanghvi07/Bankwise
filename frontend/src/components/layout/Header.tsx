"use client";

import type { ReactNode } from "react";
import { Menu } from "lucide-react";

export function Header({ onMenu, rightSlot }: { onMenu?: () => void; rightSlot?: ReactNode }) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/85 px-3 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/70 md:px-5">
      <div className="flex items-center gap-2">
        {onMenu ? (
          <button type="button" className="rounded-lg p-2 md:hidden" aria-label="Open menu" onClick={onMenu}>
            <Menu className="h-5 w-5 text-ink" />
          </button>
        ) : null}
        <h1 className="bg-gradient-to-r from-brand-indigo to-brand-violet bg-clip-text text-sm font-bold tracking-tight text-transparent md:text-base">
          BankWise AI
        </h1>
      </div>
      <div className="flex items-center gap-2">
        {rightSlot}
        <span className="hidden rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 sm:inline">Live</span>
      </div>
    </header>
  );
}
