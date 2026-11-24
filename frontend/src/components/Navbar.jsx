import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/auth-context";
import Icon from "./ui/Icon";
import ThemeToggle from "./ui/ThemeToggle";

function initials(user) {
  const source = user?.full_name || user?.email || "?";
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function UserMenu() {
  const { user, logout, config } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const close = (event) => {
      if (event.type === "keydown" ? event.key === "Escape" : !ref.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="btn btn-ghost h-9 gap-2 px-1.5"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="bg-accent-soft text-accent flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold">
          {initials(user)}
        </span>
        <span className="text-ink hidden max-w-[10rem] truncate text-sm font-medium md:inline">
          {user?.full_name || user?.email}
        </span>
        <Icon name="chevronDown" className="text-faint hidden h-4 w-4 md:block" />
      </button>

      {open && (
        <div role="menu" className="glass shadow-deep absolute right-0 top-11 z-50 w-64 rounded-panel p-1.5">
          <div className="px-2.5 py-2">
            <p className="text-ink truncate text-sm font-medium">{user?.full_name || "Signed in"}</p>
            <p className="text-muted truncate text-xs">{user?.email}</p>
            <span className="tone tone-info mt-2 capitalize">{user?.role}</span>
          </div>
          <div className="divider my-1" />
          <Link role="menuitem" to="/team" onClick={() => setOpen(false)} className="nav-item w-full">
            <Icon name="key" /> Team & API keys
          </Link>
          <Link role="menuitem" to="/settings" onClick={() => setOpen(false)} className="nav-item w-full">
            <Icon name="settings" /> Settings
          </Link>
          {config?.auth_enabled !== false && (
            <button role="menuitem" type="button" onClick={logout} className="nav-item w-full">
              <Icon name="logout" /> Sign out
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Navbar({ pageTitle, onMenuClick }) {
  return (
    <header className="line-1 sticky top-0 z-30 border-b bg-[var(--bg-1)]/90 backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--bg-1)_85%,transparent)]">
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost h-9 w-9 p-0 lg:hidden"
            aria-label="Open navigation"
            onClick={onMenuClick}
          >
            <Icon name="menu" className="h-5 w-5" />
          </button>
          <h1 className="text-ink truncate text-[15px] font-semibold">{pageTitle}</h1>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

export default Navbar;
