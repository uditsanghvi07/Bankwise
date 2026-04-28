"use client";

import { Shield } from "lucide-react";

const QUICK = [
  { label: "Calculate Home Loan EMI", message: "What would my EMI be on a ₹50 lakh home loan at 8.5% for 20 years?" },
  { label: "Check My Loan Eligibility", message: "I want to check my home loan eligibility — I earn ₹80,000 per month with ₹15,000 existing EMIs." },
  { label: "Compare Loan Options", message: "Compare 8.5% vs 9% on a ₹50 lakh loan for 20 years." },
  { label: "Plan my SIP Investment", message: "I want to plan a ₹10,000 monthly SIP for 10 years at 12% expected return." },
  { label: "Understand My CIBIL Score", message: "How can I improve my CIBIL score from 650 over the next year?" },
  { label: "FD Maturity Calculator", message: "What is the maturity on ₹1,00,000 FD at 7% for 5 years with quarterly compounding?" },
];

export function Sidebar({
  onNewChat,
  onQuick,
  onCompare,
  mobileOpen,
  onCloseMobile,
}: {
  onNewChat: () => void;
  onQuick: (m: string) => void;
  onCompare: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const panel = (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-border bg-surface/90 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-surface/80">
      <div className="flex items-center gap-2 px-4 py-4">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <div className="text-sm font-semibold text-primary">BankWise AI</div>
          <div className="text-xs text-text-muted">Advisory</div>
        </div>
      </div>
      <div className="mx-4 border-t border-border" />
      <div className="p-4">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            onCloseMobile();
          }}
          className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-white shadow-sm"
        >
          New Chat
        </button>
      </div>
      <div className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">Quick tools</div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-4">
        {QUICK.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => {
              onQuick(q.message);
              onCloseMobile();
            }}
            className="rounded-lg px-3 py-2 text-left text-sm text-text-primary hover:bg-primary-light"
          >
            {q.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            onCompare();
            onCloseMobile();
          }}
          className="rounded-lg px-3 py-2 text-left text-sm font-medium text-primary hover:bg-primary-light"
        >
          Compare (structured)
        </button>
      </nav>
      <div className="mt-auto space-y-2 border-t border-border p-4 text-xs text-text-muted">
        <p>
          BankWise AI provides professional financial insights and informational support, but it is not a substitute for official documentation, approvals, or decisions from your bank or a licensed financial adviser.
        </p>
        <p className="text-text-secondary">v1.0.0</p>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden h-full md:flex">{panel}</div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={onCloseMobile} />
          <div className="relative z-50 h-full shadow-xl">{panel}</div>
        </div>
      ) : null}
    </>
  );
}
