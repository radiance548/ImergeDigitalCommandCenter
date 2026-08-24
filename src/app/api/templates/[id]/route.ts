import { NextResponse } from "next/server";
import { templateService } from "@/lib/server/services/templateService";
import { createTemplateSchema } from "@/lib/server/validation";
import { apiError, parseJsonBody, withErrorHandling } from "@/lib/server/apiUtils";
import { requirePermission } from "@/lib/server/auth";
import { withRLS } from "@/lib/server/withRLS";

interface Params {
  params: { id: string };
}

export const GET = withErrorHandling(async (req: Request, { params }: Params) => {
  const user = await requirePermission("marketing", "view");
  const template = await withRLS(user.id, (tx) => templateService.get(params.id, tx));
  if (!template) return apiError(404, "Template not found");
  return NextResponse.json({ template });
});

export const PATCH = withErrorHandling(async (req: Request, { params }: Params) => {
  const user = await requirePermission("marketing", "edit");
  const parsed = await parseJsonBody(req, createTemplateSchema.partial());
  if ("error" in parsed) return parsed.error;
  const template = await withRLS(user.id, (tx) => templateService.update(params.id, parsed.data, tx));
  return NextResponse.json({ template });
});

export const DELETE = withErrorHandling(async (req: Request, { params }: Params) => {
  const user = await requirePermission("marketing", "edit");
  await withRLS(user.id, (tx) => templateService.remove(params.id, tx));
  return NextResponse.json({ ok: true });
});
