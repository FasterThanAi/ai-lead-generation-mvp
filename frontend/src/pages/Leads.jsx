import { useEffect, useMemo, useState } from "react";
import EmailExtraction from "../components/EmailExtraction";
import LeadTable from "../components/LeadTable";
import LeadUpload from "../components/LeadUpload";
import api from "../services/api";
import { getFriendlyErrorMessage } from "../utils/errorMessages";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";

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
  const [leadResearchMessage, setLeadResearchMessage] = useState("");
  const [leadResearchError, setLeadResearchError] = useState("");
  const [researchingLeadId, setResearchingLeadId] = useState(null);
  const [isResearchingCampaign, setIsResearchingCampaign] = useState(false);
  const [generatingCallScriptLeadId, setGeneratingCallScriptLeadId] = useState(null);
  const [startingCallLeadId, setStartingCallLeadId] = useState(null);
  const [callScriptsByLead, setCallScriptsByLead] = useState({});
  const [callMessage, setCallMessage] = useState("");
  const [callError, setCallError] = useState("");
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

  const researchedLeadCount = useMemo(
    () => leads.filter((lead) => lead.research_status === "researched").length,
    [leads]
  );

  const averageResearchConfidence = useMemo(() => {
    const confidenceValues = leads
      .map((lead) => lead.research_confidence)
      .filter((value) => value !== null && value !== undefined);

    if (confidenceValues.length === 0) {
      return 0;
    }

    return confidenceValues.reduce((total, value) => total + Number(value), 0) / confidenceValues.length;
  }, [leads]);

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
    setLeadResearchMessage("");
    setLeadResearchError("");
    setCallMessage("");
    setCallError("");
    setCallScriptsByLead({});
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
      await api.post(`/lead-scoring/score/${lead.id}`, null, {
        params: {
          force: isRescore,
        },
      });
      setLeadScoringMessage(isRescore ? "Lead rescored successfully." : "Lead scored successfully.");
      refreshLeads();
    } catch (err) {
      setLeadScoringError(getFriendlyErrorMessage(err, "AI lead scoring failed. Please try again.", "lead-scoring"));
      console.error(err);
    } finally {
      setScoringLeadId(null);
    }
  };

  const handleResearchLead = async (lead) => {
    setResearchingLeadId(lead.id);
    setLeadResearchMessage("");
    setLeadResearchError("");

    try {
      const res = await api.post(`/leads/${lead.id}/research`);
      const confidence = res.data.research_confidence;
      setLeadResearchMessage(
        `Research completed for ${lead.company_name}. Confidence: ${confidence ?? "N/A"}.`
      );
      refreshLeads();
    } catch (err) {
      setLeadResearchError(getFriendlyErrorMessage(err, "Lead research failed. Please try again."));
      console.error(err);
    } finally {
      setResearchingLeadId(null);
    }
  };

  const handleResearchCampaignLeads = async () => {
    if (!selectedCampaignId) {
      return;
    }

    setIsResearchingCampaign(true);
    setLeadResearchMessage("");
    setLeadResearchError("");

    try {
      const res = await api.post(`/campaigns/${selectedCampaignId}/research-leads`, null, {
        params: {
          limit: 5,
        },
      });
      setLeadResearchMessage(
        `Research processed ${res.data.processed ?? 0} leads. Researched ${res.data.researched ?? 0}, failed ${res.data.failed ?? 0}. Remaining: ${res.data.remaining ?? 0}.`
      );
      refreshLeads();
    } catch (err) {
      setLeadResearchError(getFriendlyErrorMessage(err, "Campaign lead research failed. Please try again."));
      console.error(err);
    } finally {
      setIsResearchingCampaign(false);
    }
  };

  const handleGenerateCallScript = async (lead) => {
    setGeneratingCallScriptLeadId(lead.id);
    setCallMessage("");
    setCallError("");

    try {
      const res = await api.post("/calls/generate-script", {
        lead_id: lead.id,
        campaign_id: lead.campaign_id,
      });
      setCallScriptsByLead((current) => ({
        ...current,
        [lead.id]: res.data,
      }));
      setCallMessage(`Call script generated for ${lead.company_name}.`);
    } catch (err) {
      setCallError(getFriendlyErrorMessage(err, "Call script could not be generated."));
      console.error(err);
    } finally {
      setGeneratingCallScriptLeadId(null);
    }
  };

  const handleStartTestCall = async (lead) => {
    setStartingCallLeadId(lead.id);
    setCallMessage("");
    setCallError("");

    try {
      const res = await api.post("/calls/start-vapi", {
        lead_id: lead.id,
        campaign_id: lead.campaign_id,
        phone_number: lead.phone || null,
        use_test_number: true,
      });
      setCallMessage(`AI test call started. Call log ID: ${res.data.call_log_id}.`);
      refreshLeads();
    } catch (err) {
      setCallError(getFriendlyErrorMessage(err, "AI test call could not be started."));
      console.error(err);
    } finally {
      setStartingCallLeadId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Upload, enrich, score, and review leads without losing the business context behind each recommendation."
      />

      <div className="space-y-6">
        <Card>
          <div className="mb-4">
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">Select Campaign</h2>
            <p className="mt-1 text-sm text-slate-500">
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
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white/80 px-4 text-sm text-slate-800 shadow-sm outline-none transition focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
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
        </Card>

        {selectedCampaign && (
          <Card>
            <div className="mb-4">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">Campaign Summary</h2>
              <p className="mt-1 text-sm text-slate-500">{selectedCampaign.campaign_name}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Industry</p>
                <p className="mt-1 break-words font-medium text-slate-900">{selectedCampaign.industry || "N/A"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Location</p>
                <p className="mt-1 break-words font-medium text-slate-900">{selectedCampaign.location || "N/A"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Target Role</p>
                <p className="mt-1 break-words font-medium text-slate-900">{selectedCampaign.target_role || "N/A"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2 xl:col-span-3">
                <p className="text-xs text-slate-500">Offer</p>
                <p className="mt-1 break-words text-sm leading-6 text-slate-900">{selectedCampaign.offer || "N/A"}</p>
              </div>
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-xs text-blue-700">Lead Count</p>
                <p className="mt-1 text-2xl font-semibold text-blue-900">{leads.length}</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-xs text-green-700">Emails Found</p>
                <p className="mt-1 text-2xl font-semibold text-green-900">{emailsFoundCount}</p>
              </div>
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                <p className="text-xs text-indigo-700">AI Scored</p>
                <p className="mt-1 text-2xl font-semibold text-indigo-900">{scoredLeadCount}</p>
              </div>
              <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                <p className="text-xs text-sky-700">AI Researched</p>
                <p className="mt-1 text-2xl font-semibold text-sky-900">{researchedLeadCount}</p>
              </div>
              <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                <p className="text-xs text-violet-700">Avg Research Confidence</p>
                <p className="mt-1 text-2xl font-semibold text-violet-900">{averageResearchConfidence.toFixed(1)}</p>
              </div>
            </div>
          </Card>
        )}

        {selectedCampaign && (
          <Card>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">AI Lead Scoring</h2>
                <p className="mt-1 text-sm text-slate-500">
                  AI scoring is a recommendation. Review before contacting leads.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-600 md:grid-cols-3">
                  <p className="rounded border bg-green-50 p-3">
                    <span className="font-semibold text-green-800">Fit Score</span> = company and campaign match.
                  </p>
                  <p className="rounded border bg-yellow-50 p-3">
                    <span className="font-semibold text-yellow-800">Contact Confidence</span> = quality of contact details.
                  </p>
                  <p className="rounded border bg-indigo-50 p-3">
                    <span className="font-semibold text-indigo-800">Final AI Score</span> = outreach readiness.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="indigo"
                className="w-full lg:w-auto"
                disabled={!selectedCampaignId || isScoringCampaign || leads.length === 0}
                onClick={handleScoreCampaignLeads}
              >
                {isScoringCampaign ? "Scoring leads..." : "Score Leads with AI"}
              </Button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">Priority</span>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 text-sm text-slate-800 shadow-sm outline-none focus:ring-4 focus:ring-slate-100"
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
                  className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 text-sm text-slate-800 shadow-sm outline-none focus:ring-4 focus:ring-slate-100"
                >
                  <option>All</option>
                  <option>Hot</option>
                  <option>Warm</option>
                  <option>Cold</option>
                  <option>Not Relevant</option>
                </select>
              </label>

              <label className="flex min-h-11 items-center gap-2 self-end rounded-2xl border border-slate-200 bg-white/70 px-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={sortByScore}
                  onChange={(e) => setSortByScore(e.target.checked)}
                  className="h-4 w-4"
                />
                Sort by final AI score
              </label>
            </div>
          </Card>
        )}

        {selectedCampaign && (
          <Card>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">AI Lead Research</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Research uses a lead website plus campaign context before scoring or drafting.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Processes up to 5 leads per click and fetches only a few public pages per lead.
                </p>
              </div>

              <Button
                type="button"
                variant="secondary"
                className="w-full lg:w-auto"
                disabled={!selectedCampaignId || isResearchingCampaign || leads.length === 0}
                onClick={handleResearchCampaignLeads}
              >
                {isResearchingCampaign ? "Researching leads..." : "Research Unresearched Leads"}
              </Button>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <LeadUpload
            campaignId={selectedCampaignId}
            onUploadComplete={refreshLeads}
          />

          <EmailExtraction
            campaignId={selectedCampaignId}
            onExtractionComplete={refreshLeads}
          />
        </div>

        {(leadExtractionMessage || leadExtractionError || leadScoringMessage || leadScoringError || leadResearchMessage || leadResearchError || callMessage || callError) && (
          <Card>
            {callMessage && (
              <p className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-700">
                {callMessage}
              </p>
            )}

            {leadResearchMessage && (
              <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-700 first:mt-0">
                {leadResearchMessage}
              </p>
            )}

            {leadExtractionMessage && (
              <p className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 first:mt-0">
                {leadExtractionMessage}
              </p>
            )}

            {leadScoringMessage && (
              <p className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-700 first:mt-0">
                {leadScoringMessage}
              </p>
            )}

            {leadExtractionError && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 first:mt-0">
                {leadExtractionError}
              </p>
            )}

            {leadScoringError && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 first:mt-0">
                {leadScoringError}
              </p>
            )}

            {leadResearchError && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 first:mt-0">
                {leadResearchError}
              </p>
            )}

            {callError && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 first:mt-0">
                {callError}
              </p>
            )}
          </Card>
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
          onResearchLead={handleResearchLead}
          researchingLeadId={researchingLeadId}
          onGenerateCallScript={handleGenerateCallScript}
          generatingCallScriptLeadId={generatingCallScriptLeadId}
          onStartTestCall={handleStartTestCall}
          startingCallLeadId={startingCallLeadId}
          callScriptsByLead={callScriptsByLead}
        />
      </div>
    </div>
  );
}

export default Leads;
