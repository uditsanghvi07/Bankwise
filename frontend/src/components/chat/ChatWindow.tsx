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
  onSuggestion,
}: {
  messages: Message[];
  isLoading: boolean;
  onSuggestion: (t: string) => void;
}) {
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="chat-welcome-3d mx-auto max-w-lg rounded-2xl px-8 py-10 text-center"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/60 bg-primary-light shadow-md">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-text-primary">Hello, I&apos;m BankWise AI</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm text-text-secondary">
                Calm, precise guidance on Indian loans, banking products, credit health, and investments — with
                calculators inline when numbers matter.
              </p>
              <div className="mt-8">
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
