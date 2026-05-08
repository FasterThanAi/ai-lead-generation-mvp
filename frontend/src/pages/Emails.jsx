import { useEffect, useMemo, useState } from "react";
import api from "../services/api";

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

function getErrorMessage(err, fallbackMessage) {
  const detail = err.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  return fallbackMessage;
}

function getStatusClasses(status) {
  const statusClasses = {
    generated: "bg-blue-50 text-blue-700 border-blue-100",
    approved: "bg-green-50 text-green-700 border-green-100",
    rejected: "bg-red-50 text-red-700 border-red-100",
  };

  return statusClasses[status] || "bg-gray-50 text-gray-700 border-gray-100";
}

function Emails() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);
  const [campaignsError, setCampaignsError] = useState("");
  const [drafts, setDrafts] = useState([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [draftsError, setDraftsError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [generationSummary, setGenerationSummary] = useState(null);
  const [updatingDraftId, setUpdatingDraftId] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusError, setStatusError] = useState("");

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => String(campaign.id) === String(selectedCampaignId)),
    [campaigns, selectedCampaignId]
  );

  useEffect(() => {
    const fetchCampaigns = async () => {
      setIsLoadingCampaigns(true);
      setCampaignsError("");

      try {
        const res = await api.get("/campaigns/");
        setCampaigns(Array.isArray(res.data.data) ? res.data.data : []);
      } catch (err) {
        setCampaignsError("Could not load campaigns. Please try again.");
        console.error(err);
      } finally {
        setIsLoadingCampaigns(false);
      }
    };

    fetchCampaigns();
  }, []);

  const fetchDrafts = async (campaignId) => {
    if (!campaignId) {
      setDrafts([]);
      return;
    }

    setIsLoadingDrafts(true);
    setDraftsError("");

    try {
      const res = await api.get(`/emails/campaign/${campaignId}`);
      setDrafts(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (err) {
      setDraftsError(getErrorMessage(err, "Could not load email drafts. Please try again."));
      console.error(err);
    } finally {
      setIsLoadingDrafts(false);
    }
  };

  useEffect(() => {
    setGenerationSummary(null);
    setGenerationError("");
    setStatusMessage("");
    setStatusError("");
    fetchDrafts(selectedCampaignId);
  }, [selectedCampaignId]);

  const handleCampaignChange = (e) => {
    setSelectedCampaignId(e.target.value);
    setDrafts([]);
    setDraftsError("");
  };

  const handleGenerateCampaignEmails = async () => {
    if (!selectedCampaignId) {
      return;
    }

    setIsGenerating(true);
    setGenerationError("");
    setGenerationSummary(null);
    setStatusMessage("");
    setStatusError("");

    try {
      const res = await api.post(`/ai/generate-emails/campaign/${selectedCampaignId}?limit=5`);
      setGenerationSummary({
        generated: res.data.generated ?? 0,
        skipped: res.data.skipped ?? 0,
        failed: res.data.failed ?? 0,
        remaining: res.data.remaining ?? 0,
      });
      await fetchDrafts(selectedCampaignId);
    } catch (err) {
      setGenerationError(getErrorMessage(err, "Email generation failed. Please try again."));
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateStatus = async (emailId, nextStatus) => {
    setUpdatingDraftId(emailId);
    setStatusMessage("");
    setStatusError("");

    try {
      const res = await api.patch(`/emails/${emailId}/status`, {
        status: nextStatus,
      });
      const updatedDraft = res.data.data;

      setDrafts((currentDrafts) =>
        currentDrafts.map((draft) => (
          draft.id === emailId ? updatedDraft : draft
        ))
      );
      setStatusMessage("Email status updated successfully.");
    } catch (err) {
      setStatusError(getErrorMessage(err, "Could not update email status. Please try again."));
      console.error(err);
    } finally {
      setUpdatingDraftId(null);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">AI Email Generation</h2>

      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow border">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Select Campaign</h2>
          </div>

          {campaignsError && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {campaignsError}
            </p>
          )}

          <select
            value={selectedCampaignId}
            onChange={handleCampaignChange}
            className="w-full rounded border p-3 text-gray-800"
            disabled={isLoadingCampaigns || campaigns.length === 0}
          >
            <option value="">
              {isLoadingCampaigns ? "Loading campaigns..." : "Choose a campaign"}
            </option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.campaign_name}
              </option>
            ))}
          </select>

          {!isLoadingCampaigns && !campaignsError && campaigns.length === 0 && (
            <p className="mt-3 text-sm text-gray-500">
              No campaigns found.
            </p>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow border">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Generate Drafts</h2>
              {selectedCampaign && (
                <p className="mt-1 text-sm text-gray-500">
                  {selectedCampaign.campaign_name}
                </p>
              )}
            </div>

            <button
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              disabled={!selectedCampaignId || isGenerating}
              onClick={handleGenerateCampaignEmails}
            >
              {isGenerating ? "Generating emails..." : "Generate Next 5 Emails"}
            </button>
          </div>

          <p className="mt-3 text-sm text-gray-500">
            For safety, only 5 leads are processed per click.
          </p>

          {generationSummary && (
            <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              Generated: {generationSummary.generated}, Skipped: {generationSummary.skipped}, Failed: {generationSummary.failed}, Remaining: {generationSummary.remaining}
            </p>
          )}

          {generationError && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {generationError}
            </p>
          )}
        </div>

        {(statusMessage || statusError) && (
          <div className="bg-white p-6 rounded-xl shadow border">
            {statusMessage && (
              <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                {statusMessage}
              </p>
            )}

            {statusError && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {statusError}
              </p>
            )}
          </div>
        )}

        <div className="bg-white p-6 rounded-xl shadow border">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Email Drafts</h2>
          </div>

          {!selectedCampaignId && (
            <div className="border border-dashed rounded-lg p-6 text-center">
              <h3 className="font-medium text-gray-800">Select a campaign</h3>
              <p className="text-sm text-gray-500 mt-1">
                Choose a campaign to view drafts.
              </p>
            </div>
          )}

          {selectedCampaignId && isLoadingDrafts && (
            <div className="border rounded-lg p-5 text-sm text-gray-600">
              Loading email drafts...
            </div>
          )}

          {selectedCampaignId && !isLoadingDrafts && draftsError && (
            <div className="border border-red-200 bg-red-50 text-red-700 rounded-lg p-4 text-sm">
              {draftsError}
            </div>
          )}

          {selectedCampaignId && !isLoadingDrafts && !draftsError && drafts.length === 0 && (
            <div className="border border-dashed rounded-lg p-6 text-center">
              <h3 className="font-medium text-gray-800">No email drafts found for this campaign</h3>
              <p className="text-sm text-gray-500 mt-1">
                Click generate to create AI email drafts.
              </p>
            </div>
          )}

          {selectedCampaignId && !isLoadingDrafts && !draftsError && drafts.length > 0 && (
            <div className="space-y-4">
              {drafts.map((draft) => (
                <div key={draft.id} className="rounded-lg border p-5">
                  <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-500">
                        {draft.lead_company_name || `Lead ID ${draft.lead_id}`}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-gray-900">
                        {draft.subject}
                      </h3>
                      {(draft.lead_contact_name || draft.lead_contact_role) && (
                        <p className="mt-1 text-sm text-gray-500">
                          {[draft.lead_contact_name, draft.lead_contact_role].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>

                    <span className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${getStatusClasses(draft.status)}`}>
                      {draft.status}
                    </span>
                  </div>

                  <p className="mt-4 whitespace-pre-line text-sm leading-6 text-gray-700">
                    {draft.body}
                  </p>

                  <div className="mt-5 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-gray-500">
                      <span>{draft.ai_model || "AI model unavailable"}</span>
                      <span className="mx-2">|</span>
                      <span>{formatDate(draft.created_at)}</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
                        disabled={updatingDraftId === draft.id || draft.status === "approved"}
                        onClick={() => handleUpdateStatus(draft.id, "approved")}
                      >
                        {updatingDraftId === draft.id ? "Updating..." : "Approve"}
                      </button>
                      <button
                        className="rounded bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                        disabled={updatingDraftId === draft.id || draft.status === "rejected"}
                        onClick={() => handleUpdateStatus(draft.id, "rejected")}
                      >
                        {updatingDraftId === draft.id ? "Updating..." : "Reject"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Emails;
