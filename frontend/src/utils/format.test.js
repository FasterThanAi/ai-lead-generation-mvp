import assert from "node:assert/strict";
import test from "node:test";
import { apiErrorMessage, formatDateTime, timeAgo } from "./format.js";

test("timeAgo treats naive API timestamps as UTC", () => {
  const now = Date.parse("2026-11-24T12:00:00Z");
  assert.equal(timeAgo("2026-11-24T11:59:50", now), "just now");
  assert.match(timeAgo("2026-11-24T10:00:00", now), /2 hours ago/);
  assert.match(timeAgo("2026-11-21T12:00:00", now), /3 days ago/);
});

test("timeAgo and formatDateTime handle missing values", () => {
  assert.equal(timeAgo(null), "—");
  assert.equal(timeAgo("not a date"), "—");
  assert.equal(formatDateTime(undefined), "—");
});

test("apiErrorMessage prefers the backend detail string", () => {
  assert.equal(apiErrorMessage({ response: { data: { detail: "Incorrect email or password." } } }), "Incorrect email or password.");
  assert.equal(apiErrorMessage({ response: { data: { detail: [{ msg: "x" }] } } }, "fallback"), "fallback");
  assert.match(apiErrorMessage({}), /Can't reach the server/);
});
