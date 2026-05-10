import { useEffect, useState } from "react";
import api from "../services/api";
import { getFriendlyErrorMessage } from "../utils/errorMessages";

function formatDate(value) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

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
    <div className="bg-white p-6 rounded-xl shadow border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Campaign List</h2>
          <p className="text-sm text-gray-500 mt-1">
            View all saved outreach campaigns.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="border rounded-lg p-5 text-sm text-gray-600">
          Loading campaigns...
        </div>
      )}

      {!isLoading && error && (
        <div className="border border-red-200 bg-red-50 text-red-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {!isLoading && !error && campaigns.length === 0 && (
        <div className="border border-dashed rounded-lg p-6 text-center">
          <h3 className="font-medium text-gray-800">No campaigns yet</h3>
          <p className="text-sm text-gray-500 mt-1">
            Create your first campaign to start lead outreach.
          </p>
        </div>
      )}

      {!isLoading && !error && campaigns.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-600">
                <th className="px-4 py-3 font-semibold">ID</th>
                <th className="px-4 py-3 font-semibold">Campaign Name</th>
                <th className="px-4 py-3 font-semibold">Industry</th>
                <th className="px-4 py-3 font-semibold">Location</th>
                <th className="px-4 py-3 font-semibold">Target Role</th>
                <th className="px-4 py-3 font-semibold">Offer</th>
                <th className="px-4 py-3 font-semibold">Created At</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{campaign.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {campaign.campaign_name}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{campaign.industry}</td>
                  <td className="px-4 py-3 text-gray-700">{campaign.location}</td>
                  <td className="px-4 py-3 text-gray-700">{campaign.target_role}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-xs">
                    <span className="line-clamp-2">{campaign.offer}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {formatDate(campaign.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default CampaignList;
