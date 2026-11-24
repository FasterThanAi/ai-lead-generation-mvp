import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/auth-context";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import Icon from "../components/ui/Icon";
import PageHeader from "../components/ui/PageHeader";
import Skeleton from "../components/ui/Skeleton";
import Toast from "../components/ui/Toast";
import api from "../services/api";
import { apiErrorMessage, formatDateTime, timeAgo } from "../utils/format";

function SectionTitle({ title, description, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-ink text-base font-semibold">{title}</h2>
        {description && <p className="text-muted mt-0.5 text-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function ApiKeys() {
  const [keys, setKeys] = useState(null);
  const [name, setName] = useState("");
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/api-keys");
      setKeys(data.data);
    } catch (err) {
      setError(apiErrorMessage(err));
      setKeys([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const create = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/auth/api-keys", { name });
      setCreated(data.api_key);
      setCopied(false);
      setName("");
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (key) => {
    if (!window.confirm(`Revoke "${key.name}"? Anything using this key will stop working immediately.`)) return;
    try {
      await api.delete(`/auth/api-keys/${key.id}`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(created);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card>
      <SectionTitle
        title="API keys"
        description="For automations such as n8n. Send the key in the X-API-Key header. Keys act with your permissions."
      />
      {error && <Toast tone="danger" className="mb-4" onClose={() => setError("")}>{error}</Toast>}

      {created && (
        <div className="tone-block tone-success mb-4 rounded-lg p-4 [--tone:var(--t-success)]">
          <p className="text-sm font-medium">Copy your new key now. It won't be shown again.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="well text-ink break-anywhere flex-1 px-3 py-2 font-mono text-xs">{created}</code>
            <Button variant="secondary" size="sm" onClick={copy}>
              <Icon name={copied ? "check" : "copy"} /> {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={create} className="mb-5 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="key-name" className="sr-only">Key name</label>
        <input
          id="key-name"
          className="field sm:max-w-xs"
          placeholder="Key name, e.g. n8n production"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button type="submit" loading={busy} disabled={!name.trim()}>
          <Icon name="plus" /> Create key
        </Button>
      </form>

      {keys === null ? (
        <Skeleton className="h-24 w-full rounded-lg" />
      ) : keys.length === 0 ? (
        <p className="text-muted text-sm">No API keys yet.</p>
      ) : (
        <ul className="line-1 divide-line divide-y rounded-lg border">
          {keys.map((key) => (
            <li key={key.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-ink text-sm font-medium">{key.name}</p>
                <p className="text-faint mt-0.5 font-mono text-xs">{key.prefix}…</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-muted text-xs">
                  {key.revoked_at ? `Revoked ${timeAgo(key.revoked_at)}` : key.last_used_at ? `Used ${timeAgo(key.last_used_at)}` : "Never used"}
                </span>
                {key.revoked_at ? (
                  <span className="tone tone-neutral">Revoked</span>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => revoke(key)}>Revoke</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Members() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [form, setForm] = useState({ email: "", full_name: "", password: "", role: "member" });
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/users");
      setUsers(data.data);
    } catch (err) {
      setMessage({ tone: "danger", text: apiErrorMessage(err) });
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const invite = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/users", { ...form, full_name: form.full_name || null });
      setMessage({ tone: "success", text: `${form.email} can now sign in with the password you set.` });
      setForm({ email: "", full_name: "", password: "", role: "member" });
      setShowForm(false);
      load();
    } catch (err) {
      setMessage({ tone: "danger", text: apiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const updateUser = async (user, changes) => {
    try {
      await api.patch(`/auth/users/${user.id}`, changes);
      load();
    } catch (err) {
      setMessage({ tone: "danger", text: apiErrorMessage(err) });
    }
  };

  return (
    <Card>
      <SectionTitle
        title="Members"
        description="People who can sign in to this workspace."
        action={
          <Button variant={showForm ? "secondary" : "primary"} size="sm" onClick={() => setShowForm((value) => !value)}>
            {showForm ? "Cancel" : <><Icon name="plus" /> Add member</>}
          </Button>
        }
      />
      {message && <Toast tone={message.tone} className="mb-4" onClose={() => setMessage(null)}>{message.text}</Toast>}

      {showForm && (
        <form onSubmit={invite} className="well mb-5 grid gap-3 p-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="m-email">Email</label>
            <input id="m-email" type="email" required className="field" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="m-name">Full name</label>
            <input id="m-name" className="field" value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="m-pass">Temporary password</label>
            <input id="m-pass" type="password" minLength={10} required className="field" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="m-role">Role</label>
            <select id="m-role" className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" loading={busy}>Add member</Button>
          </div>
        </form>
      )}

      {users === null ? (
        <Skeleton className="h-32 w-full rounded-lg" />
      ) : users.length === 0 ? (
        <EmptyState title="No members" />
      ) : (
        <div className="line-1 scroll-x rounded-lg border">
          <table className="min-w-full text-left text-sm">
            <thead className="t-head">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Last sign-in</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {users.map((user) => {
                const isMe = user.id === me?.id;
                return (
                  <tr key={user.id} className="t-row">
                    <td className="px-4 py-3">
                      <p className="text-ink font-medium">{user.full_name || "—"} {isMe && <span className="text-faint text-xs">(you)</span>}</p>
                      <p className="text-muted text-xs">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        aria-label={`Role for ${user.email}`}
                        className="field min-h-8 w-28 py-1 text-xs"
                        value={user.role}
                        disabled={isMe}
                        onChange={(e) => updateUser(user, { role: e.target.value })}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="text-muted px-4 py-3" title={formatDateTime(user.last_login_at)}>
                      {user.last_login_at ? timeAgo(user.last_login_at) : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={["tone", user.is_active ? "tone-success" : "tone-neutral"].join(" ")}>
                        {user.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isMe && (
                        <Button variant="ghost" size="sm" onClick={() => updateUser(user, { is_active: !user.is_active })}>
                          {user.is_active ? "Disable" : "Enable"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ChangePassword() {
  const [form, setForm] = useState({ current_password: "", new_password: "" });
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/change-password", form);
      setMessage({ tone: "success", text: "Password updated." });
      setForm({ current_password: "", new_password: "" });
    } catch (err) {
      setMessage({ tone: "danger", text: apiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <SectionTitle title="Your password" />
      {message && <Toast tone={message.tone} className="mb-4" onClose={() => setMessage(null)}>{message.text}</Toast>}
      <form onSubmit={submit} className="grid max-w-xl gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="cur-pass">Current password</label>
          <input id="cur-pass" type="password" autoComplete="current-password" className="field" value={form.current_password}
            onChange={(e) => setForm({ ...form, current_password: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="new-pass">New password</label>
          <input id="new-pass" type="password" autoComplete="new-password" minLength={10} className="field" value={form.new_password}
            onChange={(e) => setForm({ ...form, new_password: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" variant="secondary" loading={busy}
            disabled={!form.current_password || form.new_password.length < 10}>
            Update password
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function Team() {
  const { isAdmin, user } = useAuth();
  const isLocalDev = user?.id == null;

  return (
    <div className="space-y-6">
      <PageHeader title="Team & API keys" description="Manage who can access the workspace and how automations connect to it." />
      {isLocalDev ? (
        <Card>
          <p className="text-muted text-sm">
            Authentication is disabled on this server (AUTH_ENABLED=false), so there are no accounts or keys to manage.
          </p>
        </Card>
      ) : (
        <>
          {isAdmin && <Members />}
          <ApiKeys />
          <ChangePassword />
        </>
      )}
    </div>
  );
}
