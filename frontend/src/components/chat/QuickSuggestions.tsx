"use client";

const SUGGESTIONS = [
  "What home loan EMI would I pay?",
  "Am I eligible for a personal loan?",
  "How can I improve my CIBIL score?",
  "Compare 8.5% vs 9% loan rate",
];

export function QuickSuggestions({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {SUGGESTIONS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          className="rounded-full border border-white/80 bg-gradient-to-b from-white to-cream-surface/90 px-4 py-2 text-sm font-medium text-primary shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_3px_0_rgba(2,97,116,0.12),0_10px_24px_rgba(2,65,60,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_4px_0_rgba(2,97,116,0.14),0_14px_28px_rgba(2,65,60,0.14)]"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
