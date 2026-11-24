import { useCallback, useEffect, useMemo, useState } from "react";
import api, { getStoredToken, setStoredToken, UNAUTHORIZED_EVENT } from "../services/api";
import { AuthContext } from "./auth-context";

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | authenticated | anonymous | offline

  const loadSession = useCallback(async () => {
    try {
      const { data: authConfig } = await api.get("/auth/config");
      setConfig(authConfig);

      if (!authConfig.auth_enabled || getStoredToken()) {
        const { data } = await api.get("/auth/me");
        setUser(data.user);
        setStatus("authenticated");
        return;
      }
      setStatus("anonymous");
    } catch (error) {
      if (error?.response?.status === 401) {
        setUser(null);
        setStatus("anonymous");
      } else if (!error?.response) {
        setStatus("offline");
      } else {
        setStatus("anonymous");
      }
    }
  }, []);

  useEffect(() => {
    // Initial session bootstrap is an async subscription to the API, not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setStatus("anonymous");
    };
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  const acceptSession = useCallback((data) => {
    setStoredToken(data.access_token);
    setUser(data.user);
    setConfig((current) => (current ? { ...current, needs_setup: false, registration_open: false } : current));
    setStatus("authenticated");
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    acceptSession(data);
    return data.user;
  }, [acceptSession]);

  const register = useCallback(async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    acceptSession(data);
    return data.user;
  }, [acceptSession]);

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo(
    () => ({
      user,
      config,
      status,
      isAdmin: user?.role === "admin",
      login,
      register,
      logout,
      retry: loadSession,
    }),
    [user, config, status, login, register, logout, loadSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
