import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "Dashboard", icon: "M4 5.5A1.5 1.5 0 0 1 5.5 4h3A1.5 1.5 0 0 1 10 5.5v3A1.5 1.5 0 0 1 8.5 10h-3A1.5 1.5 0 0 1 4 8.5v-3Zm10 0A1.5 1.5 0 0 1 15.5 4h3A1.5 1.5 0 0 1 20 5.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 14 8.5v-3ZM4 15.5A1.5 1.5 0 0 1 5.5 14h3a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3Zm10 0a1.5 1.5 0 0 1 1.5-1.5h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 1-1.5-1.5v-3Z" },
  { to: "/campaigns", label: "Campaigns", icon: "M5 5.5A2.5 2.5 0 0 1 7.5 3h9A2.5 2.5 0 0 1 19 5.5v13A2.5 2.5 0 0 1 16.5 21h-9A2.5 2.5 0 0 1 5 18.5v-13ZM8 7h8M8 11h8M8 15h5" },
  { to: "/opportunities", label: "Opportunities", icon: "M12 3l1.6 5h5.2l-4.2 3 1.6 5-4.2-3-4.2 3 1.6-5-4.2-3h5.2L12 3Zm-6 16h12" },
  { to: "/discovery", label: "Lead Discovery", icon: "M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7A2.5 2.5 0 0 1 17.5 15H13l-4 5v-5H6.5A2.5 2.5 0 0 1 4 12.5v-7Zm4 2.5h8M8 11h5" },
  { to: "/leads", label: "Leads", icon: "M16 11a4 4 0 1 0-8 0m8 0a4 4 0 1 1-8 0m8 0v1a4 4 0 0 1-8 0v-1m-3 9a7 7 0 0 1 14 0" },
  { to: "/emails", label: "Emails", icon: "M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Zm2-.5 6 5 6-5" },
  { to: "/knowledge", label: "Knowledge", icon: "M5 5.5A2.5 2.5 0 0 1 7.5 3H20v15.5A2.5 2.5 0 0 1 17.5 21h-10A2.5 2.5 0 0 1 5 18.5v-13Zm0 0A2.5 2.5 0 0 1 7.5 8H20M9 12h7M9 15h5" },
  { to: "/settings", label: "Settings", icon: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.5 3.5a8.4 8.4 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a8.8 8.8 0 0 0-2-1.2L16.2 3h-4.4l-.4 2.3a8.8 8.8 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5A8.4 8.4 0 0 0 7 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a8.8 8.8 0 0 0 2 1.2l.4 2.3h4.4l.4-2.3a8.8 8.8 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" },
];

function Icon({ path }) {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      <path d={path} />
    </svg>
  );
}

function Sidebar({ collapsed, mobileOpen, onCloseMobile, onToggleCollapse }) {
  const showLabels = !collapsed || mobileOpen;

  return (
    <aside
      className={[
        "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/70 bg-white/80 shadow-xl shadow-slate-200/60 backdrop-blur-xl transition-all duration-300",
        collapsed ? "lg:w-[88px]" : "lg:w-[264px]",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        "w-[284px]",
      ].join(" ")}
    >
      <div className="flex h-20 items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white shadow-sm">
            LA
          </div>
          {showLabels && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">Lead Agent</p>
              <p className="truncate text-xs text-slate-500">Outreach MVP</p>
            </div>
          )}
        </div>

        <button
          type="button"
          className="hidden h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 lg:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggleCollapse}
        >
          <span className="text-lg leading-none">{collapsed ? "\u203a" : "\u2039"}</span>
        </button>

        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="Close navigation"
          onClick={onCloseMobile}
        >
          &times;
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={onCloseMobile}
            className={({ isActive }) => [
              "group flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition",
              collapsed ? "lg:justify-center" : "",
              isActive
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-600 hover:bg-white hover:text-slate-950",
            ].join(" ")}
            title={collapsed ? item.label : undefined}
          >
            <Icon path={item.icon} />
            {showLabels && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="p-4">
        <div className={["rounded-3xl border border-slate-200 bg-white/70 p-4", collapsed ? "lg:p-2" : ""].join(" ")}>
          <div className="h-2 rounded-full bg-gradient-to-r from-emerald-400 via-blue-500 to-indigo-500" />
          {showLabels && (
            <>
              <p className="mt-3 text-xs font-semibold text-slate-900">Manual control</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Emails and follow-ups send only after approval.
              </p>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
