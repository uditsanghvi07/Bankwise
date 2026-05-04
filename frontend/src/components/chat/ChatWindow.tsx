"use client";

import { motion } from "framer-motion";
import { Shield } from "lucide-react";
import { useEffect, useRef } from "react";

import { MessageBubble } from "@/components/chat/MessageBubble";
import { QuickSuggestions } from "@/components/chat/QuickSuggestions";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { WidgetRenderer } from "@/components/widgets/WidgetRenderer";
import type { Message } from "@/types";

export function ChatWindow({
  messages,
  isLoading,
  isStreaming = false,
  onSuggestion,
}: {
  messages: Message[];
  isLoading: boolean;
  isStreaming?: boolean;
  onSuggestion: (t: string) => void;
}) {
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: isStreaming ? "auto" : "smooth" });
  }, [messages, isLoading, isStreaming]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="chat-welcome-3d mx-auto w-full max-w-md rounded-2xl px-6 py-9 text-center sm:px-8 sm:py-10"
            >
              <div className="mx-auto flex w-full max-w-[17.5rem] flex-col items-center">
                <div className="mb-5 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50 to-violet-50 text-brand-indigo shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_12px_rgba(99,102,241,0.12)]">
                  <Shield className="h-7 w-7" strokeWidth={1.75} />
                </div>
                <h2 className="text-lg font-semibold tracking-tight text-ink sm:text-xl">Hello, I&apos;m BankWise AI</h2>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-text-secondary">
                  Calm, precise guidance on Indian loans, banking products, credit health, and investments — with
                  calculators inline when numbers matter.
                </p>
              </div>
              <div className="mx-auto mt-8 w-full max-w-md">
                <QuickSuggestions onPick={onSuggestion} />
              </div>
            </motion.div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="flex w-full justify-center">
                <div className="flex w-full max-w-4xl flex-col gap-2">
                  <MessageBubble message={m} />
                  {m.role === "assistant" && m.widget ? (
                    <div className="chat-widget-3d">
                      <WidgetRenderer widget={m.widget} />
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
          {isLoading ? <TypingIndicator /> : null}
          <div ref={bottom} />
        </div>
      </div>
    </div>
  );
}
