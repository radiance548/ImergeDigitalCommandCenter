import { NextResponse } from "next/server";
import { audienceService } from "@/lib/server/services/audienceService";
import { apiError, withErrorHandling } from "@/lib/server/apiUtils";
import { requirePermission } from "@/lib/server/auth";
import { withRLS } from "@/lib/server/withRLS";

interface Params {
  params: { id: string };
}

export const GET = withErrorHandling(async (req: Request, { params }: Params) => {
  const user = await requirePermission("marketing", "view");
  const audience = await withRLS(user.id, (tx) => audienceService.get(params.id, tx));
  if (!audience) return apiError(404, "Audience not found");
  return NextResponse.json({ audience });
});

export const DELETE = withErrorHandling(async (req: Request, { params }: Params) => {
  const user = await requirePermission("marketing", "edit");
  await audienceService.remove(params.id, user.id);
  return NextResponse.json({ ok: true });
});
