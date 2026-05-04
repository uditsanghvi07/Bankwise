"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, Loader2, Menu, Sparkles, StopCircle } from "lucide-react";

import { AgentTracePanel } from "@/components/agent/AgentTracePanel";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { HistorySidebar } from "@/components/chat/HistorySidebar";
import { InputBar } from "@/components/chat/InputBar";
import { ScenarioWizardModal } from "@/components/chat/ScenarioWizardModal";
import { CompareLoansModal } from "@/components/layout/CompareLoansModal";
import { AppNav } from "@/components/layout/AppNav";
import { useChat } from "@/hooks/useChat";
import { downloadTranscriptPdf } from "@/lib/api";

export default function ChatPage() {
  const {
    messages,
    isLoading,
    isStreaming,
    sendMessage,
    stop,
    newChat,
    conversationId,
    conversations,
    loadConversation,
    removeConversation,
  } = useChat();

  const [mobileMenu, setMobileMenu] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!conversationId) {
      alert("Send at least one message first so we have something to export.");
      return;
    }
    try {
      setExporting(true);
      await downloadTranscriptPdf(conversationId, "BankWise AI conversation");
    } catch {
      alert("Export failed. Make sure the API is running.");
    } finally {
      setExporting(false);
    }
  }

  const sidebarPanel = (
    <div className="flex h-full w-[280px] shrink-0 flex-col border-r border-slate-200/80 bg-white/90 backdrop-blur-md">
      <Link href="/" className="flex items-center gap-2 px-4 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-indigo to-brand-violet text-white shadow-md">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <div className="text-sm font-semibold tracking-tight">BankWise AI</div>
          <div className="text-[11px] text-text-muted">GenAI banking console</div>
        </div>
      </Link>
      <HistorySidebar
        conversations={conversations}
        activeId={conversationId}
        onSelect={(id) => {
          void loadConversation(id);
          setMobileMenu(false);
        }}
        onNew={() => {
          newChat();
          setMobileMenu(false);
        }}
        onDelete={(id) => void removeConversation(id)}
      />
      <div className="space-y-2 border-t border-slate-200/80 p-3">
        <button
          type="button"
          onClick={() => {
            setScenarioOpen(true);
            setMobileMenu(false);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-indigo/30 bg-brand-indigo/10 px-3 py-2 text-xs font-semibold text-brand-indigo"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Quick scenario
        </button>
        <button
          type="button"
          onClick={() => {
            setCompareOpen(true);
            setMobileMenu(false);
          }}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-slate-50"
        >
          Structured loan compare
        </button>
        <Link
          href="/advisor"
          className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs font-semibold text-ink hover:bg-slate-50"
        >
          Open advisor →
        </Link>
        <p className="px-1 text-[10px] leading-relaxed text-text-muted">
          BankWise AI provides educational guidance only. Verify rates and policies with your bank, NBFC, or a SEBI-registered adviser before acting.
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen min-h-0 flex-col bg-slate-50 text-ink">
      <AppNav />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(99,102,241,0.12),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(14,165,233,0.1),transparent_45%)]" />
        </div>

        <div className="hidden h-full md:flex">{sidebarPanel}</div>
        {mobileMenu ? (
          <div className="fixed inset-0 z-40 flex md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/40"
              aria-label="Close menu"
              onClick={() => setMobileMenu(false)}
            />
            <div className="relative z-10 h-full shadow-xl">{sidebarPanel}</div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col bg-transparent">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/80 px-3 shadow-sm backdrop-blur-md md:px-5">
            <button
              type="button"
              className="rounded-lg p-2 md:hidden"
              aria-label="Open history"
              onClick={() => setMobileMenu(true)}
            >
              <Menu className="h-5 w-5 text-ink" />
            </button>
            <div className="flex items-center gap-2 text-sm">
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-800">
                {isStreaming ? "Streaming…" : "Ready"}
              </span>
              {conversationId ? (
                <span className="hidden text-[11px] text-text-muted sm:inline">conv {conversationId.slice(0, 8)}…</span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {isStreaming ? (
                <button
                  type="button"
                  onClick={stop}
                  className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                >
                  <StopCircle className="h-3.5 w-3.5" />
                  Stop
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleExport}
                disabled={!conversationId || exporting}
                className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Export PDF
              </button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <ChatWindow
                messages={messages}
                isLoading={isLoading && !isStreaming}
                isStreaming={isStreaming}
                onSuggestion={(t) => void sendMessage(t)}
              />
              <InputBar disabled={isLoading} onSend={(t) => void sendMessage(t)} />
            </div>
            <div className="hidden h-full min-h-0 w-[min(100%,360px)] shrink-0 lg:flex">
              <AgentTracePanel />
            </div>
          </div>
        </div>
      </div>
      <CompareLoansModal open={compareOpen} onClose={() => setCompareOpen(false)} />
      <ScenarioWizardModal
        open={scenarioOpen}
        onClose={() => setScenarioOpen(false)}
        onComplete={(m) => void sendMessage(m)}
      />
    </div>
  );
}
