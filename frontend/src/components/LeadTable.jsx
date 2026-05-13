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

function LeadActions({ lead, onExtractEmail, extractingLeadId, onScoreLead, scoringLeadId }) {
  return (
    <div className="grid w-full grid-cols-1 gap-2">
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
        {scoringLeadId === lead.id ? "Scoring..." : hasScore(lead.ai_score) ? "Rescore" : "Score"}
      </Button>
    </div>
  );
}

function LeadItem({ lead, extractingLeadId, scoringLeadId, onExtractEmail, onScoreLead }) {
  const hasInsights = Boolean(
    lead.ai_score_reason ||
    lead.ai_contact_confidence_reason ||
    lead.ai_outreach_angle ||
    lead.ai_pain_point ||
    lead.ai_recommended_cta ||
    lead.ai_final_priority_reason ||
    lead.ai_score_error
  );

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
            {lead.ai_priority && <Badge variant={lead.ai_priority}>{lead.ai_priority}</Badge>}
            {lead.ai_qualification && <Badge variant={lead.ai_qualification}>{lead.ai_qualification}</Badge>}
          </div>
          <p className="text-xs text-slate-400 md:text-right">
            Created: {formatDateTimeIST(lead.created_at)}
          </p>
          <LeadActions
            lead={lead}
            extractingLeadId={extractingLeadId}
            scoringLeadId={scoringLeadId}
            onExtractEmail={onExtractEmail}
            onScoreLead={onScoreLead}
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
        </InfoBlock>

        <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 md:col-span-2 xl:col-span-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">AI Scores</p>
          <div className="mt-3 grid min-w-0 grid-cols-3 gap-2 sm:gap-3">
            <ScoreMetric label="Fit" value={lead.ai_fit_score} />
            <ScoreMetric label="Contact" value={lead.ai_contact_confidence_score} />
            <ScoreMetric label="Final" value={lead.ai_score} />
          </div>
        </div>
      </div>

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
              onExtractEmail={onExtractEmail}
              onScoreLead={onScoreLead}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

export default LeadTable;
