import { useSpotlight } from "../../motion/utils";

/**
 * Card — API unchanged (children, className, padded, interactive).
 * Every card tracks the pointer for the `.spotlight` glow; `interactive`
 * adds a hover lift.
 */
function Card({ children, className = "", padded = true, interactive = false }) {
  const spotlight = useSpotlight();
  return (
    <section
      {...spotlight}
      className={[
        "glass spotlight rounded-panel",
        interactive ? "glass-hover transition-transform duration-300 hover:-translate-y-0.5" : "",
        padded ? "p-4 sm:p-5 lg:p-6" : "",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}

export default Card;
