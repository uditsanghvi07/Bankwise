"use client";

import { Menu } from "lucide-react";

export function Header({ onMenu }: { onMenu?: () => void }) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface/90 px-4 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-surface/75 md:px-6">
      <div className="flex items-center gap-2">
        {onMenu ? (
          <button type="button" className="rounded-lg p-2 md:hidden" aria-label="Open menu" onClick={onMenu}>
            <Menu className="h-5 w-5 text-text-primary" />
          </button>
        ) : null}
        <h1 className="text-sm font-semibold text-text-primary md:text-base">BankWise AI</h1>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">Online</span>
      </div>
    </header>
  );
}
