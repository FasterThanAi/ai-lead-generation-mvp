

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
    setMessage("");
    setError("");

    const trimmedData = Object.fromEntries(
      Object.entries(formData).map(([name, value]) => [name, value.trim()])
    );

    if (Object.values(trimmedData).some((value) => !value)) {
      setError("Please fill in every field.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await api.post("/campaigns/create", trimmedData);
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
        <h2 className="text-xl font-semibold tracking-tight text-ink">Create Campaign</h2>
        <p className="mt-1 text-sm text-muted">
          Define the audience and offer before uploading leads.
        </p>
      </div>

      {message && (
        <p className="mb-4 rounded-2xl border border-success-soft bg-success-soft p-3 text-sm text-success">{message}</p>
      )}

      {error && (
        <p className="mb-4 rounded-lg border border-danger-soft bg-danger-soft p-3 text-sm text-danger">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[
          ["campaign_name", "Campaign name", "Campaign name"],
          ["industry", "Target industry", "e.g. Manufacturing"],
          ["location", "Location", "e.g. India"],
          ["target_role", "Target role", "e.g. HR / CTO"],
        ].map(([name, label, placeholder]) => (
          <div key={name}>
            <label htmlFor={`campaign-${name}`} className="label">
              {label}
            </label>
            <input
              id={`campaign-${name}`}
              name={name}
              value={formData[name]}
              onChange={handleChange}
              placeholder={placeholder}
              maxLength={255}
              className="field"
              required
            />
          </div>
        ))}

        <div className="md:col-span-2">
          <label htmlFor="campaign-offer" className="label">
            Offer
          </label>
          <textarea
            id="campaign-offer"
            name="offer"
            value={formData.offer}
            onChange={handleChange}
            placeholder="What are you offering?"
            className="field min-h-32"
            rows="4"
            required
          />
        </div>

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
