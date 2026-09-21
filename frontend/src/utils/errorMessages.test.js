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
