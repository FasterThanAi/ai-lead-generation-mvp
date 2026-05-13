function StatCard({ title, value }) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm shadow-slate-200/70 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <h3 className="mt-2 break-words text-2xl font-semibold tracking-tight text-slate-950">{value}</h3>
    </div>
  );
}

export default StatCard;
