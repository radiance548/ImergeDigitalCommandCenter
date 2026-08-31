import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { requireSuperAdmin } from "@/lib/server/auth";
import { apiError, parseJsonBody, withErrorHandling } from "@/lib/server/apiUtils";
import { updateStaffSchema } from "@/lib/server/validation";

interface Params {
  params: { id: string };
}

export const PATCH = withErrorHandling(async (req: Request, { params }: Params) => {
  await requireSuperAdmin();

  const target = await prisma.staffUser.findUnique({ where: { id: params.id } });
  if (!target) return apiError(404, "Staff account not found");
  // Checked before the body is even parsed — the Super Admin's own row can
  // never be modified through this endpoint, by anyone, full stop. The
  // schema's restricted role enum (see validation.ts) independently
  // prevents any *other* row from being promoted to Super Admin either;
  // together these mean this account can only ever be created once, by
  // scripts/bootstrapSuperAdmin.ts.
  if (target.role === "SUPER_ADMIN") return apiError(403, "The Super Admin account cannot be modified here.");

  const parsed = await parseJsonBody(req, updateStaffSchema);
  if ("error" in parsed) return parsed.error;

  const staff = await prisma.staffUser.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json({ staff });
});
