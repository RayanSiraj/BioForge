import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        // Deep-tech "ink" surface scale (dark-first).
        ink: {
          950: "#070B10",
          900: "#0B1017",
          850: "#0F151E",
          800: "#141C27",
          700: "#1E2A38",
          600: "#2A3A4D",
        },
        // Signal accent — bio/enzyme teal-emerald.
        signal: {
          400: "#34E5B0",
          500: "#14C79A",
          600: "#0FA47F",
          700: "#0B7E62",
        },
        // Cool secondary for depth / links.
        electron: {
          400: "#5AC8FF",
          500: "#2AA8F0",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(52,229,176,0.15), 0 12px 40px -12px rgba(52,229,176,0.25)",
        panel: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 60px -30px rgba(0,0,0,0.8)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        drift: {
          "0%, 100%": { transform: "translate3d(0,0,0)" },
          "50%": { transform: "translate3d(0,-14px,0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        drift: "drift 9s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
