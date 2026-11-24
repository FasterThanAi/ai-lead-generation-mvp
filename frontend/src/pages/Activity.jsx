import { useEffect, useState } from "react";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import Icon from "../components/ui/Icon";
import PageHeader from "../components/ui/PageHeader";
import Pagination from "../components/ui/Pagination";
import Skeleton from "../components/ui/Skeleton";
import Toast from "../components/ui/Toast";
import useDebouncedValue from "../hooks/useDebouncedValue";
import api from "../services/api";
import { apiErrorMessage, formatDateTime, timeAgo } from "../utils/format";

const PAGE_SIZE = 50;
const FILTERS = [
  { value: "", label: "All activity" },
  { value: "auth.", label: "Sign-ins" },
  { value: "email.", label: "Emails sent" },
  { value: "lead", label: "Leads" },
  { value: "campaign.", label: "Campaigns" },
  { value: "suppression.", label: "Suppression" },
  { value: "user.", label: "Members" },
  { value: "api_key.", label: "API keys" },
];

const TONES = {
  "auth.login_failed": "tone-danger",
  "email.sent": "tone-success",
  "suppression.unsubscribed": "tone-warn",
};

function toneFor(action) {
  if (TONES[action]) return TONES[action];
  if (action.endsWith("deleted") || action.endsWith("revoked")) return "tone-danger";
  if (action.startsWith("auth.")) return "tone-info";
  return "tone-neutral";
}

export default function Activity() {
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const query = useDebouncedValue(search);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/audit/", { params: { action: filter || undefined, q: query || undefined, page, page_size: PAGE_SIZE } })
      .then(({ data }) => {
        if (!cancelled) setResult(data);
      })
      .catch((err) => {
        if (!cancelled) setError(apiErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [filter, query, page]);

  const entries = result?.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity log"
        description="An append-only record of sign-ins, emails sent, deletions and configuration changes."
      />
      {error && <Toast tone="danger" onClose={() => setError("")}>{error}</Toast>}

      <Card>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative sm:max-w-xs sm:flex-1">
            <Icon name="search" className="text-faint pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
            <label htmlFor="activity-search" className="sr-only">Search activity</label>
            <input
              id="activity-search"
              className="field pl-9"
              placeholder="Search by person or description"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <label htmlFor="activity-filter" className="sr-only">Filter activity</label>
          <select
            id="activity-filter"
            className="field sm:w-48"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            {FILTERS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </div>

        {!entries ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((key) => <Skeleton key={key} className="h-12 w-full rounded-lg" />)}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState title="No activity found" description="Try a different filter or search term." />
        ) : (
          <ol className="line-1 divide-line divide-y rounded-lg border">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <span className={["tone w-fit font-mono text-[11px]", toneFor(entry.action)].join(" ")}>{entry.action}</span>
                <p className="text-ink-2 min-w-0 flex-1 text-sm break-anywhere">{entry.summary || "—"}</p>
                <div className="text-muted flex shrink-0 gap-3 text-xs">
                  <span className="truncate">{entry.actor_email || "system"}</span>
                  <time dateTime={entry.created_at} title={formatDateTime(entry.created_at)}>{timeAgo(entry.created_at)}</time>
                </div>
              </li>
            ))}
          </ol>
        )}

        {result?.pagination && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={result.pagination.total} onChange={setPage} />
        )}
      </Card>
    </div>
  );
}
