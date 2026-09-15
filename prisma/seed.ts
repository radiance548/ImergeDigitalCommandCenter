import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Staff accounts are NOT seeded here — the Super Admin is provisioned once
// via `npm run bootstrap:superadmin` (scripts/bootstrapSuperAdmin.ts), and
// every other account through the in-app "Add Staff" flow (Settings,
// Super Admin only). See the Auth section of README.md.

const STARTER_TEMPLATES = [
  {
    name: "Simple Announcement",
    description: "Clean single-column layout for product updates or news.",
    isSystem: true,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <h1 style="color:#182230;">Announcement</h1>
  <p style="color:#475467;line-height:1.6;">Hi {{firstName ?? 'there'}},</p>
  <p style="color:#475467;line-height:1.6;">Write your announcement here.</p>
  <a href="#" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;">Call to action</a>
  <p style="color:#98a2b3;font-size:12px;margin-top:32px;">You're receiving this because you're subscribed to Imerge updates. <a href="{{unsubscribeUrl}}" style="color:#98a2b3;">Unsubscribe</a></p>
</div>`,
  },
  {
    name: "Newsletter",
    description: "Multi-section layout for a recurring digest.",
    isSystem: true,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <h1 style="color:#182230;">This Month at Imerge</h1>
  <p style="color:#475467;line-height:1.6;">Hi {{firstName ?? 'there'}}, here's what's new:</p>
  <h2 style="color:#182230;font-size:18px;">Update one</h2>
  <p style="color:#475467;line-height:1.6;">Details here.</p>
  <h2 style="color:#182230;font-size:18px;">Update two</h2>
  <p style="color:#475467;line-height:1.6;">Details here.</p>
  <p style="color:#98a2b3;font-size:12px;margin-top:32px;">You're receiving this because you're subscribed to Imerge updates. <a href="{{unsubscribeUrl}}" style="color:#98a2b3;">Unsubscribe</a></p>
</div>`,
  },
  {
    name: "Plain Text Style",
    description: "Minimal, personal-feeling layout — good for founder-style updates.",
    isSystem: true,
    html: `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:24px;color:#182230;line-height:1.7;">
  <p>Hi {{firstName ?? 'there'}},</p>
  <p>Write your message here, as if you were emailing one person.</p>
  <p>— The Imerge team</p>
  <p style="color:#98a2b3;font-size:12px;margin-top:24px;"><a href="{{unsubscribeUrl}}" style="color:#98a2b3;">Unsubscribe</a></p>
</div>`,
  },
];

async function main() {
  for (const template of STARTER_TEMPLATES) {
    const existing = await prisma.emailTemplate.findFirst({ where: { name: template.name, isSystem: true } });
    if (existing) {
      // Keep system templates in sync with their canonical source here —
      // otherwise a content fix (e.g. correcting merge-tag syntax) never
      // reaches a database that was already seeded once.
      await prisma.emailTemplate.update({
        where: { id: existing.id },
        data: { html: template.html, description: template.description },
      });
      console.log(`Updated template: ${template.name}`);
    } else {
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
