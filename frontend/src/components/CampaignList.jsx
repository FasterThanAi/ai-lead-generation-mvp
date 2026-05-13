import { useEffect, useState } from "react";
import api from "../services/api";
import { formatDateTimeIST } from "../utils/dateUtils";
import { getFriendlyErrorMessage } from "../utils/errorMessages";
import Card from "./ui/Card";
import EmptyState from "./ui/EmptyState";

function CampaignList({ refreshKey }) {
  const [campaigns, setCampaigns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCampaigns = async () => {
      setIsLoading(true);
      setError("");

      try {
        const res = await api.get("/campaigns/");
        setCampaigns(Array.isArray(res.data.data) ? res.data.data : []);
      } catch (err) {
        setError(getFriendlyErrorMessage(err, "Could not load campaigns. Please try again."));
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaigns();
  }, [refreshKey]);

  return (
    <Card>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">Campaign List</h2>
          <p className="mt-1 text-sm text-slate-500">
            View all saved outreach campaigns.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
          Loading campaigns...
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!isLoading && !error && campaigns.length === 0 && (
        <EmptyState
          title="No campaigns yet"
          description="Create your first campaign to start lead outreach."
        />
      )}

      {!isLoading && !error && campaigns.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {campaigns.map((campaign) => (
            <article
              key={campaign.id}
              className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Campaign #{campaign.id}
                  </p>
                  <h3 className="mt-2 break-words text-lg font-semibold text-slate-950">
                    {campaign.campaign_name}
                  </h3>
                </div>
                <p className="text-xs text-slate-500">{formatDateTimeIST(campaign.created_at)}</p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Industry</p>
                  <p className="mt-1 break-words text-sm font-medium text-slate-900">{campaign.industry}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Location</p>
                  <p className="mt-1 break-words text-sm font-medium text-slate-900">{campaign.location}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Target Role</p>
                  <p className="mt-1 break-words text-sm font-medium text-slate-900">{campaign.target_role}</p>
                </div>
              </div>

              <p className="mt-4 break-words text-sm leading-6 text-slate-600">{campaign.offer}</p>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}

export default CampaignList;
