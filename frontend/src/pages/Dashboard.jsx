import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { m as motion } from "framer-motion";
import { CountUp, Magnetic, Reveal, Stagger, StaggerItem } from "../motion/primitives";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "../auth/auth-context";
import StatCard from "../components/StatCard";
import Badge from "../components/ui/Badge";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import Icon from "../components/ui/Icon";
import Skeleton from "../components/ui/Skeleton";
import Toast from "../components/ui/Toast";
import api from "../services/api";
import { timeAgo } from "../utils/format";

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

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid var(--chart-tip-bd)",
  background: "var(--chart-tip-bg)",
  color: "var(--text-1)",
  fontSize: 12,
  boxShadow: "var(--sh-2)",
};

function number(value) {
  return Number(value ?? 0).toLocaleString();
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function SectionHeader({ title, description, to, linkLabel = "View all" }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-ink text-[15px] font-semibold">{title}</h2>
        {description && <p className="text-muted mt-0.5 text-sm">{description}</p>}
      </div>
      {to && (
        <Link to={to} className="text-accent shrink-0 text-sm font-medium hover:underline">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

function SetupChecklist({ stats }) {
  const steps = [
    { done: stats.total_campaigns > 0, label: "Create your first campaign", to: "/campaigns" },
    { done: stats.total_leads > 0, label: "Add leads by CSV, discovery or the Lead Agent", to: "/leads" },
    { done: stats.gmail_connected, label: "Connect Gmail to send approved emails", to: "/settings" },
    { done: stats.emails_generated > 0, label: "Generate and review AI email drafts", to: "/emails" },
  ];
  const completed = steps.filter((step) => step.done).length;
  if (completed === steps.length) {
    return null;
  }
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-ink text-[15px] font-semibold">Get set up</h2>
          <p className="text-muted mt-0.5 text-sm">{completed} of {steps.length} steps complete</p>
        </div>
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-[var(--glass-3)]">
          <motion.div
            className="bg-accent h-full rounded-full"
            initial={{ width: 0 }}
            whileInView={{ width: `${(completed / steps.length) * 100}%` }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          />
        </div>
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((step) => (
          <li key={step.label}>
            <Link
              to={step.to}
              className="line-1 hover:line-2 flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition hover:bg-[var(--glass-2)]"
            >
              <span
                className={[
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                  step.done ? "bg-accent border-transparent text-white" : "line-3",
                ].join(" ")}
              >
                {step.done && <Icon name="check" className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span className={step.done ? "text-muted line-through" : "text-ink"}>{step.label}</span>
              {!step.done && <Icon name="chevronRight" className="text-faint ml-auto" />}
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Funnel({ stats }) {
  const stages = [
    { label: "Leads", value: Number(stats.total_leads ?? 0) },
    { label: "Drafts generated", value: Number(stats.emails_generated ?? 0) },
    { label: "Approved", value: Number(stats.emails_approved ?? 0) + Number(stats.emails_sent ?? 0) },
    { label: "Sent", value: Number(stats.emails_sent ?? 0) },
    { label: "Replied", value: Number(stats.emails_replied ?? 0) },
  ];
  const max = Math.max(...stages.map((stage) => stage.value), 1);
  return (
    <ul className="space-y-3.5">
      {stages.map((stage, index) => {
        const previous = index > 0 ? stages[index - 1].value : null;
        const conversion = previous ? Math.round((stage.value / previous) * 100) : null;
        return (
          <li key={stage.label}>
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="text-ink-2">{stage.label}</span>
              <span className="tabular">
                <span className="text-ink font-medium"><CountUp value={number(stage.value)} /></span>
                {conversion !== null && <span className="text-faint ml-2 text-xs">{conversion}%</span>}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--glass-3)]">
              <motion.div
                className="relative h-full overflow-hidden rounded-full"
                style={{
                  background: "linear-gradient(90deg, rgb(var(--accent-from)), rgb(var(--accent-to)), #38bdf8)",
                  opacity: 1 - index * 0.12,
                }}
                initial={{ width: 0 }}
                whileInView={{ width: `${Math.max((stage.value / max) * 100, stage.value ? 2 : 0)}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, delay: 0.1 + index * 0.12, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="bar-sheen absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              </motion.div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(emptyStats);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .get("/dashboard/stats")
      .then((res) => {
        if (!cancelled) setStats({ ...emptyStats, ...(res.data.data || {}) });
      })
      .catch(() => {
        if (!cancelled) setError("Could not load dashboard stats. Refresh to try again.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = (user?.full_name || "").split(" ")[0];
  const replyData = [
    { name: "Interested", value: Number(stats.interested_replies ?? 0) },
    { name: "Meeting", value: Number(stats.meeting_request_replies ?? 0) },
    { name: "Pricing", value: Number(stats.pricing_replies ?? 0) },
    { name: "High priority", value: Number(stats.high_priority_replies ?? 0) },
  ];

  return (
    <div className="space-y-6">
      <motion.section
        className="glass relative overflow-hidden rounded-panel px-6 py-7 sm:px-8"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <div aria-hidden="true" className="aurora opacity-70">
          <span />
          <span />
          <span />
        </div>
        <div aria-hidden="true" className="bg-grid absolute inset-0 opacity-50" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <motion.p
              className="text-muted mb-2 flex items-center gap-2 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <span className="live-dot text-emerald-500" /> Workspace live · {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </motion.p>
            <h2 className="text-ink text-3xl font-semibold tracking-tight sm:text-4xl">
              {greeting()}
              {firstName && (
                <>
                  , <span className="text-shimmer">{firstName}</span>
                </>
              )}
            </h2>
            <p className="text-muted mt-2 text-sm sm:text-base">
              You have <span className="text-ink font-semibold"><CountUp value={number(stats.emails_approved)} /></span> approved emails ready and{" "}
              <span className="text-ink font-semibold"><CountUp value={number(stats.hot_leads)} /></span> hot leads waiting.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={["tone", stats.gmail_connected ? "tone-success" : "tone-warn"].join(" ")}>
              <span className="live-dot" />
              {stats.gmail_connected ? "Gmail connected" : "Gmail not connected"}
            </span>
            <Magnetic strength={0.2}>
              <Link to="/campaigns" className="btn btn-primary min-h-10 px-4">
                <Icon name="plus" /> New campaign
              </Link>
            </Magnetic>
          </div>
        </div>
      </motion.section>

      {error && <Toast tone="danger">{error}</Toast>}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading dashboard">
          {[0, 1, 2, 3].map((item) => (
            <Card key={item} className="space-y-3">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-8 w-20 rounded" />
              <Skeleton className="h-3 w-36 rounded" />
            </Card>
          ))}
        </div>
      ) : (
        <>
          <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StaggerItem><StatCard title="Leads" value={number(stats.total_leads)} helper={`Across ${number(stats.total_campaigns)} campaign${Number(stats.total_campaigns) === 1 ? "" : "s"}`} tone="primary" /></StaggerItem>
            <StaggerItem><StatCard title="Emails sent" value={number(stats.emails_sent)} helper={`${number(stats.emails_approved)} approved and waiting`} tone="accent" /></StaggerItem>
            <StaggerItem><StatCard
              title="Reply rate"
              value={`${Number(stats.reply_rate ?? 0).toFixed(1)}%`}
              helper={`${number(stats.emails_replied)} replies`}
              tone="success"
            /></StaggerItem>
            <StaggerItem><StatCard
              title="Avg. AI lead score"
              value={Number(stats.average_ai_score ?? 0).toFixed(1)}
              helper={`${number(stats.hot_leads)} hot · ${number(stats.high_priority_leads)} high priority`}
              tone="warning"
            /></StaggerItem>
          </Stagger>

          <Reveal><SetupChecklist stats={stats} /></Reveal>

          <Reveal className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <SectionHeader title="Outreach funnel" description="Conversion from lead to reply. Percentages compare each stage with the one above it." />
              <Funnel stats={stats} />
              {Number(stats.emails_failed) > 0 && (
                <p className="text-danger mt-4 flex items-center gap-1.5 text-sm">
                  <Icon name="alert" /> {number(stats.emails_failed)} emails failed to send.{" "}
                  <Link to="/emails" className="underline">Review</Link>
                </p>
              )}
            </Card>

            <Card className="xl:col-span-2">
              <SectionHeader title="Reply intent" description={`${number(stats.total_classified_replies)} replies classified by AI`} to="/emails" />
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={replyData} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                    <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={92} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "var(--glass-3)" }} contentStyle={tooltipStyle} />
                    <Bar dataKey="value" name="Replies" fill="var(--chart-1)" radius={[0, 4, 4, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Reveal>

          <Reveal className="grid grid-cols-1 gap-6 xl:grid-cols-2" delay={0.05}>
            <Card>
              <SectionHeader title="Top leads" description="Highest AI scores across all campaigns" to="/leads" />
              {stats.top_ai_leads.length === 0 ? (
                <EmptyState title="No scored leads yet" description="Score leads on the Leads page to rank who to contact first." />
              ) : (
                <Stagger as="ul" className="divide-line -mx-2 divide-y" stagger={0.05}>
                  {stats.top_ai_leads.map((lead) => (
                    <StaggerItem as="li" key={lead.lead_id || lead.id} className="flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-[var(--glass-2)]">
                      <span className="bg-accent-soft text-accent tabular flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold">
                        {lead.ai_score ?? "–"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-ink truncate text-sm font-medium">{lead.company_name || `Lead #${lead.lead_id || lead.id}`}</p>
                        <p className="text-muted truncate text-xs">{lead.campaign_name || "—"}</p>
                      </div>
                      {lead.ai_priority && <Badge variant={lead.ai_priority}>{lead.ai_priority}</Badge>}
                    </StaggerItem>
                  ))}
                </Stagger>
              )}
            </Card>

            <Card>
              <SectionHeader title="Recent drafts" description="Latest AI-generated emails" to="/emails" />
              {stats.recent_email_drafts.length === 0 ? (
                <EmptyState title="No drafts yet" description="Generate emails for a campaign to review them here." />
              ) : (
                <Stagger as="ul" className="divide-line -mx-2 divide-y" stagger={0.05}>
                  {stats.recent_email_drafts.map((draft) => (
                    <StaggerItem as="li" key={draft.id} className="flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-[var(--glass-2)]">
                      <div className="min-w-0 flex-1">
                        <p className="text-ink truncate text-sm font-medium">{draft.subject}</p>
                        <p className="text-muted truncate text-xs">
                          {[draft.lead_company_name, draft.campaign_name].filter(Boolean).join(" · ") || `Lead #${draft.lead_id}`}
                        </p>
                      </div>
                      <span className="text-faint hidden shrink-0 text-xs sm:block">{timeAgo(draft.created_at)}</span>
                      <Badge variant={draft.status}>{draft.status}</Badge>
                    </StaggerItem>
                  ))}
                </Stagger>
              )}
            </Card>
          </Reveal>

          <Reveal delay={0.05}>
          <Card>
            <SectionHeader title="Latest campaigns" to="/campaigns" />
            {stats.latest_campaigns.length === 0 ? (
              <EmptyState title="No campaigns yet" description="Create a campaign to start finding leads.">
                <Link to="/campaigns" className="btn btn-primary px-4">Create campaign</Link>
              </EmptyState>
            ) : (
              <div className="scroll-x -mx-5 sm:-mx-6">
                <table className="min-w-full text-left text-sm">
                  <thead className="t-head">
                    <tr>
                      <th className="px-5 py-2.5 font-medium sm:px-6">Campaign</th>
                      <th className="px-5 py-2.5 font-medium">Industry</th>
                      <th className="px-5 py-2.5 font-medium">Location</th>
                      <th className="px-5 py-2.5 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-line divide-y">
                    {stats.latest_campaigns.map((campaign) => (
                      <tr key={campaign.id} className="t-row">
                        <td className="px-5 py-3 sm:px-6">
                          <Link to={`/leads?campaign_id=${campaign.id}`} className="text-ink font-medium hover:underline">
                            {campaign.campaign_name}
                          </Link>
                        </td>
                        <td className="text-muted px-5 py-3">{campaign.industry || "—"}</td>
                        <td className="text-muted px-5 py-3">{campaign.location || "—"}</td>
                        <td className="text-muted px-5 py-3 whitespace-nowrap">{timeAgo(campaign.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          </Reveal>
        </>
      )}
    </div>
  );
}

export default Dashboard;
