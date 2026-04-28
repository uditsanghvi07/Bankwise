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
        warning: "#b45309",
        danger: "#b91c1c",
        background: "#FFFBF0",
        surface: "#FFFCF8",
        border: "#c5e4d6",
        "text-primary": "#063d38",
        "text-secondary": "#2d5c54",
        "text-muted": "#5a7d76",
      },
      boxShadow: {
        card: "0 1px 3px rgba(2, 97, 116, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
