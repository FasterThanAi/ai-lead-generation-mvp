/**
 * Badge — Semantic tone badges supporting all SpecForge quality, validation, and status states.
 */

const toneByVariant = {
  /* lifecycle & product status */
  draft: "neutral",
  pending: "neutral",
  enriching: "info",
  needs_review: "warn",
  proposed: "info",
  approved: "success",
  rejected: "danger",
  conflicted: "warn",
  failed: "danger",
  archived: "neutral",
  imported: "violet",
  completed: "success",

  /* quality grades */
  a: "success",
  b: "info",
  c: "warn",
  d: "danger",
  "grade a": "success",
  "grade b": "info",
  "grade c": "warn",
  "grade d": "danger",

  /* extraction methods */
  pdf: "info",
  vision: "violet",
  html: "info",
  inferred: "warn",
  text: "neutral",

  /* scoring & confidence */
  high: "success",
  medium: "warn",
  low: "neutral",

  /* generic tones */
  success: "success",
  warning: "warn",
  warn: "warn",
  danger: "danger",
  info: "info",
  violet: "violet",
  neutral: "neutral",
};

const dotTones = new Set(["enriching", "running", "in_progress", "pending"]);

function Badge({ children, variant = "neutral", tone, className = "" }) {
  const normalizedVariant = String(tone || variant || "neutral").toLowerCase();
  const activeTone = toneByVariant[normalizedVariant] || normalizedVariant || "neutral";

  return (
    <span className={["tone", `tone-${activeTone}`, className].join(" ")}>
      {dotTones.has(normalizedVariant) && (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-current"
        />
      )}
      {children}
    </span>
  );
}

export default Badge;
