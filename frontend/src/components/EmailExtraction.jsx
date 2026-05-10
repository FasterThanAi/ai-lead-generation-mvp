import { useState } from "react";
import api from "../services/api";
import { getFriendlyErrorMessage } from "../utils/errorMessages";

function EmailExtraction({ campaignId, onExtractionComplete }) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");

  const handleExtractCampaignEmails = async () => {
    setSummary("");
    setError("");

    if (!campaignId) {
      setError("Please select a campaign before extracting emails.");
      return;
    }

    setIsExtracting(true);

    try {
      const res = await api.post(`/leads/extract-emails/campaign/${campaignId}`);
      const data = res.data;

      setSummary(
        `Processed ${data.processed} leads. Emails found: ${data.email_found}. Not found: ${data.email_not_found}. Website missing: ${data.website_missing}. Failed: ${data.extraction_failed}.`
      );
      onExtractionComplete?.();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(err.response ? detail || "Email extraction failed. Please try again." : getFriendlyErrorMessage(err));
      console.error(err);
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow border">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Email Extraction</h2>
        <p className="text-sm text-gray-500 mt-1">
          Find public emails from lead websites for the selected campaign.
        </p>
      </div>

      {summary && (
        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {summary}
        </p>
      )}

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        className="rounded bg-blue-600 px-5 py-3 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        disabled={!campaignId || isExtracting}
        onClick={handleExtractCampaignEmails}
      >
        {isExtracting ? "Extracting emails..." : "Extract Emails for Campaign"}
      </button>

      {!campaignId && (
        <p className="mt-3 text-sm text-gray-500">
          Select a campaign above to enable email extraction.
        </p>
      )}
    </div>
  );
}

export default EmailExtraction;
