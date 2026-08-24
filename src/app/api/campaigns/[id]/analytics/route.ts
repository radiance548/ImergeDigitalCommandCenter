import { NextResponse } from "next/server";
import { campaignService } from "@/lib/server/services/campaignService";
import { withErrorHandling } from "@/lib/server/apiUtils";
import { requirePermission } from "@/lib/server/auth";
import { withRLS } from "@/lib/server/withRLS";

interface Params {
  params: { id: string };
}

export const GET = withErrorHandling(async (req: Request, { params }: Params) => {
  const user = await requirePermission("marketing", "view");
  const analytics = await withRLS(user.id, (tx) => campaignService.getAnalytics(params.id, tx));
  return NextResponse.json({ analytics });
});
