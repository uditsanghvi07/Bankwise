import type { Config } from "tailwindcss";

/** Kiwi-inspired palette: deep teal, emerald, soft lime, warm cream — high contrast on cream surfaces */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#028174", light: "#E6F7F2", muted: "#4a9d8c" },
        accent: { DEFAULT: "#0AB68B", soft: "#92DE8B" },
        cream: { DEFAULT: "#FFE3B3", surface: "#FFFCF5", deep: "#f5d9a8" },
        /** Fintech / SaaS accent stack (purple → indigo → coral) */
        brand: {
          violet: "#7c3aed",
          indigo: "#4f46e5",
          coral: "#fb7185",
          sky: "#38bdf8",
        },
        ink: { DEFAULT: "#0f172a", muted: "#475569", soft: "#94a3b8" },
        warning: "#b45309",
        danger: "#b91c1c",
        background: "#f8fafc",
        surface: "#ffffff",
        border: "#e2e8f0",
        "text-primary": "#0f172a",
        "text-secondary": "#334155",
        "text-muted": "#64748b",
      },
      boxShadow: {
        card: "0 1px 3px rgba(2, 97, 116, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
