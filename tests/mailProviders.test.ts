import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, test } from "./harness";
import { ConsoleMailProvider } from "../src/lib/server/mail/consoleProvider";
import { PlunkMailProvider } from "../src/lib/server/mail/plunkProvider";
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

describe("mail: PlunkMailProvider webhook parsing", () => {
  test("maps a known event type without a configured secret (dev/testing mode)", async () => {
    delete process.env.PLUNK_WEBHOOK_SECRET;
    const provider = new PlunkMailProvider("sk_fake_key_for_tests");
    const payload = {
      event: { name: "email.delivery" },
      contact: { email: "recipient@example.com" },
    };
    const events = await provider.parseWebhookEvents(payload, new Headers());
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "delivered");
    assert.equal(events[0].email, "recipient@example.com");
  });

  test("extracts the clicked URL from a click event", async () => {
    delete process.env.PLUNK_WEBHOOK_SECRET;
    const provider = new PlunkMailProvider("sk_fake_key_for_tests");
    const payload = {
      event: { name: "email.click", url: "https://example.com/offer" },
      contact: { email: "a@example.com" },
    };
    const events = await provider.parseWebhookEvents(payload, new Headers());
    assert.equal(events[0].url, "https://example.com/offer");
  });

  test("maps contact.unsubscribed to our normalized 'unsubscribed' type", async () => {
    delete process.env.PLUNK_WEBHOOK_SECRET;
    const provider = new PlunkMailProvider("sk_fake_key_for_tests");
    const payload = { event: { name: "contact.unsubscribed" }, contact: { email: "a@example.com" } };
    const events = await provider.parseWebhookEvents(payload, new Headers());
    assert.equal(events[0].type, "unsubscribed");
  });

  test("returns an empty array for an unrecognized event name", async () => {
    delete process.env.PLUNK_WEBHOOK_SECRET;
    const provider = new PlunkMailProvider("sk_fake_key_for_tests");
    const events = await provider.parseWebhookEvents(
      { event: { name: "email.something_new" }, contact: { email: "a@example.com" } },
      new Headers()
    );
    assert.deepEqual(events, []);
  });

  test("returns an empty array when the contact email is missing", async () => {
    delete process.env.PLUNK_WEBHOOK_SECRET;
    const provider = new PlunkMailProvider("sk_fake_key_for_tests");
    const events = await provider.parseWebhookEvents({ event: { name: "email.delivery" } }, new Headers());
    assert.deepEqual(events, []);
  });

  test("accepts a correctly-configured shared-secret Authorization header", async () => {
    process.env.PLUNK_WEBHOOK_SECRET = "test-shared-secret";
    const provider = new PlunkMailProvider("sk_fake_key_for_tests");
    const headers = new Headers({ authorization: "Bearer test-shared-secret" });
    const events = await provider.parseWebhookEvents(
      { event: { name: "email.delivery" }, contact: { email: "a@example.com" } },
      headers
    );
    assert.equal(events.length, 1);
    delete process.env.PLUNK_WEBHOOK_SECRET;
  });

  test("rejects the request when a secret IS configured but the header is missing or wrong", async () => {
    process.env.PLUNK_WEBHOOK_SECRET = "test-shared-secret";
    const provider = new PlunkMailProvider("sk_fake_key_for_tests");
    await assert.rejects(
      () => provider.parseWebhookEvents({ event: { name: "email.delivery" }, contact: {} }, new Headers()),
      /shared secret/i
    );
    delete process.env.PLUNK_WEBHOOK_SECRET;
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
