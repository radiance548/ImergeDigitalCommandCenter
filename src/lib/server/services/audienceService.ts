import { prisma } from "@/lib/server/db";
import { withRLS, type Db } from "@/lib/server/withRLS";
import { getBroadcastProvider } from "@/lib/server/mail/broadcastIndex";
import type { createAudienceSchema, importContactsSchema } from "@/lib/server/validation";
import type { Prisma } from "@prisma/client";
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

  /** Same network-outside-transaction shape as `create` — see its comment. */
  async importContacts(audienceId: string, input: z.infer<typeof importContactsSchema>, userId: string) {
    const { audience, results } = await withRLS(userId, async (tx) => {
      const audience = await tx.audience.findUnique({ where: { id: audienceId } });
      if (!audience) throw new Error(`Audience ${audienceId} not found`);

      const results = await Promise.all(
        input.contacts.map((c) =>
          tx.audienceContact.upsert({
            where: { audienceId_email: { audienceId, email: c.email.toLowerCase() } },
            create: {
              audienceId,
              email: c.email.toLowerCase(),
              firstName: c.firstName,
              lastName: c.lastName,
              attributes: (c.attributes ?? {}) as Prisma.InputJsonValue,
            },
            update: {
              firstName: c.firstName,
              lastName: c.lastName,
              attributes: (c.attributes ?? {}) as Prisma.InputJsonValue,
            },
          })
        )
      );

      return { audience, results };
    });

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

    return results;
  },

  contactCount(audienceId: string, db: Db = prisma) {
    return db.audienceContact.count({ where: { audienceId, status: "subscribed" } });
  },
};
