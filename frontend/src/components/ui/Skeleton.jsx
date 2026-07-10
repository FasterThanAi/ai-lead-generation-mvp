function Skeleton({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={[
        "animate-pulse rounded-2xl bg-gradient-to-r from-neutral-100 via-white to-neutral-100",
        className,
      ].join(" ")}
    />
  );
}

export default Skeleton;
