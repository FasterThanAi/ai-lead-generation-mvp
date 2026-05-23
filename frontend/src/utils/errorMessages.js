const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again.";

function getBackendDetail(err) {
  const detail = err?.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  return "";
}

export function getFriendlyErrorMessage(err, fallbackMessage = DEFAULT_ERROR_MESSAGE, context = "") {
  if (!err?.response) {
    return "Backend is not reachable. Please check server status.";
  }

  const detail = getBackendDetail(err);
  const normalizedMessage = `${context} ${detail}`.toLowerCase();

  if (
    normalizedMessage.includes("gmail readonly permission") ||
    normalizedMessage.includes("readonly permission")
  ) {
    return "Gmail readonly permission is missing. Please reconnect Gmail.";
  }

  if (
    normalizedMessage.includes("only sent drafts") ||
    normalizedMessage.includes("only sent emails")
  ) {
    if (context === "followup") {
      return "Only sent emails can receive follow-ups.";
    }

    return "Only sent emails can be checked for replies.";
  }

  if (
    normalizedMessage.includes("already replied") ||
    normalizedMessage.includes("has already replied")
  ) {
    if (normalizedMessage.includes("send follow-up")) {
      return "Cannot send follow-up because this lead has already replied.";
    }

    return "Cannot generate follow-up because this lead has already replied.";
  }

  if (normalizedMessage.includes("maximum follow-up limit")) {
    return "Maximum follow-up limit reached.";
  }

  if (context === "lead-scoring") {
    if (
      normalizedMessage.includes("gemini") ||
      normalizedMessage.includes("api key") ||
      normalizedMessage.includes("quota")
    ) {
      return "Gemini API key may be missing or quota may be exceeded.";
    }

    if (normalizedMessage.includes("no leads")) {
      return "This campaign has no leads to score.";
    }

    if (normalizedMessage.includes("no unscored leads")) {
      return "No unscored leads found.";
    }

    if (normalizedMessage.includes("some failures")) {
      return "Lead scoring completed with some failures.";
    }

    return "AI lead scoring failed. Please try again.";
  }

  if (context === "classification") {
    if (normalizedMessage.includes("only replied drafts")) {
      return "Only replied drafts can be classified.";
    }

    if (normalizedMessage.includes("no reply text")) {
      return "No reply text is available for classification.";
    }

    if (
      normalizedMessage.includes("gemini") ||
      normalizedMessage.includes("api key") ||
      normalizedMessage.includes("quota")
    ) {
      return "Reply classification used a fallback or could not complete. Please try again.";
    }

    return "Reply classification failed. Please try again.";
  }

  if (context === "response") {
    if (normalizedMessage.includes("only replied emails")) {
      return "Only replied emails can have response drafts.";
    }

    if (normalizedMessage.includes("classify the reply")) {
      return "Please classify the reply before generating a response.";
    }

    if (normalizedMessage.includes("approve the response")) {
      return "Approve the response draft before sending.";
    }

    if (
      normalizedMessage.includes("gmail") &&
      (
        normalizedMessage.includes("not connected") ||
        normalizedMessage.includes("connect gmail") ||
        normalizedMessage.includes("no gmail")
      )
    ) {
      return "Gmail is not connected. Please connect Gmail in Settings.";
    }

    if (normalizedMessage.includes("send")) {
      return "Response sending failed. Please try again.";
    }

    return "Response draft generation failed. Please try again.";
  }

  if (
    normalizedMessage.includes("approve the follow-up") ||
    normalizedMessage.includes("before sending")
  ) {
    return "Approve the follow-up before sending.";
  }

  if (
    normalizedMessage.includes("gemini") ||
    normalizedMessage.includes("ai generation") ||
    (context === "ai" && err.response.status >= 500)
  ) {
    return "AI generation failed. Please check Gemini API key or try again.";
  }

  if (
    normalizedMessage.includes("gmail") &&
    (
      normalizedMessage.includes("not connected") ||
      normalizedMessage.includes("connect gmail") ||
      normalizedMessage.includes("no gmail")
    )
  ) {
    return "Gmail is not connected. Please connect Gmail in Settings.";
  }

  if (
    normalizedMessage.includes("lead email is missing") ||
    normalizedMessage.includes("lead email") ||
    normalizedMessage.includes("missing email")
  ) {
    return "This lead does not have an email address.";
  }

  if (context === "reply") {
    return "Reply check failed. Please try again.";
  }

  if (context === "followup" && normalizedMessage.includes("send")) {
    return "Follow-up sending failed. Please try again.";
  }

  return fallbackMessage || DEFAULT_ERROR_MESSAGE;
}
