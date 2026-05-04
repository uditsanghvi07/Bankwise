"use client";

import { Landmark, User } from "lucide-react";
import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { RegulatoryFootnote } from "@/components/chat/RegulatoryFootnote";
import {
  expandAbbreviations,
  normalizeMarkdownForRender,
  stripAssistantWidgetMarkup,
} from "@/lib/chatDisplay";
import type { Message } from "@/types";

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function UserAvatar() {
  return (
    <span
      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-indigo to-brand-violet text-white shadow-sm ring-1 ring-white/15"
      aria-label="You"
    >
      <User className="h-4 w-4" aria-hidden strokeWidth={2} />
    </span>
  );
}

function AssistantAvatar() {
  return (
    <span
      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-indigo to-brand-violet text-white shadow-sm ring-1 ring-indigo-400/40"
      aria-label="BankWise AI"
    >
      <Landmark className="h-4 w-4" aria-hidden strokeWidth={2} />
    </span>
  );
}

function MessageBubbleInner({ message }: { message: Message }) {
  const assistantMd = useMemo(() => {
    if (message.role === "user") return "";
    const raw = message.text || (message.streaming ? "…" : "");
    const stripped = stripAssistantWidgetMarkup(raw);
    const normalized = normalizeMarkdownForRender(stripped);
    // Only expand abbreviations on the final message (not while streaming, to avoid mid-word flicker)
    return message.streaming ? normalized : expandAbbreviations(normalized);
  }, [message.role, message.streaming, message.text]);

  if (message.role === "user") {
    return (
      <div className="flex w-full justify-end">
        <div className="flex max-w-[min(92%,42rem)] items-start gap-2">
          <UserAvatar />
          <div className="flex min-w-0 flex-col items-end gap-1">
            <div className="chat-bubble-user-3d rounded-[20px] rounded-br-[4px] px-4 py-3 text-[15px] leading-relaxed text-white">
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
            <div className="prose prose-sm max-w-none prose-p:my-2 prose-strong:text-text-primary prose-code:text-brand-indigo">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
                  // Ledger-style grid — matches .chat-table-wrap / .chat-table in globals.css
                  table: ({ children }) => (
                    <div className="chat-table-wrap not-prose">
                      <table className="chat-table">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => <thead>{children}</thead>,
                  tbody: ({ children }) => <tbody>{children}</tbody>,
                  tr: ({ children }) => <tr>{children}</tr>,
                  th: ({ children }) => <th>{children}</th>,
                  td: ({ children }) => <td>{children}</td>,
                }}
              >
                {assistantMd}
              </ReactMarkdown>
              {message.streaming ? (
                <span className="ml-0.5 inline-block h-3 w-[3px] translate-y-0.5 animate-pulse bg-brand-violet align-baseline" aria-hidden />
              ) : null}
            </div>
          </div>
          {message.regulatoryFootnote ? <RegulatoryFootnote /> : null}
          <span className="text-xs text-text-muted drop-shadow-sm">{formatTime(message.timestamp)}</span>
        </div>
      </div>
    </div>
  );
}

function widgetEqual(a: Message["widget"], b: Message["widget"]): boolean {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  return a.type === b.type && JSON.stringify(a.params) === JSON.stringify(b.params);
}

export const MessageBubble = memo(MessageBubbleInner, (prev, next) => {
  const p = prev.message;
  const n = next.message;
  return (
    p.id === n.id &&
    p.text === n.text &&
    p.streaming === n.streaming &&
    p.regulatoryFootnote === n.regulatoryFootnote &&
    p.role === n.role &&
    widgetEqual(p.widget, n.widget)
  );
});
