import { useEffect, useState } from "react";
import EmailExtraction from "../components/EmailExtraction";
import LeadTable from "../components/LeadTable";
import LeadUpload from "../components/LeadUpload";
import api from "../services/api";

function Leads() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);
  const [campaignsError, setCampaignsError] = useState("");
  const [leads, setLeads] = useState([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [leadsError, setLeadsError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [extractingLeadId, setExtractingLeadId] = useState(null);
  const [leadExtractionMessage, setLeadExtractionMessage] = useState("");
  const [leadExtractionError, setLeadExtractionError] = useState("");

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

  useEffect(() => {
    if (!selectedCampaignId) {
      return;
    }

    const fetchLeads = async () => {
      setIsLoadingLeads(true);
      setLeadsError("");

      try {
        const res = await api.get(`/leads/campaign/${selectedCampaignId}`);
        setLeads(Array.isArray(res.data.data) ? res.data.data : []);
      } catch (err) {
        const detail = err.response?.data?.detail;
        setLeadsError(detail || "Could not load leads. Please try again.");
        console.error(err);
      } finally {
        setIsLoadingLeads(false);
      }
    };

    fetchLeads();
  }, [selectedCampaignId, refreshKey]);

  const refreshLeads = () => {
    setRefreshKey((currentKey) => currentKey + 1);
  };

  const handleCampaignChange = (e) => {
    setSelectedCampaignId(e.target.value);
    setLeads([]);
    setLeadsError("");
    setLeadExtractionMessage("");
    setLeadExtractionError("");
  };

  const handleExtractLeadEmail = async (leadId) => {
    setExtractingLeadId(leadId);
    setLeadExtractionMessage("");
    setLeadExtractionError("");

    try {
      const res = await api.post(`/leads/extract-email/${leadId}`);
      const savedEmail = res.data.saved_email;

      setLeadExtractionMessage(
        savedEmail
          ? `Email extraction completed. Saved email: ${savedEmail}.`
          : "Email extraction completed. No public email was found."
      );
      refreshLeads();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setLeadExtractionError(detail || "Email extraction failed. Please try again.");
      console.error(err);
    } finally {
      setExtractingLeadId(null);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Leads</h2>

      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow border">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Select Campaign</h2>
            <p className="text-sm text-gray-500 mt-1">
              Leads will be saved under the campaign you choose here.
            </p>
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
              No campaigns found. Create a campaign before uploading leads.
            </p>
          )}
        </div>

        <LeadUpload
          campaignId={selectedCampaignId}
          onUploadComplete={refreshLeads}
        />

        <EmailExtraction
          campaignId={selectedCampaignId}
          onExtractionComplete={refreshLeads}
        />

        {(leadExtractionMessage || leadExtractionError) && (
          <div className="bg-white p-6 rounded-xl shadow border">
            {leadExtractionMessage && (
              <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                {leadExtractionMessage}
              </p>
            )}

            {leadExtractionError && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {leadExtractionError}
              </p>
            )}
          </div>
        )}

        <LeadTable
          leads={leads}
          isLoading={isLoadingLeads}
          error={leadsError}
          hasSelectedCampaign={Boolean(selectedCampaignId)}
          onExtractEmail={handleExtractLeadEmail}
          extractingLeadId={extractingLeadId}
        />
      </div>
    </div>
  );
}

export default Leads;
