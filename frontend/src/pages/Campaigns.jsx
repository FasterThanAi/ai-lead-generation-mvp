import { useState } from "react";
import CampaignForm from "../components/CampaignForm";
import CampaignList from "../components/CampaignList";

function Campaigns() {
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshCampaigns = () => {
    setRefreshKey((currentKey) => currentKey + 1);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Campaigns</h2>
      <div className="space-y-6">
        <CampaignForm onCampaignCreated={refreshCampaigns} />
        <CampaignList refreshKey={refreshKey} />
      </div>
    </div>
  );
}

export default Campaigns;
