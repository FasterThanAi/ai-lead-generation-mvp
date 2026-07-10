const toneClasses = {
  success: "border-success-100 bg-success-50 text-success-700",
  warning: "border-warning-100 bg-warning-50 text-warning-700",
  danger: "border-danger-100 bg-danger-50 text-danger-700",
  info: "border-primary-100 bg-primary-50 text-primary-700",
  neutral: "border-neutral-200 bg-neutral-50 text-neutral-700",
};

function Toast({ tone = "neutral", children, className = "" }) {
  return (
    <div
      role="status"
      className={[
        "rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm",
        toneClasses[tone] || toneClasses.neutral,
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export default Toast;
