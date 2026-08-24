import assert from "node:assert/strict";
import { describe, test } from "./harness";
import { computeCampaignAnalytics } from "../src/lib/server/campaignAnalytics";

describe("campaignAnalytics: computeCampaignAnalytics", () => {
  test("all-zero input produces all-zero output without dividing by zero", () => {
    const result = computeCampaignAnalytics([], []);
    assert.equal(result.totalRecipients, 0);
    assert.equal(result.sent, 0);
    assert.equal(result.deliveryRate, 0);
    assert.equal(result.openRate, 0);
    assert.equal(result.clickRate, 0);
    assert.equal(result.bounceRate, 0);
    assert.equal(result.engaged, 0);
    assert.equal(result.engagedRate, 0);
  });

  test("totalRecipients sums across every recipient status, not just 'sent'", () => {
    const result = computeCampaignAnalytics(
      [
        { status: "sent", _count: 80 },
        { status: "failed", _count: 15 },
        { status: "pending", _count: 5 },
      ],
      []
    );
    assert.equal(result.totalRecipients, 100);
  });

  test("pending reads straight from the recipient-status count (pre-created at send time)", () => {
    // e.g. right after hitting Send, before any provider webhook has arrived
    const result = computeCampaignAnalytics(
      [
        { status: "pending", _count: 500 },
        { status: "sent", _count: 0 },
      ],
      []
    );
    assert.equal(result.pending, 500);
    assert.equal(result.totalRecipients, 500);
  });

  test("computes delivery/open/click/bounce rates correctly from a realistic mix", () => {
    const recipientCounts = [{ status: "sent", _count: 100 }];
    const eventCounts = [
      { type: "sent", _count: 100 },
      { type: "delivered", _count: 95 },
      { type: "opened", _count: 40 },
      { type: "clicked", _count: 10 },
      { type: "bounced", _count: 5 },
    ];
    const result = computeCampaignAnalytics(recipientCounts, eventCounts);

    assert.equal(result.sent, 100);
    assert.equal(result.delivered, 95);
    assert.equal(result.opened, 40);
    assert.equal(result.clicked, 10);
    assert.equal(result.bounced, 5);
    assert.equal(result.deliveryRate, 0.95);
    assert.equal(result.openRate, 40 / 95);
    assert.equal(result.clickRate, 10 / 95);
    assert.equal(result.bounceRate, 0.05);
  });

  test("'sent' falls back to the recipient-status count when no sent event exists yet", () => {
    // e.g. right after dispatch, before any provider webhook has arrived
    const result = computeCampaignAnalytics([{ status: "sent", _count: 50 }], []);
    assert.equal(result.sent, 50);
  });

  test("'bounced' falls back to recipient-status count the same way", () => {
    const result = computeCampaignAnalytics([{ status: "bounced", _count: 3 }], []);
    assert.equal(result.bounced, 3);
  });

  test("event counts take priority over recipient-status counts when both exist", () => {
    // 'sent' event count should win over the recipient row's raw status count
    const result = computeCampaignAnalytics(
      [{ status: "sent", _count: 50 }],
      [{ type: "sent", _count: 48 }] // e.g. 2 recipients still mid-send
    );
    assert.equal(result.sent, 48);
  });

  test("openRate/clickRate are relative to delivered, not sent (a stricter, more honest metric)", () => {
    const result = computeCampaignAnalytics(
      [{ status: "sent", _count: 100 }],
      [
        { type: "sent", _count: 100 },
        { type: "delivered", _count: 50 }, // half didn't deliver
        { type: "opened", _count: 50 }, // but everyone who got it opened it
      ]
    );
    // If openRate were computed against `sent` this would be 0.5, not 1.0.
    assert.equal(result.openRate, 1);
  });

  test("engaged/engagedRate come from the recipient-level opened-and-clicked count, not the raw event totals", () => {
    // 100 delivered, 60 raw "opened" events, 20 raw "clicked" events, but only
    // 15 recipients account for both — that 15 is what campaignService computes
    // via a per-recipient join and passes in as the third argument.
    const result = computeCampaignAnalytics(
      [{ status: "sent", _count: 100 }],
      [
        { type: "delivered", _count: 100 },
        { type: "opened", _count: 60 },
        { type: "clicked", _count: 20 },
      ],
      15
    );
    assert.equal(result.engaged, 15);
    assert.equal(result.engagedRate, 0.15);
  });

  test("engagedRecipients defaults to 0 when omitted", () => {
    const result = computeCampaignAnalytics([{ status: "sent", _count: 10 }], [{ type: "delivered", _count: 10 }]);
    assert.equal(result.engaged, 0);
    assert.equal(result.engagedRate, 0);
  });

  test("unsubscribed and complained pass through directly with no rate computed for them", () => {
    const result = computeCampaignAnalytics(
      [],
      [
        { type: "unsubscribed", _count: 2 },
        { type: "complained", _count: 1 },
      ]
    );
    assert.equal(result.unsubscribed, 2);
    assert.equal(result.complained, 1);
  });
});
