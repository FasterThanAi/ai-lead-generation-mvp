import { useState } from "react";
import api from "../services/api";
import { getFriendlyErrorMessage } from "../utils/errorMessages";

function LeadUpload({ campaignId, onUploadComplete }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [inputKey, setInputKey] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files?.[0] || null);
    setMessage("");
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!campaignId) {
      setError("Please select a campaign before uploading leads.");
      return;
    }

    if (!selectedFile) {
      setError("Please choose a CSV file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    setIsUploading(true);

    try {
      const res = await api.post(`/leads/upload-csv/${campaignId}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setMessage(`${res.data.inserted_count} leads uploaded successfully.`);
      setSelectedFile(null);
      setInputKey((currentKey) => currentKey + 1);
      onUploadComplete?.();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(err.response ? detail || "Failed to upload CSV. Please check the file and try again." : getFriendlyErrorMessage(err));
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow border">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Upload Leads CSV</h2>
        <p className="text-sm text-gray-500 mt-1">
          Upload leads for the selected campaign.
        </p>
      </div>

      {message && (
        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {message}
        </p>
      )}

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            CSV File
          </label>
          <input
            key={inputKey}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="w-full rounded border p-3 text-sm"
            disabled={!campaignId || isUploading}
          />
        </div>

        <button
          className="rounded bg-blue-600 px-5 py-3 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          disabled={!campaignId || !selectedFile || isUploading}
        >
          {isUploading ? "Uploading..." : "Upload CSV"}
        </button>
      </form>

      {!campaignId && (
        <p className="mt-3 text-sm text-gray-500">
          Select a campaign above to enable CSV upload.
        </p>
      )}
    </div>
  );
}

export default LeadUpload;
