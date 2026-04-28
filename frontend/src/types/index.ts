export type WidgetType =
  | "emi_calculator"
  | "loan_eligibility"
  | "loan_comparison"
  | "amortization_schedule"
  | "sip_calculator"
  | "fd_calculator"
  | "cibil_simulator";

export interface WidgetPayload {
  type: WidgetType;
  params: Record<string, unknown>;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  widget: WidgetPayload | null;
  timestamp: Date;
  regulatoryFootnote?: boolean;
}
