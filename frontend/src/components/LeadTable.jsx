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

function displayValue(value) {
  return value || "N/A";
}

function LeadTable({ leads, isLoading, error, hasSelectedCampaign }) {
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
            Choose a campaign above to view its leads.
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
          <h3 className="font-medium text-gray-800">No leads found</h3>
          <p className="text-sm text-gray-500 mt-1">
            No leads found for this campaign. Upload a CSV to get started.
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
                <th className="px-4 py-3 font-semibold">Created At</th>
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
                      "N/A"
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
                      "N/A"
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{displayValue(lead.source)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      {displayValue(lead.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {formatDate(lead.created_at)}
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
