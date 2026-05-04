import { Link } from "react-router-dom";

function Sidebar() {
  return (
    <div className="w-64 min-h-screen bg-gray-900 text-white p-5">
      <h2 className="text-lg font-bold mb-8">Lead Agent</h2>

      <nav className="space-y-4">
        <Link to="/" className="block hover:text-blue-300">Dashboard</Link>
        <Link to="/campaigns" className="block hover:text-blue-300">Campaigns</Link>
        <Link to="/leads" className="block hover:text-blue-300">Leads</Link>
        <Link to="/emails" className="block hover:text-blue-300">Emails</Link>
        <Link to="/settings" className="block hover:text-blue-300">Settings</Link>
      </nav>
    </div>
  );
}

export default Sidebar;