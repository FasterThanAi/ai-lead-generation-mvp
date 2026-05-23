import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { formatDateTimeIST, getDateTimestampISTSafe } from "../utils/dateUtils";
import { getFriendlyErrorMessage } from "../utils/errorMessages";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";

function formatPercent(value) {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return "0.0%";
  }

  return `${numericValue.toFixed(1)}%`;
}

function getLatestFollowUp(followUps) {
  if (!followUps.length) {
    return null;
  }

  return [...followUps].sort((a, b) => {
    const numberDiff = (b.follow_up_number || 0) - (a.follow_up_number || 0);

    if (numberDiff !== 0) {
      return numberDiff;
    }

    return getDateTimestampISTSafe(b.created_at) - getDateTimestampISTSafe(a.created_at);
  })[0];
}

function getPreviewText(value, maxLength = 220) {
  const text = String(value || "").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}...`;
}

function isReplyClassified(draft) {
  return Boolean(draft.reply_intent || draft.reply_classified_at);
}

function Emails() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);
  const [campaignsError, setCampaignsError] = useState("");
  const [drafts, setDrafts] = useState([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [draftsError, setDraftsError] = useState("");
  const [followUps, setFollowUps] = useState([]);
  const [isLoadingFollowUps, setIsLoadingFollowUps] = useState(false);
  const [followUpsError, setFollowUpsError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingFollowUps, setIsGeneratingFollowUps] = useState(false);
  const [generatingFollowUpDraftId, setGeneratingFollowUpDraftId] = useState(null);
  const [generationError, setGenerationError] = useState("");
  const [generationSummary, setGenerationSummary] = useState(null);
  const [followUpSummary, setFollowUpSummary] = useState(null);
  const [updatingDraftId, setUpdatingDraftId] = useState(null);
  const [updatingFollowUpId, setUpdatingFollowUpId] = useState(null);
  const [sendingDraftId, setSendingDraftId] = useState(null);
  const [sendingFollowUpId, setSendingFollowUpId] = useState(null);
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);
  const [isSendingFollowUps, setIsSendingFollowUps] = useState(false);
  const [sendSummary, setSendSummary] = useState(null);
  const [campaignAnalytics, setCampaignAnalytics] = useState(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [isCheckingReplies, setIsCheckingReplies] = useState(false);
  const [checkingReplyDraftId, setCheckingReplyDraftId] = useState(null);
  const [replyCheckSummary, setReplyCheckSummary] = useState(null);
  const [isClassifyingReplies, setIsClassifyingReplies] = useState(false);
  const [classifyingReplyDraftId, setClassifyingReplyDraftId] = useState(null);
  const [replyClassificationSummary, setReplyClassificationSummary] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusError, setStatusError] = useState("");
  const [expandedDraftIds, setExpandedDraftIds] = useState({});
  const [expandedFollowUpIds, setExpandedFollowUpIds] = useState({});

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => String(campaign.id) === String(selectedCampaignId)),
    [campaigns, selectedCampaignId]
  );

  const approvedDraftCount = useMemo(
    () => drafts.filter((draft) => draft.status === "approved").length,
    [drafts]
  );

  const approvedFollowUpCount = useMemo(
    () => followUps.filter((followUp) => followUp.status === "approved").length,
    [followUps]
  );

  const followUpsByDraftId = useMemo(() => (
    followUps.reduce((groupedFollowUps, followUp) => {
      const key = String(followUp.original_email_draft_id);

      if (!groupedFollowUps[key]) {
        groupedFollowUps[key] = [];
      }

      groupedFollowUps[key].push(followUp);
      groupedFollowUps[key].sort((a, b) => (
        (a.follow_up_number || 0) - (b.follow_up_number || 0)
      ));

      return groupedFollowUps;
    }, {})
  ), [followUps]);

  const draftSummary = useMemo(() => ({
    total: drafts.length,
    generated: drafts.filter((draft) => draft.status === "generated").length,
    approved: drafts.filter((draft) => draft.status === "approved").length,
    sent: drafts.filter((draft) => draft.status === "sent").length,
    replied: drafts.filter((draft) => draft.status === "replied").length,
    failed: drafts.filter((draft) => draft.status === "failed").length,
  }), [drafts]);

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

  const fetchDrafts = async (campaignId) => {
    if (!campaignId) {
      setDrafts([]);
      return;
    }

    setIsLoadingDrafts(true);
    setDraftsError("");

    try {
      const res = await api.get(`/emails/campaign/${campaignId}`);
      setDrafts(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (err) {
      setDraftsError(getFriendlyErrorMessage(err, "Could not load email drafts. Please try again."));
      console.error(err);
    } finally {
      setIsLoadingDrafts(false);
    }
  };

  const fetchFollowUps = async (campaignId) => {
    if (!campaignId) {
      setFollowUps([]);
      return;
    }

    setIsLoadingFollowUps(true);
    setFollowUpsError("");

    try {
      const res = await api.get(`/followups/campaign/${campaignId}`);
      setFollowUps(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (err) {
      setFollowUpsError(getFriendlyErrorMessage(err, "Could not load follow-up drafts. Please try again."));
      console.error(err);
    } finally {
      setIsLoadingFollowUps(false);
    }
  };

  const fetchCampaignAnalytics = async (campaignId) => {
    if (!campaignId) {
      setCampaignAnalytics(null);
      return;
    }

    setIsLoadingAnalytics(true);
    setAnalyticsError("");

    try {
      const res = await api.get(`/analytics/campaign/${campaignId}`);
      setCampaignAnalytics(res.data.data || null);
    } catch (err) {
      setAnalyticsError(getFriendlyErrorMessage(err, "Could not load campaign analytics. Please try again."));
      console.error(err);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const refreshCampaignData = async (campaignId) => {
    await Promise.all([
      fetchDrafts(campaignId),
      fetchFollowUps(campaignId),
      fetchCampaignAnalytics(campaignId),
    ]);
  };

  const handleCampaignChange = (e) => {
    const nextCampaignId = e.target.value;

    setSelectedCampaignId(nextCampaignId);
    setDrafts([]);
    setFollowUps([]);
    setCampaignAnalytics(null);
    setDraftsError("");
    setFollowUpsError("");
    setAnalyticsError("");
    setGenerationSummary(null);
    setGenerationError("");
    setSendSummary(null);
    setFollowUpSummary(null);
    setReplyCheckSummary(null);
    setReplyClassificationSummary(null);
    setStatusMessage("");
    setStatusError("");
    setExpandedDraftIds({});
    setExpandedFollowUpIds({});
    refreshCampaignData(nextCampaignId);
  };

  const toggleDraftExpanded = (draftId) => {
    setExpandedDraftIds((current) => ({
      ...current,
      [draftId]: !current[draftId],
    }));
  };

  const toggleFollowUpExpanded = (followUpId) => {
    setExpandedFollowUpIds((current) => ({
      ...current,
      [followUpId]: !current[followUpId],
    }));
  };

  const handleGenerateCampaignEmails = async () => {
    if (!selectedCampaignId) {
      return;
    }

    setIsGenerating(true);
    setGenerationError("");
    setGenerationSummary(null);
    setFollowUpSummary(null);
    setSendSummary(null);
    setReplyClassificationSummary(null);
    setStatusMessage("");
    setStatusError("");

    try {
      const res = await api.post(`/ai/generate-emails/campaign/${selectedCampaignId}?limit=5`);
      setGenerationSummary({
        generated: res.data.generated ?? 0,
        skipped: res.data.skipped ?? 0,
        failed: res.data.failed ?? 0,
        remaining: res.data.remaining ?? 0,
      });
      await refreshCampaignData(selectedCampaignId);
    } catch (err) {
      setGenerationError(getFriendlyErrorMessage(err, "AI generation failed. Please check Gemini API key or try again.", "ai"));
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateStatus = async (emailId, nextStatus) => {
    setUpdatingDraftId(emailId);
    setStatusMessage("");
    setStatusError("");

    try {
      const res = await api.patch(`/emails/${emailId}/status`, {
        status: nextStatus,
      });
      const updatedDraft = res.data.data;

      setDrafts((currentDrafts) =>
        currentDrafts.map((draft) => (
          draft.id === emailId ? updatedDraft : draft
        ))
      );
      setStatusMessage("Email status updated successfully.");
      await fetchCampaignAnalytics(selectedCampaignId);
    } catch (err) {
      setStatusError(getFriendlyErrorMessage(err, "Something went wrong. Please try again."));
      console.error(err);
    } finally {
      setUpdatingDraftId(null);
    }
  };

  const handleSendDraft = async (emailId) => {
    setSendingDraftId(emailId);
    setSendSummary(null);
    setStatusMessage("");
    setStatusError("");

    try {
      const res = await api.post(`/gmail/send-draft/${emailId}`);
      const result = res.data.data;

      if (result?.status === "sent") {
        setStatusMessage("Email sent successfully.");
      } else {
        setStatusError(
          result?.error === "Lead email is missing."
            ? "This lead does not have an email address."
            : result?.error || "Something went wrong. Please try again."
        );
      }

      await refreshCampaignData(selectedCampaignId);
    } catch (err) {
      setStatusError(getFriendlyErrorMessage(err, "Something went wrong. Please try again.", "gmail"));
      console.error(err);
    } finally {
      setSendingDraftId(null);
    }
  };

  const handleSendApprovedCampaignEmails = async () => {
    if (!selectedCampaignId) {
      return;
    }

    setIsSendingCampaign(true);
    setSendSummary(null);
    setFollowUpSummary(null);
    setStatusMessage("");
    setStatusError("");

    try {
      const res = await api.post(`/gmail/send-approved/campaign/${selectedCampaignId}?limit=5`);
      setSendSummary({
        sent: res.data.sent ?? 0,
        failed: res.data.failed ?? 0,
        remainingApproved: res.data.remaining_approved ?? 0,
      });
      await refreshCampaignData(selectedCampaignId);
    } catch (err) {
      setStatusError(getFriendlyErrorMessage(err, "Something went wrong. Please try again.", "gmail"));
      console.error(err);
    } finally {
      setIsSendingCampaign(false);
    }
  };

  const handleCheckCampaignReplies = async () => {
    if (!selectedCampaignId) {
      return;
    }

    setIsCheckingReplies(true);
    setReplyCheckSummary(null);
    setReplyClassificationSummary(null);
    setStatusMessage("");
    setStatusError("");

    try {
      const res = await api.post(`/replies/check-campaign/${selectedCampaignId}?limit=5`);
      setReplyCheckSummary({
        processed: res.data.processed ?? 0,
        replied: res.data.replied ?? 0,
        noReply: res.data.no_reply ?? 0,
        failed: res.data.failed ?? 0,
      });
      setStatusMessage("Reply check completed.");
      await refreshCampaignData(selectedCampaignId);
    } catch (err) {
      setStatusError(getFriendlyErrorMessage(err, "Reply check failed. Please try again.", "reply"));
      console.error(err);
    } finally {
      setIsCheckingReplies(false);
    }
  };

  const handleCheckDraftReply = async (emailId) => {
    setCheckingReplyDraftId(emailId);
    setReplyCheckSummary(null);
    setStatusMessage("");
    setStatusError("");

    try {
      const res = await api.post(`/replies/check-draft/${emailId}`);

      if (res.data.replied) {
        setStatusMessage("Reply found for this email.");
      } else {
        setStatusMessage("No reply found for this email yet.");
      }

      await refreshCampaignData(selectedCampaignId);
    } catch (err) {
      setStatusError(getFriendlyErrorMessage(err, "Reply check failed. Please try again.", "reply"));
      console.error(err);
    } finally {
      setCheckingReplyDraftId(null);
    }
  };

  const handleClassifyCampaignReplies = async () => {
    if (!selectedCampaignId) {
      return;
    }

    setIsClassifyingReplies(true);
    setReplyClassificationSummary(null);
    setStatusMessage("");
    setStatusError("");

    try {
      const res = await api.post(`/reply-classification/classify-campaign/${selectedCampaignId}?limit=5`);
      setReplyClassificationSummary({
        processed: res.data.processed ?? 0,
        classified: res.data.classified ?? 0,
        skipped: res.data.skipped ?? 0,
        failed: res.data.failed ?? 0,
        remaining: res.data.remaining_unclassified ?? 0,
      });
      setStatusMessage("Reply classification completed.");
      await refreshCampaignData(selectedCampaignId);
    } catch (err) {
      setStatusError(getFriendlyErrorMessage(err, "Reply classification failed. Please try again.", "classification"));
      console.error(err);
    } finally {
      setIsClassifyingReplies(false);
    }
  };

  const handleClassifyDraftReply = async (emailId, force = false) => {
    setClassifyingReplyDraftId(emailId);
    setReplyClassificationSummary(null);
    setStatusMessage("");
    setStatusError("");

    try {
      await api.post(`/reply-classification/classify/${emailId}?force=${force ? "true" : "false"}`);
      setStatusMessage(force ? "Reply reclassified successfully." : "Reply classified successfully.");
      await refreshCampaignData(selectedCampaignId);
    } catch (err) {
      setStatusError(getFriendlyErrorMessage(err, "Reply classification failed. Please try again.", "classification"));
      console.error(err);
    } finally {
      setClassifyingReplyDraftId(null);
    }
  };

  const handleGenerateFollowUp = async (emailId) => {
    setGeneratingFollowUpDraftId(emailId);
    setFollowUpSummary(null);
    setStatusMessage("");
    setStatusError("");

    try {
      const res = await api.post(`/followups/generate/${emailId}`);
      setStatusMessage(res.data.message || "Follow-up draft generated.");
      await refreshCampaignData(selectedCampaignId);
    } catch (err) {
      setStatusError(getFriendlyErrorMessage(err, "Follow-up generation failed. Please try again.", "followup"));
      console.error(err);
    } finally {
      setGeneratingFollowUpDraftId(null);
    }
  };

  const handleGenerateCampaignFollowUps = async () => {
    if (!selectedCampaignId) {
      return;
    }

    setIsGeneratingFollowUps(true);
    setFollowUpSummary(null);
    setStatusMessage("");
    setStatusError("");

    try {
      const res = await api.post(`/followups/generate-campaign/${selectedCampaignId}?limit=5`);
      setFollowUpSummary({
        mode: "generated",
        processed: res.data.processed ?? 0,
        generated: res.data.generated ?? 0,
        skipped: res.data.skipped ?? 0,
        failed: res.data.failed ?? 0,
        remaining: res.data.remaining ?? 0,
      });
      await refreshCampaignData(selectedCampaignId);
    } catch (err) {
      setStatusError(getFriendlyErrorMessage(err, "Follow-up generation failed. Please try again.", "followup"));
      console.error(err);
    } finally {
      setIsGeneratingFollowUps(false);
    }
  };

  const handleUpdateFollowUpStatus = async (followUpId, nextStatus) => {
    setUpdatingFollowUpId(followUpId);
    setStatusMessage("");
    setStatusError("");

    try {
      const res = await api.patch(`/followups/${followUpId}/status`, {
        status: nextStatus,
      });
      const updatedFollowUp = res.data.data;

      setFollowUps((currentFollowUps) =>
        currentFollowUps.map((followUp) => (
          followUp.id === followUpId ? updatedFollowUp : followUp
        ))
      );
      setStatusMessage("Follow-up status updated successfully.");
      await fetchCampaignAnalytics(selectedCampaignId);
    } catch (err) {
      setStatusError(getFriendlyErrorMessage(err, "Something went wrong. Please try again.", "followup"));
      console.error(err);
    } finally {
      setUpdatingFollowUpId(null);
    }
  };

  const handleSendFollowUp = async (followUpId) => {
    setSendingFollowUpId(followUpId);
    setFollowUpSummary(null);
    setStatusMessage("");
    setStatusError("");

    try {
      const res = await api.post(`/followups/send/${followUpId}`);
      const result = res.data.data;

      if (result?.status === "sent") {
        setStatusMessage("Follow-up sent successfully.");
      } else {
        setStatusError(result?.send_error || "Follow-up sending failed. Please try again.");
      }

      await refreshCampaignData(selectedCampaignId);
    } catch (err) {
      setStatusError(getFriendlyErrorMessage(err, "Follow-up sending failed. Please try again.", "followup"));
      console.error(err);
    } finally {
      setSendingFollowUpId(null);
    }
  };

  const handleSendApprovedCampaignFollowUps = async () => {
    if (!selectedCampaignId) {
      return;
    }

    setIsSendingFollowUps(true);
    setFollowUpSummary(null);
    setStatusMessage("");
    setStatusError("");

    try {
      const res = await api.post(`/followups/send-approved/campaign/${selectedCampaignId}?limit=5`);
      setFollowUpSummary({
        mode: "sent",
        sent: res.data.sent ?? 0,
        failed: res.data.failed ?? 0,
        skipped: res.data.skipped ?? 0,
        remainingApproved: res.data.remaining_approved ?? 0,
      });
      await refreshCampaignData(selectedCampaignId);
    } catch (err) {
      setStatusError(getFriendlyErrorMessage(err, "Follow-up sending failed. Please try again.", "followup"));
      console.error(err);
    } finally {
      setIsSendingFollowUps(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Emails"
        description="Generate, approve, send, check replies, and manage follow-ups from one focused workspace."
      />

      <div className="space-y-6">
        <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm shadow-slate-200/70 backdrop-blur sm:p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Select Campaign</h2>
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
        </div>

        {selectedCampaign && (
          <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm shadow-slate-200/70 backdrop-blur sm:p-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Campaign Summary</h2>
              <p className="text-sm text-gray-500 mt-1">{selectedCampaign.campaign_name}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
              <div className="rounded-lg border bg-gray-50 p-4">
                <p className="text-xs text-gray-500">Total Drafts</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">{draftSummary.total}</p>
              </div>
              <div className="rounded-lg border bg-blue-50 p-4">
                <p className="text-xs text-blue-700">Generated</p>
                <p className="mt-1 text-2xl font-semibold text-blue-900">{draftSummary.generated}</p>
              </div>
              <div className="rounded-lg border bg-green-50 p-4">
                <p className="text-xs text-green-700">Approved</p>
                <p className="mt-1 text-2xl font-semibold text-green-900">{draftSummary.approved}</p>
              </div>
              <div className="rounded-lg border bg-purple-50 p-4">
                <p className="text-xs text-purple-700">Sent</p>
                <p className="mt-1 text-2xl font-semibold text-purple-900">{draftSummary.sent}</p>
              </div>
              <div className="rounded-lg border bg-emerald-50 p-4">
                <p className="text-xs text-emerald-700">Replied</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-900">{draftSummary.replied}</p>
              </div>
              <div className="rounded-lg border bg-red-50 p-4">
                <p className="text-xs text-red-700">Failed</p>
                <p className="mt-1 text-2xl font-semibold text-red-900">{draftSummary.failed}</p>
              </div>
            </div>
          </div>
        )}

        {selectedCampaign && (
          <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm shadow-slate-200/70 backdrop-blur sm:p-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Campaign Analytics</h2>
              <p className="text-sm text-gray-500 mt-1">
                Reply tracking uses Gmail readonly access and does not send emails.
              </p>
            </div>

            {isLoadingAnalytics && (
              <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-600">
                Loading campaign analytics...
              </div>
            )}

            {!isLoadingAnalytics && analyticsError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {analyticsError}
              </div>
            )}

            {!isLoadingAnalytics && !analyticsError && campaignAnalytics && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="rounded-lg border bg-gray-50 p-4">
                    <p className="text-xs text-gray-500">Leads</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">{campaignAnalytics.lead_count}</p>
                  </div>
                  <div className="rounded-lg border bg-gray-50 p-4">
                    <p className="text-xs text-gray-500">Drafts</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">{campaignAnalytics.draft_count}</p>
                  </div>
                  <div className="rounded-lg border bg-purple-50 p-4">
                    <p className="text-xs text-purple-700">Sent</p>
                    <p className="mt-1 text-2xl font-semibold text-purple-900">{campaignAnalytics.sent_count}</p>
                  </div>
                  <div className="rounded-lg border bg-red-50 p-4">
                    <p className="text-xs text-red-700">Failed</p>
                    <p className="mt-1 text-2xl font-semibold text-red-900">{campaignAnalytics.failed_count}</p>
                  </div>
                  <div className="rounded-lg border bg-emerald-50 p-4">
                    <p className="text-xs text-emerald-700">Replied</p>
                    <p className="mt-1 text-2xl font-semibold text-emerald-900">{campaignAnalytics.replied_count}</p>
                  </div>
                  <div className="rounded-lg border bg-sky-50 p-4">
                    <p className="text-xs text-sky-700">Classified Replies</p>
                    <p className="mt-1 text-2xl font-semibold text-sky-900">{campaignAnalytics.classified_replies ?? 0}</p>
                  </div>
                  <div className="rounded-lg border bg-red-50 p-4">
                    <p className="text-xs text-red-700">High Priority Replies</p>
                    <p className="mt-1 text-2xl font-semibold text-red-900">{campaignAnalytics.high_priority_replies ?? 0}</p>
                  </div>
                  <div className="rounded-lg border bg-emerald-50 p-4">
                    <p className="text-xs text-emerald-700">Interested</p>
                    <p className="mt-1 text-2xl font-semibold text-emerald-900">{campaignAnalytics.interested_replies ?? 0}</p>
                  </div>
                  <div className="rounded-lg border bg-blue-50 p-4">
                    <p className="text-xs text-blue-700">Pricing</p>
                    <p className="mt-1 text-2xl font-semibold text-blue-900">{campaignAnalytics.pricing_replies ?? 0}</p>
                  </div>
                  <div className="rounded-lg border bg-green-50 p-4">
                    <p className="text-xs text-green-700">Meeting Requests</p>
                    <p className="mt-1 text-2xl font-semibold text-green-900">{campaignAnalytics.meeting_request_replies ?? 0}</p>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-4">
                    <p className="text-xs text-slate-600">Not Interested</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{campaignAnalytics.not_interested_replies ?? 0}</p>
                  </div>
                  <div className="rounded-lg border bg-red-50 p-4">
                    <p className="text-xs text-red-700">Unsubscribe</p>
                    <p className="mt-1 text-2xl font-semibold text-red-900">{campaignAnalytics.unsubscribe_replies ?? 0}</p>
                  </div>
                  <div className="rounded-lg border bg-blue-50 p-4">
                    <p className="text-xs text-blue-700">Reply Rate</p>
                    <p className="mt-1 text-2xl font-semibold text-blue-900">{formatPercent(campaignAnalytics.reply_rate)}</p>
                  </div>
                  <div className="rounded-lg border bg-green-50 p-4">
                    <p className="text-xs text-green-700">Send Success</p>
                    <p className="mt-1 text-2xl font-semibold text-green-900">{formatPercent(campaignAnalytics.send_success_rate)}</p>
                  </div>
                  <div className="rounded-lg border bg-yellow-50 p-4">
                    <p className="text-xs text-yellow-700">Needs Follow-up</p>
                    <p className="mt-1 text-2xl font-semibold text-yellow-900">{campaignAnalytics.needs_follow_up_count}</p>
                  </div>
                  <div className="rounded-lg border bg-blue-50 p-4">
                    <p className="text-xs text-blue-700">Follow-ups Generated</p>
                    <p className="mt-1 text-2xl font-semibold text-blue-900">{campaignAnalytics.followups_generated_count ?? 0}</p>
                  </div>
                  <div className="rounded-lg border bg-green-50 p-4">
                    <p className="text-xs text-green-700">Follow-ups Approved</p>
                    <p className="mt-1 text-2xl font-semibold text-green-900">{campaignAnalytics.followups_approved_count ?? 0}</p>
                  </div>
                  <div className="rounded-lg border bg-purple-50 p-4">
                    <p className="text-xs text-purple-700">Follow-ups Sent</p>
                    <p className="mt-1 text-2xl font-semibold text-purple-900">{campaignAnalytics.followups_sent_count ?? 0}</p>
                  </div>
                  <div className="rounded-lg border bg-red-50 p-4">
                    <p className="text-xs text-red-700">Follow-ups Failed</p>
                    <p className="mt-1 text-2xl font-semibold text-red-900">{campaignAnalytics.followups_failed_count ?? 0}</p>
                  </div>
                  <div className="rounded-lg border bg-indigo-50 p-4">
                    <p className="text-xs text-indigo-700">AI Scored Leads</p>
                    <p className="mt-1 text-2xl font-semibold text-indigo-900">{campaignAnalytics.scored_leads ?? 0}</p>
                  </div>
                  <div className="rounded-lg border bg-gray-50 p-4">
                    <p className="text-xs text-gray-500">Unscored Leads</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">{campaignAnalytics.unscored_leads ?? 0}</p>
                  </div>
                  <div className="rounded-lg border bg-indigo-50 p-4">
                    <p className="text-xs text-indigo-700">Avg AI Score</p>
                    <p className="mt-1 text-2xl font-semibold text-indigo-900">{Number(campaignAnalytics.average_ai_score ?? 0).toFixed(1)}</p>
                  </div>
                  <div className="rounded-lg border bg-green-50 p-4">
                    <p className="text-xs text-green-700">High Priority</p>
                    <p className="mt-1 text-2xl font-semibold text-green-900">{campaignAnalytics.high_priority_leads ?? 0}</p>
                  </div>
                  <div className="rounded-lg border bg-emerald-50 p-4">
                    <p className="text-xs text-emerald-700">Hot Leads</p>
                    <p className="mt-1 text-2xl font-semibold text-emerald-900">{campaignAnalytics.hot_leads ?? 0}</p>
                  </div>
                </div>

                {campaignAnalytics.recent_replies?.length > 0 && (
                  <div className="rounded-lg border bg-gray-50 p-4">
                    <h3 className="text-sm font-semibold text-gray-900">Recent Replies</h3>
                    <div className="mt-3 space-y-3">
                      {campaignAnalytics.recent_replies.map((reply) => (
                        <div key={reply.email_draft_id} className="border-t pt-3 first:border-t-0 first:pt-0">
                          <p className="text-sm font-medium text-gray-900">
                            {reply.company_name || reply.lead_email || `Lead ID ${reply.lead_id}`}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {[reply.lead_email, formatDateTimeIST(reply.replied_at)].filter(Boolean).join(" | ")}
                          </p>
                          {(reply.reply_intent || reply.reply_priority || reply.reply_sentiment) && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {reply.reply_intent && <Badge variant={reply.reply_intent}>{reply.reply_intent}</Badge>}
                              {reply.reply_sentiment && <Badge variant={reply.reply_sentiment}>{reply.reply_sentiment}</Badge>}
                              {reply.reply_priority && <Badge variant={reply.reply_priority}>{reply.reply_priority}</Badge>}
                            </div>
                          )}
                          {reply.reply_snippet && (
                            <p className="mt-2 text-sm text-gray-700">{reply.reply_snippet}</p>
                          )}
                          {reply.reply_next_action && (
                            <p className="mt-2 text-sm font-medium text-slate-700">Next: {reply.reply_next_action}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm shadow-slate-200/70 backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">Outreach Actions</h2>
              {selectedCampaign && (
                <p className="mt-1 text-sm text-slate-500">
                  {selectedCampaign.campaign_name}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                type="button"
                variant="primary"
                className="w-full sm:w-auto"
                disabled={!selectedCampaignId || isGenerating || isSendingCampaign || isGeneratingFollowUps}
                onClick={handleGenerateCampaignEmails}
              >
                {isGenerating ? "Generating emails..." : "Generate Next 5 Emails"}
              </Button>

              <Button
                type="button"
                variant="indigo"
                className="w-full sm:w-auto"
                disabled={!selectedCampaignId || isSendingCampaign || approvedDraftCount === 0}
                onClick={handleSendApprovedCampaignEmails}
              >
                {isSendingCampaign ? "Sending approved emails..." : "Send Approved Emails"}
              </Button>

              <Button
                type="button"
                variant="success"
                className="w-full sm:w-auto"
                disabled={!selectedCampaignId || isCheckingReplies || isClassifyingReplies || isSendingCampaign || isGenerating || isGeneratingFollowUps}
                onClick={handleCheckCampaignReplies}
              >
                {isCheckingReplies ? "Checking replies..." : "Check Replies"}
              </Button>

              <Button
                type="button"
                variant="warning"
                className="w-full sm:w-auto"
                disabled={!selectedCampaignId || isClassifyingReplies || isCheckingReplies || isSendingCampaign || isGenerating || isGeneratingFollowUps}
                onClick={handleClassifyCampaignReplies}
              >
                {isClassifyingReplies ? "Classifying replies..." : "Classify Replies"}
              </Button>

              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={!selectedCampaignId || isGeneratingFollowUps || isGenerating || isSendingFollowUps}
                onClick={handleGenerateCampaignFollowUps}
              >
                {isGeneratingFollowUps ? "Generating follow-ups..." : "Generate Follow-ups"}
              </Button>

              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={!selectedCampaignId || isSendingFollowUps || approvedFollowUpCount === 0}
                onClick={handleSendApprovedCampaignFollowUps}
              >
                {isSendingFollowUps ? "Sending follow-ups..." : "Send Approved Follow-ups"}
              </Button>
            </div>
          </div>

          <p className="mt-3 text-sm text-gray-500">
            For safety, only 5 leads are processed per click.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Only approved drafts are sent. Sending is limited to 5 per click.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Reply checking uses Gmail readonly access and does not send emails.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            AI reply classification only suggests next actions. It does not send replies automatically.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Follow-ups are generated only for sent emails without replies.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Follow-ups are never sent automatically. Only approved follow-ups can be sent.
          </p>

          {generationSummary && (
            <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              Generated: {generationSummary.generated}, Skipped: {generationSummary.skipped}, Failed: {generationSummary.failed}, Remaining: {generationSummary.remaining}
            </p>
          )}

          {generationError && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {generationError}
            </p>
          )}

          {sendSummary && (
            <p className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm text-purple-700">
              Sent: {sendSummary.sent}, Failed: {sendSummary.failed}, Remaining approved: {sendSummary.remainingApproved}
            </p>
          )}

          {replyCheckSummary && (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              Checked: {replyCheckSummary.processed}, Replies found: {replyCheckSummary.replied}, No reply: {replyCheckSummary.noReply}, Failed: {replyCheckSummary.failed}
            </p>
          )}

          {replyClassificationSummary && (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Classified {replyClassificationSummary.classified} replies, skipped {replyClassificationSummary.skipped}, failed {replyClassificationSummary.failed}. Remaining: {replyClassificationSummary.remaining}.
            </p>
          )}

          {followUpSummary?.mode === "generated" && (
            <p className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-700">
              Processed: {followUpSummary.processed}, Generated: {followUpSummary.generated}, Skipped: {followUpSummary.skipped}, Failed: {followUpSummary.failed}, Remaining: {followUpSummary.remaining}
            </p>
          )}

          {followUpSummary?.mode === "sent" && (
            <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              Follow-ups sent: {followUpSummary.sent}, Failed: {followUpSummary.failed}, Skipped: {followUpSummary.skipped}, Remaining approved: {followUpSummary.remainingApproved}
            </p>
          )}
        </div>

        {(statusMessage || statusError) && (
          <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm shadow-slate-200/70 backdrop-blur sm:p-6">
            {statusMessage && (
              <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                {statusMessage}
              </p>
            )}

            {statusError && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {statusError}
              </p>
            )}
          </div>
        )}

        <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm shadow-slate-200/70 backdrop-blur sm:p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Email Drafts</h2>
          </div>

          {!selectedCampaignId && (
            <div className="border border-dashed rounded-lg p-6 text-center">
              <h3 className="font-medium text-gray-800">Select a campaign</h3>
              <p className="text-sm text-gray-500 mt-1">
                Select a campaign to generate and manage email drafts.
              </p>
            </div>
          )}

          {selectedCampaignId && isLoadingDrafts && (
            <div className="border rounded-lg p-5 text-sm text-gray-600">
              Loading email drafts...
            </div>
          )}

          {selectedCampaignId && !isLoadingDrafts && isLoadingFollowUps && (
            <div className="mb-4 border rounded-lg p-4 text-sm text-gray-600">
              Loading follow-up drafts...
            </div>
          )}

          {selectedCampaignId && !isLoadingDrafts && draftsError && (
            <div className="border border-red-200 bg-red-50 text-red-700 rounded-lg p-4 text-sm">
              {draftsError}
            </div>
          )}

          {selectedCampaignId && !isLoadingDrafts && !draftsError && followUpsError && (
            <div className="mb-4 border border-red-200 bg-red-50 text-red-700 rounded-lg p-4 text-sm">
              {followUpsError}
            </div>
          )}

          {selectedCampaignId && !isLoadingDrafts && !draftsError && drafts.length === 0 && (
            <div className="border border-dashed rounded-lg p-6 text-center">
              <h3 className="font-medium text-gray-800">No email drafts found.</h3>
              <p className="text-sm text-gray-500 mt-1">
                Generate AI drafts for this campaign.
              </p>
            </div>
          )}

          {selectedCampaignId && !isLoadingDrafts && !draftsError && drafts.length > 0 && (
            <div className="space-y-4">
              {drafts.map((draft) => {
                const draftFollowUps = followUpsByDraftId[String(draft.id)] || [];
                const latestFollowUp = getLatestFollowUp(draftFollowUps);
                const canGenerateFollowUp = (
                  draft.status === "sent" &&
                  draftFollowUps.length < 2 &&
                  (!latestFollowUp || latestFollowUp.status === "sent")
                );
                const isDraftExpanded = Boolean(expandedDraftIds[draft.id]);
                const shouldCollapseDraft = String(draft.body || "").length > 220;
                const replyClassified = isReplyClassified(draft);

                return (
                <div key={draft.id} className="rounded-3xl border border-slate-200 bg-white/85 p-4 shadow-sm sm:p-5">
                  <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-500">
                        {draft.lead_company_name || `Lead ID ${draft.lead_id}`}
                      </p>
                      <h3 className="mt-1 break-words text-lg font-semibold text-slate-950">
                        {draft.subject}
                      </h3>
                      {(draft.lead_contact_name || draft.lead_contact_role) && (
                        <p className="mt-1 break-words text-sm text-slate-500">
                          {[draft.lead_contact_name, draft.lead_contact_role].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {draft.lead_email && (
                        <p className="mt-1 break-words text-sm text-slate-500">
                          To: {draft.lead_email}
                        </p>
                      )}
                      {draft.lead_ai_score !== null && draft.lead_ai_score !== undefined ? (
                        <p className="mt-2 text-sm font-medium text-indigo-700">
                          Final AI Score: {draft.lead_ai_score}
                          {draft.lead_ai_fit_score !== null && draft.lead_ai_fit_score !== undefined ? ` | Fit ${draft.lead_ai_fit_score}` : ""}
                          {draft.lead_ai_contact_confidence_score !== null && draft.lead_ai_contact_confidence_score !== undefined ? ` | Contact ${draft.lead_ai_contact_confidence_score}` : ""}
                          {draft.lead_ai_priority ? ` | ${draft.lead_ai_priority}` : ""}
                          {draft.lead_ai_qualification ? ` | ${draft.lead_ai_qualification}` : ""}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-yellow-700">
                          This lead has not been AI-scored yet.
                        </p>
                      )}
                    </div>

                    <Badge variant={draft.status}>{draft.status}</Badge>
                  </div>

                  <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                    <p className="whitespace-pre-line break-words text-sm leading-6 text-slate-700">
                      {isDraftExpanded ? draft.body : getPreviewText(draft.body)}
                    </p>
                    {shouldCollapseDraft && (
                      <button
                        type="button"
                        className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700"
                        onClick={() => toggleDraftExpanded(draft.id)}
                      >
                        {isDraftExpanded ? "Hide full email" : "Show full email"}
                      </button>
                    )}
                  </div>

                  {(draft.sent_at || draft.send_error || draft.gmail_message_id) && (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      {draft.sent_at && (
                        <p>Sent at: {formatDateTimeIST(draft.sent_at)}</p>
                      )}
                      {draft.gmail_message_id && (
                        <p>Gmail message ID: {draft.gmail_message_id}</p>
                      )}
                      {draft.send_error && (
                        <p className="text-red-700">Send error: {draft.send_error}</p>
                      )}
                    </div>
                  )}

                  {draft.status === "replied" && (draft.reply_snippet || draft.replied_at) && (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      <p className="font-medium">Replied</p>
                      {draft.replied_at && (
                        <p className="mt-1 text-xs text-emerald-700">Replied at: {formatDateTimeIST(draft.replied_at)}</p>
                      )}
                      {draft.reply_snippet && (
                        <p className="mt-2 text-sm leading-6">{draft.reply_snippet}</p>
                      )}
                    </div>
                  )}

                  {draft.status === "replied" && replyClassified && (
                    <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-slate-800">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-slate-950">AI Reply Classification</p>
                          {draft.reply_classified_at && (
                            <p className="mt-1 text-xs text-slate-500">
                              Classified at: {formatDateTimeIST(draft.reply_classified_at)}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {draft.reply_intent && <Badge variant={draft.reply_intent}>{draft.reply_intent}</Badge>}
                          {draft.reply_sentiment && <Badge variant={draft.reply_sentiment}>{draft.reply_sentiment}</Badge>}
                          {draft.reply_priority && <Badge variant={draft.reply_priority}>{draft.reply_priority}</Badge>}
                        </div>
                      </div>

                      {draft.reply_summary && (
                        <div className="mt-4">
                          <p className="text-xs font-semibold uppercase text-slate-500">Summary</p>
                          <p className="mt-1 leading-6 text-slate-700">{draft.reply_summary}</p>
                        </div>
                      )}

                      {draft.reply_next_action && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold uppercase text-slate-500">Next action</p>
                          <p className="mt-1 leading-6 text-slate-700">{draft.reply_next_action}</p>
                        </div>
                      )}

                      {draft.reply_suggested_response_direction && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold uppercase text-slate-500">Suggested response direction</p>
                          <p className="mt-1 leading-6 text-slate-700">{draft.reply_suggested_response_direction}</p>
                        </div>
                      )}

                      {draft.reply_classification_error && (
                        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                          {draft.reply_classification_error}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-slate-500">
                      <span>{draft.ai_model || "AI model unavailable"}</span>
                      <span className="mx-2">|</span>
                      <span>{formatDateTimeIST(draft.created_at)}</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {draft.status === "generated" && (
                        <>
                          <button
                            className="rounded bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
                            disabled={updatingDraftId === draft.id || sendingDraftId === draft.id}
                            onClick={() => handleUpdateStatus(draft.id, "approved")}
                          >
                            {updatingDraftId === draft.id ? "Updating..." : "Approve"}
                          </button>
                          <button
                            className="rounded bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                            disabled={updatingDraftId === draft.id || sendingDraftId === draft.id}
                            onClick={() => handleUpdateStatus(draft.id, "rejected")}
                          >
                            {updatingDraftId === draft.id ? "Updating..." : "Reject"}
                          </button>
                        </>
                      )}
                      {draft.status === "approved" && (
                        <>
                          <button
                            className="rounded bg-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300"
                            disabled={sendingDraftId === draft.id || isSendingCampaign}
                            onClick={() => handleSendDraft(draft.id)}
                          >
                            {sendingDraftId === draft.id ? "Sending..." : "Send"}
                          </button>
                          <button
                            className="rounded bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                            disabled={updatingDraftId === draft.id || sendingDraftId === draft.id}
                            onClick={() => handleUpdateStatus(draft.id, "rejected")}
                          >
                            {updatingDraftId === draft.id ? "Updating..." : "Reject"}
                          </button>
                        </>
                      )}
                      {draft.status === "sent" && (
                        <>
                          <button
                            className="rounded bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                            disabled={checkingReplyDraftId === draft.id || isCheckingReplies}
                            onClick={() => handleCheckDraftReply(draft.id)}
                          >
                            {checkingReplyDraftId === draft.id ? "Checking..." : "Check Reply"}
                          </button>
                          {canGenerateFollowUp && (
                            <button
                              className="rounded bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                              disabled={generatingFollowUpDraftId === draft.id || isGeneratingFollowUps}
                              onClick={() => handleGenerateFollowUp(draft.id)}
                            >
                              {generatingFollowUpDraftId === draft.id ? "Generating..." : "Generate Follow-up"}
                            </button>
                          )}
                        </>
                      )}
                      {draft.status === "replied" && (
                        <button
                          className="rounded bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
                          disabled={classifyingReplyDraftId === draft.id || isClassifyingReplies}
                          onClick={() => handleClassifyDraftReply(draft.id, replyClassified)}
                        >
                          {classifyingReplyDraftId === draft.id
                            ? "Classifying..."
                            : replyClassified
                              ? "Reclassify"
                              : "Classify Reply"}
                        </button>
                      )}
                    </div>
                  </div>

                  {draftFollowUps.length > 0 && (
                    <div className="mt-5 border-t pt-4">
                      <h4 className="text-sm font-semibold text-gray-900">Follow-ups</h4>
                      <div className="mt-3 divide-y">
                        {draftFollowUps.map((followUp) => {
                          const isFollowUpExpanded = Boolean(expandedFollowUpIds[followUp.id]);
                          const shouldCollapseFollowUp = String(followUp.body || "").length > 180;

                          return (
                          <div key={followUp.id} className="py-4 first:pt-0 last:pb-0">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-xs font-medium text-gray-500">
                                  Follow-up #{followUp.follow_up_number}
                                </p>
                                <h5 className="mt-1 text-sm font-semibold text-gray-900">
                                  {followUp.subject}
                                </h5>
                              </div>

                              <Badge variant={followUp.status}>{followUp.status}</Badge>
                            </div>

                            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-700">
                              {isFollowUpExpanded ? followUp.body : getPreviewText(followUp.body, 180)}
                            </p>
                            {shouldCollapseFollowUp && (
                              <button
                                type="button"
                                className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700"
                                onClick={() => toggleFollowUpExpanded(followUp.id)}
                              >
                                {isFollowUpExpanded ? "Hide follow-up" : "Show full follow-up"}
                              </button>
                            )}

                            <div className="mt-3 text-xs text-gray-500">
                              <p>Generated: {formatDateTimeIST(followUp.generated_at || followUp.created_at)}</p>
                              {followUp.sent_at && (
                                <p>Sent at: {formatDateTimeIST(followUp.sent_at)}</p>
                              )}
                              {followUp.gmail_message_id && (
                                <p>Gmail message ID: {followUp.gmail_message_id}</p>
                              )}
                              {followUp.send_error && (
                                <p className="text-red-700">Send error: {followUp.send_error}</p>
                              )}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {followUp.status === "generated" && (
                                <>
                                  <button
                                    className="rounded bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
                                    disabled={updatingFollowUpId === followUp.id}
                                    onClick={() => handleUpdateFollowUpStatus(followUp.id, "approved")}
                                  >
                                    {updatingFollowUpId === followUp.id ? "Updating..." : "Approve"}
                                  </button>
                                  <button
                                    className="rounded bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                                    disabled={updatingFollowUpId === followUp.id}
                                    onClick={() => handleUpdateFollowUpStatus(followUp.id, "rejected")}
                                  >
                                    {updatingFollowUpId === followUp.id ? "Updating..." : "Reject"}
                                  </button>
                                </>
                              )}

                              {followUp.status === "approved" && (
                                <>
                                  <button
                                    className="rounded bg-slate-700 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                                    disabled={sendingFollowUpId === followUp.id || isSendingFollowUps}
                                    onClick={() => handleSendFollowUp(followUp.id)}
                                  >
                                    {sendingFollowUpId === followUp.id ? "Sending..." : "Send"}
                                  </button>
                                  <button
                                    className="rounded bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                                    disabled={updatingFollowUpId === followUp.id || sendingFollowUpId === followUp.id}
                                    onClick={() => handleUpdateFollowUpStatus(followUp.id, "rejected")}
                                  >
                                    {updatingFollowUpId === followUp.id ? "Updating..." : "Reject"}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Emails;
