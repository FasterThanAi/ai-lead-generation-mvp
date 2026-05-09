import { useEffect, useState } from "react";
import api from "../services/api";

function getErrorMessage(err, fallbackMessage) {
  const detail = err.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  return fallbackMessage;
}

function Settings() {
  const [gmailStatus, setGmailStatus] = useState({
    connected: false,
    email: "",
  });
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusError, setStatusError] = useState("");

  const fetchGmailStatus = async () => {
    setIsLoadingStatus(true);
    setStatusError("");

    try {
      const res = await api.get("/gmail/status");
      setGmailStatus({
        connected: Boolean(res.data.connected),
        email: res.data.email || "",
      });
    } catch (err) {
      setStatusError(getErrorMessage(err, "Could not load Gmail connection status."));
      console.error(err);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadGmailStatus = async () => {
      try {
        const res = await api.get("/gmail/status");

        if (!isMounted) {
          return;
        }

        setGmailStatus({
          connected: Boolean(res.data.connected),
          email: res.data.email || "",
        });
      } catch (err) {
        if (isMounted) {
          setStatusError(getErrorMessage(err, "Could not load Gmail connection status."));
        }
        console.error(err);
      } finally {
        if (isMounted) {
          setIsLoadingStatus(false);
        }
      }
    };

    loadGmailStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleConnectGmail = async () => {
    setIsConnecting(true);
    setStatusMessage("");
    setStatusError("");

    try {
      const res = await api.get("/gmail/oauth/start");
      const authUrl = res.data.auth_url;

      if (!authUrl) {
        throw new Error("Missing Gmail authorization URL.");
      }

      window.open(authUrl, "_blank", "noopener,noreferrer");
      setStatusMessage("Complete Gmail authorization in the new tab, then refresh the status here.");
    } catch (err) {
      setStatusError(getErrorMessage(err, "Could not start Gmail connection."));
      console.error(err);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow border">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold">Gmail Connection</h3>
              <p className="mt-2 text-sm text-gray-500">
                Emails will only be sent for approved drafts.
              </p>
            </div>

            <button
              className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
              disabled={isLoadingStatus}
              onClick={fetchGmailStatus}
            >
              Refresh Status
            </button>
          </div>

          <div className="mt-5 rounded-lg border bg-gray-50 p-4">
            {isLoadingStatus ? (
              <p className="text-sm text-gray-600">Checking Gmail connection...</p>
            ) : gmailStatus.connected ? (
              <div>
                <p className="text-sm font-medium text-green-700">Gmail connected</p>
                <p className="mt-1 text-sm text-gray-600">
                  {gmailStatus.email ? `Connected as ${gmailStatus.email}` : "Connected Gmail account is ready."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">Gmail is not connected</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Connect Gmail before sending approved email drafts.
                  </p>
                </div>

                <button
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                  disabled={isConnecting}
                  onClick={handleConnectGmail}
                >
                  {isConnecting ? "Opening Gmail..." : "Connect Gmail"}
                </button>
              </div>
            )}
          </div>

          {statusMessage && (
            <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
              {statusMessage}
            </p>
          )}

          {statusError && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {statusError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Settings;
