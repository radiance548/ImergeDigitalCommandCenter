import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, test } from "./harness";
import { ConsoleMailProvider } from "../src/lib/server/mail/consoleProvider";
import { ResendMailProvider } from "../src/lib/server/mail/resendProvider";
import { LoopsMailProvider } from "../src/lib/server/mail/loopsProvider";

describe("mail: ConsoleMailProvider", () => {
  test("send() always succeeds and returns a providerMessageId", async () => {
    const provider = new ConsoleMailProvider();
    const result = await provider.send({
      from: { email: "hello@example.com" },
      to: { email: "recipient@example.com" },
      content: { subject: "Test", html: "<p>Hi</p>" },
    });
    assert.equal(result.ok, true);
    assert.ok(result.providerMessageId?.startsWith("console_"));
  });

  test("parseWebhookEvents always returns an empty array (no real events to receive)", async () => {
    const provider = new ConsoleMailProvider();
    const events = await provider.parseWebhookEvents({}, new Headers());
    assert.deepEqual(events, []);
  });
});

describe("mail: ResendMailProvider webhook parsing", () => {
  test("maps a known event type without a configured secret (dev/testing mode)", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const provider = new ResendMailProvider("re_fake_key_for_tests");
    const payload = {
      type: "email.delivered",
      created_at: "2026-01-01T00:00:00Z",
      data: { email_id: "msg_123", to: ["recipient@example.com"] },
    };
    const events = await provider.parseWebhookEvents(payload, new Headers());
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "delivered");
    assert.equal(events[0].providerMessageId, "msg_123");
    assert.equal(events[0].email, "recipient@example.com");
  });

  test("extracts the clicked URL from a click event", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const provider = new ResendMailProvider("re_fake_key_for_tests");
    const payload = {
      type: "email.clicked",
      data: { email_id: "msg_456", to: ["a@example.com"], click: { link: "https://example.com/offer" } },
    };
    const events = await provider.parseWebhookEvents(payload, new Headers());
    assert.equal(events[0].url, "https://example.com/offer");
  });

  test("extracts broadcast_id when present, for correlating a broadcast send back to our campaign", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const provider = new ResendMailProvider("re_fake_key_for_tests");
    const payload = {
      type: "email.delivered",
      data: { email_id: "msg_789", to: ["a@example.com"], broadcast_id: "brd_abc123" },
    };
    const events = await provider.parseWebhookEvents(payload, new Headers());
    assert.equal(events[0].broadcastId, "brd_abc123");
  });

  test("broadcastId is undefined for a regular (non-broadcast) transactional send", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const provider = new ResendMailProvider("re_fake_key_for_tests");
    const payload = { type: "email.delivered", data: { email_id: "msg_789", to: ["a@example.com"] } };
    const events = await provider.parseWebhookEvents(payload, new Headers());
    assert.equal(events[0].broadcastId, undefined);
  });

  test("returns an empty array for an unrecognized event type", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const provider = new ResendMailProvider("re_fake_key_for_tests");
    const events = await provider.parseWebhookEvents({ type: "email.something_new", data: {} }, new Headers());
    assert.deepEqual(events, []);
  });

  test("rejects the request when a secret IS configured but signature headers are missing", async () => {
    process.env.RESEND_WEBHOOK_SECRET = "whsec_dGVzdHNlY3JldA==";
    const provider = new ResendMailProvider("re_fake_key_for_tests");
    await assert.rejects(
      () => provider.parseWebhookEvents({ type: "email.delivered", data: {} }, new Headers()),
      /svix/i
    );
    delete process.env.RESEND_WEBHOOK_SECRET;
  });
});

