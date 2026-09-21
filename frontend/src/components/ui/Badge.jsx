/**
 * Badge — API unchanged. Every variant key from the old map is preserved,
 * now expressed as one of seven semantic tones so both themes stay legible.
 */

const toneByVariant = {
  /* lifecycle */
  draft: "neutral",
  pending: "neutral",
  generated: "info",
  running: "warn",
  in_progress: "violet",
  completed: "success",
  approved: "success",
  converted: "success",
  rejected: "danger",
  failed: "danger",
  archived: "neutral",
  imported: "violet",
  updated_existing: "info",
  discovery: "info",
  queued: "info",
  sending: "warn",
  sent: "violet",
  replied: "success",

  /* calls */
  ringing: "warn",
  no_answer: "neutral",
  canceled: "neutral",
  asked_details: "info",
  call_later: "warn",
  do_not_call: "danger",
  test: "violet",
  actual: "success",

  /* discovery target types */
  professor: "violet",
  college: "violet",
  department: "info",
  company: "neutral",
  startup: "success",
  student: "warn",

  /* scoring */
  high: "success",
  medium: "warn",
  low: "neutral",
  hot: "pink",
  warm: "warn",
  cold: "neutral",

  /* reply intents */
  interested: "success",
  "asked for pricing": "info",
  "asked for more info": "info",
  "meeting request": "success",
  "not interested": "danger",
  "not relevant": "danger",
  "wrong person": "warn",
  "out of office": "warn",
  unsubscribe: "danger",
  "spam/irrelevant": "neutral",
  unknown: "neutral",

  /* sentiment */
  positive: "success",
  negative: "danger",
  neutral: "neutral",

  /* generic */
  success: "success",
  warning: "warn",
  danger: "danger",
  info: "info",

  /* lead status */
  new: "info",
  email_found: "success",
  email_not_found: "warn",
  website_missing: "neutral",
  extraction_failed: "danger",
  not_researched: "neutral",
  researching: "warn",
  researched: "success",

  /* processing + results returned by the backend */
  created: "info",
  processing: "warn",
  processed: "success",
  classified: "violet",
  skipped: "neutral",
  found: "success",
  not_found: "warn",
  error: "danger",
};

const dotTones = new Set(["running", "in_progress", "ringing", "sending", "researching", "queued", "processing"]);

// Accept "In Progress", "email-found" and "email_found" alike.
function resolveVariant(variant) {
  const normalized = String(variant || "neutral").trim().toLowerCase();

  if (Object.hasOwn(toneByVariant, normalized)) {
    return normalized;
  }

  const snakeCased = normalized.replace(/[\s-]+/g, "_");
  return Object.hasOwn(toneByVariant, snakeCased) ? snakeCased : normalized;
}

function Badge({ children, variant = "neutral", className = "" }) {
  const normalizedVariant = resolveVariant(variant);
  const tone = Object.hasOwn(toneByVariant, normalizedVariant) ? toneByVariant[normalizedVariant] : "neutral";

  return (
    <span className={["tone", `tone-${tone}`, className].join(" ")}>
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
