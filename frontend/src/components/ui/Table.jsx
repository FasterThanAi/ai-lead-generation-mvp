function Table({ columns = [], children, className = "" }) {
  return (
    <div className={["overflow-hidden rounded-panel border border-neutral-200 bg-white/85 shadow-soft", className].join(" ")}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200 text-left text-sm">
          {columns.length > 0 && (
            <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
              <tr>
                {columns.map((column) => (
                  <th key={column} scope="col" className="px-4 py-3">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-neutral-100 text-neutral-700">
            {children}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Table;
