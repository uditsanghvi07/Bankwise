import { BrandLoader } from "@/components/layout/BrandLoader";

export default function AdvisorLoading() {
  return (
    <BrandLoader
      title="Opening the scenario advisor…"
      subtitle="Setting up FOIR, savings rate, and the 3-path projection engine."
      tips={[
        "Loading Indian benchmark return profiles…",
        "Calibrating inflation and risk bands…",
        "Preparing the goal-feasibility gauge…",
        "Almost ready — drafting your honest verdict…",
      ]}
    />
  );
}
