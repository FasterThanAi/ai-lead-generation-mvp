import { useEffect, useState } from "react";
import api from "../services/api";
import StatCard from "../components/StatCard";

function Dashboard() {
  const [health, setHealth] = useState("Checking backend...");

  useEffect(() => {
    api.get("/health")
      .then((res) => setHealth(res.data.message))
      .catch(() => setHealth("Backend not connected"));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <StatCard title="Total Leads" value="0" />
        <StatCard title="Emails Generated" value="0" />
        <StatCard title="Emails Sent" value="0" />
        <StatCard title="Replies" value="0" />
      </div>

      <div className="bg-white p-5 rounded-xl shadow border">
        <h3 className="font-semibold mb-2">Backend Status</h3>
        <p className="text-gray-600">{health}</p>
      </div>
    </div>
  );
}

export default Dashboard;