describe("mail: LoopsMailProvider webhook parsing", () => {
  test("maps known Loops event names to the normalized set", async () => {
    delete process.env.LOOPS_WEBHOOK_SECRET;
    const provider = new LoopsMailProvider("fake_api_key");

    const cases: [string, string][] = [
      ["transactional.email.sent", "sent"],
      ["campaign.email.sent", "sent"],
      ["email.delivered", "delivered"],
      ["email.opened", "opened"],
      ["email.clicked", "clicked"],
      ["email.softBounced", "bounced"],
      ["email.hardBounced", "bounced"],
      ["email.spamReported", "complained"],
      ["email.unsubscribed", "unsubscribed"],
    ];

    for (const [eventName, expectedType] of cases) {
      const events = await provider.parseWebhookEvents(
        {
          eventName,
          eventTime: 1735689600,
          contactIdentity: { email: "test@example.com" },
          email: { id: "email_1", emailMessageId: "msg_1" },
        },
        new Headers()
      );
      assert.equal(events.length, 1, `expected exactly one event for ${eventName}`);
      assert.equal(events[0].type, expectedType, `${eventName} should map to ${expectedType}`);
    }
  });

  test("returns an empty array for an unrecognized event name", async () => {
    delete process.env.LOOPS_WEBHOOK_SECRET;
    const provider = new LoopsMailProvider("fake_api_key");
    const events = await provider.parseWebhookEvents({ eventName: "something.unheard.of" }, new Headers());
    assert.deepEqual(events, []);
  });

  test("prefers emailMessageId over id for provider message correlation", async () => {
    delete process.env.LOOPS_WEBHOOK_SECRET;
    const provider = new LoopsMailProvider("fake_api_key");
    const events = await provider.parseWebhookEvents(
      { eventName: "email.delivered", email: { id: "raw_id", emailMessageId: "message_id" } },
      new Headers()
    );
    assert.equal(events[0].providerMessageId, "message_id");
  });

  test("accepts a correctly-signed webhook when a secret is configured", async () => {
    // Replicates Loops' own documented signing scheme exactly (see
    // loopsProvider.ts's doc comment) so this test proves our verification
    // logic actually accepts what Loops would really send.
    const secretB64 = Buffer.from("test-secret-bytes").toString("base64");
    process.env.LOOPS_WEBHOOK_SECRET = `whsec_${secretB64}`;

    const payload = { eventName: "email.opened", eventTime: 1735689600, contactIdentity: { email: "a@example.com" } };
    const eventId = "evt_1";
    const timestamp = "1735689600";
    const signedContent = `${eventId}.${timestamp}.${JSON.stringify(payload)}`;
    const signature = crypto
      .createHmac("sha256", Buffer.from(secretB64, "base64"))
      .update(signedContent)
      .digest("base64");

    const headers = new Headers({
      "webhook-id": eventId,
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${signature}`,
    });

    const provider = new LoopsMailProvider("fake_api_key");
    const events = await provider.parseWebhookEvents(payload, headers);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "opened");

    delete process.env.LOOPS_WEBHOOK_SECRET;
  });

  test("rejects a webhook with an incorrect signature", async () => {
    process.env.LOOPS_WEBHOOK_SECRET = `whsec_${Buffer.from("test-secret-bytes").toString("base64")}`;
    const provider = new LoopsMailProvider("fake_api_key");
    const headers = new Headers({
      "webhook-id": "evt_1",
      "webhook-timestamp": "1735689600",
      "webhook-signature": "v1,not-the-real-signature",
    });
    await assert.rejects(
      () => provider.parseWebhookEvents({ eventName: "email.opened" }, headers),
      /Invalid Loops webhook signature/
    );
    delete process.env.LOOPS_WEBHOOK_SECRET;
  });

  test("rejects a webhook missing required headers when a secret is configured", async () => {
    process.env.LOOPS_WEBHOOK_SECRET = `whsec_${Buffer.from("test-secret-bytes").toString("base64")}`;
    const provider = new LoopsMailProvider("fake_api_key");
    await assert.rejects(
      () => provider.parseWebhookEvents({ eventName: "email.opened" }, new Headers()),
      /Missing Webhook-Id/
    );
    delete process.env.LOOPS_WEBHOOK_SECRET;
  });
});
