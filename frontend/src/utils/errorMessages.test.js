import assert from "node:assert/strict";
import test from "node:test";

import { getFriendlyErrorMessage } from "./errorMessages.js";

function backendError(status, detail) {
  return { response: { status, data: { detail } } };
}

test("preserves the Gmail daily limit detail and explains when to retry", () => {
  const error = backendError(429, "Gmail daily limit reached (20 emails).");

  assert.equal(
    getFriendlyErrorMessage(error, "Response sending failed. Please try again.", "response"),
    "Gmail daily limit reached (20 emails). Please try again tomorrow.",
  );
});

test("uses a generic rate-limit message for other 429 responses", () => {
  assert.equal(
    getFriendlyErrorMessage(backendError(429, "Temporary quota exceeded.")),
    "Too many requests. Please wait a moment and try again.",
  );
});

test("uses a timeout message for Axios timeout errors", () => {
  assert.equal(
    getFriendlyErrorMessage({ code: "ECONNABORTED" }),
    "The request timed out.",
  );
  assert.equal(
    getFriendlyErrorMessage({ code: "ETIMEDOUT" }),
    "The request timed out.",
  );
});
test("reports an unreachable backend when there is no response at all", () => {
  assert.equal(
    getFriendlyErrorMessage(new Error("socket hang up")),
    "Backend is not reachable. Please check server status.",
  );
});

test("tells the user Gmail is not connected", () => {
  assert.equal(
    getFriendlyErrorMessage(backendError(500, "Gmail is not connected")),
    "Gmail is not connected. Please connect Gmail in Settings.",
  );
});

test("flags a Gemini quota error in the lead-scoring context", () => {
  assert.equal(
    getFriendlyErrorMessage(backendError(500, "Gemini quota exceeded"), "Lead scoring failed.", "lead-scoring"),
    "Gemini API key may be missing or quota may be exceeded.",
  );
});

test("describes the upload size limit", () => {
  assert.equal(
    getFriendlyErrorMessage(backendError(400, "File too large, max size is 5 MB")),
    "File is too large. Max size is 5 MB.",
  );
});

test("falls back to the supplied or default message for unknown errors", () => {
  assert.equal(
    getFriendlyErrorMessage(backendError(500, "An unusual failure.")),
    "Something went wrong. Please try again.",
  );
  assert.equal(
    getFriendlyErrorMessage(backendError(500, "An unusual failure."), "Could not load campaigns."),
    "Could not load campaigns.",
  );
});
