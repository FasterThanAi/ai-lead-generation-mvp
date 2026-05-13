const variantClasses = {
  primary: "bg-slate-950 text-white shadow-sm shadow-slate-200 hover:bg-slate-800",
  secondary: "border border-slate-200 bg-white/80 text-slate-700 hover:bg-slate-50",
  success: "bg-emerald-600 text-white shadow-sm shadow-emerald-100 hover:bg-emerald-700",
  danger: "bg-red-600 text-white shadow-sm shadow-red-100 hover:bg-red-700",
  warning: "bg-amber-500 text-white shadow-sm shadow-amber-100 hover:bg-amber-600",
  ghost: "text-slate-600 hover:bg-slate-100",
  indigo: "bg-indigo-600 text-white shadow-sm shadow-indigo-100 hover:bg-indigo-700",
};

const sizeClasses = {
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-sm",
};

function Button({
  as: Component = "button",
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}) {
  return (
    <Component
      className={[
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl font-semibold transition",
        "focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant] || variantClasses.primary,
        sizeClasses[size] || sizeClasses.md,
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </Component>
  );
}

export default Button;
