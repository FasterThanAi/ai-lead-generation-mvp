/** @type {import('tailwindcss').Config} */

/**
 * Midnight Aurora.
 *
 * Every colour here resolves to a CSS variable defined in `src/index.css`,
 * so a single `.light` / `.dark` class on <html> repaints the whole app.
 * Never hard-code a hex in a component — reach for a token below, or one of
 * the `.glass` / `.tone-*` / `.btn-*` component classes.
 */

const channel = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  darkMode: ["class", "html.dark"],
  theme: {
    extend: {
      colors: {
        /* --- canvas ------------------------------------------------------ */
        canvas: {
          0: "var(--bg-0)",
          1: "var(--bg-1)",
          2: "var(--bg-2)",
        },

        /* Semantic tones are NOT declared here on purpose — they live as
           `text-success` / `bg-success-soft` / `border-success-soft` utilities
           in index.css so a Tailwind colour of the same name can't shadow
           them. See the tone block in src/index.css. */

        /* --- legacy names, remapped so any missed class still themes ----- */
        primary: {
          50: "rgb(var(--accent-from) / 0.10)",
          100: "rgb(var(--accent-from) / 0.18)",
          500: channel("--accent-from"),
          600: channel("--accent-from"),
          700: channel("--accent-from"),
          950: "var(--bg-1)",
        },
        accent: {
          50: "rgb(var(--accent-to) / 0.10)",
          100: "rgb(var(--accent-to) / 0.18)",
          500: channel("--accent-to"),
          600: channel("--accent-to"),
          700: channel("--accent-to"),
        },
        warning: {
          50: "rgb(var(--t-warn) / 0.10)",
          100: "rgb(var(--t-warn) / 0.20)",
          500: channel("--t-warn"),
          700: channel("--t-warn"),
        },
        neutral: {
          50: "var(--glass-sunk)",
          100: "var(--glass-1)",
          200: "var(--line-1)",
          500: "var(--text-3)",
          700: "var(--text-2)",
          900: "var(--text-1)",
          950: "var(--text-1)",
        },
      },

      borderRadius: {
        component: "0.625rem",
        panel: "0.875rem",
        hero: "1rem",
      },

      boxShadow: {
        soft: "var(--sh-1)",
        lift: "var(--sh-2)",
        deep: "var(--sh-3)",
        glow: "var(--sh-glow)",
      },

      backdropBlur: {
        glass: "22px",
      },

      fontSize: {
        "display-lg": ["clamp(1.875rem, 1.5rem + 1.6vw, 2.5rem)", { lineHeight: "1.15", fontWeight: "600", letterSpacing: "-0.025em" }],
        "display-sm": ["1.5rem", { lineHeight: "2rem", fontWeight: "600", letterSpacing: "-0.02em" }],
        metric: ["1.75rem", { lineHeight: "2.25rem", fontWeight: "600", letterSpacing: "-0.02em" }],
        eyebrow: ["0.6875rem", { lineHeight: "1rem", fontWeight: "600", letterSpacing: "0.06em" }],
      },

      spacing: {
        section: "1.5rem",
        "section-lg": "2rem",
        sidebar: "15.5rem",
        "sidebar-sm": "4.25rem",
      },

      transitionTimingFunction: {
        spring: "cubic-bezier(0.22, 1, 0.36, 1)",
      },

      keyframes: {
        rise: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "none" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-14px)" },
          to: { opacity: "1", transform: "none" },
        },
      },

      animation: {
        rise: "rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 0.4s ease both",
        "slide-in-left": "slide-in-left 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
};
