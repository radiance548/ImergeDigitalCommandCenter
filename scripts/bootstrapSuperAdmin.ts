/**
 * One-time provisioning for the Super Admin account — the only account
 * created outside the in-app "Add Staff" flow, since that flow itself
 * requires a signed-in Super Admin to use.
 *
 * Takes only an email + name, never a password: it invites the account via
 * Supabase Auth, and the real person sets their own password by clicking
 * the emailed link and landing on /reset-password. No password is ever
 * typed into this script, a shell command, or shared with anyone else.
 *
 * Usage:
 *   npx tsx --env-file-if-exists=.env.local scripts/bootstrapSuperAdmin.ts you@yourdomain.com "Your Name" [appUrl]
 *
 * appUrl must be the real, public URL people will click the invite link
 * from (e.g. https://commandcenter.imergedigital.com) — it's required
 * (either as this 3rd argument or via NEXT_PUBLIC_APP_URL), on purpose:
 * there is deliberately no silent fallback to localhost here. Supabase
 * also only honors redirect URLs on its own allow-list — add
 * `<appUrl>/**` under Authentication -> URL Configuration -> Redirect
 * URLs in the Supabase dashboard, or the invite link will look fine but
 * fail when clicked. The "Invite user" email template must also link to
 * /auth/confirm (with {{ .TokenHash }}) rather than the default
 * {{ .ConfirmationURL }} — see that route's docstring and README's Auth
 * section for why.
 *
 * Safe to run only once — running it again for the same email will fail
 * with "already registered" (Supabase) once the account exists. Delete or
 * ignore this file after use.
 */
import { prisma } from "../src/lib/server/db";
import { getSupabaseAdminClient } from "../src/lib/server/supabase";

const DASHBOARDS = ["income", "marketing", "health", "clients", "pipeline", "ltv", "settings"] as const;

async function main() {
  const [email, name, appUrl] = process.argv.slice(2);
  if (!email || !name) {
    console.error('Usage: npx tsx scripts/bootstrapSuperAdmin.ts <email> "<name>" [appUrl]');
    process.exit(1);
  }

  const baseUrl = appUrl || process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    console.error(
      "Missing app URL. Pass it as a 3rd argument, or set NEXT_PUBLIC_APP_URL in .env.local, e.g.:\n" +
        '  npx tsx scripts/bootstrapSuperAdmin.ts you@yourdomain.com "Your Name" https://commandcenter.imergedigital.com'
    );
    process.exit(1);
  }
  // Points at the server-side verification route (src/app/auth/confirm),
  // not directly at /reset-password — see that route's docstring for why.
  const redirectTo = `${baseUrl.replace(/\/$/, "")}/auth/confirm?next=/reset-password`;
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (error || !data.user) {
    throw new Error(error?.message || "Could not invite the Super Admin account.");
  }

  const fullPermissionMap = Object.fromEntries(DASHBOARDS.map((d) => [d, "full"]));

  await prisma.staffUser.upsert({
    where: { id: data.user.id },
    create: {
      id: data.user.id,
      name,
      email,
      role: "SUPER_ADMIN",
      permissionMap: fullPermissionMap,
    },
    update: { role: "SUPER_ADMIN", permissionMap: fullPermissionMap },
  });

  console.log(`Invited Super Admin: ${email}. Check that inbox for the invite link (redirects to ${redirectTo}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
