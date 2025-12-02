import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        parchment: "var(--parchment)",
        ledger: "var(--ledger)",
        graphite: "var(--graphite)",
        sage: "var(--sage)",
        copper: "var(--copper)",
        signal: "var(--signal)",
        ember: "var(--ember)"
      },
      boxShadow: {
        panel: "0 24px 80px rgba(19, 21, 20, 0.08)",
        evidence: "0 18px 42px rgba(19, 21, 20, 0.06)"
      },
      borderRadius: {
        panel: "28px"
      },
      fontFamily: {
        sans: [
          "Avenir Next",
          "Segoe UI",
          "sans-serif"
        ],
        serif: [
          "Iowan Old Style",
          "Georgia",
          "serif"
        ]
      }
    }
  },
  plugins: []
};

export default config;
