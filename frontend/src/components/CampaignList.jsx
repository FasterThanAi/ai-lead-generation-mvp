import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { formatDateTimeIST } from "../utils/dateUtils";
import { getFriendlyErrorMessage } from "../utils/errorMessages";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import Card from "./ui/Card";
import EmptyState from "./ui/EmptyState";
import Skeleton from "./ui/Skeleton";

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
          <h2 className="text-xl font-semibold tracking-tight text-ink">Campaign List</h2>
          <p className="mt-1 text-sm text-muted">
            View all saved outreach campaigns.
          </p>
        </div>

        {!isLoading && !error && campaigns.length > 0 && (
          <Badge variant="info">
            {campaigns.length} {campaigns.length === 1 ? "campaign" : "campaigns"}
          </Badge>
        )}
      </div>

      {isLoading && (
        <div role="status" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <span className="sr-only">Loading campaigns...</span>
          {[0, 1].map((index) => (
            <div key={index} className="rounded-3xl border line-1 surface-2 p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-5 w-2/3" />
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
              <Skeleton className="mt-4 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-4/5" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-2xl border border-danger-soft bg-danger-soft p-4 text-sm text-danger">
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
              className="rounded-3xl border line-1 surface-2 p-5 elev-1 transition hover:-translate-y-0.5 hover:elev-1"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">
                    Campaign #{campaign.id}
                  </p>
                  <h3 className="mt-2 break-words text-lg font-semibold text-ink">
                    {campaign.campaign_name}
                  </h3>
                </div>
                <p className="text-xs text-muted">{formatDateTimeIST(campaign.created_at)}</p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl surface-sunk p-3">
                  <p className="text-xs text-muted">Industry</p>
                  <p className="mt-1 break-words text-sm font-medium text-ink">{campaign.industry}</p>
                </div>
                <div className="rounded-2xl surface-sunk p-3">
                  <p className="text-xs text-muted">Location</p>
                  <p className="mt-1 break-words text-sm font-medium text-ink">{campaign.location}</p>
                </div>
                <div className="rounded-2xl surface-sunk p-3">
                  <p className="text-xs text-muted">Target Role</p>
                  <p className="mt-1 break-words text-sm font-medium text-ink">{campaign.target_role}</p>
                </div>
              </div>

              <p className="mt-4 break-words text-sm leading-6 text-ink-2">{campaign.offer}</p>

              <div className="mt-4">
                <Button as={Link} to={`/discovery?campaign_id=${campaign.id}`} variant="secondary" size="sm">
                  Create Discovery Job
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}

export default CampaignList;
