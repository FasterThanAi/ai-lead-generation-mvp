import { formatDateTimeIST } from "../utils/dateUtils";

function displayValue(value) {
  return value || "N/A";
}

function getStatusClasses(status) {
  const statusClasses = {
    email_found: "bg-green-100 text-green-700",
    email_not_found: "bg-yellow-100 text-yellow-800",
    website_missing: "bg-gray-100 text-gray-700",
    extraction_failed: "bg-red-100 text-red-700",
    new: "bg-blue-50 text-blue-700",
  };

  return statusClasses[status] || "bg-gray-100 text-gray-700";
}

function getPriorityClasses(priority) {
  const priorityClasses = {
    High: "bg-green-100 text-green-700",
    Medium: "bg-yellow-100 text-yellow-800",
    Low: "bg-gray-100 text-gray-700",
  };

  return priorityClasses[priority] || "bg-gray-100 text-gray-700";
}

function getQualificationClasses(qualification) {
  const qualificationClasses = {
    Hot: "bg-green-100 text-green-700",
    Warm: "bg-yellow-100 text-yellow-800",
    Cold: "bg-gray-100 text-gray-700",
    "Not Relevant": "bg-red-100 text-red-700",
  };

  return qualificationClasses[qualification] || "bg-gray-100 text-gray-700";
}

function hasScore(value) {
  return value !== null && value !== undefined;
}

function ScoreCell({ value, tone = "gray", helpText }) {
  const toneClasses = {
    green: "text-green-700",
    indigo: "text-indigo-700",
    yellow: "text-yellow-700",
    gray: "text-gray-900",
  };

  return hasScore(value) ? (
    <div>
      <p className={`text-lg font-semibold ${toneClasses[tone] || toneClasses.gray}`}>{value}</p>
      {helpText && (
        <p className="mt-1 text-xs text-gray-500">{helpText}</p>
      )}
    </div>
  ) : (
    <span className="text-gray-500">-</span>
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
    <div className="bg-white p-6 rounded-xl shadow border">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Lead List</h2>
        <p className="text-sm text-gray-500 mt-1">
          View leads connected to the selected campaign.
        </p>
      </div>

      {!hasSelectedCampaign && (
        <div className="border border-dashed rounded-lg p-6 text-center">
          <h3 className="font-medium text-gray-800">Select a campaign</h3>
          <p className="text-sm text-gray-500 mt-1">
            Select a campaign to upload and manage leads.
          </p>
        </div>
      )}

      {hasSelectedCampaign && isLoading && (
        <div className="border rounded-lg p-5 text-sm text-gray-600">
          Loading leads...
        </div>
      )}

      {hasSelectedCampaign && !isLoading && error && (
        <div className="border border-red-200 bg-red-50 text-red-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {hasSelectedCampaign && !isLoading && !error && leads.length === 0 && (
        <div className="border border-dashed rounded-lg p-6 text-center">
          <h3 className="font-medium text-gray-800">No leads found for this campaign.</h3>
          <p className="text-sm text-gray-500 mt-1">
            Upload a CSV to get started.
          </p>
        </div>
      )}

      {hasSelectedCampaign && !isLoading && !error && leads.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-600">
                <th className="px-4 py-3 font-semibold">ID</th>
                <th className="px-4 py-3 font-semibold">Company Name</th>
                <th className="px-4 py-3 font-semibold">Website</th>
                <th className="px-4 py-3 font-semibold">Industry</th>
                <th className="px-4 py-3 font-semibold">Location</th>
                <th className="px-4 py-3 font-semibold">Contact Name</th>
                <th className="px-4 py-3 font-semibold">Contact Role</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Fit Score</th>
                <th className="px-4 py-3 font-semibold">Contact Confidence</th>
                <th className="px-4 py-3 font-semibold">Final AI Score</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Qualification</th>
                <th className="px-4 py-3 font-semibold">AI Insights</th>
                <th className="px-4 py-3 font-semibold">Created At</th>
                <th className="px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{lead.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {lead.company_name}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {lead.website ? (
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {lead.website}
                      </a>
                    ) : (
                      <span className="text-gray-500">No website</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{displayValue(lead.industry)}</td>
                  <td className="px-4 py-3 text-gray-700">{displayValue(lead.location)}</td>
                  <td className="px-4 py-3 text-gray-700">{displayValue(lead.contact_name)}</td>
                  <td className="px-4 py-3 text-gray-700">{displayValue(lead.contact_role)}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {lead.email ? (
                      <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">
                        {lead.email}
                      </a>
                    ) : (
                      <span className="text-gray-500">No email yet</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{displayValue(lead.source)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusClasses(lead.status)}`}>
                      {displayValue(lead.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <ScoreCell
                      value={lead.ai_fit_score}
                      tone="green"
                      helpText="Company fit"
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <ScoreCell
                      value={lead.ai_contact_confidence_score}
                      tone="yellow"
                      helpText="Contact quality"
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {hasScore(lead.ai_score) ? (
                      <div>
                        <p className="text-lg font-semibold text-indigo-700">{lead.ai_score}</p>
                        {lead.ai_scored_at && (
                          <p className="mt-1 text-xs text-gray-500">{formatDateTimeIST(lead.ai_scored_at)}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500">Not scored</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {lead.ai_priority ? (
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${getPriorityClasses(lead.ai_priority)}`}>
                        {lead.ai_priority}
                      </span>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {lead.ai_qualification ? (
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${getQualificationClasses(lead.ai_qualification)}`}>
                        {lead.ai_qualification}
                      </span>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700 min-w-72">
                    {lead.ai_score_reason || lead.ai_outreach_angle || lead.ai_pain_point || lead.ai_recommended_cta ? (
                      <div className="space-y-2 text-xs leading-5">
                        {lead.ai_score_reason && (
                          <p><span className="font-semibold text-gray-900">Reason:</span> {lead.ai_score_reason}</p>
                        )}
                        {lead.ai_contact_confidence_reason && (
                          <p><span className="font-semibold text-gray-900">Contact:</span> {lead.ai_contact_confidence_reason}</p>
                        )}
                        {lead.ai_outreach_angle && (
                          <p><span className="font-semibold text-gray-900">Angle:</span> {lead.ai_outreach_angle}</p>
                        )}
                        {lead.ai_pain_point && (
                          <p><span className="font-semibold text-gray-900">Pain:</span> {lead.ai_pain_point}</p>
                        )}
                        {lead.ai_recommended_cta && (
                          <p><span className="font-semibold text-gray-900">CTA:</span> {lead.ai_recommended_cta}</p>
                        )}
                        {lead.ai_final_priority_reason && (
                          <p><span className="font-semibold text-gray-900">Priority:</span> {lead.ai_final_priority_reason}</p>
                        )}
                        {lead.ai_score_error && (
                          <p className="text-yellow-700">{lead.ai_score_error}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500">No AI insights yet</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {formatDateTimeIST(lead.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                    <button
                      className="whitespace-nowrap rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                      disabled={!lead.website || extractingLeadId === lead.id}
                      onClick={() => onExtractEmail?.(lead.id)}
                    >
                      {extractingLeadId === lead.id ? "Extracting..." : "Extract Email"}
                    </button>
                    <button
                      className="whitespace-nowrap rounded bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                      disabled={scoringLeadId === lead.id}
                      onClick={() => onScoreLead?.(lead)}
                    >
                      {scoringLeadId === lead.id
                        ? "Scoring..."
                        : hasScore(lead.ai_score)
                          ? "Rescore"
                          : "Score"}
                    </button>
                    </div>
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

export default LeadTable;
