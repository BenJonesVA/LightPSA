import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        border: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
        },
        grid: "var(--grid)",
        fg: {
          DEFAULT: "var(--fg)",
          muted: "var(--fg-muted)",
          subtle: "var(--fg-subtle)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          weak: "var(--accent-weak)",
          fg: "var(--accent-fg)",
        },
        focus: "var(--focus)",
        green: { DEFAULT: "var(--green)", bg: "var(--green-bg)" },
        amber: { DEFAULT: "var(--amber)", bg: "var(--amber-bg)" },
        orange: { DEFAULT: "var(--orange)", bg: "var(--orange-bg)" },
        red: { DEFAULT: "var(--red)", bg: "var(--red-bg)" },
        blue: { DEFAULT: "var(--blue)", bg: "var(--blue-bg)" },
        violet: { DEFAULT: "var(--violet)", bg: "var(--violet-bg)" },
        slate: { DEFAULT: "var(--slate)", bg: "var(--slate-bg)" },
      },
      fontFamily: {
        sans: ["var(--font)", "system-ui", "sans-serif"],
        mono: ["var(--mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        DEFAULT: "var(--shadow)",
        lg: "var(--shadow-lg)",
      },
      spacing: {
        "row-py": "var(--row-py)",
      },
    },
  },
  plugins: [],
};

export default config;
