"use client";

export function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface/95 p-4 shadow-card backdrop-blur-sm">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">{title}</h3>
      <div className="text-sm text-text-primary">{children}</div>
    </div>
  );
}
