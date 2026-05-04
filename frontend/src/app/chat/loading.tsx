import { BrandLoader } from "@/components/layout/BrandLoader";

export default function ChatLoading() {
  return (
    <BrandLoader
      title="Opening the chat console…"
      subtitle="Hooking up the agent, your history, and the knowledge base."
      tips={[
        "Loading your past conversations…",
        "Warming up the EMI / eligibility tools…",
        "Pulling the latest knowledge-base citations…",
        "Getting the streaming pipeline ready…",
      ]}
    />
  );
}
