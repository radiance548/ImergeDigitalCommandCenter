import { prisma } from "@/lib/server/db";
import { getSupabaseServerClient } from "@/lib/server/supabase";
import { ApiHttpError } from "@/lib/server/apiUtils";
import { permissionRank } from "@/lib/server/authTokens";

export { permissionRank } from "@/lib/server/authTokens";

export type StaffRole = "SUPER_ADMIN" | "CEO" | "SOCIAL_MEDIA_AD_MANAGER";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
  permissionMap: Record<string, string>;
}

const FULL_PERMISSION_MAP: Record<string, string> = {
  income: "full",
  marketing: "full",
  health: "full",
  clients: "full",
  pipeline: "full",
  ltv: "full",
  settings: "full",
};

/**
 * Resolves the current Supabase Auth session (from the request's cookies,
 * via getSupabaseServerClient) into our own StaffUser profile row —
 * identity comes from Supabase, permissions/role come from our
 * `staff_users` table, joined on a matching id (see prisma/schema.prisma
 * and the migration notes in README's Auth section for how these two
 * stay in sync).
 *
 * The Super Admin's permissionMap is always overridden to full access
 * here, regardless of what's actually stored — defense-in-depth so every
 * requirePermission()/isAdmin() check anywhere in the app is automatically
 * correct even if the stored row ever drifted. See also the "can't target
 * a Super Admin row" guard in the staff API routes, which covers the
 * write side of the same invariant.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const profile = await prisma.staffUser.findUnique({ where: { id: authUser.id } });
  if (!profile || !profile.isActive) return null;

  const isSuperAdmin = profile.role === "SUPER_ADMIN";

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role as StaffRole,
    isActive: profile.isActive,
    permissionMap: isSuperAdmin ? FULL_PERMISSION_MAP : (profile.permissionMap as Record<string, string>) || {},
  };
}

/**
 * Enforces that the current request has a signed-in Super Admin session.
 * Throws 401/403 via ApiHttpError, same convention as requirePermission.
 */
export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiHttpError(401, "Not signed in");
  if (user.role !== "SUPER_ADMIN") throw new ApiHttpError(403, "Super Admin access required");
  return user;
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
