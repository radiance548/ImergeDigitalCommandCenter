import assert from "node:assert/strict";
import { describe, test } from "./harness";
import { PlunkBroadcastProvider } from "../src/lib/server/mail/plunkBroadcastProvider";

interface Call {
  url: string;
  method: string;
  body: unknown;
}

function mockFetch(responses: Record<string, unknown>) {
  const calls: Call[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const method = init?.method || "GET";
    calls.push({
      url: String(url),
      method,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body,
    });

    const matchedKey = Object.keys(responses).find((k) => {
      const [m, pattern] = k.split(" ");
      if (m !== method) return false;
      const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
      return regex.test(String(url));
    });

    const body = matchedKey ? responses[matchedKey] : {};
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  return { calls, restore: () => (globalThis.fetch = originalFetch) };
}

describe("mail: PlunkBroadcastProvider", () => {
  test("createAudience posts to /segments and returns the external id", async () => {
    const { calls, restore } = mockFetch({ "POST https://next-api.useplunk.com/segments": { id: "seg_123" } });
    const provider = new PlunkBroadcastProvider("sk_fake_key");

    const result = await provider.createAudience("Newsletter");

    assert.equal(result.externalId, "seg_123");
    assert.equal(calls.length, 1);
    assert.equal((calls[0].body as { name: string }).name, "Newsletter");
    assert.equal((calls[0].body as { type: string }).type, "STATIC");
    restore();
  });

  test("deleteAudience sends a DELETE to /segments/{id}", async () => {
    const { calls, restore } = mockFetch({ "DELETE https://next-api.useplunk.com/segments/seg_123": { id: "seg_123" } });
    const provider = new PlunkBroadcastProvider("sk_fake_key");

    await provider.deleteAudience("seg_123");

    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, "DELETE");
    assert.equal(calls[0].url, "https://next-api.useplunk.com/segments/seg_123");
    restore();
  });

  test("upsertContacts upserts each contact's data, then bulk-adds them to the segment", async () => {
    const { calls, restore } = mockFetch({
      "POST https://next-api.useplunk.com/contacts": { id: "ct_1" },
      "POST https://next-api.useplunk.com/segments/seg_123/members": { added: 2, created: 2, notFound: 0 },
    });
    const provider = new PlunkBroadcastProvider("sk_fake_key");

    await provider.upsertContacts("seg_123", [
      { email: "a@example.com", firstName: "Ada" },
      { email: "b@example.com" },
    ]);

    const contactCalls = calls.filter((c) => c.url === "https://next-api.useplunk.com/contacts");
    assert.equal(contactCalls.length, 2);
    assert.equal((contactCalls[0].body as { email: string }).email, "a@example.com");
    assert.deepEqual((contactCalls[0].body as { data: unknown }).data, { firstName: "Ada" });
    assert.deepEqual((contactCalls[1].body as { data: unknown }).data, {});

    const memberCalls = calls.filter((c) => c.url.endsWith("/segments/seg_123/members"));
    assert.equal(memberCalls.length, 1);
    assert.deepEqual((memberCalls[0].body as { emails: string[] }).emails, ["a@example.com", "b@example.com"]);
    assert.equal((memberCalls[0].body as { createMissing: boolean }).createMissing, true);
    restore();
  });

  test("upsertContacts is a no-op for an empty contact list", async () => {
    const { calls, restore } = mockFetch({});
    const provider = new PlunkBroadcastProvider("sk_fake_key");

    await provider.upsertContacts("seg_123", []);

    assert.equal(calls.length, 0);
    restore();
  });

  test("createOrUpdateBroadcast POSTs to /campaigns when no externalBroadcastId is given", async () => {
    const { calls, restore } = mockFetch({
      "POST https://next-api.useplunk.com/campaigns": { success: true, data: { id: "cmp_1" } },
    });
    const provider = new PlunkBroadcastProvider("sk_fake_key");

    const result = await provider.createOrUpdateBroadcast({
      externalBroadcastId: null,
      audienceExternalId: "seg_123",
      from: { name: "Imerge", email: "hello@example.com" },
      subject: "Hello",
      html: "<p>Hi</p>",
      name: "Hello",
    });

    assert.equal(result.externalId, "cmp_1");
    assert.equal(calls[0].method, "POST");
    assert.equal((calls[0].body as { segmentId: string }).segmentId, "seg_123");
    assert.equal((calls[0].body as { audienceType: string }).audienceType, "SEGMENT");
    restore();
  });

  test("createOrUpdateBroadcast PUTs the existing campaign when an externalBroadcastId is given", async () => {
    const { calls, restore } = mockFetch({ "PUT https://next-api.useplunk.com/campaigns/cmp_1": {} });
    const provider = new PlunkBroadcastProvider("sk_fake_key");

    const result = await provider.createOrUpdateBroadcast({
      externalBroadcastId: "cmp_1",
      audienceExternalId: "seg_123",
      from: { email: "hello@example.com" },
      subject: "Updated subject",
      html: "<p>Updated</p>",
      name: "Updated subject",
    });

    // Should keep the same id rather than minting a new one
    assert.equal(result.externalId, "cmp_1");
    assert.equal(calls[0].method, "PUT");
    assert.equal(calls[0].url, "https://next-api.useplunk.com/campaigns/cmp_1");
    restore();
  });

  test("sendBroadcast with no date POSTs /campaigns/{id}/send with an empty body (sends immediately)", async () => {
    const { calls, restore } = mockFetch({ "POST https://next-api.useplunk.com/campaigns/cmp_1/send": {} });
    const provider = new PlunkBroadcastProvider("sk_fake_key");

    await provider.sendBroadcast("cmp_1");

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://next-api.useplunk.com/campaigns/cmp_1/send");
    assert.deepEqual(calls[0].body, {});
    restore();
  });

  test("sendBroadcast with a date includes scheduledFor in the /send request body itself", async () => {
    const { calls, restore } = mockFetch({ "POST https://next-api.useplunk.com/campaigns/cmp_1/send": {} });
    const provider = new PlunkBroadcastProvider("sk_fake_key");
    const when = new Date("2026-12-25T09:00:00.000Z");

    await provider.sendBroadcast("cmp_1", when);

    // Exactly one request — a separate PUT-to-set-scheduledFor-first was
    // tried and found to be a silent no-op against the real API (see the
    // method's comment); scheduledFor must ride along with /send itself.
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, "https://next-api.useplunk.com/campaigns/cmp_1/send");
    assert.equal((calls[0].body as { scheduledFor: string }).scheduledFor, "2026-12-25T09:00:00.000Z");
    restore();
  });

  test("cancelBroadcast POSTs to /campaigns/{id}/cancel", async () => {
    const { calls, restore } = mockFetch({ "POST https://next-api.useplunk.com/campaigns/cmp_1/cancel": {} });
    const provider = new PlunkBroadcastProvider("sk_fake_key");

    await provider.cancelBroadcast("cmp_1");

    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, "https://next-api.useplunk.com/campaigns/cmp_1/cancel");
    restore();
  });

  test("deleteBroadcast sends a DELETE to /campaigns/{id}", async () => {
    const { calls, restore } = mockFetch({
      "DELETE https://next-api.useplunk.com/campaigns/cmp_1": { success: true, message: "Campaign deleted successfully" },
    });
    const provider = new PlunkBroadcastProvider("sk_fake_key");

    await provider.deleteBroadcast("cmp_1");

    assert.equal(calls[0].method, "DELETE");
    assert.equal(calls[0].url, "https://next-api.useplunk.com/campaigns/cmp_1");
    restore();
  });

  test("getBroadcastStats maps Plunk's count fields to our BroadcastStats shape", async () => {
    const { restore } = mockFetch({
      "GET https://next-api.useplunk.com/campaigns/cmp_1/stats": {
        success: true,
        data: {
          totalRecipients: 100,
          sentCount: 100,
          deliveredCount: 95,
          openedCount: 40,
          clickedCount: 10,
          bouncedCount: 5,
          complainedCount: 1,
          unsubscribedCount: 2,
        },
      },
    });
    const provider = new PlunkBroadcastProvider("sk_fake_key");

    const stats = await provider.getBroadcastStats("cmp_1");

    assert.deepEqual(stats, {
      totalRecipients: 100,
      sent: 100,
      delivered: 95,
      opened: 40,
      clicked: 10,
      bounced: 5,
      complained: 1,
      unsubscribed: 2,
    });
    restore();
  });

  test("throws with the API's error message on a non-ok response", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message: "Invalid segment id" }), { status: 422 })) as typeof fetch;

    const provider = new PlunkBroadcastProvider("sk_fake_key");
    await assert.rejects(() => provider.cancelBroadcast("cmp_missing"), /Invalid segment id/);

    globalThis.fetch = originalFetch;
  });
});
