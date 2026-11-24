import { useEffect, useState } from "react";
import { useAuth } from "../auth/auth-context";
import api from "../services/api";
import Card from "./ui/Card";
import Icon from "./ui/Icon";
import Skeleton from "./ui/Skeleton";

const INTEGRATIONS = [
  ["gemini", "Gemini AI", "GEMINI_API_KEY"],
  ["gmail_oauth", "Gmail OAuth", "GMAIL_CLIENT_ID / SECRET"],
  ["hunter", "Hunter.io", "HUNTER_API_KEY"],
  ["apollo", "Apollo", "APOLLO_API_KEY"],
  ["vapi", "Vapi calling", "VAPI_ENABLED + VAPI_API_KEY"],
  ["n8n", "n8n Lead Agent", "N8N_WEBHOOK_URL"],
  ["unsubscribe_links", "Unsubscribe links", "PUBLIC_API_URL"],
];

function Dot({ ok }) {
  return <span className={["h-2 w-2 shrink-0 rounded-full", ok ? "bg-success-solid" : "bg-[var(--line-3)]"].join(" ")} />;
}

export default function SystemStatus() {
  const { isAdmin } = useAuth();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let cancelled = false;
    api
      .get("/system/status")
      .then(({ data }) => !cancelled && setStatus(data))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (!isAdmin || error) return null;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-ink text-base font-semibold">System status</h2>
          <p className="text-muted mt-0.5 text-sm">Configuration of this deployment. Secrets are set as server environment variables.</p>
        </div>
        {status && (
          <span className="tone tone-neutral font-mono">
            v{status.app.version} · {status.app.environment}
          </span>
        )}
      </div>
      {!status ? (
        <Skeleton className="h-32 w-full rounded-lg" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-faint mb-2 text-eyebrow uppercase">Integrations</p>
            <ul className="line-1 divide-line divide-y rounded-lg border">
              {INTEGRATIONS.map(([key, label, env]) => (
                <li key={key} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <Dot ok={status.integrations[key]} />
                  <span className="text-ink flex-1">{label}</span>
                  <span className="text-faint hidden font-mono text-xs sm:block">{status.integrations[key] ? "configured" : env}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-faint mb-2 text-eyebrow uppercase">Platform</p>
            <ul className="line-1 divide-line divide-y rounded-lg border text-sm">
              <li className="flex items-center gap-3 px-3 py-2">
                <Dot ok={status.app.database === "postgresql"} />
                <span className="text-ink flex-1">Database</span>
                <span className="text-muted capitalize">{status.app.database}</span>
              </li>
              <li className="flex items-center gap-3 px-3 py-2">
                <Dot ok={status.app.redis} />
                <span className="text-ink flex-1">Redis (shared rate limits)</span>
                <span className="text-muted">{status.app.redis ? "Connected" : "Not configured"}</span>
              </li>
              <li className="flex items-center gap-3 px-3 py-2">
                <Dot ok={status.app.auth_enabled} />
                <span className="text-ink flex-1">Authentication</span>
                <span className="text-muted">{status.app.auth_enabled ? "On" : "Off"}</span>
              </li>
              <li className="flex items-center gap-3 px-3 py-2">
                <Dot ok />
                <span className="text-ink flex-1">Daily Gmail limit</span>
                <span className="text-muted tabular">{status.limits.gmail_daily_limit}</span>
              </li>
            </ul>
            <div className="text-muted mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              {[["Users", status.counts.users], ["Leads", status.counts.leads], ["Suppressed", status.counts.suppressed]].map(([label, value]) => (
                <div key={label} className="well py-2">
                  <p className="text-ink tabular text-base font-semibold">{Number(value).toLocaleString()}</p>
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {status && status.app.database === "sqlite" && (
        <p className="text-warn mt-4 flex items-center gap-1.5 text-xs">
          <Icon name="alert" className="h-3.5 w-3.5" /> SQLite is for local development. Use PostgreSQL in production.
        </p>
      )}
    </Card>
  );
}
