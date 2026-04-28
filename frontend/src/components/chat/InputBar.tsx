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
    <div className="border-t border-border bg-surface/95 p-4 shadow-[0_-4px_24px_rgba(2,97,116,0.06)] backdrop-blur-md supports-[backdrop-filter]:bg-surface/88">
      <div className="mx-auto max-w-4xl">
        {value.length > 1500 ? (
          <div className="mb-1 text-right text-xs text-warning">{value.length} / 2000</div>
        ) : null}
        <div className="flex items-end gap-2 rounded-lg border border-border bg-background p-2 shadow-sm">
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
            className="max-h-28 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-text-muted"
          />
          <button
            type="button"
            onClick={send}
            disabled={disabled || !value.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white disabled:opacity-40"
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
