import axios from "axios";
import { useCallback, useRef } from "react";

import { postChat } from "@/lib/api";
import { useChatStore } from "@/store/chatStore";
import type { WidgetPayload } from "@/types";

function buildHistory(messages: { role: string; text: string }[]) {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.text }))
    .slice(-20);
}

export function useChat() {
  const messages = useChatStore((s) => s.messages);
  const conversationId = useChatStore((s) => s.conversationId);
  const isLoading = useChatStore((s) => s.isLoading);
  const error = useChatStore((s) => s.error);
  const addUserMessage = useChatStore((s) => s.addUserMessage);
  const addAssistantMessage = useChatStore((s) => s.addAssistantMessage);
  const clearChat = useChatStore((s) => s.clearChat);
  const setLoading = useChatStore((s) => s.setLoading);
  const setError = useChatStore((s) => s.setError);
  const setConversationId = useChatStore((s) => s.setConversationId);
  const retryRef = useRef(0);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      addUserMessage(trimmed);
      setLoading(true);
      setError(null);

      const conv = conversationId ?? null;
      const prior = useChatStore.getState().messages.slice(0, -1);
      const hist = buildHistory(prior.map((m) => ({ role: m.role, text: m.text })));

      const attempt = async () =>
        postChat({
          message: trimmed,
          conversation_id: conv,
          history: hist,
        });

      try {
        let data;
        try {
          data = await attempt();
        } catch (first) {
          if (retryRef.current < 1) {
            retryRef.current += 1;
            data = await attempt();
          } else {
            throw first;
          }
        }
        retryRef.current = 0;

        if (!useChatStore.getState().conversationId && data.conversation_id) {
          setConversationId(data.conversation_id);
        }

        const widget = data.widget
          ? ({ type: data.widget.type as WidgetPayload["type"], params: data.widget.params })
          : null;

        addAssistantMessage(data.text || "", widget, Boolean(data.show_regulatory_footnote));
      } catch (err: unknown) {
        let detail: string | null = null;
        if (axios.isAxiosError(err)) {
          const d = err.response?.data;
          if (d && typeof d === "object" && "detail" in d) {
            const v = (d as { detail: unknown }).detail;
            detail = typeof v === "string" ? v : Array.isArray(v) ? v.map(String).join("; ") : null;
          }
        }
        setError(detail ?? "I could not reach the advisory service. Check that the API is running where Next.js runs.");
        addAssistantMessage(
          detail ??
            "I could not reach BankWise AI from this device. The page talks only to the Next.js server; that server must reach the Python API (Docker: `INTERNAL_API_URL=http://backend:8000` on the frontend service; local dev: API on port 8000 or set INTERNAL_API_URL). Rebuild/restart after changing env.",
          null,
          false,
        );
      } finally {
        setLoading(false);
      }
    },
    [
      addAssistantMessage,
      addUserMessage,
      conversationId,
      isLoading,
      setConversationId,
      setError,
      setLoading,
    ],
  );

  return { messages, conversationId, isLoading, error, sendMessage, clearChat };
}
