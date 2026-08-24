import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { getSupabaseServerClient } from "@/lib/server/supabase";
import { apiError, parseJsonBody, withErrorHandling } from "@/lib/server/apiUtils";
import { getLoginRateLimiter, loginRateLimitKey } from "@/lib/server/rateLimit";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

/**
 * Thin server-side proxy in front of Supabase's own signInWithPassword.
 * Credential verification, hashing, and Supabase's own built-in auth
 * rate limiting all happen on Supabase's side — this route exists to (a)
 * apply our own rate limiter on top (see src/lib/server/rateLimit.ts) and
 * (b) join the Supabase Auth identity to our `staff_users` profile row
 * (role/department/permissions) in one response.
 */
export const POST = withErrorHandling(async (req: Request) => {
  const parsed = await parseJsonBody(req, loginSchema);
  if ("error" in parsed) return parsed.error;

  const email = parsed.data.email.trim().toLowerCase();
  const rateLimiter = getLoginRateLimiter();
  const rateLimitKey = loginRateLimitKey(getClientIp(req), email);
  const rateLimit = await rateLimiter.check(rateLimitKey);

  if (!rateLimit.allowed) {
    const retryAfterSeconds = Math.ceil((rateLimit.retryAfterMs || 0) / 1000);
    return NextResponse.json(
      { error: `Too many login attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).` },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });

  if (error || !data.user) return apiError(401, error?.message || "Invalid email or password.");

  const profile = await prisma.staffUser.findUnique({ where: { id: data.user.id } });
  if (!profile || !profile.isActive) {
    await supabase.auth.signOut();
    return apiError(401, "This account has no active staff profile. Contact an admin.");
  }

  // Successful login — clear this key's attempt count so a few earlier
  // typos don't count against the user going forward.
  await rateLimiter.reset(rateLimitKey);

  return NextResponse.json({
    user: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      department: profile.department,
      permissionMap: profile.permissionMap,
    },
  });
});
