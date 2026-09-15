import { NextResponse } from "next/server";
import { campaignService } from "@/lib/server/services/campaignService";
import { withErrorHandling } from "@/lib/server/apiUtils";
import { requirePermission } from "@/lib/server/auth";

interface Params {
  params: { id: string };
}

export const GET = withErrorHandling(async (req: Request, { params }: Params) => {
  const user = await requirePermission("marketing", "view");
  const analytics = await campaignService.getAnalytics(params.id, user.id);
  return NextResponse.json({ analytics });
});
