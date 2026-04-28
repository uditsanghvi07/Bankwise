"use client";

import type { WidgetPayload } from "@/types";

import { AmortizationWidget } from "./AmortizationWidget";
import { CIBILWidget } from "./CIBILWidget";
import { EMIWidget } from "./EMIWidget";
import { FDWidget } from "./FDWidget";
import { LoanComparisonWidget } from "./LoanComparisonWidget";
import { LoanEligibilityWidget } from "./LoanEligibilityWidget";
import { SIPWidget } from "./SIPWidget";

export function WidgetRenderer({ widget }: { widget: WidgetPayload }) {
  const p = widget.params as Record<string, unknown>;
  switch (widget.type) {
    case "emi_calculator":
      return <EMIWidget params={p} />;
    case "amortization_schedule":
      return <AmortizationWidget params={p} />;
    case "loan_eligibility":
      return <LoanEligibilityWidget params={p} />;
    case "loan_comparison":
      return <LoanComparisonWidget params={p} />;
    case "sip_calculator":
      return <SIPWidget params={p} />;
    case "fd_calculator":
      return <FDWidget params={p} />;
    case "cibil_simulator":
      return <CIBILWidget params={p} />;
    default:
      return null;
  }
}
