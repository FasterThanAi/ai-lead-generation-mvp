/**
 * Button — API unchanged.
 * variant: primary | secondary | success | danger | warning | ghost | indigo
 * size:    sm | md | lg
 * loading: shows a spinner, sets aria-busy and disables a native <button>
 */

const variantClasses = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  success: "btn-tone [--tone:var(--t-success)]",
  danger: "btn-tone [--tone:var(--t-danger)]",
  warning: "btn-tone [--tone:var(--t-warn)]",
  indigo: "btn-tone [--tone:var(--t-violet)]",
};

const sizeClasses = {
  sm: "px-3 py-1.5 text-xs min-h-9 rounded-xl",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-sm min-h-12 rounded-2xl",
};

function Button({
  as: Component = "button",
  variant = "primary",
  size = "md",
  className = "",
  loading = false,
  disabled,
  children,
  ...props
}) {
  const isNativeButton = Component === "button";

  return (
    <Component
      className={[
        "btn",
        variantClasses[variant] || variantClasses.primary,
        sizeClasses[size] || sizeClasses.md,
        className,
      ].join(" ")}
      aria-busy={loading || undefined}
      disabled={isNativeButton ? disabled || loading : disabled}
      {...props}
    >
      <span className="relative z-10 inline-flex items-center gap-2">
        {loading && (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
        {children}
      </span>
    </Component>
  );
}

export default Button;
