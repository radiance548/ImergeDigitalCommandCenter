import { prisma } from "@/lib/server/db";
import { withRLS, type Db } from "@/lib/server/withRLS";
import { getBroadcastProvider } from "@/lib/server/mail/broadcastIndex";
import { computeCampaignAnalytics } from "@/lib/server/campaignAnalytics";
import type { createCampaignSchema, updateCampaignSchema } from "@/lib/server/validation";
import type { z } from "zod";

type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

/**
 * Pre-creates a `pending` CampaignRecipient row for every subscribed
 * contact in the campaign's audience, at the moment we hand the campaign
 * off to Resend.
 *
 * Resend's Broadcast API owns the actual per-recipient fan-out and never
 * hands the recipient list back to us — without this, `getAnalytics()`
 * reads `totalRecipients: 0` until the first webhook event trickles in,
 * which looks like the send silently failed. `recordWebhookEvent`'s
 * upsert (keyed on [campaignId, email]) fills these rows in as events
 * arrive rather than creating duplicates.
 */
async function enumerateRecipients(tx: Db, campaignId: string, audienceId: string) {
  const contacts = await tx.audienceContact.findMany({
    where: { audienceId, status: "subscribed" },
    select: { id: true, email: true },
  });
  if (!contacts.length) return;
  await tx.campaignRecipient.createMany({
    data: contacts.map((c) => ({ campaignId, contactId: c.id, email: c.email.toLowerCase() })),
    skipDuplicates: true,
  });
}

