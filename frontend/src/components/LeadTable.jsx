import { Link } from "react-router-dom";
import { formatDateTimeIST } from "../utils/dateUtils";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import Card from "./ui/Card";
import EmptyState from "./ui/EmptyState";

function displayValue(value) {
  return value || "N/A";
}

function hasScore(value) {
  return value !== null && value !== undefined;
}

function getScoreTone(value) {
  if (!hasScore(value)) {
    return "bg-slate-100 text-slate-500";
  }

  if (value >= 80) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (value >= 50) {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-slate-100 text-slate-600";
}

function getResearchStatusLabel(status) {
  const normalizedStatus = String(status || "not_researched").replace(/_/g, " ");
  return normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1);
}

function hasDiscoveryMetadata(lead) {
  return String(lead.source || "").toLowerCase().includes("discovery");
}

function ScoreMetric({ label, value }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-3 text-center sm:px-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-2 rounded-xl py-1 text-2xl font-semibold leading-none ${getScoreTone(value)}`}>
        {hasScore(value) ? value : "-"}
      </p>
    </div>
  );
}

function InfoBlock({ label, children, className = "" }) {
  return (
    <div className={`min-w-0 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 ${className}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      {children}
    </div>
  );
}

function InsightBlock({ label, children }) {
  if (!children) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white/70 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 break-words whitespace-normal text-sm leading-relaxed text-slate-700">
        {children}
      </p>
    </div>
  );
}

