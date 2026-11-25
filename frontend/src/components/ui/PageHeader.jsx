import { m as motion } from "framer-motion";

function PageHeader({ title, description, eyebrow, actions }) {
  return (
    <motion.div
      className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
      initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-accent mb-2 text-eyebrow uppercase">{eyebrow}</p>
        )}

        <h2 className="text-ink text-display-sm">
          {title}
        </h2>

        {description && (
          <p className="text-muted mt-1 max-w-3xl text-sm leading-6">{description}</p>
        )}
      </div>

      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </motion.div>
  );
}

export default PageHeader;
