import crypto from "crypto";
import type {
  AudienceSyncContact,
  MailProvider,
  MailWebhookEventType,
  NormalizedWebhookEvent,
  SendEmailInput,
  SendEmailResult,
} from "./types";

const LOOPS_API_BASE = "https://app.loops.so/api/v1";

// Maps Loops' actual event names (per https://loops.so/docs/webhooks) to our
// normalized set. Loops has no generic "email.sent" — sends are confirmed via
// source-specific events instead.
const EVENT_TYPE_MAP: Record<string, MailWebhookEventType> = {
  "transactional.email.sent": "sent",
  "campaign.email.sent": "sent",
  "loop.email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.softBounced": "bounced",
  "email.hardBounced": "bounced",
  "email.spamReported": "complained",
  "email.unsubscribed": "unsubscribed",
  "contact.unsubscribed": "unsubscribed",
};

/**
 * Loops (https://loops.so) — good fit if you also want lifecycle/product
 * email (not just campaigns) on the same audience.
 *
 * Loops sends transactional email against a pre-built "transactional
 * email" template (created once in the Loops dashboard, referenced by
 * LOOPS_TRANSACTIONAL_ID) rather than accepting arbitrary raw HTML per
 * request. Configure that template with a data variable (we send it as
 * `emailBody`) rendering raw HTML in the template body so our
 * wizard-authored content still reaches the recipient unmodified.
 *
 * Webhook verification follows Loops' documented scheme exactly (as of
 * https://loops.so/docs/webhooks): headers `Webhook-Id` / `Webhook-Timestamp`
 * / `Webhook-Signature`, secret formatted as `whsec_<base64>`, signed content
 * = `${id}.${timestamp}.${rawBody}`, HMAC-SHA256 digested to base64, compared
 * against any `,<signature>` entry in the space-separated Webhook-Signature
 * header. Event → recipient correlation uses `email.emailMessageId` since
 * that's what a transactional send's response id lines up with; re-verify
 * against a live test webhook if Loops changes this.
 */
export class LoopsMailProvider implements MailProvider {
  readonly key = "loops";
  readonly label = "Loops";
  private apiKey: string;
  private transactionalId: string | undefined;

  constructor(apiKey: string, transactionalId?: string) {
    this.apiKey = apiKey;
    this.transactionalId = transactionalId;
  }

  private async request(path: string, init: RequestInit) {
    const res = await fetch(`${LOOPS_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json };
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const transactionalId = this.transactionalId || process.env.LOOPS_TRANSACTIONAL_ID;
    if (!transactionalId) {
      return { ok: false, error: "LOOPS_TRANSACTIONAL_ID is not configured" };
    }

    const { ok, json } = await this.request("/transactional", {
      method: "POST",
      body: JSON.stringify({
        transactionalId,
        email: input.to.email,
        dataVariables: {
          subject: input.content.subject,
          preheader: input.content.preheader || "",
          emailBody: input.content.html,
          ...input.mergeData,
        },
      }),
    });

    if (!ok) return { ok: false, error: (json as { message?: string }).message || "Loops send failed" };
    return { ok: true, providerMessageId: (json as { id?: string }).id };
  }

  async syncAudienceContacts(_audienceId: string, contacts: AudienceSyncContact[]): Promise<void> {
    for (const contact of contacts) {
      await this.request("/contacts/update", {
        method: "PUT",
        body: JSON.stringify({
          email: contact.email,
          firstName: contact.firstName,
          lastName: contact.lastName,
          subscribed: true,
          ...contact.attributes,
        }),
      });
    }
  }

  async parseWebhookEvents(payload: unknown, headers: Headers): Promise<NormalizedWebhookEvent[]> {
    const secret = process.env.LOOPS_WEBHOOK_SECRET;
    const eventId = headers.get("webhook-id");
    const timestamp = headers.get("webhook-timestamp");
    const signatureHeader = headers.get("webhook-signature");

    if (secret) {
      if (!eventId || !timestamp || !signatureHeader) {
        throw new Error("Missing Webhook-Id/Webhook-Timestamp/Webhook-Signature headers on Loops webhook request");
      }

      const secretParts = secret.split("_");
      const secretBytes = Buffer.from(secretParts[secretParts.length - 1], "base64");
      const signedContent = `${eventId}.${timestamp}.${JSON.stringify(payload)}`;
      const expected = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");

      const matches = signatureHeader.split(" ").some((entry) => entry.includes(`,${expected}`));
      if (!matches) throw new Error("Invalid Loops webhook signature");
    }

    const body = payload as {
      eventName?: string;
      eventTime?: number;
      contactIdentity?: { email?: string };
      email?: { id?: string; emailMessageId?: string };
    };

    const type = body.eventName ? EVENT_TYPE_MAP[body.eventName] : undefined;
    if (!type) return [];

    return [
      {
        type,
        providerMessageId: body.email?.emailMessageId || body.email?.id,
        email: body.contactIdentity?.email,
        occurredAt: body.eventTime ? new Date(body.eventTime * 1000) : new Date(),
        raw: body,
      },
    ];
  }
}
