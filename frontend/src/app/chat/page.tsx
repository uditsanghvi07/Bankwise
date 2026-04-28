"use client";

import { useState } from "react";

import { ChatWindow } from "@/components/chat/ChatWindow";
import { InputBar } from "@/components/chat/InputBar";
import { CompareLoansModal } from "@/components/layout/CompareLoansModal";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { useChat } from "@/hooks/useChat";

export default function ChatPage() {
  const { messages, isLoading, sendMessage, clearChat } = useChat();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  return (
    <div className="relative flex h-screen min-h-0 overflow-hidden bg-background">
      {/* Dark finance / market art: visible + blurred; light veils keep UI readable */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
        <div className="chat-backdrop-image absolute inset-0" />
        <div className="absolute inset-0 bg-white/8" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/5 via-transparent to-slate-950/40" />
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/15 via-transparent to-cream/12" />
      </div>

      <div className="relative z-10 flex min-h-0 w-full min-w-0 flex-1">
        <Sidebar
          mobileOpen={mobileMenu}
          onCloseMobile={() => setMobileMenu(false)}
          onNewChat={() => clearChat()}
          onQuick={(m) => void sendMessage(m)}
          onCompare={() => setCompareOpen(true)}
        />
        <div className="flex min-w-0 flex-1 flex-col bg-transparent">
          <Header onMenu={() => setMobileMenu(true)} />
          <ChatWindow messages={messages} isLoading={isLoading} onSuggestion={(t) => void sendMessage(t)} />
          <InputBar disabled={isLoading} onSend={(t) => void sendMessage(t)} />
        </div>
      </div>
      <CompareLoansModal open={compareOpen} onClose={() => setCompareOpen(false)} />
    </div>
  );
}
