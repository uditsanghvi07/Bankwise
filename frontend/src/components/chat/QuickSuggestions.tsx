"use client";

const SUGGESTIONS = [
  "What home loan EMI would I pay?",
  "Am I eligible for a personal loan?",
  "How can I improve my CIBIL score?",
  "Compare 8.5% vs 9% loan rate",
];

export function QuickSuggestions({ onPick }: { onPick: (t: string) => void }) {
  return (
    <ul className="mx-auto flex w-full flex-col gap-2.5 text-left">
      {SUGGESTIONS.map((s) => (
        <li key={s} className="w-full">
          <button
            type="button"
            onClick={() => onPick(s)}
            className="w-full rounded-full border border-indigo-200/90 bg-white/90 px-5 py-2.5 text-left text-sm font-medium leading-snug text-ink shadow-[inset_0_1px_0_rgba(255,255,255,1),0_2px_8px_rgba(15,23,42,0.05),0_0_16px_rgba(99,102,241,0.1)] outline-none transition-[border-color,box-shadow,background-color] duration-200 [-webkit-tap-highlight-color:transparent] hover:border-indigo-300 hover:bg-white hover:shadow-[inset_0_1px_0_rgba(255,255,255,1),0_3px_12px_rgba(79,70,229,0.08),0_0_22px_rgba(129,140,248,0.18)] focus-visible:ring-2 focus-visible:ring-brand-indigo/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.99]"
          >
            {s}
          </button>
        </li>
      ))}
    </ul>
  );
}
