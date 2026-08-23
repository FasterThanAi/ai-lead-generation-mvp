import axios from "axios";

let rawUrl = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");

// Normalize URL: ensure it always points to the /api endpoint
if (rawUrl && !rawUrl.endsWith("/api")) {
  rawUrl = `${rawUrl}/api`;
}

const API_BASE_URL = rawUrl || "http://localhost:8000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;