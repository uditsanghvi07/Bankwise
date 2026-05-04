"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Database,
  FileDown,
  LineChart,
  Radio,
  ShieldCheck,
  Sparkles,
  Wand2,
  Workflow,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

import { AppNav } from "@/components/layout/AppNav";

const trendData = [
  { m: "Jan", v: 42, p: 35 },
  { m: "Feb", v: 48, p: 39 },
  { m: "Mar", v: 45, p: 40 },
  { m: "Apr", v: 55, p: 44 },
  { m: "May", v: 62, p: 49 },
  { m: "Jun", v: 68, p: 56 },
];
const allocation = [
  { name: "Equity", value: 60, fill: "#6366f1" },
  { name: "Debt", value: 25, fill: "#22d3ee" },
  { name: "Gold", value: 10, fill: "#f59e0b" },
  { name: "Cash", value: 5, fill: "#94a3b8" },
];
const sipBars = [
  { y: "Y1", v: 1.2 },
  { y: "Y3", v: 4.4 },
  { y: "Y5", v: 8.6 },
  { y: "Y10", v: 23 },
  { y: "Y15", v: 49 },
];

const FEATURES = [
  {
    icon: Bot,
    title: "Bounded LangGraph agent",
    body: "DeepSeek proposes structured tool calls; Python engines run the math; the model only narrates.",
    accent: "from-brand-indigo to-brand-violet",
  },
  {
    icon: BarChart3,
    title: "Decimal calculator engines",
    body: "EMI, FOIR-eligibility, SIP, FD, comparison, directional CIBIL — all paise-precise, never invented.",
    accent: "from-brand-violet to-brand-coral",
  },
  {
    icon: Database,
    title: "Persistent chat history",
    body: "SQLite-backed conversations with rename, delete, and one-click reload — like ChatGPT, locally.",
    accent: "from-brand-sky to-brand-indigo",
  },
  {
    icon: Radio,
    title: "Real streaming UX",
    body: "Server-Sent Events deliver trace, KB citations, and tokenised replies as they materialise.",
    accent: "from-brand-coral to-brand-violet",
  },
  {
    icon: Wand2,
    title: "Scenario advisor",
    body: "Structured form → balanced opinion → recharts projections → one-click PDF report.",
    accent: "from-emerald-500 to-brand-sky",
  },
  {
    icon: ShieldCheck,
    title: "Safety pre-filter",
    body: "Policy guard scrubs prompt injection and refuses fraud / laundering / KYC bypass attempts up front.",
    accent: "from-amber-500 to-brand-coral",
  },
];

