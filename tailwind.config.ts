import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        persian: {
          DEFAULT: "#5e17eb",
          dark: "#4d0fd4",
          light: "#7c3aed",
        },
        yellow: {
          DEFAULT: "#f6cb1f",
          dark: "#d4a800",
        },
        surface: "#0d0d0d",
        "text-primary": "#ffffff",
        "text-muted": "rgba(255,255,255,0.65)",
        "text-faint": "rgba(255,255,255,0.35)",
        "border-hover": "rgba(255,255,255,0.18)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
      },
      borderRadius: {
        lg: "16px",
        xl: "24px",
      },
    },
  },
  plugins: [],
};

export default config;
