import type { MailProvider, NormalizedWebhookEvent, SendEmailInput, SendEmailResult } from "./types";

const PLUNK_API_BASE = "https://next-api.useplunk.com/v1";

/**
 * Plunk (https://useplunk.com) — transactional single-email sends.
 *
 * Implemented via direct REST calls against Plunk's confirmed API surface
 * (POST /send — see their official @plunk/node SDK source, which is a thin
 * wrapper over the same endpoint) rather than adding the SDK as a
 * dependency, matching this codebase's existing style for mail providers.
 *
 * Two real gaps vs. the Resend implementation this replaced, both because
 * of how Plunk's API is shaped, not an oversight here:
 *
 * 1. POST /send returns only `{ success: true }` — no per-message id.
 *    `providerMessageId` below is always undefined, so nothing sent through
 *    this provider can be correlated back to a specific delivery/open/click
 *    webhook event later. (Not currently a regression in practice — see
 *    the note on `MailProvider.send` in types.ts, nothing in this app
 *    calls it yet; the Campaign Builder sends through PlunkBroadcastProvider
 *    instead, whose analytics come from polling GET /campaigns/:id/stats.)
 *
 * 2. Plunk has no dashboard-configurable webhook subscription like Resend's.
 *    Inbound events only exist as a step inside a manually-built Workflow
 *    (their automation feature) — one Workflow per event type you care
 *    about, authenticated by a shared secret header you set on that step
 *    (see https://docs.useplunk.com/guides/webhooks), not an HMAC
 *    signature. `parseWebhookEvents` below verifies that shared secret via
 *    PLUNK_WEBHOOK_SECRET and parses the documented default payload shape
 *    ({ contact, event, workflow, execution }) — but since nothing in this
 *    app currently points a Workflow at this endpoint, treat this as
 *    best-effort scaffolding to validate once (if) that's set up, not a
 *    confirmed-working path the way the send half is.
 */
export class PlunkMailProvider implements MailProvider {
  readonly key = "plunk";
  readonly label = "Plunk";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const res = await fetch(`${PLUNK_API_BASE}/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: input.to.email,
        subject: input.content.subject,
        body: input.content.html,
        type: "html",
        from: input.from.email,
        name: input.from.name,
        subscribed: true,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = (json as { message?: string })?.message || `Plunk API error (${res.status})`;
      return { ok: false, error: message };
    }
    // See the class comment — Plunk's /send response carries no message id.
    return { ok: true };
  }

  async parseWebhookEvents(payload: unknown, headers: Headers): Promise<NormalizedWebhookEvent[]> {
    const secret = process.env.PLUNK_WEBHOOK_SECRET;
    if (secret) {
      const authHeader = headers.get("authorization");
      if (authHeader !== `Bearer ${secret}`) {
        throw new Error("Invalid or missing Plunk webhook shared secret");
      }
    }

    const body = payload as {
      event?: { name?: string; url?: string } & Record<string, unknown>;
      contact?: { email?: string };
    };

    const eventName = body.event?.name;
    const email = body.contact?.email;
    if (!eventName || !email) return [];

    const typeMap: Record<string, NormalizedWebhookEvent["type"]> = {
      "email.sent": "sent",
      "email.delivery": "delivered",
      "email.open": "opened",
      "email.click": "clicked",
      "email.bounce": "bounced",
      "email.complaint": "complained",
      "contact.unsubscribed": "unsubscribed",
    };
    const type = typeMap[eventName];
    if (!type) return [];

    return [
      {
        type,
        email,
        url: typeof body.event?.url === "string" ? body.event.url : undefined,
        occurredAt: new Date(),
        raw: body,
      },
    ];
  }
}
