function StatCard({ title, value }) {
  return (
    <div className="bg-white p-5 rounded-xl shadow border">
      <p className="text-gray-500 text-sm">{title}</p>
      <h3 className="text-2xl font-bold text-gray-800 mt-2">{value}</h3>
    </div>
  );
}

export default StatCard;