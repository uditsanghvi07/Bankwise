"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export function ScenarioWizardModal({
  open,
  onClose,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: (message: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [income, setIncome] = useState("");
  const [obligations, setObligations] = useState("");
  const [loanType, setLoanType] = useState<"home" | "personal" | "car" | "business">("home");

  function reset() {
    setStep(0);
    setIncome("");
    setObligations("");
    setLoanType("home");
  }

  function finish() {
    const inc = income.trim() || "80000";
    const ob = obligations.trim() || "0";
    const msg = `Guided scenario: I earn ₹${inc} per month with ₹${ob} in existing EMIs. I want a ${loanType} loan — walk me through FOIR headroom, a sensible EMI range, and what documents banks usually ask for.`;
    onComplete(msg);
    reset();
    onClose();
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button type="button" className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-brand-indigo">Scenario mode</p>
                <h2 className="text-lg font-bold text-ink">Guided loan workflow</h2>
              </div>
              <button type="button" className="rounded-lg p-2 hover:bg-slate-100" onClick={onClose} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 flex gap-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-brand-indigo" : "bg-slate-200"}`} />
              ))}
            </div>
            {step === 0 ? (
              <div className="mt-5 space-y-3">
                <label className="block text-sm font-medium text-ink">Net monthly income (₹)</label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-indigo/30 focus:ring-2"
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                  placeholder="e.g. 80000"
                />
                <button
                  type="button"
                  className="mt-2 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white"
                  onClick={() => setStep(1)}
                >
                  Continue
                </button>
              </div>
            ) : null}
            {step === 1 ? (
              <div className="mt-5 space-y-3">
                <label className="block text-sm font-medium text-ink">Existing EMI obligations (₹ / month)</label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-indigo/30 focus:ring-2"
                  value={obligations}
                  onChange={(e) => setObligations(e.target.value)}
                  placeholder="e.g. 15000"
                />
                <div className="flex gap-2">
                  <button type="button" className="flex-1 rounded-xl border border-slate-200 py-2 text-sm" onClick={() => setStep(0)}>
                    Back
                  </button>
                  <button type="button" className="flex-1 rounded-xl bg-slate-900 py-2 text-sm font-semibold text-white" onClick={() => setStep(2)}>
                    Continue
                  </button>
                </div>
              </div>
            ) : null}
            {step === 2 ? (
              <div className="mt-5 space-y-3">
                <label className="block text-sm font-medium text-ink">Loan type</label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-indigo/30 focus:ring-2"
                  value={loanType}
                  onChange={(e) => setLoanType(e.target.value as typeof loanType)}
                >
                  <option value="home">Home</option>
                  <option value="personal">Personal</option>
                  <option value="car">Car</option>
                  <option value="business">Business</option>
                </select>
                <div className="flex gap-2">
                  <button type="button" className="flex-1 rounded-xl border border-slate-200 py-2 text-sm" onClick={() => setStep(1)}>
                    Back
                  </button>
                  <button type="button" className="flex-1 rounded-xl bg-gradient-to-r from-brand-indigo to-brand-violet py-2 text-sm font-semibold text-white" onClick={finish}>
                    Run scenario
                  </button>
                </div>
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
