import { useState } from "react";
import { m as motion } from "framer-motion";
import ParticleField from "../components/ParticleField";
import { Magnetic, SplitText, TiltCard } from "../motion/primitives";
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
      <section className="relative hidden overflow-hidden bg-[#0a0a0b] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden="true" className="aurora aurora-dark">
          <span />
          <span />
          <span />
        </div>
        <div aria-hidden="true" className="bg-grid-dark absolute inset-0" />
        <ParticleField className="absolute inset-0" />
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#0a0a0b]">
            <Icon name="target" className="h-5 w-5" strokeWidth={2} />
          </div>
          <span className="text-lg font-semibold">Lead Agent</span>
        </div>

        <div className="relative max-w-lg">
          <motion.p
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="live-dot text-[#3dd68c]" /> AI agents online
          </motion.p>
          <SplitText
            text="Find the right leads. Send the right message. Stay in control."
            className="text-5xl font-semibold leading-[1.08] tracking-tight"
            delay={0.15}
          />
          <p className="mt-4 text-lg">
            <span className="font-medium text-white/70">Research, score and reach out with AI, on autopilot.</span>
          </p>
          <ul className="mt-10 space-y-6">
            {highlights.map((item, index) => (
              <motion.li
                key={item.title}
                className="flex gap-4"
                initial={{ opacity: 0, x: -24, filter: "blur(6px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.7, delay: 0.7 + index * 0.12, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/10">
                  <Icon name={item.icon} className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-0.5 text-sm text-white/65">{item.text}</p>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">AI lead generation and outreach workspace</p>
      </section>

      <section className="flex flex-col bg-[var(--bg-1)]">
        <div className="flex justify-end p-4">
          <ThemeToggle />
        </div>
        <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6 pb-16">
          <div aria-hidden="true" className="bg-grid absolute inset-0 opacity-60" />
          <motion.div
            className="relative w-full max-w-md"
            initial={{ opacity: 0, y: 30, scale: 0.96, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          >
          <div className="glow-border">
          <TiltCard className="rounded-[calc(var(--radius-card)-1px)] bg-[var(--bg-1)] p-8" max={4}>
          <form onSubmit={submit} className="w-full" noValidate>
            <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary-bg)] text-[var(--primary-fg)] lg:hidden">
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

            <Magnetic className="mt-6 w-full" strength={0.12}>
              <button type="submit" className="btn btn-primary w-full" disabled={submitting || !form.email || !form.password}>
                {submitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                {submitting ? "Please wait…" : isSetup ? "Create admin account" : isRegister ? "Create account" : "Sign in"}
                {!submitting && <Icon name="chevronRight" />}
              </button>
            </Magnetic>

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
          </TiltCard>
          </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
