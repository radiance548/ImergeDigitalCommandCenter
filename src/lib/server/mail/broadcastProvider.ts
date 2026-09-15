// ============================================================
// BroadcastProvider abstraction
//
// Separate from MailProvider (types.ts) on purpose: a "broadcast" —
// create an audience-targeted campaign, let the provider manage its own
// queue/throttle/scheduling internally, track it by an external id — is a
// Plunk-specific primitive (their Campaigns API), not something Loops or
// plain SMTP have an equivalent for in the same shape. Modeling it as a
// generic interface implemented by only one provider would be dishonest
// abstraction; this interface exists so the Campaign Builder's service
// layer isn't littered with Plunk-specific fetch calls directly, while
// being upfront that Plunk is the one implementation.
//
// MailProvider (single-email send + webhook parsing) remains
// provider-agnostic and available separately for any future transactional
// email use case outside the Campaign Builder.
// ============================================================

import type { AudienceSyncContact, EmailAddress } from "./types";

export interface CreateOrUpdateBroadcastInput {
  /** Existing Plunk campaign id to update, or null to create a new one. */
  externalBroadcastId: string | null;
  audienceExternalId: string;
  from: EmailAddress;
  subject: string;
  html: string;
  /** Internal label shown in the Plunk dashboard, not sent to recipients. */
  name: string;
}

/**
 * Live-recomputed aggregate counts, read directly from the provider rather
 * than accumulated from our own webhook ingestion — see the comment on
 * campaignService.getAnalytics for why (Plunk has no dashboard-configurable
 * webhook subscription the way Resend did, so per-recipient event
 * correlation isn't available; these totals are the authoritative source
 * instead).
 */
export interface BroadcastStats {
  totalRecipients: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
}

export interface BroadcastProvider {
  readonly key: string;

  /** Creates a new audience on the provider, returning its external id. */
  createAudience(name: string): Promise<{ externalId: string }>;

  /** Deletes a provider-side audience, e.g. to roll back a failed local creation. */
  deleteAudience(audienceExternalId: string): Promise<void>;

  /** Adds/updates contacts in a provider-side audience. */
  upsertContacts(audienceExternalId: string, contacts: AudienceSyncContact[]): Promise<void>;

  /** Creates a new broadcast, or updates an existing one's content, returning its external id. */
  createOrUpdateBroadcast(input: CreateOrUpdateBroadcastInput): Promise<{ externalId: string }>;

  /** Sends immediately (omit scheduledAt) or schedules a broadcast for later. */
  sendBroadcast(externalBroadcastId: string, scheduledAt?: Date): Promise<void>;

  /** Cancels a scheduled (not-yet-sent) broadcast. */
  cancelBroadcast(externalBroadcastId: string): Promise<void>;

  /** Deletes a draft (never-sent) broadcast, e.g. when the local campaign row is deleted. */
  deleteBroadcast(externalBroadcastId: string): Promise<void>;

  /** Fetches live delivery/engagement stats for a sent broadcast. */
  getBroadcastStats(externalBroadcastId: string): Promise<BroadcastStats>;
}
