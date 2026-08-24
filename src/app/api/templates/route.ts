import { NextResponse } from "next/server";
import { templateService } from "@/lib/server/services/templateService";
import { createTemplateSchema } from "@/lib/server/validation";
import { parseJsonBody, withErrorHandling } from "@/lib/server/apiUtils";
import { requirePermission } from "@/lib/server/auth";
import { withRLS } from "@/lib/server/withRLS";

export const GET = withErrorHandling(async (req: Request) => {
  const user = await requirePermission("marketing", "view");
  const templates = await withRLS(user.id, (tx) => templateService.list(tx));
  return NextResponse.json({ templates });
});

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requirePermission("marketing", "edit");
  const parsed = await parseJsonBody(req, createTemplateSchema);
  if ("error" in parsed) return parsed.error;
  const template = await withRLS(user.id, (tx) => templateService.create(parsed.data, tx));
  return NextResponse.json({ template }, { status: 201 });
});
