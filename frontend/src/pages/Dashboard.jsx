import { useEffect, useState } from "react";
import api from "../services/api";
import StatCard from "../components/StatCard";

function formatDate(value) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatPercent(value) {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return "0.0%";
  }

  return `${numericValue.toFixed(1)}%`;
}

const emptyStats = {
  total_campaigns: 0,
  total_leads: 0,
  emails_generated: 0,
  emails_approved: 0,
  emails_sent: 0,
  emails_failed: 0,
  emails_replied: 0,
  reply_rate: 0,
  total_followups_generated: 0,
  total_followups_sent: 0,
  gmail_connected: false,
  latest_campaigns: [],
  recent_email_drafts: [],
};

function Dashboard() {
  const [stats, setStats] = useState(emptyStats);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDashboardStats = async () => {
      setIsLoading(true);
      setError("");

      try {
        const res = await api.get("/dashboard/stats");
        setStats({
          ...emptyStats,
          ...(res.data.data || {}),
        });
      } catch (err) {
        setError("Could not load dashboard stats.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardStats();
  }, []);

  const statCards = [
    ["Total Campaigns", stats.total_campaigns],
    ["Total Leads", stats.total_leads],
    ["Emails Generated", stats.emails_generated],
    ["Emails Approved", stats.emails_approved],
    ["Emails Sent", stats.emails_sent],
    ["Emails Failed", stats.emails_failed],
    ["Emails Replied", stats.emails_replied],
    ["Reply Rate", formatPercent(stats.reply_rate)],
    ["Follow-ups Generated", stats.total_followups_generated],
    ["Follow-ups Sent", stats.total_followups_sent],
    ["Gmail Status", stats.gmail_connected ? "Connected" : "Not connected"],
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      {isLoading && (
        <div className="mb-6 rounded-lg border bg-white p-5 text-sm text-gray-600 shadow">
          Loading dashboard stats...
        </div>
      )}

      {!isLoading && error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {statCards.map(([title, value]) => (
          <StatCard key={title} title={title} value={String(value ?? 0)} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="bg-white p-6 rounded-xl shadow border">
          <div className="mb-4">
            <h3 className="text-xl font-semibold">Latest Campaigns</h3>
          </div>

          {stats.latest_campaigns.length === 0 ? (
            <div className="border border-dashed rounded-lg p-6 text-center text-sm text-gray-500">
              No campaigns yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-600">
                    <th className="px-4 py-3 font-semibold">Campaign</th>
                    <th className="px-4 py-3 font-semibold">Industry</th>
                    <th className="px-4 py-3 font-semibold">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.latest_campaigns.map((campaign) => (
                    <tr key={campaign.id} className="border-b last:border-b-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {campaign.campaign_name}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{campaign.industry || "N/A"}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDate(campaign.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow border">
          <div className="mb-4">
            <h3 className="text-xl font-semibold">Recent Email Drafts</h3>
          </div>

          {stats.recent_email_drafts.length === 0 ? (
            <div className="border border-dashed rounded-lg p-6 text-center text-sm text-gray-500">
              No email drafts yet.
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recent_email_drafts.map((draft) => (
                <div key={draft.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{draft.subject}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {[draft.campaign_name, draft.lead_company_name].filter(Boolean).join(" | ") || `Lead ID ${draft.lead_id}`}
                      </p>
                    </div>
                    <span className="w-fit rounded-full border bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700">
                      {draft.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">{formatDate(draft.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
