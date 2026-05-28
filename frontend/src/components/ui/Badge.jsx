const badgeClasses = {
  generated: "border-blue-100 bg-blue-50 text-blue-700",
  draft: "border-slate-200 bg-slate-100 text-slate-600",
  approved: "border-emerald-100 bg-emerald-50 text-emerald-700",
  converted: "border-emerald-100 bg-emerald-50 text-emerald-700",
  archived: "border-slate-200 bg-slate-100 text-slate-500",
  running: "border-amber-100 bg-amber-50 text-amber-700",
  completed: "border-emerald-100 bg-emerald-50 text-emerald-700",
  pending: "border-slate-200 bg-slate-100 text-slate-600",
  imported: "border-indigo-100 bg-indigo-50 text-indigo-700",
  updated_existing: "border-sky-100 bg-sky-50 text-sky-700",
  discovery: "border-sky-100 bg-sky-50 text-sky-700",
  queued: "border-blue-100 bg-blue-50 text-blue-700",
  ringing: "border-amber-100 bg-amber-50 text-amber-700",
  in_progress: "border-indigo-100 bg-indigo-50 text-indigo-700",
  no_answer: "border-slate-200 bg-slate-100 text-slate-600",
  canceled: "border-slate-200 bg-slate-100 text-slate-600",
  asked_details: "border-sky-100 bg-sky-50 text-sky-700",
  call_later: "border-amber-100 bg-amber-50 text-amber-700",
  do_not_call: "border-red-100 bg-red-50 text-red-700",
  professor: "border-violet-100 bg-violet-50 text-violet-700",
  college: "border-indigo-100 bg-indigo-50 text-indigo-700",
  department: "border-blue-100 bg-blue-50 text-blue-700",
  company: "border-slate-200 bg-white/80 text-slate-700",
  startup: "border-emerald-100 bg-emerald-50 text-emerald-700",
  student: "border-amber-100 bg-amber-50 text-amber-700",
  rejected: "border-red-100 bg-red-50 text-red-700",
  sending: "border-amber-100 bg-amber-50 text-amber-700",
  sent: "border-indigo-100 bg-indigo-50 text-indigo-700",
  failed: "border-red-100 bg-red-50 text-red-700",
  replied: "border-emerald-100 bg-emerald-50 text-emerald-700",
  high: "border-emerald-100 bg-emerald-50 text-emerald-700",
  medium: "border-amber-100 bg-amber-50 text-amber-700",
  low: "border-slate-200 bg-slate-100 text-slate-600",
  hot: "border-emerald-100 bg-emerald-50 text-emerald-700",
  warm: "border-amber-100 bg-amber-50 text-amber-700",
  cold: "border-slate-200 bg-slate-100 text-slate-600",
  "not relevant": "border-red-100 bg-red-50 text-red-700",
  interested: "border-emerald-100 bg-emerald-50 text-emerald-700",
  "asked for pricing": "border-blue-100 bg-blue-50 text-blue-700",
  "asked for more info": "border-sky-100 bg-sky-50 text-sky-700",
  "meeting request": "border-green-100 bg-green-50 text-green-700",
  "not interested": "border-red-100 bg-red-50 text-red-700",
  "wrong person": "border-amber-100 bg-amber-50 text-amber-700",
  "out of office": "border-amber-100 bg-amber-50 text-amber-700",
  unsubscribe: "border-red-100 bg-red-50 text-red-700",
  "spam/irrelevant": "border-slate-200 bg-slate-100 text-slate-600",
  unknown: "border-slate-200 bg-white/80 text-slate-600",
  positive: "border-emerald-100 bg-emerald-50 text-emerald-700",
  negative: "border-red-100 bg-red-50 text-red-700",
  neutral: "border-slate-200 bg-white/80 text-slate-600",
  success: "border-emerald-100 bg-emerald-50 text-emerald-700",
  warning: "border-amber-100 bg-amber-50 text-amber-700",
  danger: "border-red-100 bg-red-50 text-red-700",
  new: "border-blue-100 bg-blue-50 text-blue-700",
  email_found: "border-emerald-100 bg-emerald-50 text-emerald-700",
  email_not_found: "border-amber-100 bg-amber-50 text-amber-700",
  website_missing: "border-slate-200 bg-slate-100 text-slate-600",
  extraction_failed: "border-red-100 bg-red-50 text-red-700",
  not_researched: "border-slate-200 bg-slate-100 text-slate-600",
  researching: "border-amber-100 bg-amber-50 text-amber-700",
  researched: "border-emerald-100 bg-emerald-50 text-emerald-700",
};

function Badge({ children, variant = "neutral", className = "" }) {
  const normalizedVariant = String(variant || "neutral").toLowerCase();

  return (
    <span
      className={[
        "inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        badgeClasses[normalizedVariant] || badgeClasses.neutral,
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

export default Badge;
