function Card({ children, className = "", padded = true }) {
  return (
    <section
      className={[
        "rounded-3xl border border-white/70 bg-white/80 shadow-sm shadow-slate-200/70 backdrop-blur",
        padded ? "p-5 sm:p-6" : "",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}

export default Card;
