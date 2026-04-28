import { create } from "zustand";

import type { Message, WidgetPayload } from "@/types";

function nid() {
  return crypto.randomUUID();
}

interface ChatState {
  messages: Message[];
  conversationId: string | null;
  isLoading: boolean;
  error: string | null;
  addUserMessage: (text: string) => void;
  addAssistantMessage: (text: string, widget: WidgetPayload | null, regulatoryFootnote: boolean) => void;
  clearChat: () => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  setConversationId: (c: string | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  conversationId: null,
  isLoading: false,
  error: null,

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

  addAssistantMessage: (text, widget, regulatoryFootnote) => {
    const msg: Message = {
      id: nid(),
      role: "assistant",
      text,
      widget,
      timestamp: new Date(),
      regulatoryFootnote,
    };
    set((s) => ({ messages: [...s.messages, msg], error: null }));
  },

  setLoading: (v) => set({ isLoading: v }),
  setError: (e) => set({ error: e }),
  setConversationId: (c) => set({ conversationId: c }),

  clearChat: () =>
    set({
      messages: [],
      conversationId: null,
      error: null,
      isLoading: false,
    }),
}));
