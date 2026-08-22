import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import api from "../services/api";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/StatCard";
import Skeleton from "../components/ui/Skeleton";

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.get("/dashboard/stats");
      setStats(res.data?.data || null);
    } catch (err) {
      console.error("Failed fetching dashboard stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading || !stats) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-panel" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72 w-full rounded-panel" />
          <Skeleton className="h-72 w-full rounded-panel" />
        </div>
      </div>
    );
  }

  const funnel = stats.enrichment_funnel || {
    ingested: stats.products || 0,
    sourced: 0,
    extracted: 0,
    validated: 0,
    approved: 0,
  };

  const funnelData = [
    { stage: "Ingested", count: funnel.ingested, fill: "var(--chart-1)" },
    { stage: "Sourced", count: funnel.sourced, fill: "var(--chart-2)" },
    { stage: "Extracted", count: funnel.extracted, fill: "var(--chart-3)" },
    { stage: "Validated", count: funnel.validated, fill: "var(--chart-4)" },
    { stage: "Approved", count: funnel.approved, fill: "var(--chart-5)" },
  ];

  const gradeCounts = stats.products_by_grade || { A: 0, B: 0, C: 0, D: 0 };
  const gradeData = [
    { grade: "Grade A (≥90%)", count: gradeCounts.A || 0, fill: "var(--chart-2)" },
    { grade: "Grade B (≥75%)", count: gradeCounts.B || 0, fill: "var(--chart-1)" },
    { grade: "Grade C (≥50%)", count: gradeCounts.C || 0, fill: "var(--chart-5)" },
    { grade: "Grade D (<50%)", count: gradeCounts.D || 0, fill: "var(--chart-4)" },
  ];

  const gradeTone = {
    A: "success",
    B: "info",
    C: "warn",
    D: "danger",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Intelligence Dashboard"
        description="Real-time telemetry on industrial product ingestion, multimodal spec extraction, confidence, and provenance."
        action={
          <div className="flex items-center gap-2">
            <Link to="/products" className="btn btn-primary btn-sm">
              Explore Products →
            </Link>
            <Button variant="secondary" size="sm" onClick={fetchStats}>
              ↻ Refresh
            </Button>
          </div>
        }
      />

      {/* 4 Core Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          eyebrow="Fleet Scope"
          title="Total Products"
          value={stats.products}
          tone="primary"
          helper={`${stats.catalogs} Active Catalogs`}
        />
        <StatCard
          eyebrow="Completeness"
          title="Mean Completeness"
          value={`${stats.mean_completeness}%`}
          tone="accent"
          helper={`${stats.attributes_total} Extracted Specs`}
        />
        <StatCard
          eyebrow="Confidence"
          title="Mean Confidence"
          value={`${stats.mean_confidence}%`}
          tone="success"
          helper={`${stats.attributes_approved} Approved Specs`}
        />
        <StatCard
          eyebrow="Curator Backlog"
          title="Needs Review"
          value={stats.review_backlog}
          tone={stats.review_backlog > 0 ? "warning" : "neutral"}
          helper={`${stats.conflicts_open} Open Conflicts`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 5-Stage Enrichment Funnel */}
        <Card className="glass p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-ink text-sm font-semibold">5-Stage Enrichment Funnel</h3>
              <p className="text-faint text-xs">Ingested → Sourced → Extracted → Validated → Approved</p>
            </div>
            <Badge tone="info" variant="soft">
              Pipeline Flow
            </Badge>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="stage"
                  tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--chart-tip-bg)",
                    border: "1px solid var(--chart-tip-bd)",
                    borderRadius: "0.5rem",
                    color: "var(--text-ink)",
                    fontSize: "0.75rem",
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 2, 2]}>
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Quality Grade Distribution */}
        <Card className="glass p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-ink text-sm font-semibold">Quality Grade Distribution</h3>
              <p className="text-faint text-xs">Based on schema completeness % and extraction confidence %</p>
            </div>
            <Badge tone="success" variant="soft">
              Catalog Health
            </Badge>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradeData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="grade"
                  tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--chart-tip-bg)",
                    border: "1px solid var(--chart-tip-bd)",
                    borderRadius: "0.5rem",
                    color: "var(--text-ink)",
                    fontSize: "0.75rem",
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 2, 2]}>
                  {gradeData.map((entry, index) => (
                    <Cell key={`grade-cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Recent Enriched Products Table */}
      <Card className="glass overflow-hidden">
        <div className="p-4 border-b line-1 flex items-center justify-between">
          <div>
            <h3 className="text-ink text-sm font-semibold">Recently Processed Products</h3>
            <p className="text-faint text-xs">Latest products ingested and scored across catalogs.</p>
          </div>
          <Link to="/products" className="text-xs font-semibold text-accent hover:underline">
            View All Products →
          </Link>
        </div>

        {stats.recent_products && stats.recent_products.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b line-1 text-faint uppercase text-eyebrow bg-surface-sunk/40">
                  <th className="p-3.5">Part Number</th>
                  <th className="p-3.5">Manufacturer</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Completeness</th>
                  <th className="p-3.5">Confidence</th>
                  <th className="p-3.5">Grade</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y line-1">
                {stats.recent_products.map((p) => {
                  const comp = p.completeness_score ?? 0;
                  const conf = p.confidence_score ?? 0;
                  const grade = p.quality_grade || "D";

                  return (
                    <tr key={p.id} className="hover:bg-surface-sunk/50 transition-colors">
                      <td className="p-3.5 font-semibold text-ink">
                        <Link to={`/products/${p.id}`} className="hover:text-accent hover:underline">
                          {p.part_number}
                        </Link>
                      </td>
                      <td className="p-3.5 text-muted">{p.manufacturer || "—"}</td>
                      <td className="p-3.5 text-muted">{p.category || "—"}</td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 bg-surface-sunk rounded-full overflow-hidden">
                            <div className="h-full bg-accent rounded-full" style={{ width: `${Math.min(100, comp)}%` }} />
                          </div>
                          <span className="tabular-nums text-ink font-medium">{comp}%</span>
                        </div>
                      </td>
                      <td className="p-3.5 tabular-nums font-semibold text-ink">{conf}%</td>
                      <td className="p-3.5">
                        <Badge tone={gradeTone[grade] || "neutral"} variant="solid">
                          {grade}
                        </Badge>
                      </td>
                      <td className="p-3.5">
                        <Badge tone={p.status === "approved" ? "success" : "warn"} variant="soft">
                          {p.status}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-right">
                        <Link to={`/products/${p.id}`} className="text-accent hover:underline font-semibold">
                          Specs →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-muted text-xs">
            No products available yet. Import a product catalog to see live telemetry.
          </div>
        )}
      </Card>
    </div>
  );
}

export default Dashboard;
