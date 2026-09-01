import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/server/db";
import { withRLS, type Db } from "@/lib/server/withRLS";
import { getBroadcastProvider } from "@/lib/server/mail/broadcastIndex";
import type { createAudienceSchema, importContactsSchema } from "@/lib/server/validation";
import { Prisma } from "@prisma/client";
import type { z } from "zod";

export const audienceService = {
  list(db: Db = prisma) {
    return db.audience.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { contacts: true } } },
    });
  },

  get(id: string, db: Db = prisma) {
    return db.audience.findUnique({
      where: { id },
      include: { contacts: { orderBy: { createdAt: "desc" }, take: 200 } },
    });
  },

  /**
   * Creates the audience locally AND on Resend, storing the Resend audience
   * id for later contact/broadcast syncing.
   *
   * The Resend call runs BEFORE the transaction opens, not inside it — an
   * interactive Prisma transaction has a hard timeout (see withRLS), and a
   * network round-trip has no business holding a DB connection open while
   * it waits on a third party.
   */
  async create(input: z.infer<typeof createAudienceSchema>, userId: string) {
    const provider = getBroadcastProvider();
    const { externalId } = await provider.createAudience(input.name);
    return withRLS(userId, (tx) => tx.audience.create({ data: { ...input, externalId } }));
  },

  remove(id: string, db: Db = prisma) {
    return db.audience.delete({ where: { id } });
  },

  /**
   * Same network-outside-transaction shape as `create` — see its comment.
   *
   * Upserts as ONE multi-row `INSERT ... ON CONFLICT` statement rather than
   * one `upsert()` round trip per contact — with thousands of contacts, N
   * sequential round trips on the transaction's single connection easily
   * blows past the interactive transaction's default 5s timeout, even
   * though each individual query is fast on its own.
   *
   * That round-trip fix alone isn't sufficient at the top of the range,
   * though: measured directly against the real DB, a single 5000-row
   * VALUES/ON CONFLICT statement takes ~6-7s of genuine server-side work
   * (row-level RLS check + unique-index maintenance × 5000, plus
   * transmitting ~30k bound parameters), which is real work, not a hung
   * connection — so this passes an explicit longer timeout rather than
   * papering over it with more chunking.
   */
  async importContacts(audienceId: string, input: z.infer<typeof importContactsSchema>, userId: string) {
    const { audience, count } = await withRLS(
      userId,
      async (tx) => {
        const audience = await tx.audience.findUnique({ where: { id: audienceId } });
        if (!audience) throw new Error(`Audience ${audienceId} not found`);

        const rows = input.contacts.map(
          (c) =>
            Prisma.sql`(${randomUUID()}, ${audienceId}, ${c.email.toLowerCase()}, ${c.firstName ?? null}, ${c.lastName ?? null}, ${JSON.stringify(c.attributes ?? {})}::jsonb)`
        );

        const count = await tx.$executeRaw`
        INSERT INTO "audience_contacts" (id, "audienceId", email, "firstName", "lastName", attributes)
        VALUES ${Prisma.join(rows)}
        ON CONFLICT ("audienceId", email) DO UPDATE SET
          "firstName" = excluded."firstName",
          "lastName" = excluded."lastName",
          attributes = excluded.attributes
      `;

        return { audience, count };
      },
      { timeout: 30_000, maxWait: 10_000 }
    );

    // Push into Resend's own audience so Broadcasts sent against it reach
    // these contacts. If this fails, contacts are still stored locally —
    // the next successful sync (or a retry) will catch up.
    if (audience.externalId) {
      try {
        await getBroadcastProvider().upsertContacts(
          audience.externalId,
          input.contacts.map((c) => ({
            email: c.email,
            firstName: c.firstName,
            lastName: c.lastName,
            attributes: c.attributes,
          }))
        );
      } catch (error) {
        console.error("[audienceService] Resend contact sync failed:", error);
      }
    }

    return count;
  },

  contactCount(audienceId: string, db: Db = prisma) {
    return db.audienceContact.count({ where: { audienceId, status: "subscribed" } });
  },
};
