import { NextResponse } from "next/server";
import { campaignService } from "@/lib/server/services/campaignService";
import { withErrorHandling } from "@/lib/server/apiUtils";
import { requirePermission } from "@/lib/server/auth";

interface Params {
  params: { id: string };
}

export const POST = withErrorHandling(async (req: Request, { params }: Params) => {
  const user = await requirePermission("marketing", "edit");
  const campaign = await campaignService.sendNow(params.id, user.id);
  return NextResponse.json({ campaign });
});
