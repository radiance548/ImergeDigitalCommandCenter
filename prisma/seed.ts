import { PrismaClient } from "@prisma/client";
import { SEED_USERS } from "../src/lib/demoData";
import { getSupabaseAdminClient } from "../src/lib/server/supabase";

const prisma = new PrismaClient();

/** Creates the Supabase Auth user if it doesn't exist yet, returning its id either way. */
async function upsertAuthUser(email: string, password: string): Promise<string> {
  const supabase = getSupabaseAdminClient();

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // demo accounts — skip the confirmation email flow
  });
  if (created?.user) return created.user.id;

  if (createError && !/already (been )?registered|already exists/i.test(createError.message)) {
    throw createError;
  }

  // Already exists from a previous seed run — look it up instead.
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;
  const existing = list.users.find((u) => u.email?.toLowerCase() === email);
  if (!existing) throw new Error(`Could not find or create a Supabase auth user for ${email}`);
  return existing.id;
}

const STARTER_TEMPLATES = [
  {
    name: "Simple Announcement",
    description: "Clean single-column layout for product updates or news.",
    isSystem: true,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <h1 style="color:#182230;">{{subject}}</h1>
  <p style="color:#475467;line-height:1.6;">Hi {{first_name}},</p>
  <p style="color:#475467;line-height:1.6;">Write your announcement here.</p>
  <a href="#" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;">Call to action</a>
  <p style="color:#98a2b3;font-size:12px;margin-top:32px;">You're receiving this because you're subscribed to Imerge updates.</p>
</div>`,
  },
  {
    name: "Newsletter",
    description: "Multi-section layout for a recurring digest.",
    isSystem: true,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <h1 style="color:#182230;">This Month at Imerge</h1>
  <p style="color:#475467;line-height:1.6;">Hi {{first_name}}, here's what's new:</p>
  <h2 style="color:#182230;font-size:18px;">Update one</h2>
  <p style="color:#475467;line-height:1.6;">Details here.</p>
  <h2 style="color:#182230;font-size:18px;">Update two</h2>
  <p style="color:#475467;line-height:1.6;">Details here.</p>
  <p style="color:#98a2b3;font-size:12px;margin-top:32px;">You're receiving this because you're subscribed to Imerge updates.</p>
</div>`,
  },
  {
    name: "Plain Text Style",
    description: "Minimal, personal-feeling layout — good for founder-style updates.",
    isSystem: true,
    html: `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:24px;color:#182230;line-height:1.7;">
  <p>Hi {{first_name}},</p>
  <p>Write your message here, as if you were emailing one person.</p>
  <p>— The Imerge team</p>
</div>`,
  },
];

async function main() {
  // Backend auth accounts — same emails/permissions as the frontend demo
  // data (src/lib/demoData.ts). Credentials live in Supabase Auth
  // (auth.users); this script provisions those accounts, then creates a
  // matching staff_users profile row keyed to the same id — see the Auth
  // section of README.md for why these two tables have to stay in sync.
  for (const seedUser of SEED_USERS) {
    const email = seedUser.email.toLowerCase();
    const authUserId = await upsertAuthUser(email, seedUser.password);

    await prisma.staffUser.upsert({
      where: { id: authUserId },
      create: {
        id: authUserId,
        name: seedUser.name,
        email,
        role: seedUser.role,
        department: seedUser.department,
        isActive: seedUser.isActive,
        permissionMap: seedUser.permissions,
      },
      update: {
        name: seedUser.name,
        role: seedUser.role,
        department: seedUser.department,
        isActive: seedUser.isActive,
        permissionMap: seedUser.permissions,
      },
    });
    console.log(`Seeded staff user: ${email} (${authUserId})`);
  }

  for (const template of STARTER_TEMPLATES) {
    const existing = await prisma.emailTemplate.findFirst({ where: { name: template.name, isSystem: true } });
    if (!existing) {
      await prisma.emailTemplate.create({ data: template });
      console.log(`Seeded template: ${template.name}`);
    }
  }

  const demoAudience = await prisma.audience.upsert({
    where: { id: "demo-audience" },
    create: {
      id: "demo-audience",
      name: "Demo Audience",
      description: "Sample contacts for trying out the campaign builder.",
      contacts: {
        create: [
          { email: "demo1@example.com", firstName: "Ada", status: "subscribed" },
          { email: "demo2@example.com", firstName: "Kofi", status: "subscribed" },
          { email: "demo3@example.com", firstName: "Mei", status: "subscribed" },
        ],
      },
    },
    update: {},
  });
  console.log(`Demo audience ready: ${demoAudience.name}`);

  await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
