import { motion } from "framer-motion";

function StatCard({ title, value, eyebrow, tone = "primary", helper }) {
  const toneClasses = {
    primary: "from-primary-50 to-white text-primary-700 ring-primary-100",
    accent: "from-accent-50 to-white text-accent-700 ring-accent-100",
    success: "from-success-50 to-white text-success-700 ring-success-100",
    warning: "from-warning-50 to-white text-warning-700 ring-warning-100",
    danger: "from-danger-50 to-white text-danger-700 ring-danger-100",
    neutral: "from-neutral-50 to-white text-neutral-700 ring-neutral-200",
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={[
        "group relative overflow-hidden rounded-panel border border-white/80 bg-gradient-to-br p-5 shadow-soft backdrop-blur",
        "transition duration-300 hover:shadow-lift focus-within:ring-4",
        toneClasses[tone] || toneClasses.primary,
      ].join(" ")}
    >
      <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
              {eyebrow}
            </p>
          )}
          <p className="text-sm font-semibold text-neutral-600">{title}</p>
          <h3 className="mt-2 break-words text-metric tracking-tight text-neutral-950">{value}</h3>
        </div>
        <span className="mt-1 h-10 w-10 rounded-2xl bg-white/80 ring-1 ring-current/10 transition group-hover:scale-105" />
      </div>
      {helper && (
        <p className="mt-4 text-xs font-medium text-neutral-500">{helper}</p>
      )}
    </motion.div>
  );
}

export default StatCard;
