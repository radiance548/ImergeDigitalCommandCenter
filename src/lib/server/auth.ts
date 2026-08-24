import { prisma } from "@/lib/server/db";
import { getSupabaseServerClient } from "@/lib/server/supabase";
import { ApiHttpError } from "@/lib/server/apiUtils";
import { permissionRank } from "@/lib/server/authTokens";

export { permissionRank } from "@/lib/server/authTokens";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  permissionMap: Record<string, string>;
}

/**
 * Resolves the current Supabase Auth session (from the request's cookies,
 * via getSupabaseServerClient) into our own StaffUser profile row —
 * identity comes from Supabase, permissions/role/department come from our
 * `staff_users` table, joined on a matching id (see prisma/schema.prisma
 * and the migration notes in README's Auth section for how these two
 * stay in sync).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const profile = await prisma.staffUser.findUnique({ where: { id: authUser.id } });
  if (!profile || !profile.isActive) return null;

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    isActive: profile.isActive,
    permissionMap: (profile.permissionMap as Record<string, string>) || {},
  };
}

/**
 * Enforces that the current request has a signed-in session with at least
 * `minLevel` permission on `dashboard`. Returns the session user on
 * success, or throws an `ApiHttpError` (401/403) that `withErrorHandling`
 * turns into the right response — so call sites don't need to branch:
 *
 *   const user = await requirePermission("marketing", "edit");
 *   // ...use `user`, or the request has already been rejected
 */
export async function requirePermission(
  dashboard: string,
  minLevel: "view" | "edit" | "full" = "view"
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiHttpError(401, "Not signed in");

  const level = user.permissionMap[dashboard];
  if (permissionRank(level) < permissionRank(minLevel)) {
    throw new ApiHttpError(403, `You don't have ${minLevel} access to ${dashboard}`);
  }
  return user;
}
