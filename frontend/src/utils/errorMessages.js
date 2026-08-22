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
    return "SpecForge backend is not reachable. Please check server connection.";
  }

  const detail = getBackendDetail(err);
  const normalizedMessage = `${context} ${detail}`.toLowerCase();

  if (
    normalizedMessage.includes("gemini") ||
    normalizedMessage.includes("api key") ||
    normalizedMessage.includes("quota")
  ) {
    return "Gemini API key may be missing or quota exceeded.";
  }

  if (
    normalizedMessage.includes("unsupported file type") ||
    normalizedMessage.includes("allowed extensions")
  ) {
    return "Unsupported file type. Please upload CSV, XLSX, PDF, PNG, JPG, or DOCX.";
  }

  if (
    normalizedMessage.includes("too large") ||
    normalizedMessage.includes("max size")
  ) {
    return "File exceeds maximum upload size limit.";
  }

  if (normalizedMessage.includes("no readable text")) {
    return "Document uploaded but no extractable text was found.";
  }

  if (normalizedMessage.includes("extraction failed")) {
    return "Specification extraction failed on this document.";
  }

  if (normalizedMessage.includes("unauthorized") || normalizedMessage.includes("x-api-key")) {
    return "Unauthorized. A valid X-API-Key is required for mutating actions.";
  }

  return detail || fallbackMessage || DEFAULT_ERROR_MESSAGE;
}
