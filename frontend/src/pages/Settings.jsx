import { useEffect, useState } from "react";
import api from "../services/api";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import Skeleton from "../components/ui/Skeleton";

function Settings() {
  const [deepHealth, setDeepHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const res = await api.get("/health/deep");
      setDeepHealth(res.data);
    } catch (err) {
      console.error("Health check failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & System Health"
        description="Configure SpecForge extraction models, deterministic normalization engine, and security keys."
        action={
          <Button variant="secondary" onClick={fetchHealth}>
            ↻ Re-Run Health Diagnostics
          </Button>
        }
      />

      <div className="space-y-6">
        {/* Deep Health Diagnostics */}
        <Card className="glass p-6 space-y-4">
          <div className="flex items-center justify-between border-b line-1 pb-3">
            <div>
              <h3 className="text-base font-semibold text-ink">Deep System Diagnostics</h3>
              <p className="text-muted text-xs">Live connectivity status for SQLite/PostgreSQL, Gemini API, and Vector Store.</p>
            </div>
            {deepHealth && (
              <Badge tone={deepHealth.status === "healthy" ? "success" : "warn"} variant="solid">
                System {deepHealth.status}
              </Badge>
            )}
          </div>

          {loading ? (
            <Skeleton className="h-32 w-full rounded-lg" />
          ) : deepHealth?.checks ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Database */}
              <div className="well p-4 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink">Database Engine</span>
                  <Badge tone={deepHealth.checks.database?.status === "ok" ? "success" : "danger"} variant="soft">
                    {deepHealth.checks.database?.status || "error"}
                  </Badge>
                </div>
                <p className="text-[11px] text-faint">
                  Dialect: <span className="font-mono text-ink font-semibold">{deepHealth.checks.database?.dialect || "sqlite"}</span>
                </p>
                <p className="text-[11px] text-muted">
                  Dialect-safe column migrations initialized automatically at startup.
                </p>
              </div>

              {/* Gemini Model */}
              <div className="well p-4 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink">Gemini Multimodal</span>
                  <Badge
                    tone={deepHealth.checks.gemini?.status === "ok" ? "success" : "neutral"}
                    variant="soft"
                  >
                    {deepHealth.checks.gemini?.status || "offline"}
                  </Badge>
                </div>
                <p className="text-[11px] text-faint">
                  Model: <span className="font-mono text-ink font-semibold">{deepHealth.checks.gemini?.model || "gemini-2.5-flash"}</span>
                </p>
                <p className="text-[11px] text-muted">
                  Multimodal vision extraction, schema proposals, and plausibility verification.
                </p>
              </div>

              {/* Vector RAG */}
              <div className="well p-4 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink">Taxonomy Vector Store</span>
                  <Badge tone="info" variant="soft">
                    {deepHealth.checks.pgvector?.status || "active"}
                  </Badge>
                </div>
                <p className="text-[11px] text-faint">
                  Vector Engine: <span className="font-mono text-ink font-semibold">In-Memory / PGVector</span>
                </p>
                <p className="text-[11px] text-muted">
                  Domain taxonomy chunk retrieval for guided LLM candidate extraction.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-danger">Diagnostics unavailable.</p>
          )}
        </Card>

        {/* Multimodal Vision Settings */}
        <Card className="glass p-6 space-y-4">
          <div className="border-b line-1 pb-3">
            <h3 className="text-base font-semibold text-ink">Multimodal Vision & Resolution Settings</h3>
            <p className="text-muted text-xs">PyMuPDF document rendering and cost-control thresholds.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="well p-3.5 rounded-lg space-y-1">
              <span className="text-faint block">Max Pages per Document:</span>
              <span className="font-bold text-ink text-sm">10 Pages</span>
              <p className="text-[11px] text-muted">Configurable via VISION_MAX_PAGES.</p>
            </div>

            <div className="well p-3.5 rounded-lg space-y-1">
              <span className="text-faint block">PyMuPDF Rendering Resolution:</span>
              <span className="font-bold text-ink text-sm">200 DPI</span>
              <p className="text-[11px] text-muted">High-clarity pixel rendering for drawing callouts.</p>
            </div>

            <div className="well p-3.5 rounded-lg space-y-1">
              <span className="text-faint block">Vision SHA-256 Cache:</span>
              <span className="font-bold text-success text-sm">Enabled</span>
              <p className="text-[11px] text-muted">0 duplicate API calls on re-running enrichment.</p>
            </div>
          </div>
        </Card>

        {/* Security & API Guard */}
        <Card className="glass p-6 space-y-4">
          <div className="border-b line-1 pb-3">
            <h3 className="text-base font-semibold text-ink">API Key Security Guard</h3>
            <p className="text-muted text-xs">Mutating endpoint protection for production deployment.</p>
          </div>

          <div className="well p-4 rounded-lg text-xs space-y-2">
            <p className="text-ink font-semibold">
              Header Security: <span className="font-mono text-accent">X-API-Key</span>
            </p>
            <p className="text-muted">
              When <code>API_KEY</code> is set in the backend environment, all mutating routes (POST, PUT, PATCH, DELETE) require the <code>X-API-Key</code> request header.
            </p>
            <p className="text-faint">
              Read-only routes (GET, dashboard telemetry, product browsing, catalog summary) remain open for evaluators and judges.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default Settings;
