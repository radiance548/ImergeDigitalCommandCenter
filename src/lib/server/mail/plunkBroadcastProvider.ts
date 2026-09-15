import type { AudienceSyncContact } from "./types";
import type { BroadcastProvider, BroadcastStats, CreateOrUpdateBroadcastInput } from "./broadcastProvider";

// No /v1 prefix here — unlike /v1/send and /v1/track (the narrow "Public
// API" surface, see plunkProvider.ts), segments/contacts/campaigns
// management lives directly off the API root — confirmed against Plunk's
// own example requests (e.g. "Create Contact" -> POST /contacts, no /v1).
const PLUNK_API_BASE = "https://next-api.useplunk.com";

/** Concurrent request cap for the per-contact upsert loop in upsertContacts — see its comment. */
const UPSERT_CONCURRENCY = 10;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Plunk Campaigns (https://docs.useplunk.com/concepts/campaigns) — Plunk's
 * equivalent of Resend Broadcasts: an audience-targeted send Plunk itself
 * queues and dispatches, tracked by its own id.
 *
 * Built against Plunk's documented REST surface + their official
 * @plunk/node SDK source (for the transactional /send shape — see
 * plunkProvider.ts) rather than adding the SDK as a dependency, matching
 * this codebase's existing direct-REST style. A few endpoints below
 * (segment creation's exact body, the send/schedule sequencing) are
 * flagged inline as unconfirmed — Plunk's public docs were inconsistent
 * on these specifics as of when this was written; validate against a real
 * API key before relying on them in production.
 *
 * Terminology mapping from the Resend implementation this replaced:
 *   Resend "Audience"  → Plunk "Segment" (specifically a STATIC segment —
 *     dynamic/query-based segments reject membership-management calls)
 *   Resend "Broadcast"  → Plunk "Campaign"
 *
 * One structural difference worth knowing: Resend's contacts lived inside
 * a specific audience by construction. Plunk's contacts are global to the
 * project — a Segment is just a named grouping of them — so upsertContacts
 * below does two things: upserts each contact's data globally, then adds
 * them to this specific segment.
 */
export class PlunkBroadcastProvider implements BroadcastProvider {
  readonly key = "plunk";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const res = await fetch(`${PLUNK_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = (json as { message?: string })?.message || `Plunk API error (${res.status})`;
      throw new Error(message);
    }
    return json as T;
  }

  async createAudience(name: string): Promise<{ externalId: string }> {
    // Body shape unconfirmed against a live account — Plunk's docs describe
    // static-segment creation as a dashboard-only action in one place, but
    // the API reference sitemap separately lists POST /segments as a real
    // endpoint. Validate this once PLUNK_API_KEY is available.
    const result = await this.request<{ id: string }>("/segments", {
      method: "POST",
      body: JSON.stringify({ name, type: "STATIC" }),
    });
    return { externalId: result.id };
  }

  async deleteAudience(audienceExternalId: string): Promise<void> {
    await this.request(`/segments/${audienceExternalId}`, { method: "DELETE" });
  }

  /**
   * Plunk contacts are global (not scoped to a segment the way Resend's
   * were scoped to an audience), so this is two steps: upsert each
   * contact's data, then bulk-add them to this segment.
   *
   * The upsert step is one request per contact — this is the same
   * round-trip-per-contact shape that turned out to be the real bottleneck
   * for Resend at a few thousand contacts (see audienceService.importContacts's
   * history). Kept here as a bounded-concurrency batch (10 at a time)
   * rather than fully serial to avoid repeating that mistake outright, but
   * Plunk's "Bulk Operations" / "CSV Import" endpoints (present in their
   * API sitemap, not yet confirmed in detail) are worth investigating for
   * a genuine single-request bulk upsert once validated for real.
   */
  async upsertContacts(audienceExternalId: string, contacts: AudienceSyncContact[]): Promise<void> {
    if (!contacts.length) return;

    for (const batch of chunk(contacts, UPSERT_CONCURRENCY)) {
      await Promise.all(
        batch.map((c) =>
          this.request("/contacts", {
            method: "POST",
            body: JSON.stringify({
              email: c.email,
              subscribed: true,
              data: {
                ...(c.firstName ? { firstName: c.firstName } : {}),
                ...(c.lastName ? { lastName: c.lastName } : {}),
                ...(c.attributes ?? {}),
              },
            }),
          })
        )
      );
    }

    await this.request(`/segments/${audienceExternalId}/members`, {
      method: "POST",
      body: JSON.stringify({
        emails: contacts.map((c) => c.email),
        createMissing: true,
        subscribed: true,
      }),
    });
  }

  async createOrUpdateBroadcast(input: CreateOrUpdateBroadcastInput): Promise<{ externalId: string }> {
    const body = JSON.stringify({
      name: input.name,
      subject: input.subject,
      body: input.html,
      from: input.from.email,
      fromName: input.from.name,
      type: "MARKETING",
      audienceType: "SEGMENT",
      segmentId: input.audienceExternalId,
    });

    if (input.externalBroadcastId) {
      await this.request(`/campaigns/${input.externalBroadcastId}`, { method: "PUT", body });
      return { externalId: input.externalBroadcastId };
    }

    // POST /campaigns wraps its response as { success, data: {...} } —
    // confirmed directly against a live account (unlike POST /segments,
    // which returns the created object flat with no wrapper; Plunk isn't
    // consistent about this across endpoints).
    const result = await this.request<{ data: { id: string } }>("/campaigns", { method: "POST", body });
    return { externalId: result.data.id };
  }

  async sendBroadcast(externalBroadcastId: string, scheduledAt?: Date): Promise<void> {
    // scheduledFor must be in the POST /campaigns/:id/send request body
    // itself — confirmed directly against Plunk's real controller source.
    // An earlier version of this method set it via a separate PUT
    // beforehand, which turned out to be a silent no-op (nothing reads
    // scheduledFor from the update endpoint) and caused a "scheduled" send
    // to fire immediately instead — caught in testing against fake
    // (@example.com, non-deliverable) contacts before it could reach a
    // real audience.
    await this.request(`/campaigns/${externalBroadcastId}/send`, {
      method: "POST",
      body: JSON.stringify(scheduledAt ? { scheduledFor: scheduledAt.toISOString() } : {}),
    });
  }

  async cancelBroadcast(externalBroadcastId: string): Promise<void> {
    await this.request(`/campaigns/${externalBroadcastId}/cancel`, { method: "POST" });
  }

  /**
   * Plunk only allows deleting a DRAFT campaign — confirmed against a live
   * account ("Can only delete draft campaigns"). Deleting a sent campaign
   * isn't offered at all (it's a permanent record), and a still-scheduled
   * one must be canceled back to draft first — callers (campaignService.remove)
   * are expected to cancel before calling this if needed.
   */
  async deleteBroadcast(externalBroadcastId: string): Promise<void> {
    await this.request(`/campaigns/${externalBroadcastId}`, { method: "DELETE" });
  }

  async getBroadcastStats(externalBroadcastId: string): Promise<BroadcastStats> {
    // Also wrapped as { success, data: {...} } — same as POST /campaigns,
    // confirmed directly against a live account.
    const { data: stats } = await this.request<{
      data: {
        totalRecipients: number;
        sentCount: number;
        deliveredCount: number;
        openedCount: number;
        clickedCount: number;
        bouncedCount: number;
        complainedCount: number;
        unsubscribedCount: number;
      };
    }>(`/campaigns/${externalBroadcastId}/stats`, { method: "GET" });

    return {
      totalRecipients: stats.totalRecipients,
      sent: stats.sentCount,
      delivered: stats.deliveredCount,
      opened: stats.openedCount,
      clicked: stats.clickedCount,
      bounced: stats.bouncedCount,
      complained: stats.complainedCount,
      unsubscribed: stats.unsubscribedCount,
    };
  }
}
