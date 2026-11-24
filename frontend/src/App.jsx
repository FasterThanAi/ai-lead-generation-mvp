import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import AuthProvider from "./auth/AuthProvider";
import { useAuth } from "./auth/auth-context";
import ErrorBoundary from "./components/ErrorBoundary";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import { pageTitles } from "./components/navigation";
import Skeleton from "./components/ui/Skeleton";
import ThemeProvider from "./theme/ThemeProvider";

// Each page is its own chunk: the first load only ships the shell and the page you open.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const Opportunities = lazy(() => import("./pages/Opportunities"));
const LeadDiscovery = lazy(() => import("./pages/LeadDiscovery"));
const Leads = lazy(() => import("./pages/Leads"));
const Calls = lazy(() => import("./pages/Calls"));
const Emails = lazy(() => import("./pages/Emails"));
const Knowledge = lazy(() => import("./pages/Knowledge"));
const Settings = lazy(() => import("./pages/Settings"));
const Suppression = lazy(() => import("./pages/Suppression"));
const Team = lazy(() => import("./pages/Team"));
const Activity = lazy(() => import("./pages/Activity"));
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));

function PageFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-8 w-56 rounded-lg" />
      <Skeleton className="h-4 w-96 max-w-full rounded" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-28 rounded-panel" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-panel" />
    </div>
  );
}

function FullScreenMessage({ title, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="glass w-full max-w-md rounded-panel p-8 text-center">
        <h1 className="text-ink text-lg font-semibold">{title}</h1>
        <div className="text-muted mt-2 text-sm">{children}</div>
      </div>
    </div>
  );
}

function AppShell() {
  const location = useLocation();
  const { isAdmin } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem("leadagent-sidebar") === "collapsed";
    } catch {
      return false;
    }
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const pageTitle = useMemo(() => {
    const path = location.pathname.replace(/\/$/, "") || "/";
    return pageTitles[path] || "Page not found";
  }, [location.pathname]);

  useEffect(() => {
    document.title = `${pageTitle} · Lead Agent`;
  }, [pageTitle]);

  useEffect(() => {
    try {
      window.localStorage.setItem("leadagent-sidebar", isSidebarCollapsed ? "collapsed" : "expanded");
    } catch {
      // non-essential preference
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    document.body.style.overflow = isMobileSidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileSidebarOpen]);

  return (
    <div className="min-h-screen overflow-x-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--accent-solid)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      {isMobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <Sidebar
        collapsed={isSidebarCollapsed}
        mobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onToggleCollapse={() => setIsSidebarCollapsed((value) => !value)}
      />

      <div
        className={[
          "flex min-h-screen min-w-0 flex-col transition-[padding] duration-300 ease-spring",
          isSidebarCollapsed ? "lg:pl-sidebar-sm" : "lg:pl-sidebar",
        ].join(" ")}
      >
        <Navbar pageTitle={pageTitle} onMenuClick={() => setIsMobileSidebarOpen(true)} />

        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full min-w-0 max-w-[1440px]">
            <ErrorBoundary resetKey={location.pathname}>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/campaigns" element={<Campaigns />} />
                  <Route path="/opportunities" element={<Opportunities />} />
                  <Route path="/discovery" element={<LeadDiscovery />} />
                  <Route path="/leads" element={<Leads />} />
                  <Route path="/calls" element={<Calls />} />
                  <Route path="/emails" element={<Emails />} />
                  <Route path="/suppression" element={<Suppression />} />
                  <Route path="/knowledge" element={<Knowledge />} />
                  <Route path="/team" element={<Team />} />
                  <Route path="/activity" element={isAdmin ? <Activity /> : <Navigate to="/" replace />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/login" element={<Navigate to="/" replace />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}

function AuthGate() {
  const { status, retry } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center" aria-busy="true">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--line-2)] border-t-[var(--accent-solid)]" />
      </div>
    );
  }

  if (status === "offline") {
    return (
      <FullScreenMessage title="Can't reach the server">
        <p>The API is not responding. On the free hosting tier it can take up to a minute to wake up.</p>
        <button type="button" className="btn btn-primary mt-5 px-4" onClick={retry}>
          Try again
        </button>
      </FullScreenMessage>
    );
  }

  if (status !== "authenticated") {
    return (
      <Suspense fallback={null}>
        <Login />
      </Suspense>
    );
  }

  return <AppShell />;
}

function App() {
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <AuthProvider>
            <AuthGate />
          </AuthProvider>
        </BrowserRouter>
      </MotionConfig>
    </ThemeProvider>
  );
}

export default App;