function LeadActions({
  lead,
  onExtractEmail,
  extractingLeadId,
  onScoreLead,
  scoringLeadId,
  onResearchLead,
  researchingLeadId,
  onGenerateCallScript,
  generatingCallScriptLeadId,
  onStartTestCall,
  onStartActualCall,
  startingCallLeadId,
  startingCallMode,
}) {
  const isResearched = lead.research_status === "researched";
  const doNotCall = Boolean(lead.do_not_call);
  const isStartingThisLead = startingCallLeadId === lead.id;

  return (
    <div className="grid w-full grid-cols-1 gap-2">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="w-full"
        disabled={researchingLeadId === lead.id}
        onClick={() => onResearchLead?.(lead)}
      >
        {researchingLeadId === lead.id ? "Researching..." : isResearched ? "Refresh Research" : "Research Lead"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="w-full"
        disabled={!lead.website || extractingLeadId === lead.id}
        onClick={() => onExtractEmail?.(lead.id)}
      >
        {extractingLeadId === lead.id ? "Extracting..." : "Extract Email"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="indigo"
        className="w-full"
        disabled={scoringLeadId === lead.id}
        onClick={() => onScoreLead?.(lead)}
      >
        {scoringLeadId === lead.id ? "Scoring..." : isResearched && hasScore(lead.ai_score) ? "Rescore after research" : hasScore(lead.ai_score) ? "Rescore" : "Score"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="w-full"
        disabled={generatingCallScriptLeadId === lead.id}
        onClick={() => onGenerateCallScript?.(lead)}
      >
        {generatingCallScriptLeadId === lead.id ? "Generating..." : "Generate Call Script"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="w-full"
        disabled={doNotCall || isStartingThisLead}
        onClick={() => onStartTestCall?.(lead)}
      >
        {isStartingThisLead && startingCallMode === "test" ? "Starting..." : "Start Test AI Call"}
      </Button>
      {lead.phone && (
        <Button
          type="button"
          size="sm"
          variant="indigo"
          className="w-full"
          disabled={doNotCall || isStartingThisLead}
          onClick={() => onStartActualCall?.(lead)}
        >
          {isStartingThisLead && startingCallMode === "actual" ? "Starting..." : "Start Actual Lead Call"}
        </Button>
      )}
      <Button
        as={Link}
        to={`/calls?campaign_id=${lead.campaign_id}&lead_id=${lead.id}`}
        size="sm"
        variant="ghost"
        className="w-full"
      >
        Open Calls / Actual Number
      </Button>
    </div>
  );
}

function LeadItem({
  lead,
  extractingLeadId,
  scoringLeadId,
  researchingLeadId,
  onExtractEmail,
  onScoreLead,
  onResearchLead,
  onGenerateCallScript,
  generatingCallScriptLeadId,
  onStartTestCall,
  onStartActualCall,
  startingCallLeadId,
  startingCallMode,
  callScript,
}) {
  const hasInsights = Boolean(
    lead.ai_score_reason ||
    lead.ai_contact_confidence_reason ||
    lead.ai_outreach_angle ||
    lead.ai_pain_point ||
    lead.ai_recommended_cta ||
    lead.ai_final_priority_reason ||
    lead.ai_score_error
  );
  const hasResearch = Boolean(
    lead.research_summary ||
    lead.research_outreach_angle ||
    lead.research_risk_flags ||
    lead.research_pain_points ||
    lead.research_use_case_fit ||
    lead.research_error
  );
  const usedResearchFallback = Boolean(lead.research_used_fallback);
  const isDiscoveredLead = hasDiscoveryMetadata(lead);

  return (
    <article className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5 xl:p-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(170px,11rem)] md:items-start">
        <div className="min-w-0">
          <h3 className="break-words text-lg font-semibold text-slate-950">
            {lead.company_name}
          </h3>
          <p className="mt-1 break-words text-sm text-slate-500">
            {[lead.industry, lead.location].filter(Boolean).join(" | ") || "Company context unavailable"}
          </p>
          {lead.website && (
            <a
              href={lead.website}
              target="_blank"
              rel="noreferrer"
              title={lead.website}
              className="mt-2 block break-all text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {lead.website}
            </a>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3 md:items-end">
          <div className="flex flex-wrap gap-2 md:justify-end">
            <Badge variant={lead.status}>{displayValue(lead.status)}</Badge>
            {isDiscoveredLead && <Badge variant="discovery">Discovered</Badge>}
            {lead.do_not_call && <Badge variant="do_not_call">Do Not Call</Badge>}
            <Badge variant={lead.research_status || "not_researched"}>
              {getResearchStatusLabel(lead.research_status)}
            </Badge>
            {lead.ai_priority && <Badge variant={lead.ai_priority}>{lead.ai_priority}</Badge>}
            {lead.ai_qualification && <Badge variant={lead.ai_qualification}>{lead.ai_qualification}</Badge>}
          </div>
          {lead.research_confidence !== null && lead.research_confidence !== undefined && (
            <p className="text-xs font-medium text-sky-700 md:text-right">
              Research confidence: {lead.research_confidence}
            </p>
          )}
          <p className="text-xs text-slate-400 md:text-right">
            Created: {formatDateTimeIST(lead.created_at)}
          </p>
          {(lead.last_call_outcome || lead.call_status) && (
            <p className="text-xs font-medium text-indigo-700 md:text-right">
              Last call: {lead.last_call_outcome || lead.call_status}
            </p>
          )}
          {!lead.phone && (
            <p className="text-xs text-amber-700 md:text-right">
              No phone number. Use test number or add phone.
            </p>
          )}
          <LeadActions
            lead={lead}
            extractingLeadId={extractingLeadId}
            scoringLeadId={scoringLeadId}
            researchingLeadId={researchingLeadId}
            onExtractEmail={onExtractEmail}
            onScoreLead={onScoreLead}
            onResearchLead={onResearchLead}
            onGenerateCallScript={onGenerateCallScript}
            generatingCallScriptLeadId={generatingCallScriptLeadId}
            onStartTestCall={onStartTestCall}
            onStartActualCall={onStartActualCall}
            startingCallLeadId={startingCallLeadId}
            startingCallMode={startingCallMode}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7">
        <InfoBlock label="Contact" className="xl:col-span-2">
          <p className="mt-2 break-words text-sm font-semibold text-slate-900">{displayValue(lead.contact_name)}</p>
          <p className="mt-1 break-words text-sm text-slate-500">{displayValue(lead.contact_role)}</p>
        </InfoBlock>

        <InfoBlock label="Email" className="xl:col-span-2">
          {lead.email ? (
            <a
              href={`mailto:${lead.email}`}
              title={lead.email}
              className="mt-2 block break-all text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              {lead.email}
            </a>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No email yet</p>
          )}
          <p className="mt-2 break-words text-xs text-slate-400">{displayValue(lead.source)}</p>
          {(lead.source_url || lead.profile_url) && (
            <a
              href={lead.profile_url || lead.source_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block break-all text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              Source URL: {lead.source_url || lead.profile_url}
            </a>
          )}
          {isDiscoveredLead && (
            <p className="mt-2 text-xs font-medium text-slate-500">
              Discovery source: public website
            </p>
          )}
        </InfoBlock>

        <InfoBlock label="Phone" className="xl:col-span-1">
          <p className="mt-2 break-words text-sm font-semibold text-slate-900">{displayValue(lead.phone)}</p>
          {isDiscoveredLead && (
            <p className={lead.phone ? "mt-2 text-xs font-medium text-emerald-700" : "mt-2 text-xs font-medium text-amber-700"}>
              Phone extracted: {lead.phone ? "yes" : "no"}
            </p>
          )}
        </InfoBlock>

        <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 md:col-span-2 xl:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">AI Scores</p>
          <div className="mt-3 grid min-w-0 grid-cols-3 gap-2 sm:gap-3">
            <ScoreMetric label="Fit" value={lead.ai_fit_score} />
            <ScoreMetric label="Contact" value={lead.ai_contact_confidence_score} />
            <ScoreMetric label="Final" value={lead.ai_score} />
          </div>
        </div>
      </div>

      {callScript && (
        <details className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 open:bg-white">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-indigo-800">
            View Generated Call Script
          </summary>
          <div className="grid gap-3 border-t border-indigo-100 px-4 py-4 md:grid-cols-2">
            <InsightBlock label="Opener">{callScript.opener}</InsightBlock>
            <InsightBlock label="Questions">{callScript.questions}</InsightBlock>
            <InsightBlock label="Objection handling">{callScript.objection_handling}</InsightBlock>
            <InsightBlock label="Closing">{callScript.closing}</InsightBlock>
          </div>
        </details>
      )}

      <details className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/70 open:bg-white">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-sky-800">
          {hasResearch ? "View AI Research" : "No AI research yet"}
        </summary>
        <div className="border-t border-sky-100 px-4 py-4">
          {hasResearch ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <InsightBlock label="Summary">{lead.research_summary}</InsightBlock>
              <InsightBlock label="Business type">{lead.research_business_type}</InsightBlock>
              <InsightBlock label="Pain points">{lead.research_pain_points}</InsightBlock>
              <InsightBlock label="Use case fit">{lead.research_use_case_fit}</InsightBlock>
              <InsightBlock label="Outreach angle">{lead.research_outreach_angle}</InsightBlock>
              <InsightBlock label="Risk flags">{lead.research_risk_flags}</InsightBlock>
              {lead.researched_at && (
                <p className="rounded-xl border border-sky-100 bg-white/70 p-3 text-xs text-slate-400">
                  Researched: {formatDateTimeIST(lead.researched_at)}
                </p>
              )}
              {usedResearchFallback && (
                <p className="break-words rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm leading-relaxed text-amber-700 md:col-span-2 xl:col-span-3">
                  Website text unavailable. AI used CSV and campaign data only.
                </p>
              )}
              {lead.research_sources && (
                <p className="break-words whitespace-pre-line rounded-xl border border-sky-100 bg-white/70 p-3 text-xs leading-5 text-slate-500 md:col-span-2">
                  {lead.research_sources}
                </p>
              )}
              {lead.research_error && !usedResearchFallback && (
                <p className="break-words rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm leading-relaxed text-amber-700 md:col-span-2 xl:col-span-3">
                  {lead.research_error}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Research this lead to enrich scoring and outreach drafts with website and campaign context.</p>
          )}
        </div>
      </details>

      <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 open:bg-white">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-700">
          {hasInsights ? "View AI Insights" : "No AI insights yet"}
        </summary>
        <div className="border-t border-slate-200 px-4 py-4">
          {hasInsights ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <InsightBlock label="Reason">{lead.ai_score_reason}</InsightBlock>
              <InsightBlock label="Contact confidence">{lead.ai_contact_confidence_reason}</InsightBlock>
              <InsightBlock label="Angle">{lead.ai_outreach_angle}</InsightBlock>
              <InsightBlock label="Pain">{lead.ai_pain_point}</InsightBlock>
              <InsightBlock label="CTA">{lead.ai_recommended_cta}</InsightBlock>
              <InsightBlock label="Final priority">{lead.ai_final_priority_reason}</InsightBlock>
              {lead.ai_scored_at && (
                <p className="rounded-xl border border-slate-200 bg-white/70 p-3 text-xs text-slate-400">
                  Scored: {formatDateTimeIST(lead.ai_scored_at)}
                </p>
              )}
              {lead.ai_score_error && (
                <p className="break-words rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm leading-relaxed text-amber-700 md:col-span-2 xl:col-span-3">
                  {lead.ai_score_error}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Score this lead to see fit, contact confidence, angle, pain point, and CTA.</p>
          )}
        </div>
      </details>
    </article>
  );
}

function LeadTable({
  leads,
  isLoading,
  error,
  hasSelectedCampaign,
  onExtractEmail,
  extractingLeadId,
  onScoreLead,
  scoringLeadId,
  onResearchLead,
  researchingLeadId,
  onGenerateCallScript,
  generatingCallScriptLeadId,
  onStartTestCall,
  onStartActualCall,
  startingCallLeadId,
  startingCallMode,
  callScriptsByLead = {},
}) {
  return (
    <Card>
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">Lead List</h2>
        <p className="mt-1 text-sm text-slate-500">
          Spacious lead cards keep contact details, AI scores, and actions readable at every size.
        </p>
      </div>

      {!hasSelectedCampaign && (
        <EmptyState
          title="Select a campaign"
          description="Select a campaign to upload and manage leads."
        />
      )}

      {hasSelectedCampaign && isLoading && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
          Loading leads...
        </div>
      )}

      {hasSelectedCampaign && !isLoading && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {hasSelectedCampaign && !isLoading && !error && leads.length === 0 && (
        <EmptyState
          title="No leads found for this campaign"
          description="Upload a CSV to get started."
        />
      )}

      {hasSelectedCampaign && !isLoading && !error && leads.length > 0 && (
        <div className="space-y-3">
          {leads.map((lead) => (
            <LeadItem
              key={lead.id}
              lead={lead}
              extractingLeadId={extractingLeadId}
              scoringLeadId={scoringLeadId}
              researchingLeadId={researchingLeadId}
              onExtractEmail={onExtractEmail}
              onScoreLead={onScoreLead}
              onResearchLead={onResearchLead}
              onGenerateCallScript={onGenerateCallScript}
              generatingCallScriptLeadId={generatingCallScriptLeadId}
              onStartTestCall={onStartTestCall}
              onStartActualCall={onStartActualCall}
              startingCallLeadId={startingCallLeadId}
              startingCallMode={startingCallMode}
              callScript={callScriptsByLead[lead.id]}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

export default LeadTable;
