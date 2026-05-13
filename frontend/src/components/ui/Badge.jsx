const badgeClasses = {
  generated: "border-blue-100 bg-blue-50 text-blue-700",
  approved: "border-emerald-100 bg-emerald-50 text-emerald-700",
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
  neutral: "border-slate-200 bg-white/80 text-slate-600",
  success: "border-emerald-100 bg-emerald-50 text-emerald-700",
  warning: "border-amber-100 bg-amber-50 text-amber-700",
  danger: "border-red-100 bg-red-50 text-red-700",
  new: "border-blue-100 bg-blue-50 text-blue-700",
  email_found: "border-emerald-100 bg-emerald-50 text-emerald-700",
  email_not_found: "border-amber-100 bg-amber-50 text-amber-700",
  website_missing: "border-slate-200 bg-slate-100 text-slate-600",
  extraction_failed: "border-red-100 bg-red-50 text-red-700",
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
