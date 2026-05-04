"use client";

import { ArrowUp, Loader2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";

export function InputBar({
  onSend,
  disabled,
}: {
  onSend: (t: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");
  const ta = useRef<HTMLTextAreaElement>(null);

  const send = useCallback(() => {
    if (!value.trim() || disabled) return;
    onSend(value);
    setValue("");
    if (ta.current) ta.current.style.height = "auto";
  }, [disabled, onSend, value]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const onInput = () => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 4 * 24)}px`;
  };

  return (
    <div className="border-t border-border bg-surface/95 p-4 shadow-[0_-4px_24px_rgba(79,70,229,0.07)] backdrop-blur-md supports-[backdrop-filter]:bg-surface/88">
      <div className="mx-auto max-w-4xl">
        {value.length > 1500 ? (
          <div className="mb-1 text-right text-xs text-warning">{value.length} / 2000</div>
        ) : null}
        <div className="flex items-end gap-2 rounded-xl border border-indigo-200/85 bg-white p-2 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_0_0_1px_rgba(199,210,254,0.55),0_0_18px_rgba(129,140,248,0.22),0_4px_12px_rgba(99,102,241,0.07)] transition-shadow duration-200 focus-within:border-indigo-300 focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,1),0_0_0_1px_rgba(165,180,252,0.85),0_0_26px_rgba(139,92,246,0.2),0_0_36px_rgba(129,140,248,0.18),0_4px_14px_rgba(79,70,229,0.08)]">
          <textarea
            ref={ta}
            rows={1}
            maxLength={2000}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            onInput={onInput}
            disabled={disabled}
            placeholder="Ask me about loans, EMI, CIBIL, investments..."
            className="max-h-28 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] outline-none ring-0 placeholder:text-text-muted focus:ring-0"
          />
          <button
            type="button"
            onClick={send}
            disabled={disabled || !value.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-indigo to-brand-violet text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-indigo/40 focus-visible:ring-offset-2"
            aria-label="Send"
          >
            {disabled ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-text-muted">
          BankWise AI provides professional financial insights. Always verify rates, terms, and final decisions with your bank.
        </p>
      </div>
    </div>
  );
}
