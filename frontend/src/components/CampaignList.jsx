import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { apiErrorMessage, formatDateTime, timeAgo } from "../utils/format";
import Button from "./ui/Button";
import Card from "./ui/Card";
import EmptyState from "./ui/EmptyState";
import Icon from "./ui/Icon";
import Skeleton from "./ui/Skeleton";
import Toast from "./ui/Toast";

const FIELDS = [
  ["campaign_name", "Name"],
  ["industry", "Industry"],
  ["location", "Location"],
  ["target_role", "Target role"],
];

function EditCampaign({ campaign, onSaved, onCancel }) {
  const [form, setForm] = useState({
    campaign_name: campaign.campaign_name,
    industry: campaign.industry,
    location: campaign.location,
    target_role: campaign.target_role,
    offer: campaign.offer,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.patch(`/campaigns/${campaign.id}`, form);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-3">
      {error && <Toast tone="danger">{error}</Toast>}
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(([field, label]) => (
          <div key={field}>
            <label className="label" htmlFor={`c-${campaign.id}-${field}`}>{label}</label>
            <input
              id={`c-${campaign.id}-${field}`}
              className="field"
              required
              maxLength={255}
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <div>
        <label className="label" htmlFor={`c-${campaign.id}-offer`}>Offer</label>
        <textarea id={`c-${campaign.id}-offer`} className="field" required value={form.offer}
          onChange={(e) => setForm({ ...form, offer: e.target.value })} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={busy}>Save changes</Button>
        <Button type="button" size="sm" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function CampaignList({ refreshKey }) {
  const [campaigns, setCampaigns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/campaigns/")
      .then((res) => {
        if (!cancelled) {
          setCampaigns(Array.isArray(res.data.data) ? res.data.data : []);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(apiErrorMessage(err, "Could not load campaigns. Please try again."));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, reloadKey]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return campaigns;
    return campaigns.filter((campaign) =>
      [campaign.campaign_name, campaign.industry, campaign.location, campaign.target_role]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(needle))
    );
  }, [campaigns, query]);

  const duplicate = async (campaign) => {
    try {
      await api.post(`/campaigns/${campaign.id}/duplicate`);
      setNotice(`Duplicated "${campaign.campaign_name}".`);
      reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const remove = async (campaign) => {
    const leads = campaign.lead_count ?? 0;
    const message = leads
      ? `Delete "${campaign.campaign_name}" and its ${leads} leads, drafts and jobs? This cannot be undone.`
      : `Delete "${campaign.campaign_name}"? This cannot be undone.`;
    if (!window.confirm(message)) return;
    try {
      await api.delete(`/campaigns/${campaign.id}`);
      setNotice(`Deleted "${campaign.campaign_name}".`);
      reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <Card>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-ink text-base font-semibold">All campaigns</h2>
          <p className="text-muted mt-0.5 text-sm">
            {campaigns.length} {campaigns.length === 1 ? "campaign" : "campaigns"}
          </p>
        </div>
        {campaigns.length > 3 && (
          <div className="relative sm:w-64">
            <Icon name="search" className="text-faint pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
            <label htmlFor="campaign-search" className="sr-only">Search campaigns</label>
            <input id="campaign-search" className="field pl-9" placeholder="Search campaigns" value={query}
              onChange={(e) => setQuery(e.target.value)} />
          </div>
        )}
      </div>

      {notice && <Toast tone="success" className="mb-4" onClose={() => setNotice("")}>{notice}</Toast>}
      {error && <Toast tone="danger" className="mb-4" onClose={() => setError("")}>{error}</Toast>}

      {isLoading ? (
        <div role="status" className="space-y-3">
          <span className="sr-only">Loading campaigns…</span>
          {[0, 1, 2].map((index) => <Skeleton key={index} className="h-24 w-full rounded-lg" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState title="No campaigns yet" description="Create your first campaign above to start finding leads." />
      ) : visible.length === 0 ? (
        <EmptyState title="No matching campaigns" description="Try a different search." />
      ) : (
        <ul className="space-y-3">
          {visible.map((campaign) => (
            <li key={campaign.id} className="line-1 hover:line-2 rounded-lg border p-4 transition-colors">
              {editingId === campaign.id ? (
                <EditCampaign
                  campaign={campaign}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => {
                    setEditingId(null);
                    setNotice("Campaign updated.");
                    reload();
                  }}
                />
              ) : (
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-ink break-words text-[15px] font-semibold">{campaign.campaign_name}</h3>
                      <span className="text-faint text-xs" title={formatDateTime(campaign.created_at)}>
                        Created {timeAgo(campaign.created_at)}
                      </span>
                    </div>
                    <div className="text-muted mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <span>{campaign.industry}</span>
                      <span>{campaign.location}</span>
                      <span>{campaign.target_role}</span>
                    </div>
                    <p className="text-ink-2 mt-2 line-clamp-2 break-words text-sm">{campaign.offer}</p>
                    <div className="mt-3 flex gap-2">
                      <span className="tone tone-info tabular">{campaign.lead_count ?? 0} leads</span>
                      <span className="tone tone-violet tabular">{campaign.sent_count ?? 0} sent</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 lg:justify-end">
                    <Button as={Link} to={`/leads?campaign_id=${campaign.id}`} variant="secondary" size="sm">
                      <Icon name="leads" /> Leads
                    </Button>
                    <Button as={Link} to={`/discovery?campaign_id=${campaign.id}`} variant="secondary" size="sm">
                      <Icon name="discovery" /> Discover
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(campaign.id)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => duplicate(campaign)} title="Duplicate">
                      <Icon name="copy" /><span className="sr-only">Duplicate</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(campaign)} title="Delete">
                      <Icon name="trash" /><span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default CampaignList;
