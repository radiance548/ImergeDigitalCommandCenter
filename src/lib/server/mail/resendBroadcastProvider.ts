import type { AudienceSyncContact } from "./types";
import type { BroadcastProvider, CreateOrUpdateBroadcastInput } from "./broadcastProvider";

const RESEND_API_BASE = "https://api.resend.com";

/** RFC 4180 field escaping — quotes a value only if it needs it. */
function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Resend Broadcasts (https://resend.com/docs/dashboard/broadcasts/introduction)
 * — Resend's own audience-targeted send: it owns the queue, throttling,
 * and scheduling internally once you call send/schedule, so our app no
 * longer needs its own dispatch queue for the Campaign Builder.
 *
 * Implemented via direct REST calls (rather than guessing at the Node
 * SDK's broadcast method surface, which wasn't fully confirmed at the
 * time this was written) against the documented endpoints:
 *   POST   /audiences
 *   POST   /contacts/imports          (bulk upsert — see upsertContacts)
 *   POST   /broadcasts
 *   PATCH  /broadcasts/{id}
 *   POST   /broadcasts/{id}/send      body: { scheduled_at?: string }
 *   DELETE /broadcasts/{id}
 *
 * Resend renamed "Audiences" to "Segments" — GET /audiences and GET
 * /segments return identical resources with identical ids (confirmed
 * directly against a live account), so `/audiences` + `/audiences/{id}/contacts`
 * still work fine for creating an audience/adding contacts. Broadcast
 * *creation* specifically requires the newer `segment_id` field name
 * though (same id value, just a different key) — see createOrUpdateBroadcast.
 */
export class ResendBroadcastProvider implements BroadcastProvider {
  readonly key = "resend";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const res = await fetch(`${RESEND_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = (json as { message?: string })?.message || `Resend API error (${res.status})`;
      throw new Error(message);
    }
    return json as T;
  }

  async createAudience(name: string): Promise<{ externalId: string }> {
    const result = await this.request<{ id: string }>("/audiences", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    return { externalId: result.id };
  }

  /**
   * Bulk-upserts via Resend's Contacts Import API (POST /contacts/imports)
   * instead of one POST per contact — with a few thousand contacts, the old
   * per-contact loop could take minutes and risked tripping Resend's rate
   * limit (10 req/s/team). This is one request no matter how many contacts,
   * at the cost of being async: Resend processes the CSV in the background
   * and this only confirms the import was *accepted*, not that every
   * contact has landed yet. That's an acceptable trade here since the
   * caller (audienceService.importContacts) already treats this sync as
   * best-effort and fire-and-forget.
   */
  async upsertContacts(audienceExternalId: string, contacts: AudienceSyncContact[]): Promise<void> {
    if (!contacts.length) return;

    const csv = [
      "email,first_name,last_name",
      ...contacts.map((c) => [c.email, c.firstName ?? "", c.lastName ?? ""].map(csvField).join(",")),
    ].join("\n");

    const form = new FormData();
    form.set("file", new Blob([csv], { type: "text/csv" }), "contacts.csv");
    form.set("column_map", JSON.stringify({ email: "email", first_name: "first_name", last_name: "last_name" }));
    form.set("on_conflict", "upsert");
    form.set("segments", JSON.stringify([{ id: audienceExternalId }]));

    // Not routed through `request()` — that helper always sets
    // Content-Type: application/json, but a multipart body needs fetch to
    // compute its own boundary-bearing Content-Type instead.
    const res = await fetch(`${RESEND_API_BASE}/contacts/imports`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = (json as { message?: string })?.message || `Resend API error (${res.status})`;
      throw new Error(message);
    }
  }

  async createOrUpdateBroadcast(input: CreateOrUpdateBroadcastInput): Promise<{ externalId: string }> {
    // Resend renamed "Audiences" to "Segments" — /audiences and /segments
    // now return the exact same resources with identical ids (confirmed
    // directly against a live account: GET /audiences and GET /segments
    // returned identical lists), but broadcast creation specifically
    // requires the field to be named `segment_id`, not `audience_id`. The
    // old `audience_id` field name is silently accepted by some Resend
    // endpoints for backward compat, but NOT here — without a resolvable
    // segment_id, Resend can't tell which contact is receiving each send,
    // which is exactly why {{{contact.first_name|there}}}-style merge
    // tags rendered as literal text instead of being substituted.
    const body = JSON.stringify({
      name: input.name,
      segment_id: input.audienceExternalId,
      from: input.from.name ? `${input.from.name} <${input.from.email}>` : input.from.email,
      subject: input.subject,
      html: input.html,
    });

    if (input.externalBroadcastId) {
      await this.request(`/broadcasts/${input.externalBroadcastId}`, { method: "PATCH", body });
      return { externalId: input.externalBroadcastId };
    }

    const result = await this.request<{ id: string }>("/broadcasts", { method: "POST", body });
    return { externalId: result.id };
  }

  async sendBroadcast(externalBroadcastId: string, scheduledAt?: Date): Promise<void> {
    await this.request(`/broadcasts/${externalBroadcastId}/send`, {
      method: "POST",
      body: JSON.stringify(scheduledAt ? { scheduled_at: scheduledAt.toISOString() } : {}),
    });
  }

  async cancelBroadcast(externalBroadcastId: string): Promise<void> {
    await this.request(`/broadcasts/${externalBroadcastId}`, { method: "DELETE" });
  }
}
