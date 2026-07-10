/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eef6ff",
          100: "#d9ebff",
          500: "#2878ff",
          600: "#155ee8",
          700: "#124cc0",
          950: "#071832",
        },
        accent: {
          50: "#ecfdf5",
          100: "#d1fae5",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
        neutral: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          500: "#64748b",
          700: "#334155",
          900: "#0f172a",
          950: "#020617",
        },
        success: {
          50: "#ecfdf5",
          100: "#d1fae5",
          600: "#059669",
          700: "#047857",
        },
        warning: {
          50: "#fffbeb",
          100: "#fef3c7",
          500: "#f59e0b",
          700: "#b45309",
        },
        danger: {
          50: "#fef2f2",
          100: "#fee2e2",
          600: "#dc2626",
          700: "#b91c1c",
        },
      },
      borderRadius: {
        component: "1.25rem",
        panel: "1.75rem",
      },
      boxShadow: {
        soft: "0 18px 45px rgba(15, 23, 42, 0.08)",
        lift: "0 22px 60px rgba(15, 23, 42, 0.14)",
      },
      fontSize: {
        "display-sm": ["2rem", { lineHeight: "2.35rem", fontWeight: "700" }],
        metric: ["1.875rem", { lineHeight: "2.25rem", fontWeight: "700" }],
      },
      spacing: {
        section: "1.5rem",
        "section-lg": "2rem",
      },
    },
  },
};
