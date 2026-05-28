import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../services/api";
import { formatDateTimeIST } from "../utils/dateUtils";
import { getFriendlyErrorMessage } from "../utils/errorMessages";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";

const emptyForm = {
  id: null,
  campaign_id: "",
  opportunity_id: "",
  title: "",
  target_type: "general",
  department: "",
  location: "",
  target_role: "",
  query_goal: "",
  source_mode: "manual_urls",
  source_urls: "",
  generated_queries: "",
  limit: 20,
};

const targetTypes = ["professor", "college", "department", "company", "startup", "student", "general"];

function splitLines(value) {
  return String(value || "")
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function copyText(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
  }
}

function display(value, fallback = "N/A") {
  return value || fallback;
}

function jobToForm(job) {
  return {
    id: job.id,
    campaign_id: job.campaign_id ? String(job.campaign_id) : "",
    opportunity_id: job.opportunity_id ? String(job.opportunity_id) : "",
    title: job.title || "",
    target_type: job.target_type || "general",
    department: job.department || "",
    location: job.location || "",
    target_role: job.target_role || "",
    query_goal: job.query_goal || "",
    source_mode: job.source_mode || "manual_urls",
    source_urls: job.source_urls || "",
    generated_queries: job.generated_queries || "",
    limit: job.limit || 20,
  };
}

function opportunityToForm(opportunity, currentForm) {
  return {
    ...currentForm,
    opportunity_id: String(opportunity.id),
    campaign_id: opportunity.converted_campaign_id ? String(opportunity.converted_campaign_id) : currentForm.campaign_id,
    title: `${opportunity.title || "Opportunity"} Discovery`,
    target_type: opportunity.suggested_discovery_target_type || "general",
    department: opportunity.suggested_discovery_department || opportunity.target_domain || "",
    location: opportunity.suggested_campaign_location || opportunity.target_location || "",
    target_role: opportunity.suggested_discovery_role || opportunity.suggested_campaign_target_role || "",
    query_goal: opportunity.raw_goal || opportunity.ai_summary || "",
    source_mode: "generated_queries",
    generated_queries: opportunity.suggested_discovery_queries || opportunity.search_keywords || "",
  };
}

