import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { getSupabaseAdminClient } from "@/lib/server/supabase";
import { requireSuperAdmin } from "@/lib/server/auth";
import { apiError, parseJsonBody, withErrorHandling } from "@/lib/server/apiUtils";
import { createStaffSchema } from "@/lib/server/validation";

// Staff management is Super Admin only (see requireSuperAdmin) and, like
// getSessionUser()/the login route, queries staff_users via the plain
// `prisma` singleton rather than withRLS — see the Auth section of
// README.md for why that's the established pattern for this table.

export const GET = withErrorHandling(async () => {
  await requireSuperAdmin();
  const staff = await prisma.staffUser.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ staff });
});

export const POST = withErrorHandling(async (req: Request) => {
  await requireSuperAdmin();
  const parsed = await parseJsonBody(req, createStaffSchema);
  if ("error" in parsed) return parsed.error;
  const { name, email, password, role, permissionMap } = parsed.data;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) return apiError(400, error?.message || "Could not create the account.");

  try {
    const staff = await prisma.staffUser.create({
      data: {
        id: data.user.id,
        name,
        email,
        role,
        permissionMap: permissionMap ?? {},
      },
    });
    return NextResponse.json({ staff }, { status: 201 });
  } catch (dbError) {
    // Don't leave an orphaned Supabase Auth user with no matching profile
    // (a dead login that would always 401 at the "no active staff
    // profile" check) if the second half of this two-step create fails —
    // e.g. the email is somehow already taken in staff_users.
    await supabase.auth.admin.deleteUser(data.user.id);
    throw dbError;
  }
});
