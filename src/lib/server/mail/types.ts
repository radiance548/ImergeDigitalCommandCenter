// ============================================================
// MailProvider abstraction
//
// Every outbound-email concern in the app (campaign sending,
// analytics ingestion, audience sync) goes through this interface.
// To add a new provider: implement `MailProvider` in a new file in
// this folder, register it in `./index.ts`'s factory, and set
// MAIL_PROVIDER=<key> in the environment. Nothing else changes —
// services, API routes, and the frontend wizard are provider-agnostic.
// ============================================================

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailContent {
  subject: string;
  html: string;
  /** Optional plain-text fallback; providers that need it will generate one if omitted. */
  text?: string;
  preheader?: string;
}

export interface SendEmailInput {
  from: EmailAddress;
  to: EmailAddress;
  content: EmailContent;
  /** Merge tags for personalization, e.g. { first_name: "Ada" }. */
  mergeData?: Record<string, unknown>;
  /** Used to correlate provider webhook events back to our CampaignRecipient row. */
  metadata?: Record<string, string>;
  /** For providers with native scheduling support (optional — we also schedule via our own queue). */
  sendAt?: Date;
}

export interface SendEmailResult {
  ok: boolean;
  /** The provider's message id, used to reconcile webhook events later. */
  providerMessageId?: string;
  error?: string;
}

export interface AudienceSyncContact {
  email: string;
  firstName?: string;
  lastName?: string;
  attributes?: Record<string, unknown>;
}

/** Normalized shape every provider's webhook payload gets translated into. */
export type MailWebhookEventType =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "unsubscribed";

export interface NormalizedWebhookEvent {
  type: MailWebhookEventType;
  providerMessageId?: string;
  /** Present on broadcast sends (Plunk Campaigns) — correlates the event to an EmailCampaign via its externalBroadcastId. */
  broadcastId?: string;
  /** Present on audience/contact-level events (e.g. unsubscribes) that aren't scoped to any one campaign send. */
  audienceId?: string;
  email?: string;
  url?: string;
  occurredAt: Date;
  raw?: unknown;
}

export interface MailProvider {
  /** Machine-readable key, matches the `provider` column on EmailCampaign / MAIL_PROVIDER env var. */
  readonly key: string;
  /** Human-readable label for the campaign wizard's provider picker. */
  readonly label: string;

  /** Send a single email (called once per recipient by the dispatch worker). */
  send(input: SendEmailInput): Promise<SendEmailResult>;

  /**
   * Optional: push/update contacts into the provider's own audience/list
   * feature, for providers (Loops, Plunk contacts, Brevo) that manage
   * lists natively. Providers that don't support this can no-op.
   */
  syncAudienceContacts?(audienceId: string, contacts: AudienceSyncContact[]): Promise<void>;

  /**
   * Verify + parse an inbound webhook request from this provider into our
   * normalized event shape, so the webhook route can stay provider-agnostic.
   */
  parseWebhookEvents(payload: unknown, headers: Headers): Promise<NormalizedWebhookEvent[]>;
}
