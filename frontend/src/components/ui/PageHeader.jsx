function PageHeader({ title, description, eyebrow, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {eyebrow}
          </p>
        )}
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          {title}
        </h2>
        {description && (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

export default PageHeader;
