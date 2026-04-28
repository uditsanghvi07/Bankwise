import axios from "axios";

/**
 * All browser API calls go to the same origin (`/api/...`). Next proxies to FastAPI using
 * INTERNAL_API_URL. We never use NEXT_PUBLIC_API_URL in the browser so tunnels, LAN IPs, and
 * other devices never accidentally call localhost/127.0.0.1 on the viewer's machine.
 */
const base = typeof window !== "undefined" ? "" : "";

export const api = axios.create({
  baseURL: base,
  timeout: 120_000,
  headers: { "Content-Type": "application/json" },
});

export async function postChat(body: {
  message: string;
  conversation_id: string | null;
  history: { role: "user" | "assistant"; content: string }[];
}) {
  const { data } = await api.post("/api/chat", body);
  return data as {
    text: string;
    widget: { type: string; params: Record<string, unknown> } | null;
    conversation_id: string;
    show_regulatory_footnote: boolean;
  };
}