export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-ink">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-violet/20 via-brand-sky/10 to-transparent" />
      <div className="pointer-events-none absolute -right-24 top-32 h-96 w-96 rounded-full bg-gradient-to-br from-brand-coral/30 to-brand-indigo/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 bottom-0 h-80 w-80 rounded-full bg-gradient-to-tr from-primary/25 to-brand-sky/20 blur-3xl" />

      <AppNav />

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-12 md:px-6 md:pt-16">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-indigo shadow-sm backdrop-blur">
              <Bot className="h-3.5 w-3.5" />
              LangGraph · RAG · Decimal engines · SSE streaming
            </p>
            <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-ink md:text-5xl lg:text-[3.25rem]">
              Banking answers that{" "}
              <span className="bg-gradient-to-r from-brand-indigo via-brand-violet to-brand-coral bg-clip-text text-transparent">
                stay on rails
              </span>
              .
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-text-secondary">
              A full-stack GenAI advisory surface for Indian retail banking — curated KB retrieval, bounded tool
              loops over deterministic calculators, persistent SQLite history, streaming chat, and a scenario
              advisor with PDF export.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-slate-800"
              >
                Launch console
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/advisor"
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-sm hover:bg-slate-50"
              >
                Try the advisor
              </Link>
              <Link
                href="/docs"
                className="rounded-full px-3 py-3 text-sm font-semibold text-text-secondary hover:text-ink"
              >
                How it works →
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="relative"
          >
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-brand-indigo/20 via-white/40 to-brand-coral/20 blur-2xl" />
            <div className="relative grid gap-4 sm:grid-cols-2">
              <DashboardCard label="Engagement" value="+37%" hue="emerald">
                <ResponsiveContainer width="100%" height={96}>
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="m" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0", fontSize: 12 }} />
                    <Area type="monotone" dataKey="v" stroke="#6366f1" fill="url(#g)" strokeWidth={2} />
                    <Area type="monotone" dataKey="p" stroke="#22d3ee" strokeWidth={1.4} fillOpacity={0} />
                  </AreaChart>
                </ResponsiveContainer>
              </DashboardCard>
              <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-brand-indigo to-brand-violet p-5 text-white shadow-xl">
                <LineChart className="h-5 w-5 opacity-90" />
                <p className="mt-3 text-sm font-medium opacity-90">Asset allocation</p>
                <div className="mt-2 flex items-center gap-4">
                  <div className="h-24 w-24">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={allocation} dataKey="value" innerRadius={26} outerRadius={42} stroke="none">
                          {allocation.map((a) => (
                            <Cell key={a.name} fill={a.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="text-xs">
                    {allocation.map((a) => (
                      <li key={a.name} className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: a.fill }} />
                        {a.name} <span className="opacity-80">— {a.value}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-xl backdrop-blur">
                <p className="text-xs font-bold uppercase tracking-wider text-text-muted">SIP corpus growth (₹ L)</p>
                <ResponsiveContainer width="100%" height={108}>
                  <BarChart data={sipBars}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="y" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0", fontSize: 12 }} />
                    <Bar dataKey="v" radius={[6, 6, 0, 0]} fill="#7c3aed" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-lg backdrop-blur">
                <div className="flex flex-wrap items-center gap-3">
                  <Workflow className="h-5 w-5 text-brand-indigo" />
                  <p className="text-sm font-semibold text-ink">Agent trace</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                    safety → retrieve → tools → critic
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Retrieve KB", "EMI engine", "Eligibility", "Verifier", "Stream"].map((t) => (
                    <motion.span
                      key={t}
                      whileHover={{ y: -2 }}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-text-secondary shadow-sm"
                    >
                      {t}
                    </motion.span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <section id="features" className="mt-24 grid gap-5 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span
                aria-hidden
                className={`pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br ${f.accent} opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-20`}
              />
              <div className="relative">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${f.accent} text-white shadow-md`}>
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-bold text-ink">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{f.body}</p>
              </div>
            </motion.div>
          ))}
        </section>

        <section className="mt-20 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
          <h2 className="text-2xl font-bold text-ink md:text-3xl">From “a chatbot demo” to a real workflow</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Ask anything",
                body: "Calculations or regulations — the LLM either calls a tool or grounds the answer in curated KB.",
              },
              {
                step: "02",
                title: "See the trace",
                body: "Safety → retrieve → tool runs → critic. Every step is rendered in the UI as it happens.",
              },
              {
                step: "03",
                title: "Export the work",
                body: "Conversations and scenarios become professionally styled PDFs you can hand to anyone.",
              },
            ].map((s) => (
              <div key={s.step} className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-brand-indigo">{s.step}</p>
                <p className="mt-2 text-base font-bold text-ink">{s.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-text-secondary">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-indigo to-brand-violet px-5 py-2.5 text-sm font-semibold text-white shadow-md"
            >
              <Sparkles className="h-4 w-4" />
              Try the chat
            </Link>
            <Link href="/advisor" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-indigo hover:underline">
              <Wand2 className="h-4 w-4" />
              Run a scenario
            </Link>
            <Link href="/docs" className="inline-flex items-center gap-1 text-sm font-semibold text-text-secondary hover:text-ink">
              <FileDown className="h-4 w-4" />
              See the architecture
            </Link>
          </div>
        </section>

        <footer id="trust" className="mt-16 text-center">
          <p className="text-sm font-medium text-text-muted">
            Educational guidance only · verify with your bank, NBFC, or a SEBI-registered adviser
          </p>
        </footer>
      </main>
    </div>
  );
}

function DashboardCard({
  label,
  value,
  hue,
  children,
}: {
  label: string;
  value: string;
  hue: "emerald" | "rose" | "amber";
  children: React.ReactNode;
}) {
  const hueCls =
    hue === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : hue === "rose"
      ? "bg-rose-50 text-rose-700"
      : "bg-amber-50 text-amber-700";
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-text-muted">{label}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${hueCls}`}>{value}</span>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}
