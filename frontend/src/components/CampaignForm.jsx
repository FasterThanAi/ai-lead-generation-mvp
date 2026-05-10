import { useState } from "react";
import api from "../services/api";
import { getFriendlyErrorMessage } from "../utils/errorMessages";

function CampaignForm({ onCampaignCreated }) {
  const [formData, setFormData] = useState({
    campaign_name: "",
    industry: "",
    location: "",
    target_role: "",
    offer: "",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setError("");

    try {
      const res = await api.post("/campaigns/create", formData);
      setMessage(res.data.message);
      setFormData({
        campaign_name: "",
        industry: "",
        location: "",
        target_role: "",
        offer: "",
      });
      onCampaignCreated?.();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Something went wrong. Please try again."));
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow border">
      <h2 className="text-xl font-semibold mb-4">Create Campaign</h2>

      {message && (
        <p className="mb-4 text-sm text-blue-600">{message}</p>
      )}

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="campaign_name"
          value={formData.campaign_name}
          onChange={handleChange}
          placeholder="Campaign name"
          className="w-full border p-3 rounded"
          required
        />

        <input
          name="industry"
          value={formData.industry}
          onChange={handleChange}
          placeholder="Target industry, e.g. Manufacturing"
          className="w-full border p-3 rounded"
          required
        />

        <input
          name="location"
          value={formData.location}
          onChange={handleChange}
          placeholder="Location, e.g. India"
          className="w-full border p-3 rounded"
          required
        />

        <input
          name="target_role"
          value={formData.target_role}
          onChange={handleChange}
          placeholder="Target role, e.g. HR / CTO"
          className="w-full border p-3 rounded"
          required
        />

        <textarea
          name="offer"
          value={formData.offer}
          onChange={handleChange}
          placeholder="What are you offering?"
          className="w-full border p-3 rounded"
          rows="4"
          required
        />

        <button
          className="bg-blue-600 text-white px-5 py-3 rounded hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating..." : "Create Campaign"}
        </button>
      </form>
    </div>
  );
}

export default CampaignForm;
