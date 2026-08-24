import CampaignWizard from "@/components/campaign-builder/CampaignWizard";

export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  return <CampaignWizard campaignId={params.id} />;
}
