import { useState } from "react";
import api from "../services/api";
import { getFriendlyErrorMessage } from "../utils/errorMessages";
import Button from "./ui/Button";
import Card from "./ui/Card";

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
    <Card>
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">Create Campaign</h2>
        <p className="mt-1 text-sm text-slate-500">
          Define the audience and offer before uploading leads.
        </p>
      </div>

      {message && (
        <p className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>
      )}

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[
          ["campaign_name", "Campaign name"],
          ["industry", "Target industry, e.g. Manufacturing"],
          ["location", "Location, e.g. India"],
          ["target_role", "Target role, e.g. HR / CTO"],
        ].map(([name, placeholder]) => (
          <input
            key={name}
            name={name}
            value={formData[name]}
            onChange={handleChange}
            placeholder={placeholder}
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white/80 px-4 text-sm shadow-sm outline-none transition focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
            required
          />
        ))}

        <textarea
          name="offer"
          value={formData.offer}
          onChange={handleChange}
          placeholder="What are you offering?"
          className="min-h-32 w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-slate-300 focus:ring-4 focus:ring-slate-100 md:col-span-2"
          rows="4"
          required
        />

        <div className="md:col-span-2">
          <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? "Creating..." : "Create Campaign"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default CampaignForm;
