import { BrandLoader } from "@/components/layout/BrandLoader";

export default function DocsLoading() {
  return (
    <BrandLoader
      title="Opening the docs…"
      subtitle="Loading the architecture walkthrough — agent loop, RAG, streaming, and safety."
      tips={[
        "Drawing the agent graph…",
        "Lining up the RAG pipeline diagram…",
        "Highlighting calculator + critic flow…",
      ]}
    />
  );
}
