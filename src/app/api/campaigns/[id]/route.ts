import { NextResponse } from "next/server";
import { campaignService } from "@/lib/server/services/campaignService";
import { updateCampaignSchema } from "@/lib/server/validation";
import { apiError, parseJsonBody, withErrorHandling } from "@/lib/server/apiUtils";
import { requirePermission } from "@/lib/server/auth";
import { withRLS } from "@/lib/server/withRLS";

interface Params {
  params: { id: string };
}

export const GET = withErrorHandling(async (req: Request, { params }: Params) => {
  const user = await requirePermission("marketing", "view");
  const campaign = await withRLS(user.id, (tx) => campaignService.get(params.id, tx));
  if (!campaign) return apiError(404, "Campaign not found");
  return NextResponse.json({ campaign });
});

export const PATCH = withErrorHandling(async (req: Request, { params }: Params) => {
  const user = await requirePermission("marketing", "edit");
  const parsed = await parseJsonBody(req, updateCampaignSchema);
  if ("error" in parsed) return parsed.error;
  const campaign = await withRLS(user.id, (tx) => campaignService.update(params.id, parsed.data, tx));
  return NextResponse.json({ campaign });
});

export const DELETE = withErrorHandling(async (req: Request, { params }: Params) => {
  const user = await requirePermission("marketing", "edit");
  await campaignService.remove(params.id, user.id);
  return NextResponse.json({ ok: true });
});
