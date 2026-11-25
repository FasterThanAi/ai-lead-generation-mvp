import { m as motion } from "framer-motion";
import { CountUp } from "../motion/primitives";
import { useSpotlight } from "../motion/utils";

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
  const spotlight = useSpotlight();

  return (
    <motion.div
      {...spotlight}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="glass spotlight group relative overflow-hidden rounded-panel p-5"
      style={{ "--tone": accent }}
    >
      {/* Tone glow in the corner that brightens on hover. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-25 blur-2xl transition-opacity duration-500 group-hover:opacity-60"
        style={{ backgroundColor: "rgb(var(--tone))" }}
      />
      <div className="relative flex items-center gap-2">
        <span aria-hidden="true" className="live-dot" style={{ color: "rgb(var(--tone))" }} />
        <p className="text-muted truncate text-sm font-medium">{title}</p>
        {eyebrow && <span className="text-faint ml-auto truncate text-xs">{eyebrow}</span>}
      </div>
      <p className="text-ink tabular relative mt-3 break-words text-metric">
        <CountUp value={value} />
      </p>
      {helper && <p className="text-faint relative mt-1.5 text-xs">{helper}</p>}
      {/* Accent line that draws in when the card enters the viewport. */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[2px] origin-left"
        style={{ background: "linear-gradient(90deg, rgb(var(--tone)), transparent)" }}
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
      />
    </motion.div>
  );
}

export default StatCard;
