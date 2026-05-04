import { useCallback, useEffect, useRef } from "react";

import {
  fetchConversation,
  listConversations,
  postChatStream,
  type StoredMessageDTO,
} from "@/lib/api";
import { useChatStore } from "@/store/chatStore";
import type { Message, TraceStep, WidgetPayload } from "@/types";

function buildHistory(messages: { role: string; text: string }[]) {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.text }))
    .slice(-20);
}

function dtoToMessage(d: StoredMessageDTO): Message {
  return {
    id: d.id,
    role: d.role === "assistant" ? "assistant" : "user",
    text: d.content,
    widget: d.widget ? { type: d.widget.type as WidgetPayload["type"], params: d.widget.params } : null,
    timestamp: new Date(d.created_at),
    regulatoryFootnote: d.show_regulatory_footnote,
  };
}

export function useChat() {
  const messages = useChatStore((s) => s.messages);
  const conversationId = useChatStore((s) => s.conversationId);
  const isLoading = useChatStore((s) => s.isLoading);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const error = useChatStore((s) => s.error);
  const conversations = useChatStore((s) => s.conversations);

  const addUserMessage = useChatStore((s) => s.addUserMessage);
  const beginStreamingAssistant = useChatStore((s) => s.beginStreamingAssistant);
  const appendStreamDelta = useChatStore((s) => s.appendStreamDelta);
  const finalizeStreamingAssistant = useChatStore((s) => s.finalizeStreamingAssistant);
  const addAssistantMessage = useChatStore((s) => s.addAssistantMessage);
  const setLoading = useChatStore((s) => s.setLoading);
  const setError = useChatStore((s) => s.setError);
  const setConversationId = useChatStore((s) => s.setConversationId);
  const setConversations = useChatStore((s) => s.setConversations);
  const setMessagesFromHistory = useChatStore((s) => s.setMessagesFromHistory);
  const removeConversationFromStore = useChatStore((s) => s.removeConversation);

  const abortRef = useRef<AbortController | null>(null);

  const refreshConversations = useCallback(async () => {
    try {
      const list = await listConversations();
      setConversations(list);
    } catch {
      // ignore — backend may be offline; UI shows empty list
    }
  }, [setConversations]);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  const loadConversation = useCallback(
    async (id: string) => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchConversation(id);
        setConversationId(id);
        setMessagesFromHistory(data.messages.map(dtoToMessage));
      } catch {
        setError("Could not load conversation.");
      } finally {
        setLoading(false);
      }
    },
    [setError, setLoading, setConversationId, setMessagesFromHistory],
  );

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    useChatStore.getState().clearChat();
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }, [setLoading]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || useChatStore.getState().isLoading) return;

      addUserMessage(trimmed);
      setLoading(true);
      setError(null);

      const conv = useChatStore.getState().conversationId ?? null;
      const prior = useChatStore.getState().messages.slice(0, -1);
      const hist = buildHistory(prior.map((m) => ({ role: m.role, text: m.text })));

      const assistantId = beginStreamingAssistant();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      let lastTrace: TraceStep[] = [];
      let lastKb: string[] = [];
      let lastWidget: WidgetPayload | null = null;
      let regulatoryFootnote = false;
      let closedConv = conv;

      let pendingDelta = "";
      let deltaRaf: number | null = null;
      const flushDelta = () => {
        deltaRaf = null;
        if (pendingDelta) {
          appendStreamDelta(assistantId, pendingDelta);
          pendingDelta = "";
        }
      };
      const scheduleDeltaFlush = () => {
        if (deltaRaf != null) return;
        deltaRaf = requestAnimationFrame(flushDelta);
      };

      await postChatStream(
        { message: trimmed, conversation_id: conv, history: hist },
        {
          onMeta: (m) => {
            if (m.conversation_id) {
              closedConv = m.conversation_id;
              if (!useChatStore.getState().conversationId) setConversationId(m.conversation_id);
            }
          },
          onTrace: (t) => {
            lastTrace = t.trace ?? [];
            lastKb = t.kb_citations ?? [];
          },
          onWidget: (w) => {
            if (w && w.type) {
              lastWidget = { type: w.type as WidgetPayload["type"], params: (w.params ?? {}) as Record<string, unknown> };
            }
          },
          onDelta: (d) => {
            if (d.text) {
              pendingDelta += d.text;
              scheduleDeltaFlush();
            }
          },
          onDone: (d) => {
            if (d.conversation_id) closedConv = d.conversation_id;
            regulatoryFootnote = Boolean(d.show_regulatory_footnote);
            if (d.kb_citations) lastKb = d.kb_citations;
            if (d.widget && d.widget.type) {
              lastWidget = {
                type: d.widget.type as WidgetPayload["type"],
                params: (d.widget.params ?? {}) as Record<string, unknown>,
              };
            }
          },
          onError: (e) => {
            setError(e.message || "Streaming failed.");
          },
        },
        ctrl.signal,
      );

      if (deltaRaf != null) {
        cancelAnimationFrame(deltaRaf);
        deltaRaf = null;
      }
      if (pendingDelta) {
        appendStreamDelta(assistantId, pendingDelta);
        pendingDelta = "";
      }

      finalizeStreamingAssistant(assistantId, {
        widget: lastWidget,
        regulatoryFootnote,
        trace: lastTrace,
        kbCitations: lastKb,
      });
      setLoading(false);
      abortRef.current = null;

      if (closedConv && !useChatStore.getState().conversationId) {
        setConversationId(closedConv);
      }
      void refreshConversations();
    },
    [
      addUserMessage,
      appendStreamDelta,
      beginStreamingAssistant,
      finalizeStreamingAssistant,
      refreshConversations,
      setConversationId,
      setError,
      setLoading,
    ],
  );

  const removeConversation = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      } catch {
        // ignore
      }
      removeConversationFromStore(id);
    },
    [removeConversationFromStore],
  );

  return {
    messages,
    conversationId,
    isLoading,
    isStreaming,
    error,
    conversations,
    sendMessage,
    stop,
    newChat,
    loadConversation,
    refreshConversations,
    removeConversation,
    addAssistantMessage,
  };
}
