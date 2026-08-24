import { NextResponse } from "next/server";
import { campaignService } from "@/lib/server/services/campaignService";
import { scheduleCampaignSchema } from "@/lib/server/validation";
import { parseJsonBody, withErrorHandling } from "@/lib/server/apiUtils";
import { requirePermission } from "@/lib/server/auth";

interface Params {
  params: { id: string };
}

export const POST = withErrorHandling(async (req: Request, { params }: Params) => {
  const user = await requirePermission("marketing", "edit");
  const parsed = await parseJsonBody(req, scheduleCampaignSchema);
  if ("error" in parsed) return parsed.error;

  const campaign = await campaignService.schedule(params.id, new Date(parsed.data.scheduledAt), user.id);
  return NextResponse.json({ campaign });
});

export const DELETE = withErrorHandling(async (req: Request, { params }: Params) => {
  const user = await requirePermission("marketing", "edit");
  const campaign = await campaignService.cancelSchedule(params.id, user.id);
  return NextResponse.json({ campaign });
});
