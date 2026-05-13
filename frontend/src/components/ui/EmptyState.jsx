function EmptyState({ title, description, children }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          {description}
        </p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export default EmptyState;