export const campaignService = {
  list(db: Db = prisma) {
    return db.emailCampaign.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        template: { select: { id: true, name: true } },
        audience: { select: { id: true, name: true } },
        _count: { select: { recipients: true } },
      },
    });
  },

  get(id: string, db: Db = prisma) {
    return db.emailCampaign.findUnique({
      where: { id },
      include: { template: true, audience: true },
    });
  },

  // -------------------- Step 1 & 2: content + template --------------------
  create(input: CreateCampaignInput, createdById: string | undefined, db: Db = prisma) {
    return db.emailCampaign.create({
      data: { ...input, createdById, status: "draft" },
    });
  },

  update(id: string, input: UpdateCampaignInput, db: Db = prisma) {
    return db.emailCampaign.update({ where: { id }, data: input });
  },

  async remove(id: string, userId: string) {
    const campaign = await withRLS(userId, (tx) => tx.emailCampaign.findUnique({ where: { id } }));
    if (campaign?.externalBroadcastId && campaign.status === "scheduled") {
      try {
        await getBroadcastProvider().cancelBroadcast(campaign.externalBroadcastId);
      } catch (error) {
        console.error("[campaignService] failed to cancel Resend broadcast before delete:", error);
      }
    }
    return withRLS(userId, (tx) => tx.emailCampaign.delete({ where: { id } }));
  },

  // -------------------- Step 3: audience --------------------
  setAudience(id: string, audienceId: string | null, db: Db = prisma) {
    return db.emailCampaign.update({ where: { id }, data: { audienceId } });
  },

  // -------------------- Step 4: schedule / send --------------------
  // Both paths below go through Resend's Broadcast API, which owns the
  // actual queueing/throttling/scheduling — this service just creates or
  // updates the broadcast's content and tells Resend when to fire it.

  /**
   * Pushes this campaign's current content to Resend as a broadcast
   * (creating it on first call), returning its external id.
   *
   * Reads and writes each run in their own short `withRLS` transaction;
   * the Resend call in between runs outside any transaction, so a slow
   * broadcast API response can never trip Prisma's interactive-transaction
   * timeout (see withRLS).
   */
  async syncBroadcastContent(campaignId: string, userId: string) {
    const campaign = await withRLS(userId, (tx) => campaignService.get(campaignId, tx));
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);
    if (!campaign.audience) throw new Error("Pick an audience before scheduling or sending this campaign.");
    if (!campaign.audience.externalId) {
      throw new Error("This audience hasn't synced to Resend yet — try re-saving it, or contact an admin.");
    }

    const provider = getBroadcastProvider();
    const { externalId } = await provider.createOrUpdateBroadcast({
      externalBroadcastId: campaign.externalBroadcastId,
      audienceExternalId: campaign.audience.externalId,
      from: { name: campaign.fromName, email: campaign.fromEmail },
      subject: campaign.subject,
      html: campaign.bodyHtml,
      name: campaign.subject,
    });

    if (externalId !== campaign.externalBroadcastId) {
      await withRLS(userId, (tx) =>
        tx.emailCampaign.update({ where: { id: campaignId }, data: { externalBroadcastId: externalId } })
      );
    }

    return { campaign, externalBroadcastId: externalId };
  },

  /** Schedule for a future time. */
  async schedule(id: string, scheduledAt: Date, userId: string) {
    const { campaign, externalBroadcastId } = await campaignService.syncBroadcastContent(id, userId);
    await getBroadcastProvider().sendBroadcast(externalBroadcastId, scheduledAt);
    return withRLS(userId, async (tx) => {
      if (campaign.audienceId) await enumerateRecipients(tx, id, campaign.audienceId);
      return tx.emailCampaign.update({
        where: { id },
        data: { status: "scheduled", scheduledAt },
      });
    });
  },

  async cancelSchedule(id: string, userId: string) {
    const campaign = await withRLS(userId, (tx) => tx.emailCampaign.findUnique({ where: { id } }));
    if (campaign?.externalBroadcastId) {
      await getBroadcastProvider().cancelBroadcast(campaign.externalBroadcastId);
    }
    return withRLS(userId, (tx) =>
      tx.emailCampaign.update({ where: { id }, data: { status: "draft", scheduledAt: null } })
    );
  },

  /** Send immediately via Resend's Broadcast API. */
  async sendNow(id: string, userId: string) {
    const { campaign, externalBroadcastId } = await campaignService.syncBroadcastContent(id, userId);
    await getBroadcastProvider().sendBroadcast(externalBroadcastId);
    return withRLS(userId, async (tx) => {
      if (campaign.audienceId) await enumerateRecipients(tx, id, campaign.audienceId);
      return tx.emailCampaign.update({
        where: { id },
        data: { status: "sent", sentAt: new Date() },
      });
    });
  },

  // -------------------- Step 5: analytics --------------------
  async getAnalytics(campaignId: string, db: Db = prisma) {
    const [recipientCounts, eventCounts] = await Promise.all([
      db.campaignRecipient.groupBy({ by: ["status"], where: { campaignId }, _count: true }),
      db.campaignEvent.groupBy({ by: ["type"], where: { campaignId }, _count: true }),
    ]);

    return computeCampaignAnalytics(recipientCounts, eventCounts);
  },

  // -------------------- Webhook ingestion --------------------
  // Always runs on the unrestricted `prisma` singleton, never withRLS —
  // there's no signed-in user for an inbound provider webhook to scope
  // to. Resend Broadcast webhook events carry a broadcast_id (see
  // resendProvider.ts's parseWebhookEvents) rather than a per-recipient
  // id we generated ourselves, since Resend — not us — creates each
  // individual send when it fans a broadcast out to its audience. The
  // upsert below usually just updates a `pending` row enumerateRecipients
  // already created at send time, but still falls back to creating one
  // (e.g. a contact added to the audience after the campaign was sent).
  async recordWebhookEvent(event: {
    type: string;
    providerMessageId?: string;
    broadcastId?: string;
    audienceId?: string;
    email?: string;
    url?: string;
    occurredAt: Date;
  }) {
    // Unsubscribes come from Resend as a contact-level event scoped to the
    // audience, not a broadcast — see resendProvider.ts's parseWebhookEvents.
    // No CampaignEvent row here: we have no reliable way to attribute an
    // audience-level unsubscribe to any one campaign send.
    if (event.type === "unsubscribed") {
      if (!event.audienceId || !event.email) return;
      const audience = await prisma.audience.findUnique({ where: { externalId: event.audienceId } });
      if (!audience) return;
      await prisma.audienceContact.updateMany({
        where: { audienceId: audience.id, email: event.email.toLowerCase() },
        data: { status: "unsubscribed" },
      });
      return;
    }

    if (!event.broadcastId || !event.email) return; // can't correlate without both

    const campaign = await prisma.emailCampaign.findUnique({ where: { externalBroadcastId: event.broadcastId } });
    if (!campaign) return; // event for a broadcast we don't recognize — safe to drop

    const email = event.email.toLowerCase();
    const contact = await prisma.audienceContact.findFirst({
      where: { audienceId: campaign.audienceId ?? undefined, email },
    });

    const statusForEvent: Record<string, "sent" | "delivered" | "bounced" | undefined> = {
      sent: "sent",
      delivered: "delivered",
      bounced: "bounced",
    };
    const nextStatus = statusForEvent[event.type];

    const recipient = await prisma.campaignRecipient.upsert({
      where: { campaignId_email: { campaignId: campaign.id, email } },
      create: {
        campaignId: campaign.id,
        contactId: contact?.id,
        email,
        status: nextStatus ?? "pending",
        providerMessageId: event.providerMessageId,
        sentAt: event.type === "sent" ? event.occurredAt : undefined,
      },
      update: {
        ...(nextStatus ? { status: nextStatus } : {}),
        ...(event.providerMessageId ? { providerMessageId: event.providerMessageId } : {}),
      },
    });

    await prisma.campaignEvent.create({
      data: {
        campaignId: campaign.id,
        recipientId: recipient.id,
        type: event.type as never,
        url: event.url,
        occurredAt: event.occurredAt,
      },
    });

    if (event.type === "complained" && contact) {
      await prisma.audienceContact.update({ where: { id: contact.id }, data: { status: "complained" } });
    }
  },
};
