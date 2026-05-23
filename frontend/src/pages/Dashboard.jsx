import { useEffect, useState } from "react";
import api from "../services/api";
import StatCard from "../components/StatCard";
import { formatDateTimeIST } from "../utils/dateUtils";
import Badge from "../components/ui/Badge";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";

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
  total_classified_replies: 0,
  high_priority_replies: 0,
  interested_replies: 0,
  pricing_replies: 0,
  meeting_request_replies: 0,
  total_followups_generated: 0,
  total_followups_sent: 0,
  total_response_drafts: 0,
  response_drafts_sent: 0,
  total_scored_leads: 0,
  average_ai_score: 0,
  high_priority_leads: 0,
  hot_leads: 0,
  gmail_connected: false,
  latest_campaigns: [],
  recent_email_drafts: [],
  top_ai_leads: [],
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
    ["Classified Replies", stats.total_classified_replies],
    ["High Priority Replies", stats.high_priority_replies],
    ["Interested Replies", stats.interested_replies],
    ["Pricing Replies", stats.pricing_replies],
    ["Meeting Requests", stats.meeting_request_replies],
    ["Follow-ups Generated", stats.total_followups_generated],
    ["Follow-ups Sent", stats.total_followups_sent],
    ["Response Drafts", stats.total_response_drafts],
    ["Responses Sent", stats.response_drafts_sent],
    ["Total Scored Leads", stats.total_scored_leads],
    ["Average AI Score", Number(stats.average_ai_score ?? 0).toFixed(1)],
    ["High Priority Leads", stats.high_priority_leads],
    ["Hot Leads", stats.hot_leads],
    ["Gmail Status", stats.gmail_connected ? "Connected" : "Not connected"],
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="A quick view of campaigns, leads, replies, follow-ups, and AI scoring health."
      />

      {isLoading && (
        <div className="mb-6 rounded-3xl border border-white/70 bg-white/80 p-5 text-sm text-slate-600 shadow-sm">
          Loading dashboard stats...
        </div>
      )}

      {!isLoading && error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(([title, value]) => (
          <StatCard key={title} title={title} value={String(value ?? 0)} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="xl:col-span-2">
          <div className="mb-4">
            <h3 className="text-xl font-semibold">Top AI-Scored Leads</h3>
            <p className="mt-1 text-sm text-gray-500">
              Review these recommendations before contacting leads.
            </p>
          </div>

          {stats.top_ai_leads.length === 0 ? (
            <div className="border border-dashed rounded-lg p-6 text-center text-sm text-gray-500">
              No scored leads yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              {stats.top_ai_leads.map((lead) => (
                <div key={lead.lead_id || lead.id} className="rounded-lg border bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-900">
                    {lead.company_name || `Lead ID ${lead.lead_id || lead.id}`}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {lead.campaign_name || "Campaign unavailable"}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                      Final {lead.ai_score ?? 0}
                    </span>
                    {lead.ai_fit_score !== null && lead.ai_fit_score !== undefined && (
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                        Fit {lead.ai_fit_score}
                      </span>
                    )}
                    {lead.ai_contact_confidence_score !== null && lead.ai_contact_confidence_score !== undefined && (
                      <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
                        Contact {lead.ai_contact_confidence_score}
                      </span>
                    )}
                    {lead.ai_priority && <Badge variant={lead.ai_priority}>{lead.ai_priority}</Badge>}
                    {lead.ai_qualification && <Badge variant={lead.ai_qualification}>{lead.ai_qualification}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-4">
            <h3 className="text-xl font-semibold">Latest Campaigns</h3>
          </div>

          {stats.latest_campaigns.length === 0 ? (
            <EmptyState title="No campaigns yet" />
          ) : (
            <div className="space-y-3">
              {stats.latest_campaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="break-words text-sm font-semibold text-slate-950">{campaign.campaign_name}</p>
                  <p className="mt-1 break-words text-sm text-slate-500">{campaign.industry || "N/A"}</p>
                  <p className="mt-2 text-xs text-slate-400">{formatDateTimeIST(campaign.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-4">
            <h3 className="text-xl font-semibold">Recent Email Drafts</h3>
          </div>

          {stats.recent_email_drafts.length === 0 ? (
            <EmptyState title="No email drafts yet" />
          ) : (
            <div className="space-y-3">
              {stats.recent_email_drafts.map((draft) => (
                <div key={draft.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{draft.subject}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {[draft.campaign_name, draft.lead_company_name].filter(Boolean).join(" | ") || `Lead ID ${draft.lead_id}`}
                      </p>
                    </div>
                    <Badge variant={draft.status}>{draft.status}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">{formatDateTimeIST(draft.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default Dashboard;
