/** @type {import('tailwindcss').Config} */

// Couleur de thème (variable CSS) compatible avec les modificateurs d'opacité (bg-surface-0/85, border-brand-500/20…)
const themed = (v) => `color-mix(in srgb, var(${v}) calc(<alpha-value> * 100%), transparent)`;
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0", 300: "#6ee7b7",
          400: "rgb(var(--accent-brand) / <alpha-value>)", 500: themed("--brand-500"), 600: "#059669", 700: "#047857",
          800: "#065f46", 900: "#064e3b",
        },
        emerald: { 400: "rgb(var(--accent-emerald) / <alpha-value>)", 500: "#10b981", 600: "#059669" },
        rose: { 400: "rgb(var(--accent-rose) / <alpha-value>)", 500: "#f43f5e", 600: "#e11d48" },
        amber: { 400: "rgb(var(--accent-amber) / <alpha-value>)", 500: "#f59e0b", 600: "#d97706" },
        surface: {
          0: themed("--surface-0"),
          1: themed("--surface-1"),
          2: themed("--surface-2"),
          3: themed("--surface-3"),
          4: themed("--surface-4"),
          5: themed("--surface-5"),
        },
        text: {
          primary: themed("--text-primary"),
          secondary: themed("--text-secondary"),
          muted: themed("--text-muted"),
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        mono: ['"DM Mono"', "monospace"],
      },
      borderRadius: {
        xl: "12px", "2xl": "16px", "3xl": "20px",
      },
    },
  },
  plugins: [],
};

