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
 * off to Plunk.
 *
 * Plunk's Campaigns API owns the actual per-recipient fan-out and never
 * hands the recipient list back to us. `getAnalytics()` no longer depends
 * on these rows for its numbers (it polls Plunk's own live stats instead —
 * see its comment), but this local record is still useful as an audit
 * trail of who a campaign was sent to, and `recordWebhookEvent`'s upsert
 * (keyed on [campaignId, email]) will fill these in with real status/event
 * data if you ever wire up a Plunk Workflow webhook (see plunkProvider.ts).
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
    if (campaign?.externalBroadcastId) {
      const provider = getBroadcastProvider();
      // Cancel first if still scheduled — Plunk only allows deleting a
      // DRAFT campaign, so a scheduled one has to come back to draft
      // before delete will succeed.
      if (campaign.status === "scheduled") {
        try {
          await provider.cancelBroadcast(campaign.externalBroadcastId);
        } catch (error) {
          console.error("[campaignService] failed to cancel Plunk campaign before delete:", error);
        }
      }
      try {
        await provider.deleteBroadcast(campaign.externalBroadcastId);
      } catch (error) {
        // Expected/harmless for an already-sent campaign (Plunk keeps
        // those as permanent records and rejects delete) — still
        // best-effort logged rather than silently swallowed, since it
        // could also mean the segment this campaign references won't be
        // deletable later.
        console.error("[campaignService] failed to delete Plunk campaign:", error);
      }
    }
    return withRLS(userId, (tx) => tx.emailCampaign.delete({ where: { id } }));
  },

  // -------------------- Step 3: audience --------------------
  setAudience(id: string, audienceId: string | null, db: Db = prisma) {
    return db.emailCampaign.update({ where: { id }, data: { audienceId } });
  },

  // -------------------- Step 4: schedule / send --------------------
  // Both paths below go through Plunk's Campaigns API, which owns the
  // actual queueing/throttling/scheduling — this service just creates or
  // updates the campaign's content and tells Plunk when to fire it.

  /**
   * Pushes this campaign's current content to Plunk as a campaign
   * (creating it on first call), returning its external id.
   *
   * Reads and writes each run in their own short `withRLS` transaction;
   * the Plunk call in between runs outside any transaction, so a slow
   * campaign API response can never trip Prisma's interactive-transaction
   * timeout (see withRLS).
   */
  async syncBroadcastContent(campaignId: string, userId: string) {
    const campaign = await withRLS(userId, (tx) => campaignService.get(campaignId, tx));
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);
    if (!campaign.audience) throw new Error("Pick an audience before scheduling or sending this campaign.");
    if (!campaign.audience.externalId) {
      throw new Error("This audience hasn't synced to Plunk yet — try re-saving it, or contact an admin.");
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

  /** Send immediately via Plunk's Campaigns API. */
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
  /**
   * Once a campaign has been handed to Plunk (externalBroadcastId is set),
   * its numbers are read live from Plunk's own GET /campaigns/:id/stats
   * rather than accumulated from our own webhook ingestion — Plunk has no
   * dashboard-configurable webhook subscription the way Resend did (see
   * plunkProvider.ts's class comment), so per-recipient CampaignEvent rows
   * won't exist for a Plunk send unless you've separately wired up a Plunk
   * Workflow webhook. Plunk's stats are described as "recomputed from the
   * underlying emails and events on every call" — authoritative, not
   * eventually consistent — so polling here is a good fit, not a
   * workaround.
   *
   * `engaged`/`engagedRate` (opened AND clicked by the same recipient) has
   * no equivalent in Plunk's aggregate stats — it needs a per-recipient
   * join we don't have without webhook-ingested CampaignEvent rows — so
   * both are always 0 for a Plunk-sourced result.
   *
   * The network call runs outside any transaction — same reasoning as
   * syncBroadcastContent. Draft campaigns (no externalBroadcastId yet)
   * fall back to the local recipient/event tables, which will normally
   * just be empty (nothing's been sent).
   */
  async getAnalytics(campaignId: string, userId: string) {
    const campaign = await withRLS(userId, (tx) => tx.emailCampaign.findUnique({ where: { id: campaignId } }));
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

    if (campaign.externalBroadcastId) {
      const stats = await getBroadcastProvider().getBroadcastStats(campaign.externalBroadcastId);
      const { sent, delivered, bounced } = stats;
      return {
        totalRecipients: stats.totalRecipients,
        pending: Math.max(stats.totalRecipients - sent, 0),
        sent,
        delivered,
        opened: stats.opened,
        clicked: stats.clicked,
        engaged: 0,
        bounced,
        unsubscribed: stats.unsubscribed,
        complained: stats.complained,
        deliveryRate: sent ? delivered / sent : 0,
        openRate: delivered ? stats.opened / delivered : 0,
        clickRate: delivered ? stats.clicked / delivered : 0,
        engagedRate: 0,
        bounceRate: sent ? bounced / sent : 0,
      };
    }

    return withRLS(userId, async (tx) => {
      const [recipientCounts, eventCounts, openedRecipients, clickedRecipients] = await Promise.all([
        tx.campaignRecipient.groupBy({ by: ["status"], where: { campaignId }, _count: true }),
        tx.campaignEvent.groupBy({ by: ["type"], where: { campaignId }, _count: true }),
        tx.campaignEvent.findMany({
          where: { campaignId, type: "opened", recipientId: { not: null } },
          select: { recipientId: true },
          distinct: ["recipientId"],
        }),
        tx.campaignEvent.findMany({
          where: { campaignId, type: "clicked", recipientId: { not: null } },
          select: { recipientId: true },
          distinct: ["recipientId"],
        }),
      ]);

      const clickedIds = new Set(clickedRecipients.map((r) => r.recipientId));
      const engagedRecipients = openedRecipients.filter((r) => clickedIds.has(r.recipientId)).length;

      return computeCampaignAnalytics(recipientCounts, eventCounts, engagedRecipients);
    });
  },

  // -------------------- Webhook ingestion --------------------
  // Always runs on the unrestricted `prisma` singleton, never withRLS —
  // there's no signed-in user for an inbound provider webhook to scope to.
  //
  // Kept for whichever provider actually produces `broadcastId`-correlated
  // events (this was written for Resend's Broadcast webhooks, which carry
  // one). getAnalytics() no longer depends on this path — it polls Plunk's
  // own live stats instead (see its comment) — and PlunkMailProvider's
  // best-effort parseWebhookEvents doesn't set `broadcastId` at all (Plunk's
  // Workflow-webhook payloads aren't scoped to a campaign send the way
  // Resend's were), so events arriving through the generic webhook route
  // will currently just no-op below rather than update anything. Left in
  // place as real, working plumbing for a future provider (or a
  // more-specific Plunk Workflow payload) that does carry that
  // correlation, not dead code to delete.
  async recordWebhookEvent(event: {
    type: string;
    providerMessageId?: string;
    broadcastId?: string;
    audienceId?: string;
    email?: string;
    url?: string;
    occurredAt: Date;
  }) {
    // Unsubscribes scoped to the audience rather than one campaign send —
    // no CampaignEvent row here: we have no reliable way to attribute an
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
