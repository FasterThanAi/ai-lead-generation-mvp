import Icon from "./Icon";

export default function Pagination({ page, pageSize, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) {
    return null;
  }
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-4">
      <p className="text-muted text-sm tabular">
        {start}–{end} of {total.toLocaleString()}
      </p>
      <div className="flex gap-1">
        <button type="button" className="btn btn-secondary h-8 w-8 p-0" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <Icon name="chevronLeft" />
        </button>
        <span className="text-muted flex items-center px-2 text-sm tabular">{page} / {pages}</span>
        <button type="button" className="btn btn-secondary h-8 w-8 p-0" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">
          <Icon name="chevronRight" />
        </button>
      </div>
    </nav>
  );
}
