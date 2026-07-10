function Card({ children, className = "", padded = true }) {
  return (
    <section
      className={[
        "rounded-panel border border-white/80 bg-white/85 shadow-soft backdrop-blur transition duration-300",
        padded ? "p-5 sm:p-6" : "",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}

export default Card;
