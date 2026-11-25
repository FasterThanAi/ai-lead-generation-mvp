/**
 * Motion primitives shared across the app. Every one respects the OS
 * "reduce motion" setting through <MotionConfig reducedMotion="user"> and
 * useReducedMotion, so the flashy layer never gets in anyone's way.
 */
import { useEffect, useRef } from "react";
import { animate, m as motion, useInView, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { EASE_OUT_EXPO, parseDisplayNumber, staggerChild } from "./utils";


/** Fades, lifts and un-blurs its children the first time they scroll into view. */
export function Reveal({ children, delay = 0, y = 18, className = "", as = "div", once = true }) {
  const Component = motion[as] || motion.div;
  return (
    <Component
      className={className}
      initial={{ opacity: 0, y, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once, margin: "-40px" }}
      transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay }}
    >
      {children}
    </Component>
  );
}

const staggerParent = (stagger, delayChildren) => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren } },
});

/** Container whose direct <StaggerItem> children cascade in one after another. */
export function Stagger({ children, className = "", stagger = 0.07, delay = 0, as = "div" }) {
  const Component = motion[as] || motion.div;
  return (
    <Component
      className={className}
      variants={staggerParent(stagger, delay)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
    >
      {children}
    </Component>
  );
}

export function StaggerItem({ children, className = "", as = "div", ...props }) {
  const Component = motion[as] || motion.div;
  return (
    <Component className={className} variants={staggerChild} {...props}>
      {children}
    </Component>
  );
}

/**
 * Counts up to `value` when scrolled into view and re-animates from the current
 * number whenever the value changes. Renders through a MotionValue, so the
 * ticking digits never cause React re-renders.
 */
export function CountUp({ value, duration = 1.4, className = "" }) {
  const parsed = parseDisplayNumber(value);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-20px" });
  const reduce = useReducedMotion();
  const motionValue = useMotionValue(0);
  const text = useTransform(motionValue, (latest) => {
    if (!parsed) return String(value ?? "");
    const formatted = latest.toLocaleString(undefined, {
      minimumFractionDigits: parsed.decimals,
      maximumFractionDigits: parsed.decimals,
      useGrouping: parsed.grouped,
    });
    return `${parsed.prefix}${formatted}${parsed.suffix}`;
  });

  const target = parsed?.numeric ?? 0;
  useEffect(() => {
    if (!parsed || !inView) return undefined;
    if (reduce) {
      motionValue.set(target);
      return undefined;
    }
    const controls = animate(motionValue, target, { duration, ease: EASE_OUT_EXPO });
    return () => controls.stop();
    // `parsed` is derived from `value`; `target` captures the part that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, target, reduce, duration, motionValue]);

  if (!parsed) {
    return <span ref={ref} className={className}>{value}</span>;
  }
  return <motion.span ref={ref} className={className}>{text}</motion.span>;
}

/** 3D tilt that follows the pointer and springs back on leave. */
export function TiltCard({ children, className = "", max = 7, ...props }) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const springConfig = { stiffness: 220, damping: 22, mass: 0.6 };
  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), springConfig);
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), springConfig);
  const glareX = useTransform(px, [0, 1], ["0%", "100%"]);
  const glareY = useTransform(py, [0, 1], ["0%", "100%"]);
  const glare = useMotionTemplate`radial-gradient(420px circle at ${glareX} ${glareY}, rgba(255,255,255,0.14), transparent 45%)`;

  if (reduce) {
    return <div className={className} {...props}>{children}</div>;
  }

  return (
    <motion.div
      className={["relative [transform-style:preserve-3d]", className].join(" ")}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        px.set((event.clientX - rect.left) / rect.width);
        py.set((event.clientY - rect.top) / rect.height);
      }}
      onPointerLeave={() => {
        px.set(0.5);
        py.set(0.5);
      }}
      {...props}
    >
      {children}
      <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ background: glare }} />
    </motion.div>
  );
}

/** Element that drifts toward the pointer while hovered (for CTAs). */
export function Magnetic({ children, strength = 0.25, className = "" }) {
  const reduce = useReducedMotion();
  const x = useSpring(0, { stiffness: 300, damping: 20 });
  const y = useSpring(0, { stiffness: 300, damping: 20 });
  if (reduce) return <span className={className}>{children}</span>;
  return (
    <motion.span
      className={["inline-flex", className].join(" ")}
      style={{ x, y }}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        x.set((event.clientX - rect.left - rect.width / 2) * strength);
        y.set((event.clientY - rect.top - rect.height / 2) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.span>
  );
}

/** Reveals a heading word by word with a blur-up. */
export function SplitText({ text, className = "", delay = 0, stagger = 0.06, as = "h2" }) {
  const Component = motion[as] || motion.h2;
  const words = String(text).split(" ");
  return (
    <Component
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
      aria-label={text}
    >
      {words.map((word, index) => (
        <span key={`${word}-${index}`} aria-hidden="true" className="inline-block overflow-hidden pb-[0.08em] align-top">
          <motion.span
            className="inline-block"
            variants={{
              hidden: { y: "110%", opacity: 0, filter: "blur(6px)" },
              show: { y: "0%", opacity: 1, filter: "blur(0px)", transition: { duration: 0.75, ease: EASE_OUT_EXPO } },
            }}
          >
            {word}
          </motion.span>
          {index < words.length - 1 ? " " : ""}
        </span>
      ))}
    </Component>
  );
}

