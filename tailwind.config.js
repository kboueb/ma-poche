/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0", 300: "#6ee7b7",
          400: "#34d399", 500: "var(--brand-500)", 600: "#059669", 700: "#047857",
          800: "#065f46", 900: "#064e3b",
        },
        emerald: { 400: "#34d399", 500: "#10b981", 600: "#059669" },
        rose: { 400: "#fb7185", 500: "#f43f5e", 600: "#e11d48" },
        amber: { 400: "#fbbf24", 500: "#f59e0b", 600: "#d97706" },
        surface: {
          0: "var(--surface-0)",
          1: "var(--surface-1)",
          2: "var(--surface-2)",
          3: "var(--surface-3)",
          4: "var(--surface-4)",
          5: "var(--surface-5)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
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

