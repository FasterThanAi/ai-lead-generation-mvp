// Single source of truth for navigation, page titles and admin-only routes.
export const navGroups = [
  {
    label: null,
    items: [{ to: "/", label: "Dashboard", icon: "dashboard" }],
  },
  {
    label: "Plan",
    items: [
      { to: "/campaigns", label: "Campaigns", icon: "campaigns" },
      { to: "/opportunities", label: "Opportunities", icon: "sparkles" },
    ],
  },
  {
    label: "Prospect",
    items: [
      { to: "/discovery", label: "Lead Discovery", icon: "discovery" },
      { to: "/leads", label: "Leads", icon: "leads" },
    ],
  },
  {
    label: "Engage",
    items: [
      { to: "/emails", label: "Emails", icon: "emails" },
      { to: "/calls", label: "Calls", icon: "calls" },
      { to: "/suppression", label: "Suppression", icon: "ban" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { to: "/knowledge", label: "Knowledge", icon: "knowledge" },
      { to: "/team", label: "Team & API keys", icon: "team" },
      { to: "/activity", label: "Activity log", icon: "activity", adminOnly: true },
      { to: "/settings", label: "Settings", icon: "settings" },
    ],
  },
];

export const pageTitles = Object.fromEntries(
  navGroups.flatMap((group) => group.items.map((item) => [item.to, item.label]))
);
