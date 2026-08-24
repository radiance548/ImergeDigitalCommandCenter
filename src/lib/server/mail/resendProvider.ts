import { Resend } from "resend";
import type {
  AudienceSyncContact,
  MailProvider,
  MailWebhookEventType,
  NormalizedWebhookEvent,
  SendEmailInput,
  SendEmailResult,
} from "./types";

const EVENT_TYPE_MAP: Record<string, MailWebhookEventType> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

/**
 * Resend (https://resend.com) — recommended default for the campaign
 * builder. Requires RESEND_API_KEY and, for webhook signature
 * verification, RESEND_WEBHOOK_SECRET (the `whsec_...` value shown when
 * you create the webhook endpoint in the Resend dashboard).
 */
export class ResendMailProvider implements MailProvider {
  readonly key = "resend";
  readonly label = "Resend";
  private client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const { data, error } = await this.client.emails.send({
      from: input.from.name ? `${input.from.name} <${input.from.email}>` : input.from.email,
      to: input.to.name ? `${input.to.name} <${input.to.email}>` : input.to.email,
      subject: input.content.subject,
      html: input.content.html,
      text: input.content.text,
      // Resend "tags" round-trip through webhook events — used to correlate
      // a delivery event back to our CampaignRecipient row without relying
      // solely on email_id (useful if you ever batch-send).
      tags: input.metadata
        ? Object.entries(input.metadata).map(([name, value]) => ({ name, value: String(value) }))
        : undefined,
      scheduledAt: input.sendAt?.toISOString(),
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true, providerMessageId: data?.id };
  }

  async syncAudienceContacts(audienceId: string, contacts: AudienceSyncContact[]): Promise<void> {
    // Resend Audiences: https://resend.com/docs/api-reference/contacts/create-contact
    // audienceId here should be a Resend Audience ID (create one in the
    // Resend dashboard or via their Audiences API and store it on our
    // Audience row, e.g. in a future `externalId` column).
    for (const contact of contacts) {
      await this.client.contacts.create({
        audienceId,
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        unsubscribed: false,
      });
    }
  }

  async parseWebhookEvents(payload: unknown, headers: Headers): Promise<NormalizedWebhookEvent[]> {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (secret) {
      const { Webhook } = await import("svix");
      const svixId = headers.get("svix-id");
      const svixTimestamp = headers.get("svix-timestamp");
      const svixSignature = headers.get("svix-signature");
      if (!svixId || !svixTimestamp || !svixSignature) {
        throw new Error("Missing Svix signature headers on Resend webhook request");
      }
      new Webhook(secret).verify(JSON.stringify(payload), {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      });
    }

    const body = payload as {
      type?: string;
      created_at?: string;
      data?: Record<string, unknown> & {
        broadcast_id?: string;
        audience_id?: string;
        unsubscribed?: boolean;
        email?: string;
      };
    };
    const data = body.data || {};
    const occurredAt = body.created_at ? new Date(body.created_at) : new Date();

    // Resend has no "email.unsubscribed" event — a broadcast unsubscribe
    // surfaces as a contact-level update instead (data.unsubscribed flips
    // to true), scoped to the audience rather than any one campaign send,
    // since Resend doesn't tell us which broadcast triggered it.
    // https://resend.com/docs/webhooks/contacts/updated
    if (body.type === "contact.updated") {
      if (!data.unsubscribed || !data.audience_id || !data.email) return [];
      return [
        {
          type: "unsubscribed",
          audienceId: data.audience_id,
          email: data.email,
          occurredAt,
          raw: body,
        },
      ];
    }

    const type = body.type ? EVENT_TYPE_MAP[body.type] : undefined;
    if (!type) return [];

    const to = Array.isArray(data.to) ? (data.to[0] as string) : undefined;
    const click = data.click as { link?: string } | undefined;

    return [
      {
        type,
        providerMessageId: (data.email_id as string) || undefined,
        broadcastId: data.broadcast_id,
        email: to,
        url: click?.link,
        occurredAt,
        raw: body,
      },
    ];
  }
}
