import { NextResponse } from "next/server";
import { campaignService } from "@/lib/server/services/campaignService";
import { createCampaignSchema } from "@/lib/server/validation";
import { parseJsonBody, withErrorHandling } from "@/lib/server/apiUtils";
import { requirePermission } from "@/lib/server/auth";
import { withRLS } from "@/lib/server/withRLS";

export const GET = withErrorHandling(async (req: Request) => {
  const user = await requirePermission("marketing", "view");
  const campaigns = await withRLS(user.id, (tx) => campaignService.list(tx));
  return NextResponse.json({ campaigns });
});

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requirePermission("marketing", "edit");
  const parsed = await parseJsonBody(req, createCampaignSchema);
  if ("error" in parsed) return parsed.error;

  const campaign = await withRLS(user.id, (tx) => campaignService.create(parsed.data, user.id, tx));
  return NextResponse.json({ campaign }, { status: 201 });
});
