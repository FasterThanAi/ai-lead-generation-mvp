import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../services/api";
import StatCard from "../components/StatCard";
import { formatDateTimeIST } from "../utils/dateUtils";
import Badge from "../components/ui/Badge";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";
import Skeleton from "../components/ui/Skeleton";
import Toast from "../components/ui/Toast";

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
    {
      title: "Total Campaigns",
      value: stats.total_campaigns,
      helper: `${stats.total_leads ?? 0} leads across active motion`,
      tone: "primary",
    },
    {
      title: "Email Pipeline",
      value: stats.emails_generated,
      helper: `${stats.emails_approved ?? 0} approved, ${stats.emails_sent ?? 0} sent`,
      tone: "accent",
    },
    {
      title: "Reply Rate",
      value: formatPercent(stats.reply_rate),
      helper: `${stats.emails_replied ?? 0} replies captured`,
      tone: "success",
    },
    {
      title: "Average AI Score",
      value: Number(stats.average_ai_score ?? 0).toFixed(1),
      helper: `${stats.hot_leads ?? 0} hot leads, ${stats.high_priority_leads ?? 0} priority`,
      tone: "warning",
    },
  ];

  const emailFunnelData = [
    { name: "Generated", value: Number(stats.emails_generated ?? 0), color: "#2878ff" },
    { name: "Approved", value: Number(stats.emails_approved ?? 0), color: "#10b981" },
    { name: "Sent", value: Number(stats.emails_sent ?? 0), color: "#6366f1" },
    { name: "Replied", value: Number(stats.emails_replied ?? 0), color: "#059669" },
    { name: "Failed", value: Number(stats.emails_failed ?? 0), color: "#dc2626" },
  ];

  const replySignalData = [
    { name: "Classified", value: Number(stats.total_classified_replies ?? 0) },
    { name: "Priority", value: Number(stats.high_priority_replies ?? 0) },
    { name: "Interested", value: Number(stats.interested_replies ?? 0) },
    { name: "Pricing", value: Number(stats.pricing_replies ?? 0) },
    { name: "Meetings", value: Number(stats.meeting_request_replies ?? 0) },
  ];

  const followupData = [
    { name: "Follow-ups", generated: Number(stats.total_followups_generated ?? 0), sent: Number(stats.total_followups_sent ?? 0) },
    { name: "Responses", generated: Number(stats.total_response_drafts ?? 0), sent: Number(stats.response_drafts_sent ?? 0) },
  ];

  const dashboardHighlights = [
    ["Gmail", stats.gmail_connected ? "Connected" : "Not connected", stats.gmail_connected ? "success" : "warning", stats.gmail_connected ? "Live" : "Check"],
    ["Scored leads", stats.total_scored_leads ?? 0, "new", "AI"],
    ["High priority replies", stats.high_priority_replies ?? 0, "success", "Priority"],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        eyebrow="Revenue command center"
        description="A modern view of campaign throughput, reply quality, follow-up momentum, and AI lead scoring health."
        actions={
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/80 bg-white/75 px-3 py-2 text-sm font-semibold text-neutral-700 shadow-sm backdrop-blur">
            <span className="h-2.5 w-2.5 rounded-full bg-accent-500 shadow-[0_0_0_4px_rgba(16,185,129,0.14)]" />
            {stats.gmail_connected ? "Gmail connected" : "Gmail needs attention"}
          </div>
        }
      />

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading dashboard stats">
          {[0, 1, 2, 3].map((item) => (
            <Card key={item} className="space-y-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-3 w-36" />
            </Card>
          ))}
        </div>
      )}

      {!isLoading && error && (
        <Toast tone="danger" className="mb-2">
          {error}
        </Toast>
      )}

      {!isLoading && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => (
              <StatCard
                key={card.title}
                title={card.title}
                value={String(card.value ?? 0)}
                helper={card.helper}
                tone={card.tone}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {dashboardHighlights.map(([label, value, tone, badge]) => (
              <motion.div
                key={label}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="rounded-panel border border-white/80 bg-white/80 p-4 shadow-soft backdrop-blur transition hover:shadow-lift"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-neutral-500">{label}</p>
                  <Badge variant={tone}>{badge}</Badge>
                </div>
                <p className="mt-3 break-words text-2xl font-bold tracking-tight text-neutral-950">{value}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-neutral-950">Email Funnel</h3>
                  <p className="mt-1 text-sm leading-6 text-neutral-500">
                    Generated drafts through replies, using the current dashboard payload.
                  </p>
                </div>
                <Badge variant="sent">{stats.emails_sent ?? 0} sent</Badge>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={emailFunnelData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: "rgba(40, 120, 255, 0.08)" }}
                      contentStyle={{
                        borderRadius: 16,
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
                      }}
                    />
                    <Bar dataKey="value" radius={[10, 10, 4, 4]}>
                      {emailFunnelData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="xl:col-span-2">
              <div className="mb-6">
                <h3 className="text-lg font-bold tracking-tight text-neutral-950">Reply Signals</h3>
                <p className="mt-1 text-sm leading-6 text-neutral-500">
                  High-intent categories from classified replies.
                </p>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={replySignalData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="replySignal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 16,
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
                      }}
                    />
                    <Area type="monotone" dataKey="value" stroke="#059669" strokeWidth={3} fill="url(#replySignal)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card>
              <div className="mb-6">
                <h3 className="text-lg font-bold tracking-tight text-neutral-950">Follow-up Production</h3>
                <p className="mt-1 text-sm leading-6 text-neutral-500">
                  Generated and sent volumes for follow-ups and reply responses.
                </p>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={followupData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 16,
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
                      }}
                    />
                    <Bar dataKey="generated" fill="#2878ff" radius={[10, 10, 4, 4]} />
                    <Bar dataKey="sent" fill="#10b981" radius={[10, 10, 4, 4]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <div className="mb-6">
                <h3 className="text-lg font-bold tracking-tight text-neutral-950">Latest Campaigns</h3>
                <p className="mt-1 text-sm leading-6 text-neutral-500">
                  Recently created campaign workspaces.
                </p>
              </div>

              {stats.latest_campaigns.length === 0 ? (
                <EmptyState title="No campaigns yet" description="Create a campaign to start filling this activity stream." />
              ) : (
                <div className="space-y-3">
                  {stats.latest_campaigns.map((campaign, index) => (
                    <motion.div
                      key={campaign.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04, duration: 0.2 }}
                      className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 transition hover:-translate-y-0.5 hover:border-primary-100 hover:bg-white hover:shadow-soft"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-bold text-neutral-950">{campaign.campaign_name}</p>
                          <p className="mt-1 break-words text-sm text-neutral-500">{campaign.industry || "N/A"}</p>
                        </div>
                        <Badge variant={campaign.status || "running"}>{campaign.status || "active"}</Badge>
                      </div>
                      <p className="mt-3 text-xs font-medium text-neutral-400">{formatDateTimeIST(campaign.created_at)}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card className="xl:col-span-2">
              <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-neutral-950">Top AI-Scored Leads</h3>
                  <p className="mt-1 text-sm leading-6 text-neutral-500">
                    Highest-quality opportunities ranked by fit, contact confidence, and priority signals.
                  </p>
                </div>
                <Badge variant="hot">{stats.hot_leads ?? 0} hot</Badge>
              </div>

              {stats.top_ai_leads.length === 0 ? (
                <EmptyState title="No scored leads yet" description="Run scoring to surface prioritized accounts here." />
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {stats.top_ai_leads.map((lead, index) => (
                    <motion.div
                      key={lead.lead_id || lead.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04, duration: 0.2 }}
                      className="group rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 transition hover:-translate-y-1 hover:border-primary-100 hover:bg-white hover:shadow-lift"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-bold text-neutral-950">
                            {lead.company_name || `Lead ID ${lead.lead_id || lead.id}`}
                          </p>
                          <p className="mt-1 break-words text-xs font-medium text-neutral-500">
                            {lead.campaign_name || "Campaign unavailable"}
                          </p>
                        </div>
                        <span className="rounded-2xl bg-primary-50 px-3 py-2 text-sm font-bold text-primary-700 ring-1 ring-primary-100">
                          {lead.ai_score ?? 0}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {lead.ai_fit_score !== null && lead.ai_fit_score !== undefined && (
                          <Badge variant="success">Fit {lead.ai_fit_score}</Badge>
                        )}
                        {lead.ai_contact_confidence_score !== null && lead.ai_contact_confidence_score !== undefined && (
                          <Badge variant="warning">Contact {lead.ai_contact_confidence_score}</Badge>
                        )}
                        {lead.ai_priority && <Badge variant={lead.ai_priority}>{lead.ai_priority}</Badge>}
                        {lead.ai_qualification && <Badge variant={lead.ai_qualification}>{lead.ai_qualification}</Badge>}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="xl:col-span-2">
              <div className="mb-6">
                <h3 className="text-lg font-bold tracking-tight text-neutral-950">Recent Email Drafts</h3>
                <p className="mt-1 text-sm leading-6 text-neutral-500">
                  Drafts created most recently, with status surfaced for quick review.
                </p>
              </div>

              {stats.recent_email_drafts.length === 0 ? (
                <EmptyState title="No email drafts yet" description="Generated emails will appear here as soon as campaigns produce drafts." />
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {stats.recent_email_drafts.map((draft, index) => (
                    <motion.div
                      key={draft.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04, duration: 0.2 }}
                      className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 transition hover:-translate-y-0.5 hover:border-primary-100 hover:bg-white hover:shadow-soft"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-bold text-neutral-950">{draft.subject}</p>
                          <p className="mt-1 break-words text-xs font-medium text-neutral-500">
                            {[draft.campaign_name, draft.lead_company_name].filter(Boolean).join(" | ") || `Lead ID ${draft.lead_id}`}
                          </p>
                        </div>
                        <Badge variant={draft.status}>{draft.status}</Badge>
                      </div>
                      <p className="mt-3 text-xs font-medium text-neutral-400">{formatDateTimeIST(draft.created_at)}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export default Dashboard;
