import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/auth-context";
import Button from "../components/ui/Button";
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
const REASON_LABELS = {
  unsubscribed: { label: "Unsubscribed", tone: "tone-warn" },
  bounced: { label: "Bounced", tone: "tone-danger" },
  complaint: { label: "Complaint", tone: "tone-danger" },
  import: { label: "Imported", tone: "tone-info" },
  manual: { label: "Manual", tone: "tone-neutral" },
};

export default function Suppression() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [form, setForm] = useState({ email: "", reason: "manual", note: "" });
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);
  const query = useDebouncedValue(search);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/suppression/", { params: { q: query || undefined, page, page_size: PAGE_SIZE } });
      setResult(data);
    } catch (err) {
      setMessage({ tone: "danger", text: apiErrorMessage(err) });
    }
  }, [query, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const add = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/suppression/", { ...form, note: form.note || null });
      setMessage({
        tone: data.created ? "success" : "info",
        text: data.created ? `${data.data.email} will never be emailed.` : `${data.data.email} is already suppressed.`,
      });
      setForm({ email: "", reason: "manual", note: "" });
      load();
    } catch (err) {
      setMessage({ tone: "danger", text: apiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    try {
      const { data } = await api.post("/suppression/import", body, { headers: { "Content-Type": "multipart/form-data" } });
      setMessage({
        tone: "success",
        text: `Imported ${data.added} addresses. ${data.already_present} were already listed, ${data.invalid} were invalid.`,
      });
      load();
    } catch (err) {
      setMessage({ tone: "danger", text: apiErrorMessage(err) });
    }
  };

  const remove = async (entry) => {
    if (!window.confirm(`Allow emails to ${entry.email} again?`)) return;
    try {
      await api.delete(`/suppression/${entry.id}`);
      load();
    } catch (err) {
      setMessage({ tone: "danger", text: apiErrorMessage(err) });
    }
  };

  const entries = result?.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppression list"
        description="Addresses here are never emailed: the check runs on every send, for cold emails, follow-ups and replies."
        actions={
          <>
            <input ref={fileInput} type="file" accept=".csv,.txt" className="hidden" onChange={importFile} />
            <Button variant="secondary" onClick={() => fileInput.current?.click()}>
              <Icon name="upload" /> Import CSV
            </Button>
          </>
        }
      />
      {message && <Toast tone={message.tone} onClose={() => setMessage(null)}>{message.text}</Toast>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <div className="relative mb-4 sm:max-w-xs">
            <Icon name="search" className="text-faint pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
            <label htmlFor="sup-search" className="sr-only">Search suppressed addresses</label>
            <input
              id="sup-search"
              className="field pl-9"
              placeholder="Search email"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {!entries ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : entries.length === 0 ? (
            <EmptyState
              title={query ? "No matching addresses" : "No suppressed addresses yet"}
              description="Recipients who click the unsubscribe link in your emails are added here automatically."
            />
          ) : (
            <div className="line-1 scroll-x rounded-lg border">
              <table className="min-w-full text-left text-sm">
                <thead className="t-head">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Email</th>
                    <th className="px-4 py-2.5 font-medium">Reason</th>
                    <th className="px-4 py-2.5 font-medium">Added</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-line divide-y">
                  {entries.map((entry) => {
                    const reason = REASON_LABELS[entry.reason] || { label: entry.reason, tone: "tone-neutral" };
                    const locked = entry.reason === "unsubscribed" && !isAdmin;
                    return (
                      <tr key={entry.id} className="t-row">
                        <td className="px-4 py-3">
                          <p className="text-ink font-medium break-anywhere">{entry.email}</p>
                          {entry.note && <p className="text-muted text-xs">{entry.note}</p>}
                        </td>
                        <td className="px-4 py-3"><span className={["tone", reason.tone].join(" ")}>{reason.label}</span></td>
                        <td className="text-muted px-4 py-3 whitespace-nowrap" title={formatDateTime(entry.created_at)}>
                          {timeAgo(entry.created_at)}
                          {entry.created_by && <span className="text-faint block text-xs">by {entry.created_by}</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={locked}
                            title={locked ? "Only an admin can remove someone who unsubscribed" : undefined}
                            onClick={() => remove(entry)}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {result?.pagination && (
            <Pagination page={page} pageSize={PAGE_SIZE} total={result.pagination.total} onChange={setPage} />
          )}
        </Card>

        <Card className="h-fit">
          <h2 className="text-ink text-base font-semibold">Add an address</h2>
          <p className="text-muted mt-0.5 text-sm">For do-not-contact requests, bounces or complaints.</p>
          <form onSubmit={add} className="mt-4 space-y-3">
            <div>
              <label className="label" htmlFor="sup-email">Email</label>
              <input id="sup-email" type="email" required className="field" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@company.com" />
            </div>
            <div>
              <label className="label" htmlFor="sup-reason">Reason</label>
              <select id="sup-reason" className="field" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
                <option value="manual">Do not contact</option>
                <option value="bounced">Bounced</option>
                <option value="complaint">Complaint</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="sup-note">Note <span className="text-faint font-normal">(optional)</span></label>
              <textarea id="sup-note" className="field min-h-20" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <Button type="submit" className="w-full" loading={busy} disabled={!form.email}>Add to list</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
