import { useMemo, useState } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Campaigns from "./pages/Campaigns";
import Opportunities from "./pages/Opportunities";
import Leads from "./pages/Leads";
import Emails from "./pages/Emails";
import Knowledge from "./pages/Knowledge";
import Settings from "./pages/Settings";

const pageTitles = {
  "/": "Dashboard",
  "/campaigns": "Campaigns",
  "/opportunities": "Opportunities",
  "/leads": "Leads",
  "/emails": "Emails",
  "/knowledge": "Knowledge",
  "/settings": "Settings",
};

function AppShell() {
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const pageTitle = useMemo(
    () => pageTitles[location.pathname] || "AI Lead Generation",
    [location.pathname]
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-transparent text-slate-950">
      {isMobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm lg:hidden"
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
          "flex min-h-screen min-w-0 flex-col transition-[padding] duration-300",
          isSidebarCollapsed ? "lg:pl-[88px]" : "lg:pl-[264px]",
        ].join(" ")}
      >
        <Navbar
          pageTitle={pageTitle}
          collapsed={isSidebarCollapsed}
          onMenuClick={() => setIsMobileSidebarOpen(true)}
          onCollapseClick={() => setIsSidebarCollapsed((value) => !value)}
        />

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-5 sm:py-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1440px] min-w-0">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/opportunities" element={<Opportunities />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/emails" element={<Emails />} />
              <Route path="/knowledge" element={<Knowledge />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;
