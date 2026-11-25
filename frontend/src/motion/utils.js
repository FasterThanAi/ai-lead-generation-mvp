export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1];

export const staggerChild = {
  hidden: { opacity: 0, y: 16, scale: 0.98, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: EASE_OUT_EXPO },
  },
};

/** Splits "1,284", "12.5%" or "$3.4k" into an animatable number plus decoration. */
export function parseDisplayNumber(raw) {
  const text = String(raw ?? "");
  const match = text.match(/^(\D*?)(-?[\d,]*\.?\d+)(.*)$/);
  if (!match) return null;
  const numeric = Number(match[2].replace(/,/g, ""));
  if (!Number.isFinite(numeric)) return null;
  return {
    prefix: match[1],
    numeric,
    suffix: match[3],
    decimals: (match[2].split(".")[1] || "").length,
    grouped: match[2].includes(",") || numeric >= 1000,
  };
}

/**
 * Pointer-tracking spotlight: sets --spot-x / --spot-y on the element so the
 * `.spotlight` CSS can paint a soft glow under the cursor. No React state.
 */
export function useSpotlight() {
  return {
    onPointerMove: (event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      event.currentTarget.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
      event.currentTarget.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
    },
  };
}

