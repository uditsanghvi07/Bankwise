import { create } from "zustand";

import type { AdvisorRequest, AdvisorResponse } from "@/lib/api";

/**
 * In-memory advisor state.
 *
 * Intentionally NOT using zustand/persist — the user wants the report and form
 * values to survive client-side route changes (Chat, Home, Docs ↔ Advisor) but
 * to reset on a hard browser reload (or via the explicit "Start over" button).
 * Plain in-memory state gives us exactly that: route changes don't remount the
 * provider, but a full reload wipes the JS heap and we start fresh.
 */

export const ADVISOR_DEFAULT_FORM: AdvisorRequest = {
  age: 28,
  monthly_income: 80000,
  monthly_expenses: 35000,
  monthly_savings: 20000,
  existing_emi_obligations: 5000,
  current_savings: 150000,
  target_corpus: 10000000,
  horizon_years: 12,
  risk_appetite: "moderate",
  primary_goal: "wealth_growth",
  notes: "",
};

interface AdvisorState {
  formValues: AdvisorRequest;
  request: AdvisorRequest | null;
  response: AdvisorResponse | null;
  loading: boolean;
  error: string | null;

  setFormValues: (next: AdvisorRequest) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  setResult: (req: AdvisorRequest, res: AdvisorResponse) => void;
  reset: () => void;
}

export const useAdvisorStore = create<AdvisorState>((set) => ({
  formValues: ADVISOR_DEFAULT_FORM,
  request: null,
  response: null,
  loading: false,
  error: null,

  setFormValues: (next) => set({ formValues: next }),
  setLoading: (v) => set({ loading: v }),
  setError: (e) => set({ error: e }),
  setResult: (req, res) =>
    set({
      request: req,
      response: res,
      formValues: req,
      loading: false,
      error: null,
    }),
  reset: () =>
    set({
      formValues: ADVISOR_DEFAULT_FORM,
      request: null,
      response: null,
      loading: false,
      error: null,
    }),
}));
