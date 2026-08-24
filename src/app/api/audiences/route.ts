import { NextResponse } from "next/server";
import { audienceService } from "@/lib/server/services/audienceService";
import { createAudienceSchema } from "@/lib/server/validation";
import { parseJsonBody, withErrorHandling } from "@/lib/server/apiUtils";
import { requirePermission } from "@/lib/server/auth";
import { withRLS } from "@/lib/server/withRLS";

export const GET = withErrorHandling(async (req: Request) => {
  const user = await requirePermission("marketing", "view");
  const audiences = await withRLS(user.id, (tx) => audienceService.list(tx));
  return NextResponse.json({ audiences });
});

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requirePermission("marketing", "edit");
  const parsed = await parseJsonBody(req, createAudienceSchema);
  if ("error" in parsed) return parsed.error;
  const audience = await audienceService.create(parsed.data, user.id);
  return NextResponse.json({ audience }, { status: 201 });
});
