import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { apiErrorMessage, timeAgo } from "../utils/format";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import Card from "./ui/Card";
import EmptyState from "./ui/EmptyState";
import Icon from "./ui/Icon";
import Skeleton from "./ui/Skeleton";
import Toast from "./ui/Toast";

const PAGE_SIZE = 50;
const STATUS_OPTIONS = ["new", "contacted", "qualified", "disqualified"];
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

function scoreTone(score) {
  if (score === null || score === undefined) return "text-faint";
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-warn";
  return "text-muted";
}

function Drawer({ lead, onClose, onDelete, children }) {
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={`Lead ${lead.company_name}`}>
      <button type="button" aria-label="Close lead details" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="line-1 shadow-deep absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l bg-[var(--bg-0)]">
        <header className="line-1 flex items-center justify-between gap-3 border-b bg-[var(--bg-1)] px-5 py-3.5">
          <div className="min-w-0">
            <p className="text-ink truncate font-semibold">{lead.company_name}</p>
            <p className="text-muted truncate text-xs">Lead #{lead.id} · added {timeAgo(lead.created_at)}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => onDelete(lead)}>
              <Icon name="trash" /> Delete
            </Button>
            <button type="button" className="btn btn-ghost h-8 w-8 p-0" onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}

export default function LeadGrid({
  leads,
  totalLeads,
  isLoading,
  error,
  searchQuery,
  onSearchChange,
  priorityFilter,
  onPriorityChange,
  qualificationFilter,
  onQualificationChange,
  sortByScore,
  onSortByScoreChange,
  hasActiveFilters,
  onClearFilters,
  onChanged,
  onOpenImport,
  renderDetail,
}) {
  const [selected, setSelected] = useState(() => new Set());
  const [openLeadId, setOpenLeadId] = useState(null);
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const pages = Math.max(1, Math.ceil(leads.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageLeads = useMemo(
    () => leads.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [leads, currentPage]
  );
  const openLead = leads.find((lead) => lead.id === openLeadId) || null;
  const visibleIds = pageLeads.map((lead) => lead.id);
  const allOnPageSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const selectedIds = [...selected].filter((id) => leads.some((lead) => lead.id === id));

  const toggle = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllOnPage = () =>
    setSelected((current) => {
      const next = new Set(current);
      visibleIds.forEach((id) => (allOnPageSelected ? next.delete(id) : next.add(id)));
      return next;
    });

  const runBulk = async (request, successText) => {
    setBusy(true);
    try {
      await request();
      setMessage({ tone: "success", text: successText });
      setSelected(new Set());
      onChanged();
    } catch (err) {
      setMessage({ tone: "danger", text: apiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const bulkDelete = () => {
    if (!window.confirm(`Delete ${plural(selectedIds.length, "lead")} and their drafts? This cannot be undone.`)) return;
    runBulk(() => api.post("/leads/bulk-delete", { lead_ids: selectedIds }), `Deleted ${plural(selectedIds.length, "lead")}.`);
  };

  const bulkStatus = (status) =>
    runBulk(() => api.post("/leads/bulk-update", { lead_ids: selectedIds, status }), `Marked ${plural(selectedIds.length, "lead")} as ${status}.`);

  const bulkDoNotCall = () =>
    runBulk(() => api.post("/leads/bulk-update", { lead_ids: selectedIds, do_not_call: true }), `Marked ${plural(selectedIds.length, "lead")} do-not-call.`);

  const deleteOne = async (lead) => {
    if (!window.confirm(`Delete ${lead.company_name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/leads/${lead.id}`);
      setOpenLeadId(null);
      setMessage({ tone: "success", text: `Deleted ${lead.company_name}.` });
      onChanged();
    } catch (err) {
      setMessage({ tone: "danger", text: apiErrorMessage(err) });
    }
  };

  return (
    <Card padded={false}>
      <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center">
        <div className="relative lg:max-w-sm lg:flex-1">
          <Icon name="search" className="text-faint pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
          <label htmlFor="lead-search" className="sr-only">Search leads</label>
          <input
            id="lead-search"
            type="search"
            className="field pl-9"
            placeholder="Search company, contact, email, website…"
            value={searchQuery}
            onChange={(event) => {
              onSearchChange(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="lead-priority" className="sr-only">Priority</label>
          <select id="lead-priority" className="field w-36" value={priorityFilter} onChange={(e) => onPriorityChange(e.target.value)}>
            <option value="All">All priorities</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
          <label htmlFor="lead-qualification" className="sr-only">Qualification</label>
          <select id="lead-qualification" className="field w-40" value={qualificationFilter} onChange={(e) => onQualificationChange(e.target.value)}>
            <option value="All">All qualifications</option>
            <option>Hot</option>
            <option>Warm</option>
            <option>Cold</option>
            <option>Not Relevant</option>
          </select>
          <label className="text-ink-2 flex items-center gap-2 px-1 text-sm">
            <input type="checkbox" checked={sortByScore} onChange={(e) => onSortByScoreChange(e.target.checked)} className="h-4 w-4 accent-[var(--accent-solid)]" />
            Sort by score
          </label>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onClearFilters}>Clear</Button>
          )}
        </div>
      </div>

      {message && (
        <div className="px-4 pb-3 sm:px-5">
          <Toast tone={message.tone} onClose={() => setMessage(null)}>{message.text}</Toast>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="line-1 flex flex-wrap items-center gap-2 border-y bg-[var(--accent-soft)] px-4 py-2 sm:px-5">
          <span className="text-ink text-sm font-medium">{selectedIds.length} selected</span>
          <span className="text-faint">·</span>
          {STATUS_OPTIONS.map((status) => (
            <Button key={status} variant="ghost" size="sm" disabled={busy} onClick={() => bulkStatus(status)} className="capitalize">
              Mark {status}
            </Button>
          ))}
          <Button variant="ghost" size="sm" disabled={busy} onClick={bulkDoNotCall}>Do not call</Button>
          <Button variant="danger" size="sm" disabled={busy} onClick={bulkDelete}>
            <Icon name="trash" /> Delete
          </Button>
          <button type="button" className="text-muted ml-auto text-sm hover:underline" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2 p-5">
          {[0, 1, 2, 3, 4].map((key) => <Skeleton key={key} className="h-11 w-full rounded-md" />)}
        </div>
      ) : error ? (
        <div className="p-5"><Toast tone="danger">{error}</Toast></div>
      ) : leads.length === 0 ? (
        <div className="p-5">
          {hasActiveFilters ? (
            <EmptyState title="No leads match your filters" description="Try a different search or clear the filters.">
              <Button variant="secondary" size="sm" onClick={onClearFilters}>Clear filters</Button>
            </EmptyState>
          ) : (
            <EmptyState title="No leads in this campaign yet" description="Import a CSV, run Lead Discovery or start the Lead Agent.">
              <Button size="sm" onClick={onOpenImport}><Icon name="upload" /> Add leads</Button>
            </EmptyState>
          )}
        </div>
      ) : (
        <div className="scroll-x line-1 border-t">
          <table className="min-w-full text-left text-sm">
            <thead className="t-head">
              <tr>
                <th className="w-10 px-4 py-2.5 sm:px-5">
                  <input type="checkbox" aria-label="Select all leads on this page" checked={allOnPageSelected}
                    onChange={toggleAllOnPage} className="h-4 w-4 accent-[var(--accent-solid)]" />
                </th>
                <th className="px-3 py-2.5 font-medium">Company</th>
                <th className="px-3 py-2.5 font-medium">Contact</th>
                <th className="px-3 py-2.5 font-medium">Email</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 text-right font-medium">Score</th>
                <th className="px-3 py-2.5 font-medium">Priority</th>
                <th className="px-3 py-2.5 font-medium">Research</th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {pageLeads.map((lead) => (
                <tr
                  key={lead.id}
                  className={["t-row cursor-pointer", selected.has(lead.id) ? "bg-[var(--accent-soft)]" : ""].join(" ")}
                  onClick={() => setOpenLeadId(lead.id)}
                >
                  <td className="px-4 py-2.5 sm:px-5" onClick={(event) => event.stopPropagation()}>
                    <input type="checkbox" aria-label={`Select ${lead.company_name}`} checked={selected.has(lead.id)}
                      onChange={() => toggle(lead.id)} className="h-4 w-4 accent-[var(--accent-solid)]" />
                  </td>
                  <td className="max-w-[16rem] px-3 py-2.5">
                    <button type="button" className="text-ink block max-w-full truncate text-left font-medium hover:underline"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenLeadId(lead.id);
                      }}>
                      {lead.company_name}
                    </button>
                    <span className="text-faint block truncate text-xs">{lead.website || lead.location || "—"}</span>
                  </td>
                  <td className="max-w-[12rem] px-3 py-2.5">
                    <span className="text-ink-2 block truncate">{lead.contact_name || "—"}</span>
                    <span className="text-faint block truncate text-xs">{lead.contact_role || ""}</span>
                  </td>
                  <td className="text-ink-2 max-w-[14rem] truncate px-3 py-2.5">{lead.email || <span className="text-faint">—</span>}</td>
                  <td className="px-3 py-2.5"><Badge variant={lead.status}>{String(lead.status || "new").replace(/_/g, " ")}</Badge></td>
                  <td className={["tabular px-3 py-2.5 text-right font-semibold", scoreTone(lead.ai_score)].join(" ")}>
                    {lead.ai_score ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">{lead.ai_priority ? <Badge variant={lead.ai_priority}>{lead.ai_priority}</Badge> : <span className="text-faint">—</span>}</td>
                  <td className="text-muted px-3 py-2.5 text-xs capitalize">{String(lead.research_status || "not researched").replace(/_/g, " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {leads.length > 0 && (
        <div className="line-1 flex items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
          <p className="text-muted text-sm tabular">
            {leads.length === totalLeads ? `${totalLeads} leads` : `${leads.length} of ${totalLeads} leads`}
          </p>
          {pages > 1 && (
            <div className="flex items-center gap-1">
              <button type="button" className="btn btn-secondary h-8 w-8 p-0" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} aria-label="Previous page">
                <Icon name="chevronLeft" />
              </button>
              <span className="text-muted px-2 text-sm tabular">{currentPage} / {pages}</span>
              <button type="button" className="btn btn-secondary h-8 w-8 p-0" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)} aria-label="Next page">
                <Icon name="chevronRight" />
              </button>
            </div>
          )}
        </div>
      )}

      {openLead && (
        <Drawer lead={openLead} onClose={() => setOpenLeadId(null)} onDelete={deleteOne}>
          {renderDetail(openLead)}
        </Drawer>
      )}
    </Card>
  );
}
