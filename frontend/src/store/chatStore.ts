import { create } from "zustand";

import type { ConversationSummary } from "@/lib/api";
import type { Message, TraceStep, WidgetPayload } from "@/types";

function nid() {
  return crypto.randomUUID();
}

interface ChatState {
  messages: Message[];
  conversationId: string | null;
  isLoading: boolean;
  isStreaming: boolean;
  streamingMessageId: string | null;
  error: string | null;
  lastAgentTrace: TraceStep[];
  lastKbCitations: string[];
  conversations: ConversationSummary[];
  // mutators
  addUserMessage: (text: string) => void;
  addAssistantMessage: (
    text: string,
    widget: WidgetPayload | null,
    regulatoryFootnote: boolean,
    meta?: { trace?: TraceStep[]; kbCitations?: string[] },
  ) => void;
  beginStreamingAssistant: () => string;
  appendStreamDelta: (id: string, chunk: string) => void;
  finalizeStreamingAssistant: (
    id: string,
    payload: { widget?: WidgetPayload | null; regulatoryFootnote?: boolean; trace?: TraceStep[]; kbCitations?: string[] },
  ) => void;
  setMessagesFromHistory: (msgs: Message[]) => void;
  clearChat: () => void;
  setLoading: (v: boolean) => void;
  setStreaming: (v: boolean) => void;
  setError: (e: string | null) => void;
  setConversationId: (c: string | null) => void;
  setConversations: (list: ConversationSummary[]) => void;
  upsertConversation: (c: ConversationSummary) => void;
  removeConversation: (id: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  conversationId: null,
  isLoading: false,
  isStreaming: false,
  streamingMessageId: null,
  error: null,
  lastAgentTrace: [],
  lastKbCitations: [],
  conversations: [],

  addUserMessage: (text) => {
    const msg: Message = {
      id: nid(),
      role: "user",
      text,
      widget: null,
      timestamp: new Date(),
    };
    set((s) => ({ messages: [...s.messages, msg], error: null }));
  },

  addAssistantMessage: (text, widget, regulatoryFootnote, meta) => {
    const msg: Message = {
      id: nid(),
      role: "assistant",
      text,
      widget,
      timestamp: new Date(),
      regulatoryFootnote,
    };
    set((s) => ({
      messages: [...s.messages, msg],
      error: null,
      lastAgentTrace: meta?.trace ?? s.lastAgentTrace,
      lastKbCitations: meta?.kbCitations ?? s.lastKbCitations,
    }));
  },

  beginStreamingAssistant: () => {
    const id = nid();
    const msg: Message = {
      id,
      role: "assistant",
      text: "",
      widget: null,
      timestamp: new Date(),
      regulatoryFootnote: false,
      streaming: true,
    };
    set((s) => ({ messages: [...s.messages, msg], streamingMessageId: id, isStreaming: true, error: null }));
    return id;
  },

  appendStreamDelta: (id, chunk) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, text: m.text + chunk } : m)),
    })),

  finalizeStreamingAssistant: (id, payload) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id
          ? {
              ...m,
              widget: payload.widget ?? m.widget ?? null,
              regulatoryFootnote: payload.regulatoryFootnote ?? m.regulatoryFootnote ?? false,
              streaming: false,
            }
          : m,
      ),
      isStreaming: false,
      streamingMessageId: null,
      lastAgentTrace: payload.trace ?? s.lastAgentTrace,
      lastKbCitations: payload.kbCitations ?? s.lastKbCitations,
    })),

  setMessagesFromHistory: (msgs) =>
    set({
      messages: msgs,
      isLoading: false,
      isStreaming: false,
      streamingMessageId: null,
      error: null,
    }),

  setLoading: (v) => set({ isLoading: v }),
  setStreaming: (v) => set({ isStreaming: v }),
  setError: (e) => set({ error: e }),
  setConversationId: (c) => set({ conversationId: c }),
  setConversations: (list) => set({ conversations: list }),
  upsertConversation: (c) =>
    set((s) => {
      const others = s.conversations.filter((x) => x.id !== c.id);
      return { conversations: [c, ...others] };
    }),
  removeConversation: (id) =>
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      conversationId: s.conversationId === id ? null : s.conversationId,
      messages: s.conversationId === id ? [] : s.messages,
    })),

  clearChat: () => {
    void get(); // satisfy linter
    set({
      messages: [],
      conversationId: null,
      error: null,
      isLoading: false,
      isStreaming: false,
      streamingMessageId: null,
      lastAgentTrace: [],
      lastKbCitations: [],
    });
  },
}));
