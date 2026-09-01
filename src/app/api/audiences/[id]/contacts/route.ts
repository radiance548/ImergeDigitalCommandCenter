import { NextResponse } from "next/server";
import { audienceService } from "@/lib/server/services/audienceService";
import { importContactsSchema } from "@/lib/server/validation";
import { parseJsonBody, withErrorHandling } from "@/lib/server/apiUtils";
import { requirePermission } from "@/lib/server/auth";
import { withRLS } from "@/lib/server/withRLS";

interface Params {
  params: { id: string };
}

export const GET = withErrorHandling(async (req: Request, { params }: Params) => {
  const user = await requirePermission("marketing", "view");
  const contacts = await withRLS(user.id, (tx) =>
    tx.audienceContact.findMany({ where: { audienceId: params.id }, orderBy: { createdAt: "desc" } })
  );
  return NextResponse.json({ contacts });
});

export const POST = withErrorHandling(async (req: Request, { params }: Params) => {
  const user = await requirePermission("marketing", "edit");
  const parsed = await parseJsonBody(req, importContactsSchema);
  if ("error" in parsed) return parsed.error;

  const imported = await audienceService.importContacts(params.id, parsed.data, user.id);
  return NextResponse.json({ imported });
});
