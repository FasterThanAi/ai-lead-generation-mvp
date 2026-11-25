import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, m as motion } from "framer-motion";
import { useAuth } from "../auth/auth-context";
import useDebouncedValue from "../hooks/useDebouncedValue";
import api from "../services/api";
import { useTheme } from "../theme/useTheme";
import { OPEN_PALETTE_EVENT } from "./commandPaletteEvents";
import { navGroups } from "./navigation";
import Icon from "./ui/Icon";

function normalise(value) {
  return String(value || "").toLowerCase();
}

export default function CommandPalette() {
  const navigate = useNavigate();
  const { isAdmin, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [leadResults, setLeadResults] = useState([]);
  const inputRef = useRef(null);
  const debounced = useDebouncedValue(query, 220);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  // Live lead search once the user has typed something meaningful.
  useEffect(() => {
    if (!open || debounced.trim().length < 2) return undefined;
    let cancelled = false;
    api
      .get("/leads/search", { params: { q: debounced.trim(), page_size: 6 } })
      .then(({ data }) => !cancelled && setLeadResults(data.data || []))
      .catch(() => !cancelled && setLeadResults([]));
    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setLeadResults([]);
    setActive(0);
  };

  const items = useMemo(() => {
    const pages = navGroups
      .flatMap((group) => group.items)
      .filter((item) => !item.adminOnly || isAdmin)
      .map((item) => ({
        id: `page:${item.to}`,
        group: "Go to",
        label: item.label,
        icon: item.icon,
        run: () => navigate(item.to),
      }));
    const actions = [
      { id: "act:campaign", group: "Actions", label: "Create a campaign", icon: "plus", run: () => navigate("/campaigns") },
      { id: "act:import", group: "Actions", label: "Import leads from CSV", icon: "upload", run: () => navigate("/leads") },
      { id: "act:suppress", group: "Actions", label: "Add to suppression list", icon: "ban", run: () => navigate("/suppression") },
      { id: "act:key", group: "Actions", label: "Create an API key", icon: "key", run: () => navigate("/team") },
      { id: "act:theme", group: "Actions", label: isDark ? "Switch to light mode" : "Switch to dark mode", icon: isDark ? "sun" : "moon", run: toggleTheme },
      { id: "act:logout", group: "Actions", label: "Sign out", icon: "logout", run: logout },
    ];
    const needle = normalise(query.trim());
    const filtered = [...pages, ...actions].filter((item) => !needle || normalise(item.label).includes(needle));
    const leads = needle.length >= 2
      ? leadResults.map((lead) => ({
          id: `lead:${lead.id}`,
          group: "Leads",
          label: lead.company_name,
          hint: lead.email || lead.website || lead.location || "",
          icon: "leads",
          run: () => navigate(`/leads?campaign_id=${lead.campaign_id}`),
        }))
      : [];
    return [...leads, ...filtered];
  }, [query, leadResults, isAdmin, isDark, navigate, toggleTheme, logout]);

  const activeIndex = Math.min(active, Math.max(items.length - 1, 0));

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((activeIndex + 1) % Math.max(items.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((activeIndex - 1 + items.length) % Math.max(items.length, 1));
    } else if (event.key === "Enter" && items[activeIndex]) {
      event.preventDefault();
      items[activeIndex].run();
      close();
    }
  };

  let lastGroup = null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button type="button" aria-label="Close command palette" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="glow-border relative w-full max-w-xl shadow-deep"
            initial={{ opacity: 0, scale: 0.94, y: -12, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.97, y: -6, filter: "blur(4px)" }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            <div className="overflow-hidden rounded-[calc(var(--radius-card)-1px)] bg-[var(--bg-1)]">
              <div className="line-1 flex items-center gap-3 border-b px-4">
                <Icon name="search" className="text-faint h-[18px] w-[18px]" />
                <input
                  ref={inputRef}
                  autoFocus
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onKeyDown}
                  placeholder="Search leads, jump to a page, run an action…"
                  aria-label="Command"
                  className="text-ink h-14 flex-1 bg-transparent text-[15px] outline-none focus-visible:outline-none"
                />
                <span className="kbd">esc</span>
              </div>
              <ul className="max-h-[min(60vh,420px)] overflow-y-auto p-2" role="listbox">
                {items.length === 0 && (
                  <li className="text-muted px-3 py-8 text-center text-sm">No results for “{query}”</li>
                )}
                {items.map((item, index) => {
                  const showGroup = item.group !== lastGroup;
                  lastGroup = item.group;
                  const isActive = index === activeIndex;
                  return (
                    <li key={item.id}>
                      {showGroup && <p className="text-faint px-3 pb-1 pt-3 text-eyebrow uppercase">{item.group}</p>}
                      <motion.button
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onMouseMove={() => setActive(index)}
                        onClick={() => {
                          item.run();
                          close();
                        }}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(index, 10) * 0.015, duration: 0.25 }}
                        className="relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm"
                      >
                        {isActive && (
                          <motion.span
                            layoutId="palette-active"
                            className="absolute inset-0 rounded-lg bg-[var(--accent-soft)]"
                            transition={{ type: "spring", stiffness: 500, damping: 38 }}
                          />
                        )}
                        <Icon name={item.icon} className={["relative h-4 w-4", isActive ? "text-accent" : "text-faint"].join(" ")} />
                        <span className="text-ink relative truncate">{item.label}</span>
                        {item.hint && <span className="text-faint relative ml-auto truncate text-xs">{item.hint}</span>}
                        {isActive && !item.hint && <Icon name="chevronRight" className="text-faint relative ml-auto h-4 w-4" />}
                      </motion.button>
                    </li>
                  );
                })}
              </ul>
              <div className="line-1 text-faint flex items-center gap-4 border-t px-4 py-2 text-xs">
                <span><span className="kbd">↑</span> <span className="kbd">↓</span> navigate</span>
                <span><span className="kbd">↵</span> open</span>
                <span className="ml-auto"><span className="kbd">⌘</span> <span className="kbd">K</span> toggle</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
