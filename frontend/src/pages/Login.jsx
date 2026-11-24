import { useState } from "react";
import { useAuth } from "../auth/auth-context";
import Icon from "../components/ui/Icon";
import ThemeToggle from "../components/ui/ThemeToggle";
import { getFriendlyErrorMessage } from "../utils/errorMessages";

const highlights = [
  { icon: "sparkles", title: "AI research & scoring", text: "Enrich every lead and rank who to contact first." },
  { icon: "emails", title: "Human-approved outreach", text: "Nothing is sent until someone on your team approves it." },
  { icon: "shield", title: "Compliance built in", text: "Suppression list, unsubscribe links and a full audit trail." },
];

export default function Login() {
  const { config, login, register } = useAuth();
  const isSetup = Boolean(config?.needs_setup);
  const canRegister = Boolean(config?.registration_open);
  const [mode, setMode] = useState(isSetup ? "register" : "login");
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isRegister = mode === "register";

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isRegister) {
        await register({ email: form.email, password: form.password, full_name: form.full_name || null });
      } else {
        await login(form.email, form.password);
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : getFriendlyErrorMessage(err, "Sign-in failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(0,520px)]">
      <section className="relative hidden overflow-hidden bg-[#0f1222] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(600px 400px at 20% 10%, rgba(99,102,241,0.35), transparent 60%), radial-gradient(500px 400px at 90% 90%, rgba(14,165,233,0.18), transparent 60%)",
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500">
            <Icon name="target" className="h-5 w-5" strokeWidth={2} />
          </div>
          <span className="text-lg font-semibold">Lead Agent</span>
        </div>

        <div className="relative max-w-lg">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Find the right leads. Send the right message. Stay in control.
          </h2>
          <ul className="mt-10 space-y-6">
            {highlights.map((item) => (
              <li key={item.title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon name={item.icon} className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-0.5 text-sm text-white/65">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">AI lead generation and outreach workspace</p>
      </section>

      <section className="flex flex-col bg-[var(--bg-1)]">
        <div className="flex justify-end p-4">
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <form onSubmit={submit} className="w-full max-w-sm" noValidate>
            <div className="bg-accent mb-6 flex h-10 w-10 items-center justify-center rounded-lg text-white lg:hidden">
              <Icon name="target" className="h-5 w-5" strokeWidth={2} />
            </div>
            <h1 className="text-ink text-2xl font-semibold tracking-tight">
              {isSetup ? "Set up your workspace" : isRegister ? "Create your account" : "Welcome back"}
            </h1>
            <p className="text-muted mt-1.5 text-sm">
              {isSetup
                ? "Create the first account. It becomes the workspace admin."
                : isRegister
                  ? "Join your team's workspace."
                  : "Sign in to continue to Lead Agent."}
            </p>

            {error && (
              <div role="alert" className="tone-block tone-danger mt-6 flex gap-2 rounded-lg px-3 py-2.5 text-sm [--tone:var(--t-danger)]">
                <Icon name="alert" className="mt-0.5 h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-6 space-y-4">
              {isRegister && (
                <div>
                  <label className="label" htmlFor="full_name">Full name</label>
                  <input id="full_name" className="field" autoComplete="name" value={form.full_name} onChange={update("full_name")} />
                </div>
              )}
              <div>
                <label className="label" htmlFor="email">Work email</label>
                <input
                  id="email"
                  type="email"
                  className="field"
                  autoComplete="email"
                  required
                  autoFocus
                  value={form.email}
                  onChange={update("email")}
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label className="label" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  className="field"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  required
                  minLength={isRegister ? 10 : undefined}
                  value={form.password}
                  onChange={update("password")}
                />
                {isRegister && <p className="text-faint mt-1.5 text-xs">At least 10 characters.</p>}
              </div>
            </div>

            <button type="submit" className="btn btn-primary mt-6 w-full" disabled={submitting || !form.email || !form.password}>
              {submitting ? "Please wait…" : isSetup ? "Create admin account" : isRegister ? "Create account" : "Sign in"}
            </button>

            {!isSetup && canRegister && (
              <p className="text-muted mt-6 text-center text-sm">
                {isRegister ? "Already have an account?" : "New here?"}{" "}
                <button
                  type="button"
                  className="text-accent font-medium hover:underline"
                  onClick={() => {
                    setMode(isRegister ? "login" : "register");
                    setError("");
                  }}
                >
                  {isRegister ? "Sign in" : "Create an account"}
                </button>
              </p>
            )}
            {!isSetup && !canRegister && (
              <p className="text-faint mt-6 text-center text-xs">Need access? Ask a workspace admin to invite you.</p>
            )}
          </form>
        </div>
      </section>
    </div>
  );
}
