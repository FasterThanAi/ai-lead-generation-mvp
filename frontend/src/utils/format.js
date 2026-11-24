import { getDateTimestampISTSafe } from "./dateUtils";

// API timestamps are UTC without an offset; dateUtils normalises them.
function parseApiDate(value) {
  const timestamp = getDateTimestampISTSafe(value);
  return timestamp ? new Date(timestamp) : null;
}

export function formatDateTime(value) {
  const date = value ? parseApiDate(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function timeAgo(value, now = Date.now()) {
  const date = value ? parseApiDate(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "—";
  }
  const seconds = Math.round((now - date.getTime()) / 1000);
  if (seconds < 45) return "just now";
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      const amount = Math.round(seconds / size);
      return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(-amount, unit);
    }
  }
  return "just now";
}

export function apiErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string" && detail) return detail;
  if (!error?.response) return "Can't reach the server. Check your connection and try again.";
  return fallback;
}
