import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/server/supabase";

/**
 * Server-side landing point for invite/recovery email links, instead of
 * letting Supabase's own /auth/v1/verify redirect straight to a client
 * page. That default hand-off appends session tokens to the URL (either
 * as a #access_token hash, or a PKCE ?code — which fails with "code
 * verifier not found" for anything not initiated by a browser, like
 * admin.inviteUserByEmail()). Verifying the token_hash here instead, with
 * the cookie-writing server client, sets the session via cookies directly
 * — no client-side exchange, no PKCE verifier needed. This is the pattern
 * Supabase's own Next.js SSR docs recommend.
 *
 * Requires the "Invite user" and "Reset Password" email templates to link
 * here directly (using {{ .TokenHash }}) instead of the default
 * {{ .ConfirmationURL }} — see README's Auth section.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next") || "/reset-password";

  if (tokenHash && type) {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(new URL("/reset-password?error=link_invalid", url.origin));
}
