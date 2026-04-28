"use client";

import { Landmark, User } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { RegulatoryFootnote } from "@/components/chat/RegulatoryFootnote";
import type { Message } from "@/types";

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function UserAvatar() {
  return (
    <span
      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-sm ring-1 ring-primary/35"
      aria-label="You"
    >
      <User className="h-4 w-4" aria-hidden strokeWidth={2} />
    </span>
  );
}

function AssistantAvatar() {
  return (
    <span
      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-sm ring-1 ring-primary/35"
      aria-label="BankWise AI"
    >
      <Landmark className="h-4 w-4" aria-hidden strokeWidth={2} />
    </span>
  );
}

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex w-full justify-end">
        <div className="flex max-w-[min(92%,42rem)] items-start gap-2">
          <UserAvatar />
          <div className="flex min-w-0 flex-col items-end gap-1">
            <div className="chat-bubble-user-3d rounded-[20px] rounded-br-[4px] px-4 py-3 text-[15px] leading-relaxed text-white transition-transform duration-200 hover:-translate-y-0.5">
              {message.text}
            </div>
            <span className="text-xs text-text-muted drop-shadow-sm">{formatTime(message.timestamp)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-start">
      <div className="flex max-w-[min(92%,42rem)] items-start gap-2">
        <AssistantAvatar />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="chat-bubble-ai-3d rounded-[20px] rounded-bl-[4px] px-4 py-3 text-[15px] leading-relaxed text-text-primary transition-transform duration-200 hover:-translate-y-0.5">
            <div className="prose prose-sm max-w-none prose-p:my-2 prose-strong:text-text-primary prose-code:text-primary">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
                }}
              >
                {message.text}
              </ReactMarkdown>
            </div>
          </div>
          {message.regulatoryFootnote ? <RegulatoryFootnote /> : null}
          <span className="text-xs text-text-muted drop-shadow-sm">{formatTime(message.timestamp)}</span>
        </div>
      </div>
    </div>
  );
}
