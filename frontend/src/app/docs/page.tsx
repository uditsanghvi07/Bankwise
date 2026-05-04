"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Bot,
  Database,
  FileText,
  GitBranch,
  Layers,
  ShieldCheck,
  Wand2,
  Workflow,
} from "lucide-react";

import { AppNav } from "@/components/layout/AppNav";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "ux", label: "User journey" },
  { id: "stack", label: "Tech stack" },
  { id: "agent", label: "Agent loop" },
  { id: "rag", label: "RAG" },
  { id: "stream", label: "Streaming" },
  { id: "history", label: "History" },
  { id: "advisor", label: "Advisor" },
  { id: "export", label: "PDF export" },
  { id: "safety", label: "Safety" },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-ink">
      <AppNav />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.18),transparent_60%)]" />

      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-10 md:grid-cols-[200px_1fr] md:px-6">
        <aside className="hidden md:block">
          <div className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">Sections</p>
            <ul className="space-y-0.5 text-sm">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="block rounded-md px-2 py-1.5 text-text-secondary hover:bg-slate-100 hover:text-ink"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <article className="space-y-12">
          <header>
            <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-violet shadow-sm">
              <BookOpen className="h-3.5 w-3.5" />
              How BankWise works
            </p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
              Plain-English walkthrough of the whole system.
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-text-secondary">
              Read top-to-bottom (~5 minutes) to understand the chat console, the LangGraph tool loop, the RAG layer,
              SQLite history, the advisor scenario engine, PDF export, and what we deliberately do not let the LLM do.
            </p>
          </header>

          <Section id="overview" icon={Layers} title="What this product is">
            BankWise AI is a banking advisory console that combines a language model with deterministic Python
            calculator engines (Decimal-precise EMI, eligibility, SIP, FD, comparison, CIBIL) and a small curated
            knowledge base. Numbers come from <strong>Python</strong>; tone and explanations come from the
            <strong> LLM</strong>; safety, history, and visualisations are stitched together by the FastAPI backend
            and the Next.js UI.
          </Section>

          <Section id="ux" icon={Workflow} title="What a user does">
            <ol className="list-decimal space-y-2 pl-6 text-sm text-text-secondary">
              <li>Lands on <Link className="link" href="/">/</Link> — overview, design tokens, &quot;Open console&quot;.</li>
              <li>Opens <Link className="link" href="/chat">/chat</Link> — typing a question streams a tokenised reply alongside an agent trace, KB citations, and any rich widget (e.g. EMI breakdown).</li>
              <li>Optional: <Link className="link" href="/advisor">/advisor</Link> for a structured scenario report with charts and a downloadable PDF.</li>
              <li>History lives in SQLite — every conversation is restorable from the left rail.</li>
            </ol>
          </Section>

          <Section id="stack" icon={GitBranch} title="Tech stack">
            <Grid>
              <Card title="Frontend" body="Next.js 14 (App Router), TypeScript, Tailwind, Zustand, Recharts, Framer Motion." />
              <Card title="Backend" body="FastAPI, Pydantic v2, Python Decimal, LangGraph + LangChain Core, fpdf2." />
              <Card title="LLM" body="DeepSeek (OpenAI-compatible) for chat + advisor narration. Tool calls feed Python engines." />
              <Card title="Storage" body="SQLite via stdlib sqlite3 (WAL mode). Schema: conversations, messages." />
            </Grid>
          </Section>

          <Section id="agent" icon={Bot} title="LangGraph tool loop (chat)">
            <p className="text-sm leading-relaxed text-text-secondary">
              The chat handler runs a bounded ReAct-style loop. Pseudocode:
            </p>
            <CodeBlock>{`graph = StateGraph(messages)
  ↳ node "agent": ChatOpenAI(DeepSeek).bind_tools(BANKWISE_TOOLS).ainvoke(messages)
  ↳ if tool_calls -> node "tools": ToolNode runs Python engines, returns ToolMessage(JSON)
  ↳ loop back to "agent" until the model emits a final answer (recursion_limit=14)`}</CodeBlock>
            <p className="text-sm leading-relaxed text-text-secondary">
              After the loop, a tiny rule-based <em>critic</em> checks that the prose does not contradict the EMI
              from the most recent tool result, and the response envelope is built (text + widget + trace + KB).
            </p>
          </Section>

          <Section id="rag" icon={BookOpen} title="Curated RAG (zero external embedding cost)">
            <p className="text-sm leading-relaxed text-text-secondary">
              <code>backend/knowledge/*.md</code> hosts short notes (FOIR, CIBIL, PMAY, NACH, disclaimers) split on
              <code> ## KB:id </code>headers. The retriever scores chunks with token overlap and injects the top
              snippets into the system prompt with citation ids. Citations bubble up to the UI under each
              assistant turn.
            </p>
          </Section>

          <Section id="stream" icon={ArrowRight} title="Streaming chat (SSE)">
            <p className="text-sm leading-relaxed text-text-secondary">
              <code>POST /api/chat/stream</code> emits Server-Sent Events. The graph runs end-to-end first (so
              tool numbers are correct), then the final assistant text is replayed in word-sized chunks. Frame
              types:
            </p>
            <CodeBlock>{`event: meta   data: { conversation_id }
event: trace  data: { trace[], kb_citations[] }
event: widget data: { type, params }
event: delta  data: { text: "<chunk>" }
event: done   data: { conversation_id, widget, kb_citations, show_regulatory_footnote }`}</CodeBlock>
            <p className="text-sm leading-relaxed text-text-secondary">
              The browser consumes the body via <code>fetch + ReadableStream</code> and updates one assistant
              message in the Zustand store as deltas arrive.
            </p>
          </Section>

          <Section id="history" icon={Database} title="History &mdash; SQLite tables">
            <CodeBlock>{`CREATE TABLE conversations (id TEXT PK, title TEXT, created_at, updated_at);
CREATE TABLE messages (
  id TEXT PK, conversation_id TEXT FK, role TEXT,
  content TEXT, widget_json TEXT, trace_json TEXT,
  kb_citations_json TEXT, show_regulatory_footnote INT,
  created_at INT
);`}</CodeBlock>
            <p className="text-sm leading-relaxed text-text-secondary">
              Routes: <code>GET/POST /api/conversations</code>, <code>GET/PATCH/DELETE /api/conversations/{`{id}`}</code>.
              The chat handler persists user + assistant turns automatically and best-effort never blocks the
              response on persistence failures.
            </p>
          </Section>

          <Section id="advisor" icon={Wand2} title="Advisor &mdash; balanced opinion engine">
            <p className="text-sm leading-relaxed text-text-secondary">
              Inputs (age, income, savings, FOIR, risk appetite, goal) flow into <code>/api/advisor/scenario</code>.
              The backend computes a deterministic health score, FOIR/savings rate, expected return based on risk
              band, required SIP for the goal, and a 0-N year projection. The LLM is then asked to write 4&ndash;6
              sentences using those facts (no fabricated numbers). Returned JSON drives charts, recommendation
              cards, and a one-click PDF export.
            </p>
          </Section>

          <Section id="export" icon={FileText} title="PDF export (fpdf2)">
            <p className="text-sm leading-relaxed text-text-secondary">
              Two endpoints: <code>/api/export/transcript</code> (full chat transcript) and
              <code> /api/export/advisor</code> (scenario report). Both stream a styled PDF generated server-side
              with a coloured header, kv tables, projection table, and disclaimers. The browser triggers a normal
              download &mdash; no third-party PDF service.
            </p>
          </Section>

          <Section id="safety" icon={ShieldCheck} title="Safety guarantees (and what we don&apos;t promise)">
            <ul className="list-disc space-y-1 pl-6 text-sm text-text-secondary">
              <li>Pre-LLM safety filter scrubs known prompt-injection / fraud patterns.</li>
              <li>Money laundering, tax evasion, fake docs — refused with a polite policy message.</li>
              <li>Numbers come from Decimal engines; the critic flags monthly figures that contradict tool JSON.</li>
              <li>This is <strong>educational guidance only</strong>, not investment, tax, or legal advice.</li>
            </ul>
          </Section>
        </article>
      </main>
    </div>
  );
}

function Section({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      className="scroll-mt-20"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-indigo to-brand-violet text-white shadow-sm">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-xl font-bold tracking-tight text-ink">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </motion.section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-bold text-ink">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-text-secondary">{body}</p>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950 p-4 text-[12.5px] leading-relaxed text-slate-100 shadow-inner">
      <code>{children}</code>
    </pre>
  );
}
