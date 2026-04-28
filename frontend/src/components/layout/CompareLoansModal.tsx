"use client";

import { X } from "lucide-react";
import { useState } from "react";

import {
  decimalStringFromNumber,
  intStringFromNumber,
  parseDecimalInput,
  parseDigitsInt,
  sanitizeDecimalString,
  sanitizeDigitString,
} from "@/lib/inputParsers";
import { useChatStore } from "@/store/chatStore";
import type { WidgetPayload } from "@/types";

type Row = { label: string; principalStr: string; rateStr: string; tenureStr: string };

export function CompareLoansModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [a, setA] = useState<Row>({
    label: "Option A",
    principalStr: intStringFromNumber(5_000_000),
    rateStr: decimalStringFromNumber(8.5),
    tenureStr: intStringFromNumber(240),
  });
  const [b, setB] = useState<Row>({
    label: "Option B",
    principalStr: intStringFromNumber(5_000_000),
    rateStr: decimalStringFromNumber(9),
    tenureStr: intStringFromNumber(240),
  });

  if (!open) return null;

  const submit = () => {
    const widget: WidgetPayload = {
      type: "loan_comparison",
      params: {
        loans: [
          {
            label: a.label,
            principal: parseDigitsInt(a.principalStr),
            annual_rate: parseDecimalInput(a.rateStr),
            tenure_months: parseDigitsInt(a.tenureStr),
          },
          {
            label: b.label,
            principal: parseDigitsInt(b.principalStr),
            annual_rate: parseDecimalInput(b.rateStr),
            tenure_months: parseDigitsInt(b.tenureStr),
          },
        ],
      },
    };
    useChatStore.getState().addUserMessage("Compare these two loan options (structured comparison).");
    useChatStore.getState().addAssistantMessage("Here is a structured comparison of the two options you entered.", widget, true);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl border border-border bg-surface/95 p-4 shadow-card backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Compare loans</h2>
          <button type="button" className="rounded p-1 hover:bg-primary-light" aria-label="Close" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-border p-3">
            <h3 className="text-xs font-semibold uppercase text-text-secondary">Option A</h3>
            <input className="w-full rounded border border-border px-2 py-1 text-sm" value={a.label} onChange={(e) => setA({ ...a, label: e.target.value })} />
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="w-full rounded border border-border px-2 py-1 text-sm numeric"
              value={a.principalStr}
              onChange={(e) => setA({ ...a, principalStr: sanitizeDigitString(e.target.value) })}
            />
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className="w-full rounded border border-border px-2 py-1 text-sm numeric"
              value={a.rateStr}
              onChange={(e) => setA({ ...a, rateStr: sanitizeDecimalString(e.target.value) })}
            />
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="w-full rounded border border-border px-2 py-1 text-sm numeric"
              value={a.tenureStr}
              onChange={(e) => setA({ ...a, tenureStr: sanitizeDigitString(e.target.value) })}
            />
          </div>
          <div className="space-y-2 rounded-lg border border-border p-3">
            <h3 className="text-xs font-semibold uppercase text-text-secondary">Option B</h3>
            <input className="w-full rounded border border-border px-2 py-1 text-sm" value={b.label} onChange={(e) => setB({ ...b, label: e.target.value })} />
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="w-full rounded border border-border px-2 py-1 text-sm numeric"
              value={b.principalStr}
              onChange={(e) => setB({ ...b, principalStr: sanitizeDigitString(e.target.value) })}
            />
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className="w-full rounded border border-border px-2 py-1 text-sm numeric"
              value={b.rateStr}
              onChange={(e) => setB({ ...b, rateStr: sanitizeDecimalString(e.target.value) })}
            />
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="w-full rounded border border-border px-2 py-1 text-sm numeric"
              value={b.tenureStr}
              onChange={(e) => setB({ ...b, tenureStr: sanitizeDigitString(e.target.value) })}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded-lg border border-border px-4 py-2 text-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="rounded-lg bg-primary px-4 py-2 text-sm text-white" onClick={submit}>
            Compare
          </button>
        </div>
      </div>
    </div>
  );
}
