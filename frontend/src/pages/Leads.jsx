import { useEffect, useMemo, useState } from "react";
import EmailExtraction from "../components/EmailExtraction";
import LeadTable from "../components/LeadTable";
import LeadUpload from "../components/LeadUpload";
import api from "../services/api";
import { getFriendlyErrorMessage } from "../utils/errorMessages";

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
  const [isScoringCampaign, setIsScoringCampaign] = useState(false);
  const [scoringLeadId, setScoringLeadId] = useState(null);
  const [leadScoringMessage, setLeadScoringMessage] = useState("");
  const [leadScoringError, setLeadScoringError] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [qualificationFilter, setQualificationFilter] = useState("All");
  const [sortByScore, setSortByScore] = useState(true);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => String(campaign.id) === String(selectedCampaignId)),
    [campaigns, selectedCampaignId]
  );

  const emailsFoundCount = useMemo(
    () => leads.filter((lead) => lead.email || lead.status === "email_found").length,
    [leads]
  );

  const scoredLeadCount = useMemo(
    () => leads.filter((lead) => lead.ai_score !== null && lead.ai_score !== undefined).length,
    [leads]
  );

  const visibleLeads = useMemo(() => {
    const filteredLeads = leads.filter((lead) => {
      const priorityMatches = priorityFilter === "All" || lead.ai_priority === priorityFilter;
      const qualificationMatches = qualificationFilter === "All" || lead.ai_qualification === qualificationFilter;

      return priorityMatches && qualificationMatches;
    });

    if (!sortByScore) {
      return filteredLeads;
    }

    return [...filteredLeads].sort((a, b) => (
      (b.ai_score ?? -1) - (a.ai_score ?? -1)
    ));
  }, [leads, priorityFilter, qualificationFilter, sortByScore]);

  useEffect(() => {
    const fetchCampaigns = async () => {
      setIsLoadingCampaigns(true);
      setCampaignsError("");

      try {
        const res = await api.get("/campaigns/");
        setCampaigns(Array.isArray(res.data.data) ? res.data.data : []);
      } catch (err) {
        setCampaignsError(getFriendlyErrorMessage(err, "Could not load campaigns. Please try again."));
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
        setLeadsError(err.response ? detail || "Could not load leads. Please try again." : getFriendlyErrorMessage(err));
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
    setLeadScoringMessage("");
    setLeadScoringError("");
    setPriorityFilter("All");
    setQualificationFilter("All");
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
      setLeadExtractionError(err.response ? detail || "Email extraction failed. Please try again." : getFriendlyErrorMessage(err));
      console.error(err);
    } finally {
      setExtractingLeadId(null);
    }
  };

  const handleScoreCampaignLeads = async () => {
    if (!selectedCampaignId) {
      return;
    }

    setIsScoringCampaign(true);
    setLeadScoringMessage("");
    setLeadScoringError("");

    try {
      const res = await api.post(`/lead-scoring/score-campaign/${selectedCampaignId}?limit=5`);
      setLeadScoringMessage(
        `Scored ${res.data.scored ?? 0} leads, skipped ${res.data.skipped ?? 0}, failed ${res.data.failed ?? 0}. Remaining unscored: ${res.data.remaining_unscored ?? 0}.`
      );
      refreshLeads();
    } catch (err) {
      setLeadScoringError(getFriendlyErrorMessage(err, "AI lead scoring failed. Please try again.", "lead-scoring"));
      console.error(err);
    } finally {
      setIsScoringCampaign(false);
    }
  };

  const handleScoreLead = async (lead) => {
    const isRescore = lead.ai_score !== null && lead.ai_score !== undefined;

    setScoringLeadId(lead.id);
    setLeadScoringMessage("");
    setLeadScoringError("");

    try {
      await api.post(`/lead-scoring/score/${lead.id}${isRescore ? "?force=true" : ""}`);
      setLeadScoringMessage(isRescore ? "Lead rescored successfully." : "Lead scored successfully.");
      refreshLeads();
    } catch (err) {
      setLeadScoringError(getFriendlyErrorMessage(err, "AI lead scoring failed. Please try again.", "lead-scoring"));
      console.error(err);
    } finally {
      setScoringLeadId(null);
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
              Create your first campaign to start lead outreach.
            </p>
          )}
        </div>

        {selectedCampaign && (
          <div className="bg-white p-6 rounded-xl shadow border">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Campaign Summary</h2>
              <p className="text-sm text-gray-500 mt-1">{selectedCampaign.campaign_name}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg border bg-gray-50 p-4">
                <p className="text-xs text-gray-500">Industry</p>
                <p className="mt-1 font-medium text-gray-900">{selectedCampaign.industry || "N/A"}</p>
              </div>
              <div className="rounded-lg border bg-gray-50 p-4">
                <p className="text-xs text-gray-500">Location</p>
                <p className="mt-1 font-medium text-gray-900">{selectedCampaign.location || "N/A"}</p>
              </div>
              <div className="rounded-lg border bg-gray-50 p-4">
                <p className="text-xs text-gray-500">Target Role</p>
                <p className="mt-1 font-medium text-gray-900">{selectedCampaign.target_role || "N/A"}</p>
              </div>
              <div className="rounded-lg border bg-gray-50 p-4 md:col-span-3">
                <p className="text-xs text-gray-500">Offer</p>
                <p className="mt-1 text-sm text-gray-900">{selectedCampaign.offer || "N/A"}</p>
              </div>
              <div className="rounded-lg border bg-blue-50 p-4">
                <p className="text-xs text-blue-700">Lead Count</p>
                <p className="mt-1 text-2xl font-semibold text-blue-900">{leads.length}</p>
              </div>
              <div className="rounded-lg border bg-green-50 p-4">
                <p className="text-xs text-green-700">Emails Found</p>
                <p className="mt-1 text-2xl font-semibold text-green-900">{emailsFoundCount}</p>
              </div>
              <div className="rounded-lg border bg-indigo-50 p-4">
                <p className="text-xs text-indigo-700">AI Scored</p>
                <p className="mt-1 text-2xl font-semibold text-indigo-900">{scoredLeadCount}</p>
              </div>
            </div>
          </div>
        )}

        {selectedCampaign && (
          <div className="bg-white p-6 rounded-xl shadow border">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold">AI Lead Scoring</h2>
                <p className="mt-1 text-sm text-gray-500">
                  AI scoring is a recommendation. Review before contacting leads.
                </p>
              </div>

              <button
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                disabled={!selectedCampaignId || isScoringCampaign || leads.length === 0}
                onClick={handleScoreCampaignLeads}
              >
                {isScoringCampaign ? "Scoring leads..." : "Score Leads with AI"}
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">Priority</span>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full rounded border p-2 text-gray-800"
                >
                  <option>All</option>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">Qualification</span>
                <select
                  value={qualificationFilter}
                  onChange={(e) => setQualificationFilter(e.target.value)}
                  className="w-full rounded border p-2 text-gray-800"
                >
                  <option>All</option>
                  <option>Hot</option>
                  <option>Warm</option>
                  <option>Cold</option>
                  <option>Not Relevant</option>
                </select>
              </label>

              <label className="flex items-center gap-2 self-end text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={sortByScore}
                  onChange={(e) => setSortByScore(e.target.checked)}
                  className="h-4 w-4"
                />
                Sort by AI score
              </label>
            </div>
          </div>
        )}

        <LeadUpload
          campaignId={selectedCampaignId}
          onUploadComplete={refreshLeads}
        />

        <EmailExtraction
          campaignId={selectedCampaignId}
          onExtractionComplete={refreshLeads}
        />

        {(leadExtractionMessage || leadExtractionError || leadScoringMessage || leadScoringError) && (
          <div className="bg-white p-6 rounded-xl shadow border">
            {leadExtractionMessage && (
              <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                {leadExtractionMessage}
              </p>
            )}

            {leadScoringMessage && (
              <p className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-700 first:mt-0">
                {leadScoringMessage}
              </p>
            )}

            {leadExtractionError && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {leadExtractionError}
              </p>
            )}

            {leadScoringError && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 first:mt-0">
                {leadScoringError}
              </p>
            )}
          </div>
        )}

        <LeadTable
          leads={visibleLeads}
          isLoading={isLoadingLeads}
          error={leadsError}
          hasSelectedCampaign={Boolean(selectedCampaignId)}
          onExtractEmail={handleExtractLeadEmail}
          extractingLeadId={extractingLeadId}
          onScoreLead={handleScoreLead}
          scoringLeadId={scoringLeadId}
        />
      </div>
    </div>
  );
}

export default Leads;
