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
    return "Only sent emails can be checked for replies.";
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

  return fallbackMessage || DEFAULT_ERROR_MESSAGE;
}
