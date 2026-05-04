"use client";

import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw } from "lucide-react";

import { AdvisorReport } from "@/components/advisor/AdvisorReport";
import { ScenarioForm } from "@/components/advisor/ScenarioForm";
import { AppNav } from "@/components/layout/AppNav";
import { BrandLoader } from "@/components/layout/BrandLoader";
import { postAdvisorScenario, type AdvisorRequest } from "@/lib/api";
import { ADVISOR_DEFAULT_FORM, useAdvisorStore } from "@/store/advisorStore";

export default function AdvisorPage() {
  const formValues = useAdvisorStore((s) => s.formValues);
  const request = useAdvisorStore((s) => s.request);
  const response = useAdvisorStore((s) => s.response);
  const loading = useAdvisorStore((s) => s.loading);
  const error = useAdvisorStore((s) => s.error);

  const setFormValues = useAdvisorStore((s) => s.setFormValues);
  const setLoading = useAdvisorStore((s) => s.setLoading);
  const setError = useAdvisorStore((s) => s.setError);
  const setResult = useAdvisorStore((s) => s.setResult);
  const reset = useAdvisorStore((s) => s.reset);

  // Show the reset affordance once there's something to reset (a report or
  // user-edited form values). Default form is treated as "nothing to reset".
  const formDirty = JSON.stringify(formValues) !== JSON.stringify(ADVISOR_DEFAULT_FORM);
  const canReset = !loading && (response !== null || formDirty);

  async function handleSubmit(req: AdvisorRequest) {
    setLoading(true);
    setError(null);
    try {
      const res = await postAdvisorScenario(req);
      setResult(req, res);
    } catch (e) {
      setError("Could not generate the scenario. Make sure the API is running and try again.");
      setLoading(false);
      console.error(e);
    }
  }

  function handleReset() {
    if (loading) return;
    if (response !== null && !window.confirm("Start over? This will clear the current report and reset the form.")) {
      return;
    }
    reset();
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-ink">
      <AppNav />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.18),transparent_60%)]" />

      <main className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <header className="mb-8 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-indigo shadow-sm">
              Scenario advisor
            </p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
              An <span className="bg-gradient-to-r from-brand-indigo to-brand-violet bg-clip-text text-transparent">honest read</span> on your money — not a sales pitch.
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-text-secondary">
              We compute FOIR, savings rate, emergency cover, and three-path projections at realistic Indian
              benchmarks (Nifty 50 / EPF / FD blends). The verdict will tell you plainly if you&apos;re excellent, stretched,
              or already in debt-trap territory — no marketing copy.
            </p>
          </div>
          {canReset ? (
            <button
              type="button"
              onClick={handleReset}
              title="Clear the current report and reset the form"
              className="group inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-text-secondary shadow-sm transition hover:-translate-y-0.5 hover:border-brand-indigo/40 hover:text-brand-indigo hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-indigo/30 md:text-sm"
            >
              <RotateCcw className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-180" />
              Start over
            </button>
          ) : null}
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <ScenarioForm
            value={formValues}
            onChange={setFormValues}
            onSubmit={handleSubmit}
            loading={loading}
          />
        </section>

        <AnimatePresence>
          {error ? (
            <motion.div
              key="err"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            >
              {error}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {loading ? (
          <section className="mt-10">
            <BrandLoader
              variant="panel"
              title="Drafting your honest verdict…"
              subtitle="Computing FOIR, savings rate, emergency cover, and three return paths."
              tips={[
                "Crunching FOIR against your income…",
                "Stress-testing 3 return paths (Nifty / EPF / FD)…",
                "Adjusting for ~6% inflation drag…",
                "Checking how realistic your goal really is…",
                "Drafting an honest verdict, not a sales pitch…",
              ]}
            />
          </section>
        ) : null}

        {!loading && request && response ? (
          <section className="mt-10">
            <AdvisorReport request={request} response={response} />

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-xs text-text-muted">
                Done reviewing? Reset the report and form to run a brand-new scenario.
              </p>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-indigo to-brand-violet px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-indigo/40 md:text-sm"
              >
                <RotateCcw className="h-4 w-4" />
                Start a new scenario
              </button>
            </div>
          </section>
        ) : null}

        {!loading && !response ? (
          <section className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              {
                title: "Real Indian benchmarks",
                body: "Returns based on long-run Nifty 50 / multi-cap, EPF, PPF, FD and gold blends — not picked-from-air rates.",
              },
              {
                title: "3-path projections",
                body: "Pessimistic, base, and optimistic returns with inflation-adjusted target. See the full range, not one optimistic line.",
              },
              {
                title: "Brutal verdict",
                body: "Excellent · Healthy · Stretched · Concerning · Critical. Debt-trap profiles are flagged loudly with concrete next steps.",
              },
            ].map((c) => (
              <div key={c.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-bold text-ink">{c.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">{c.body}</p>
              </div>
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}