function Field({ label, children }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function ResultCard({ result, checked, onToggle }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <label className="flex min-w-0 items-start gap-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={() => onToggle(result.id)}
            disabled={result.status === "imported"}
            className="mt-1 h-4 w-4 shrink-0"
          />
          <span className="min-w-0">
            <span className="block break-words text-base font-semibold text-slate-950">
              {display(result.name || result.organization, "Unnamed public contact")}
            </span>
            <span className="mt-1 block break-words text-sm text-slate-500">
              {[result.designation, result.department, result.organization].filter(Boolean).join(" | ") || "Context needs review"}
            </span>
          </span>
        </label>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Badge variant={result.status}>{result.status}</Badge>
          {result.confidence !== null && result.confidence !== undefined && (
            <Badge variant={result.confidence >= 70 ? "success" : result.confidence >= 45 ? "warning" : "low"}>
              Confidence {result.confidence}
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Email</p>
          {result.email ? (
            <a href={`mailto:${result.email}`} className="mt-1 block break-all text-sm font-semibold text-blue-600">
              {result.email}
            </a>
          ) : (
            <p className="mt-1 text-sm text-slate-500">No public email found</p>
          )}
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Phone</p>
          <p className="mt-1 break-words text-sm font-semibold text-slate-900">{display(result.phone)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Type / Location</p>
          <p className="mt-1 break-words text-sm font-semibold text-slate-900">
            {[result.lead_type, result.location].filter(Boolean).join(" | ") || "N/A"}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Imported Lead</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{result.imported_lead_id || "Not imported"}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {result.fit_reason && (
          <p className="break-words rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
            {result.fit_reason}
          </p>
        )}
        {result.risk_flags && (
          <p className="break-words rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm leading-6 text-amber-700">
            {result.risk_flags}
          </p>
        )}
      </div>

      <a
        href={result.source_url}
        target="_blank"
        rel="noreferrer"
        className="mt-3 block break-all text-xs font-medium text-blue-600 hover:text-blue-700"
      >
        Source: {result.source_url}
      </a>
    </article>
  );
}

function LeadDiscovery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [campaigns, setCampaigns] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [results, setResults] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(searchParams.get("job_id") || "");
  const [selectedResultIds, setSelectedResultIds] = useState([]);
  const [formValues, setFormValues] = useState({
    ...emptyForm,
    campaign_id: searchParams.get("campaign_id") || "",
    opportunity_id: searchParams.get("opportunity_id") || "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingQueries, setIsGeneratingQueries] = useState(false);
  const [runningJobId, setRunningJobId] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedJob = useMemo(
    () => jobs.find((job) => String(job.id) === String(selectedJobId)) || null,
    [jobs, selectedJobId]
  );

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => String(campaign.id) === String(formValues.campaign_id)),
    [campaigns, formValues.campaign_id]
  );

  const selectedIds = useMemo(() => new Set(selectedResultIds), [selectedResultIds]);
  const generatedQueries = splitLines(formValues.generated_queries || selectedJob?.generated_queries);

  const loadInitialData = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [campaignRes, opportunityRes, jobsRes] = await Promise.all([
        api.get("/campaigns/"),
        api.get("/opportunities/"),
        api.get("/discovery/jobs"),
      ]);
      const campaignData = Array.isArray(campaignRes.data.data) ? campaignRes.data.data : [];
      const opportunityData = Array.isArray(opportunityRes.data.data) ? opportunityRes.data.data : [];
      const jobData = Array.isArray(jobsRes.data.data) ? jobsRes.data.data : [];

      setCampaigns(campaignData);
      setOpportunities(opportunityData);
      setJobs(jobData);

      const jobIdFromUrl = searchParams.get("job_id");
      if (jobIdFromUrl) {
        const job = jobData.find((item) => String(item.id) === String(jobIdFromUrl));
        if (job) {
          setSelectedJobId(String(job.id));
          setFormValues(jobToForm(job));
          await loadResults(job.id);
        }
      }
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err, "Could not load discovery data. Please try again."));
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadJobs = async () => {
    const res = await api.get("/discovery/jobs");
    const jobData = Array.isArray(res.data.data) ? res.data.data : [];
    setJobs(jobData);
    return jobData;
  };

  const loadResults = async (jobId) => {
    if (!jobId) {
      setResults([]);
      return [];
    }

    const res = await api.get(`/discovery/jobs/${jobId}/results`);
    const resultData = Array.isArray(res.data.data) ? res.data.data : [];
    setResults(resultData);
    return resultData;
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadInitialData();
    }, 0);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateFormValue = (field, value) => {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleOpportunityChange = (value) => {
    const opportunity = opportunities.find((item) => String(item.id) === String(value));

    if (!opportunity) {
      updateFormValue("opportunity_id", value);
      return;
    }

    setFormValues((current) => opportunityToForm(opportunity, current));
  };

  const selectJob = async (job) => {
    setSelectedJobId(String(job.id));
    setSelectedResultIds([]);
    setFormValues(jobToForm(job));
    setSearchParams({ job_id: String(job.id) });

    try {
      await loadResults(job.id);
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err, "Could not load discovery results. Please try again."));
      console.error(err);
    }
  };

  const saveJob = async () => {
    const payload = {
      opportunity_id: formValues.opportunity_id ? Number(formValues.opportunity_id) : null,
      campaign_id: formValues.campaign_id ? Number(formValues.campaign_id) : null,
      title: formValues.title.trim(),
      target_type: formValues.target_type || "general",
      department: formValues.department.trim() || null,
      location: formValues.location.trim() || null,
      target_role: formValues.target_role.trim() || null,
      query_goal: formValues.query_goal.trim() || null,
      source_mode: formValues.source_mode || "manual_urls",
      source_urls: formValues.source_urls.trim() || null,
      generated_queries: formValues.generated_queries.trim() || null,
      limit: Number(formValues.limit) || 20,
    };

    const res = formValues.id
      ? await api.patch(`/discovery/jobs/${formValues.id}`, payload)
      : await api.post("/discovery/jobs", payload);

    const savedJob = res.data.data;
    setSelectedJobId(String(savedJob.id));
    setFormValues(jobToForm(savedJob));
    await loadJobs();
    return savedJob;
  };

  const handleSaveJob = async () => {
    setIsSaving(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      if (!formValues.title.trim()) {
        setErrorMessage("Title is required.");
        return;
      }
      const savedJob = await saveJob();
      setStatusMessage(formValues.id ? "Discovery job updated." : "Discovery job saved.");
      setSearchParams({ job_id: String(savedJob.id) });
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err, err.message || "Discovery job could not be saved."));
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateQueries = async () => {
    setIsGeneratingQueries(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const res = await api.post("/discovery/generate-queries", {
        title: formValues.title,
        target_type: formValues.target_type,
        department: formValues.department,
        location: formValues.location,
        target_role: formValues.target_role,
        query_goal: formValues.query_goal,
        offer: selectedCampaign?.offer || "",
      });
      const queries = Array.isArray(res.data.queries) ? res.data.queries : [];
      setFormValues((current) => ({
        ...current,
        generated_queries: queries.join("\n"),
        source_mode: "generated_queries",
      }));
      setStatusMessage("Manual search queries generated. Copy them, find public source URLs, then paste URLs before running discovery.");
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err, "Search queries could not be generated. Please try again."));
      console.error(err);
    } finally {
      setIsGeneratingQueries(false);
    }
  };

  const handleRunJob = async (job = null) => {
    setRunningJobId(job?.id || formValues.id || "new");
    setStatusMessage("");
    setErrorMessage("");

    try {
      if (!formValues.id && !job && !formValues.title.trim()) {
        setErrorMessage("Title is required.");
        return;
      }
      const activeJob = job || await saveJob();
      const res = await api.post(`/discovery/jobs/${activeJob.id}/run`);
      setStatusMessage(
        `Discovery completed. Pages attempted: ${res.data.pages_attempted ?? 0}. Contacts found: ${res.data.contacts_found ?? 0}.`
      );
      const jobData = await loadJobs();
      const refreshedJob = jobData.find((item) => item.id === activeJob.id) || activeJob;
      setSelectedJobId(String(refreshedJob.id));
      setFormValues(jobToForm(refreshedJob));
      await loadResults(refreshedJob.id);
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err, "Discovery run failed. Please try again."));
      console.error(err);
    } finally {
      setRunningJobId(null);
    }
  };

  const toggleResult = (resultId) => {
    setSelectedResultIds((current) => (
      current.includes(resultId)
        ? current.filter((id) => id !== resultId)
        : [...current, resultId]
    ));
  };

  const handleBulkStatus = async (status) => {
    if (!selectedJobId || selectedResultIds.length === 0) {
      return;
    }

    setStatusMessage("");
    setErrorMessage("");

    try {
      const endpoint = status === "approved" ? "approve-selected" : "reject-selected";
      const res = await api.post(`/discovery/jobs/${selectedJobId}/${endpoint}`, {
        result_ids: selectedResultIds,
      });
      setStatusMessage(`${res.data.updated ?? 0} contacts ${status}.`);
      setSelectedResultIds([]);
      await loadResults(selectedJobId);
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err, "Selected contacts could not be updated. Please try again."));
      console.error(err);
    }
  };

  const handleImportSelected = async () => {
    if (!selectedJobId || selectedResultIds.length === 0) {
      return;
    }

    setIsImporting(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const res = await api.post(`/discovery/jobs/${selectedJobId}/import-selected`, {
        result_ids: selectedResultIds,
        allow_no_email: false,
      });
      setStatusMessage(
        `Imported ${res.data.imported ?? 0} leads. Duplicates skipped: ${res.data.skipped_duplicates ?? 0}. No-email skipped: ${res.data.skipped_no_email ?? 0}.`
      );
      setSelectedResultIds([]);
      await loadJobs();
      await loadResults(selectedJobId);
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err, "Selected contacts could not be imported. Please try again."));
      console.error(err);
    } finally {
      setIsImporting(false);
    }
  };

  const handleResearchImported = async () => {
    if (!selectedJobId) {
      return;
    }

    setIsResearching(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const res = await api.post(`/discovery/jobs/${selectedJobId}/research-imported`, null, {
        params: { limit: 5 },
      });
      setStatusMessage(
        `Research processed ${res.data.processed ?? 0} imported leads. Researched ${res.data.researched ?? 0}, failed ${res.data.failed ?? 0}.`
      );
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err, "Imported lead research failed. Please try again."));
      console.error(err);
    } finally {
      setIsResearching(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Lead Discovery"
        description="Find public contacts from reviewed source URLs, approve them, and import selected contacts into Leads."
      />

      <div className="space-y-6">
        <Card>
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">Create Discovery Job</h2>
              <p className="mt-1 text-sm text-slate-500">
                Paste official public pages only. Search query mode gives copyable queries; it does not scrape search results or LinkedIn.
              </p>
            </div>
            {formValues.id && (
              <Button type="button" variant="secondary" onClick={() => setFormValues(emptyForm)}>
                New Job
              </Button>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Campaign">
              <select
                value={formValues.campaign_id}
                onChange={(e) => updateFormValue("campaign_id", e.target.value)}
                className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 text-sm outline-none focus:ring-4 focus:ring-slate-100"
              >
                <option value="">Optional campaign</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.campaign_name}</option>
                ))}
              </select>
            </Field>

            <Field label="Opportunity">
              <select
                value={formValues.opportunity_id}
                onChange={(e) => handleOpportunityChange(e.target.value)}
                className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 text-sm outline-none focus:ring-4 focus:ring-slate-100"
              >
                <option value="">Optional opportunity</option>
                {opportunities.map((opportunity) => (
                  <option key={opportunity.id} value={opportunity.id}>{opportunity.title}</option>
                ))}
              </select>
            </Field>

            <Field label="Title">
              <input
                type="text"
                value={formValues.title}
                onChange={(e) => updateFormValue("title", e.target.value)}
                className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 text-sm outline-none focus:ring-4 focus:ring-slate-100"
                placeholder="Professor CSE Discovery"
              />
            </Field>

            <Field label="Target type">
              <select
                value={formValues.target_type}
                onChange={(e) => updateFormValue("target_type", e.target.value)}
                className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 text-sm outline-none focus:ring-4 focus:ring-slate-100"
              >
                {targetTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </Field>

            <Field label="Department/domain">
              <input
                type="text"
                value={formValues.department}
                onChange={(e) => updateFormValue("department", e.target.value)}
                className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 text-sm outline-none focus:ring-4 focus:ring-slate-100"
                placeholder="Computer Science / Restaurants / SaaS"
              />
            </Field>

            <Field label="Location">
              <input
                type="text"
                value={formValues.location}
                onChange={(e) => updateFormValue("location", e.target.value)}
                className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 text-sm outline-none focus:ring-4 focus:ring-slate-100"
                placeholder="India"
              />
            </Field>

            <Field label="Target role">
              <input
                type="text"
                value={formValues.target_role}
                onChange={(e) => updateFormValue("target_role", e.target.value)}
                className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 text-sm outline-none focus:ring-4 focus:ring-slate-100"
                placeholder="Professor / HOD / Owner / CTO"
              />
            </Field>

            <Field label="Limit">
              <input
                type="number"
                min="1"
                max="50"
                value={formValues.limit}
                onChange={(e) => updateFormValue("limit", e.target.value)}
                className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 text-sm outline-none focus:ring-4 focus:ring-slate-100"
              />
            </Field>

            <label className="text-sm lg:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">Goal</span>
              <textarea
                value={formValues.query_goal}
                onChange={(e) => updateFormValue("query_goal", e.target.value)}
                className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-3 text-sm leading-6 outline-none focus:ring-4 focus:ring-slate-100"
                placeholder="Find public department/faculty/company contact pages relevant to this campaign."
              />
            </label>

            <label className="text-sm lg:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">Source URLs</span>
              <textarea
                value={formValues.source_urls}
                onChange={(e) => updateFormValue("source_urls", e.target.value)}
                className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-3 text-sm leading-6 outline-none focus:ring-4 focus:ring-slate-100"
                placeholder={"https://www.cse.iitd.ac.in/\nhttps://www.iiit.ac.in/research/"}
              />
              <span className="mt-1 block text-xs text-slate-500">One public URL per line. No login pages, CAPTCHA pages, or automated LinkedIn scraping.</span>
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="button" onClick={handleSaveJob} disabled={isSaving}>
              {isSaving ? "Saving..." : formValues.id ? "Update Job" : "Save Job"}
            </Button>
            <Button type="button" variant="secondary" onClick={handleGenerateQueries} disabled={isGeneratingQueries}>
              {isGeneratingQueries ? "Generating..." : "Generate Search Queries"}
            </Button>
            <Button type="button" variant="indigo" onClick={() => handleRunJob()} disabled={Boolean(runningJobId)}>
              {runningJobId ? "Running..." : "Run Discovery"}
            </Button>
          </div>

          {generatedQueries.length > 0 && (
            <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
              <p className="text-sm font-semibold text-sky-900">Generated manual search queries</p>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {generatedQueries.map((query) => (
                  <div key={query} className="flex min-w-0 flex-col gap-2 rounded-xl border border-sky-100 bg-white/80 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="min-w-0 break-words text-sm text-slate-700">{query}</p>
                    <Button type="button" size="sm" variant="secondary" onClick={() => copyText(query)}>
                      Copy
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {(statusMessage || errorMessage) && (
          <Card>
            {statusMessage && <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{statusMessage}</p>}
            {errorMessage && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 first:mt-0">{errorMessage}</p>}
          </Card>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
          <Card>
            <div className="mb-4">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">Discovery Jobs</h2>
              <p className="mt-1 text-sm text-slate-500">{jobs.length} jobs saved.</p>
            </div>

            {isLoading ? (
              <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Loading jobs...</p>
            ) : jobs.length === 0 ? (
              <EmptyState title="No discovery jobs yet" description="Create a job from a strategy or paste source URLs manually." />
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <article
                    key={job.id}
                    className={[
                      "rounded-2xl border p-4 transition",
                      String(selectedJobId) === String(job.id) ? "border-slate-950 bg-slate-50" : "border-slate-200 bg-white/80",
                    ].join(" ")}
                  >
                    <button type="button" className="block w-full text-left" onClick={() => selectJob(job)}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={job.status}>{job.status}</Badge>
                        {job.target_type && <Badge variant="neutral">{job.target_type}</Badge>}
                      </div>
                      <h3 className="mt-3 break-words text-base font-semibold text-slate-950">{job.title}</h3>
                      <p className="mt-2 break-words text-sm text-slate-500">{job.campaign_name || "No campaign selected"}</p>
                      <p className="mt-2 text-xs text-slate-400">Created: {formatDateTimeIST(job.created_at)}</p>
                    </button>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <span className="rounded-xl bg-slate-50 p-2">Pages: {job.pages_attempted}</span>
                      <span className="rounded-xl bg-slate-50 p-2">Contacts: {job.contacts_found}</span>
                    </div>

                    {job.errors && (
                      <p className="mt-3 whitespace-pre-line break-words rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-700">
                        {job.errors}
                      </p>
                    )}

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <Button type="button" size="sm" variant="indigo" disabled={runningJobId === job.id} onClick={() => handleRunJob(job)}>
                        {runningJobId === job.id ? "Running..." : "Run"}
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => selectJob(job)}>
                        View Results
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">Results Review</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedJob ? selectedJob.title : "Select a job to review discovered contacts."}
                </p>
              </div>
              {selectedJob && (
                <Button as={Link} to="/leads" variant="secondary">
                  Open Leads
                </Button>
              )}
            </div>

            {!selectedJob ? (
              <EmptyState title="No job selected" description="Select a discovery job to review contacts." />
            ) : (
              <>
                <div className="mb-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Selected</p>
                    <p className="mt-1 text-xl font-semibold text-slate-950">{selectedResultIds.length}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Pending</p>
                    <p className="mt-1 text-xl font-semibold text-slate-950">{results.filter((item) => item.status === "pending").length}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Approved</p>
                    <p className="mt-1 text-xl font-semibold text-slate-950">{results.filter((item) => item.status === "approved").length}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Imported</p>
                    <p className="mt-1 text-xl font-semibold text-slate-950">{results.filter((item) => item.status === "imported").length}</p>
                  </div>
                </div>

                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button type="button" size="sm" variant="secondary" disabled={results.length === 0} onClick={() => setSelectedResultIds(results.filter((item) => item.status !== "imported").map((item) => item.id))}>
                    Select Reviewable
                  </Button>
                  <Button type="button" size="sm" variant="secondary" disabled={selectedResultIds.length === 0} onClick={() => setSelectedResultIds([])}>
                    Clear Selection
                  </Button>
                  <Button type="button" size="sm" variant="success" disabled={selectedResultIds.length === 0} onClick={() => handleBulkStatus("approved")}>
                    Approve
                  </Button>
                  <Button type="button" size="sm" variant="danger" disabled={selectedResultIds.length === 0} onClick={() => handleBulkStatus("rejected")}>
                    Reject
                  </Button>
                  <Button type="button" size="sm" variant="indigo" disabled={selectedResultIds.length === 0 || isImporting} onClick={handleImportSelected}>
                    {isImporting ? "Importing..." : "Import Selected to Leads"}
                  </Button>
                  <Button type="button" size="sm" variant="secondary" disabled={isResearching || results.every((item) => item.status !== "imported")} onClick={handleResearchImported}>
                    {isResearching ? "Researching..." : "Research Imported Leads"}
                  </Button>
                </div>

                {results.length === 0 ? (
                  <EmptyState title="No contacts found" description="Run discovery after adding public source URLs. If a page has no readable public email, it will show a clean warning on the job card." />
                ) : (
                  <div className="space-y-3">
                    {results.map((result) => (
                      <ResultCard
                        key={result.id}
                        result={result}
                        checked={selectedIds.has(result.id)}
                        onToggle={toggleResult}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default LeadDiscovery;
