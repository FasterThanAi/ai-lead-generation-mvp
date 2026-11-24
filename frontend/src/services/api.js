import axios from "axios";

// Falls back to same-origin /api so the Docker/nginx build works without a build-time URL.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
export const TOKEN_STORAGE_KEY = "leadagent-token";
export const UNAUTHORIZED_EVENT = "leadagent:unauthorized";

export function getStoredToken() {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token) {
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // storage blocked — the session still works until reload
  }
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || "";
    // A 401 anywhere except the sign-in call itself means the session is gone.
    if (status === 401 && !url.includes("/auth/login")) {
      setStoredToken(null);
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    return Promise.reject(error);
  }
);

/** Download an authenticated file (e.g. CSV export) without exposing the token in a URL. */
export async function downloadFile(path, fallbackName = "download") {
  const response = await api.get(path, { responseType: "blob" });
  const disposition = response.headers?.["content-disposition"] || "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const filename = match ? match[1] : fallbackName;
  const url = window.URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export default api;
