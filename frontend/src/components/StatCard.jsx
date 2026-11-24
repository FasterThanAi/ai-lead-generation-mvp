/**
 * StatCard — API unchanged (title, value, eyebrow, tone, helper).
 * tone: primary | accent | success | warning | danger | neutral
 */
const toneVar = {
  primary: "var(--accent-from)",
  accent: "var(--accent-to)",
  success: "var(--t-success)",
  warning: "var(--t-warn)",
  danger: "var(--t-danger)",
  neutral: "var(--t-neutral)",
};

function StatCard({ title, value, eyebrow, tone = "primary", helper }) {
  const accent = toneVar[tone] || toneVar.primary;

  return (
    <div className="glass rounded-panel p-5" style={{ "--tone": accent }}>
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: "rgb(var(--tone))" }} />
        <p className="text-muted truncate text-sm font-medium">{title}</p>
        {eyebrow && <span className="text-faint ml-auto truncate text-xs">{eyebrow}</span>}
      </div>
      <p className="text-ink tabular mt-3 break-words text-metric">{value}</p>
      {helper && <p className="text-faint mt-1.5 text-xs">{helper}</p>}
    </div>
  );
}

export default StatCard;
