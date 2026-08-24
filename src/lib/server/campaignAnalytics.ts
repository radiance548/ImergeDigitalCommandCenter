export interface CampaignAnalyticsResult {
  totalRecipients: number;
  pending: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  engaged: number;
  bounced: number;
  unsubscribed: number;
  complained: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  engagedRate: number;
  bounceRate: number;
}

/**
 * Turns raw groupBy counts (recipient status counts + event type counts)
 * into the analytics numbers the Campaign Builder's Analytics step shows.
 *
 * Pulled out of campaignService so the aggregation math — and its
 * fallback rules (e.g. "sent" prefers the event count but falls back to
 * the recipient-status count) — can be unit-tested without a database.
 *
 * `engagedRecipients` (recipients with both an "opened" and a "clicked"
 * event) can't be derived from the grouped counts above — it needs a
 * per-recipient join, which campaignService computes separately and
 * passes in here. It exists because raw open counts are inflated by mail
 * apps that auto-preview messages (e.g. Apple's Mail Privacy Protection)
 * before a recipient ever sees them; a recipient who also clicked a link
 * can't be explained by that, so it's a much more trustworthy signal of
 * a real read than "opened" alone.
 */
export function computeCampaignAnalytics(
  recipientCounts: { status: string; _count: number }[],
  eventCounts: { type: string; _count: number }[],
  engagedRecipients = 0
): CampaignAnalyticsResult {
  const recipients = Object.fromEntries(recipientCounts.map((r) => [r.status, r._count]));
  const events = Object.fromEntries(eventCounts.map((e) => [e.type, e._count]));

  const sent = events.sent ?? recipients.sent ?? 0;
  const delivered = events.delivered ?? 0;
  const opened = events.opened ?? 0;
  const clicked = events.clicked ?? 0;
  const bounced = events.bounced ?? recipients.bounced ?? 0;
  const unsubscribed = events.unsubscribed ?? 0;
  const complained = events.complained ?? 0;

  return {
    totalRecipients: Object.values(recipients).reduce((a, b) => a + b, 0),
    pending: recipients.pending ?? 0,
    sent,
    delivered,
    opened,
    clicked,
    engaged: engagedRecipients,
    bounced,
    unsubscribed,
    complained,
    deliveryRate: sent ? delivered / sent : 0,
    openRate: delivered ? opened / delivered : 0,
    clickRate: delivered ? clicked / delivered : 0,
    engagedRate: delivered ? engagedRecipients / delivered : 0,
    bounceRate: sent ? bounced / sent : 0,
  };
}
