import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { m as motion } from "framer-motion";
import { useAuth } from "../auth/auth-context";
import Icon from "./ui/Icon";
import { navGroups } from "./navigation";

function Sidebar({ collapsed, mobileOpen, onCloseMobile, onToggleCollapse }) {
  const { isAdmin } = useAuth();
  const compact = collapsed && !mobileOpen;

  useEffect(() => {
    if (!mobileOpen) {
      return undefined;
    }
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onCloseMobile();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  return (
    <aside
      className={[
        "fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r transition-[width,transform] duration-300 ease-spring",
        "line-1 bg-[var(--bg-1)]",
        collapsed ? "lg:w-sidebar-sm" : "lg:w-sidebar",
        mobileOpen ? "translate-x-0 shadow-deep" : "-translate-x-full lg:translate-x-0",
      ].join(" ")}
      aria-label="Sidebar"
    >
      <div className={["flex h-14 shrink-0 items-center gap-2.5 px-4", compact ? "lg:justify-center lg:px-0" : ""].join(" ")}>
        <motion.div
          className="bg-accent relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white shadow-glow"
          whileHover={{ rotate: 90, scale: 1.08 }}
          transition={{ type: "spring", stiffness: 260, damping: 14 }}
        >
          <Icon name="target" className="h-[18px] w-[18px]" strokeWidth={2} />
        </motion.div>
        <div className={["min-w-0 flex-1", compact ? "lg:hidden" : ""].join(" ")}>
          <p className="text-ink truncate text-sm font-semibold">Lead Agent</p>
          <p className="text-faint truncate text-xs">AI outreach workspace</p>
        </div>
        <button type="button" className="btn btn-ghost h-8 w-8 p-0 lg:hidden" aria-label="Close navigation" onClick={onCloseMobile}>
          <Icon name="close" />
        </button>
      </div>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 pt-2">
        {navGroups.map((group, index) => {
          const items = group.items.filter((item) => !item.adminOnly || isAdmin);
          if (!items.length) {
            return null;
          }
          return (
            <div key={group.label || index} className="mb-5 last:mb-0">
              {group.label && (
                <p className={["text-faint mb-1 px-2.5 text-eyebrow uppercase", compact ? "lg:sr-only" : ""].join(" ")}>
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    onClick={onCloseMobile}
                    title={compact ? item.label : undefined}
                    className={({ isActive }) =>
                      ["nav-item group", isActive ? "nav-item-active !bg-transparent" : "", compact ? "lg:justify-center lg:px-0" : ""].join(" ")
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          // One shared layoutId: the pill glides between items on navigation.
                          <motion.span
                            layoutId="sidebar-active-pill"
                            aria-hidden="true"
                            className="absolute inset-0 rounded-lg bg-[var(--accent-soft)] ring-1 ring-[rgb(var(--accent-from)/0.18)]"
                            transition={{ type: "spring", stiffness: 420, damping: 34 }}
                          >
                            <span className="bg-accent absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full" />
                          </motion.span>
                        )}
                        <Icon
                          name={item.icon}
                          className={["relative h-[18px] w-[18px] transition-transform duration-300 group-hover:scale-110", isActive ? "text-accent" : ""].join(" ")}
                        />
                        <span className={["relative truncate", compact ? "lg:sr-only" : ""].join(" ")}>{item.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="line-1 hidden shrink-0 border-t p-3 lg:block">
        <button
          type="button"
          onClick={onToggleCollapse}
          className={["nav-item w-full", compact ? "justify-center px-0" : ""].join(" ")}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Icon name={collapsed ? "chevronRight" : "chevronLeft"} className="h-[18px] w-[18px]" />
          {!compact && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
