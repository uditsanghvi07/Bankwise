import axios from "axios";

import type { TraceStep, WidgetPayload } from "@/types";

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

export type ChatHistoryItem = { role: "user" | "assistant"; content: string };

export async function postChat(body: {
  message: string;
  conversation_id: string | null;
  history: ChatHistoryItem[];
}) {
  const { data } = await api.post("/api/chat", body);
  return data as {
    text: string;
    widget: { type: string; params: Record<string, unknown> } | null;
    conversation_id: string;
    show_regulatory_footnote: boolean;
    trace?: TraceStep[];
    kb_citations?: string[];
  };
}

export interface StreamCallbacks {
  onMeta?: (m: { conversation_id: string; phase?: string }) => void;
  onTrace?: (t: { trace: TraceStep[]; kb_citations: string[] }) => void;
  onWidget?: (w: { type?: string; params?: Record<string, unknown> }) => void;
  onDelta?: (d: { text: string }) => void;
  onDone?: (d: {
    conversation_id: string;
    show_regulatory_footnote: boolean;
    kb_citations: string[];
    widget: { type?: string; params?: Record<string, unknown> } | null;
  }) => void;
  onError?: (err: Error) => void;
}

export async function postChatStream(
  body: { message: string; conversation_id: string | null; history: ChatHistoryItem[] },
  cbs: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    cbs.onError?.(e instanceof Error ? e : new Error(String(e)));
    return;
  }
  if (!res.ok || !res.body) {
    cbs.onError?.(new Error(`stream failed: HTTP ${res.status}`));
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const event = parseSseFrame(frame);
        if (!event) continue;
        try {
          const data = event.data ? JSON.parse(event.data) : {};
          if (event.event === "meta") cbs.onMeta?.(data);
          else if (event.event === "trace") cbs.onTrace?.(data);
          else if (event.event === "widget") cbs.onWidget?.(data);
          else if (event.event === "delta") cbs.onDelta?.(data);
          else if (event.event === "done") cbs.onDone?.(data);
        } catch {
          // ignore malformed frame
        }
      }
    }
  } catch (e) {
    if ((e as Error).name !== "AbortError") {
      cbs.onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  }
}

function parseSseFrame(frame: string): { event: string; data: string } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const raw of frame.split("\n")) {
    const line = raw.trimEnd();
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^\s/, ""));
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

// ---------------- conversations ---------------- //

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

export interface StoredMessageDTO {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  widget: { type: string; params: Record<string, unknown> } | null;
  trace: TraceStep[];
  kb_citations: string[];
  show_regulatory_footnote: boolean;
  created_at: number;
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const { data } = await api.get<{ conversations: ConversationSummary[] }>("/api/conversations/");
  return data.conversations;
}

export async function createConversation(title = "New chat"): Promise<ConversationSummary> {
  const { data } = await api.post<ConversationSummary>("/api/conversations/", { title });
  return data;
}

export async function fetchConversation(id: string): Promise<{
  conversation: ConversationSummary;
  messages: StoredMessageDTO[];
}> {
  const { data } = await api.get(`/api/conversations/${id}`);
  return data;
}

export async function renameConversation(id: string, title: string): Promise<void> {
  await api.patch(`/api/conversations/${id}`, { title });
}

export async function deleteConversation(id: string): Promise<void> {
  await api.delete(`/api/conversations/${id}`);
}

// ---------------- advisor ---------------- //

export interface AdvisorRequest {
  age: number;
  monthly_income: number;
  monthly_expenses: number;
  monthly_savings: number;
  existing_emi_obligations: number;
  current_savings: number;
  target_corpus: number;
  horizon_years: number;
  risk_appetite: "low" | "moderate" | "high";
  primary_goal: "retirement" | "home" | "child_education" | "wealth_growth" | "emergency_fund" | "tax_saving";
  notes?: string | null;
}

export interface AdvisorProjectionPoint {
  year: number;
  age: number;
  contribution_to_date: number;
  portfolio_value: number;
  portfolio_pessimistic?: number | null;
  portfolio_optimistic?: number | null;
  nominal_target: number | null;
}

export interface AdvisorRecommendation {
  title: string;
  detail: string;
  weight_pct: number;
}

export type AdvisorVerdictSeverity = "excellent" | "healthy" | "stretched" | "concerning" | "critical";
export type AdvisorVerdictTone = "celebrate" | "encourage" | "caution" | "alarm";

export interface AdvisorVerdict {
  label: string;
  severity: AdvisorVerdictSeverity;
  tone: AdvisorVerdictTone;
  headline: string;
  one_liner: string;
}

export interface AdvisorScenarioReturns {
  profile: "low" | "moderate" | "high";
  base_pct: number;
  pessimistic_pct: number;
  optimistic_pct: number;
  inflation_pct: number;
  profile_stdev_pct: number;
}

export interface AdvisorGoalFeasibility {
  feasible: boolean;
  sip_required_base: number;
  sip_required_pessimistic: number;
  sip_required_optimistic: number;
  pct_of_current_savings: number;
  label: "conservative" | "on_track" | "ambitious" | "unrealistic";
  note: string;
}

export interface AdvisorResponse {
  summary: string;
  health_score: number;
  foir_used_pct: number;
  savings_rate_pct: number;
  net_cashflow?: number;
  emergency_fund_months?: number;
  expected_return_pct: number;
  monthly_sip_required: number;
  inflation_adjusted_target?: number | null;
  real_corpus_at_horizon?: number;
  returns?: AdvisorScenarioReturns | null;
  verdict?: AdvisorVerdict | null;
  goal_feasibility?: AdvisorGoalFeasibility | null;
  red_flags?: string[];
  green_flags?: string[];
  projections: AdvisorProjectionPoint[];
  recommendations: AdvisorRecommendation[];
  risks: string[];
  disclaimers: string[];
  narrative: string;
}

export async function postAdvisorScenario(req: AdvisorRequest): Promise<AdvisorResponse> {
  const { data } = await api.post<AdvisorResponse>("/api/advisor/scenario", req);
  return data;
}

// ---------------- export ---------------- //

export async function downloadTranscriptPdf(conversation_id: string, title?: string): Promise<void> {
  const res = await api.post(
    "/api/export/transcript",
    { conversation_id, title },
    { responseType: "blob" },
  );
  triggerDownload(res.data as Blob, `bankwise-transcript-${conversation_id.slice(0, 8)}.pdf`);
}

export async function downloadAdvisorPdf(req: AdvisorRequest, res: AdvisorResponse): Promise<void> {
  const r = await api.post(
    "/api/export/advisor",
    { request: req, response: res },
    { responseType: "blob" },
  );
  triggerDownload(r.data as Blob, `bankwise-advisor-${Date.now()}.pdf`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
