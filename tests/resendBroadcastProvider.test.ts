import assert from "node:assert/strict";
import { describe, test } from "./harness";
import { ResendBroadcastProvider } from "../src/lib/server/mail/resendBroadcastProvider";

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

describe("mail: ResendBroadcastProvider", () => {
  test("createAudience posts to /audiences and returns the external id", async () => {
    const { calls, restore } = mockFetch({ "POST https://api.resend.com/audiences": { id: "aud_123" } });
    const provider = new ResendBroadcastProvider("re_fake_key");

    const result = await provider.createAudience("Newsletter");

    assert.equal(result.externalId, "aud_123");
    assert.equal(calls.length, 1);
    assert.equal((calls[0].body as { name: string }).name, "Newsletter");
    restore();
  });

  test("upsertContacts posts a single bulk CSV import instead of one request per contact", async () => {
    const { calls, restore } = mockFetch({
      "POST https://api.resend.com/contacts/imports": { object: "contact_import", id: "imp_1" },
    });
    const provider = new ResendBroadcastProvider("re_fake_key");

    await provider.upsertContacts("aud_123", [
      { email: "a@example.com", firstName: "Ada" },
      { email: "b@example.com" },
    ]);

    assert.equal(calls.length, 1);
    const form = calls[0].body as FormData;
    assert.equal(form.get("on_conflict"), "upsert");
    assert.deepEqual(JSON.parse(String(form.get("segments"))), [{ id: "aud_123" }]);
    assert.deepEqual(JSON.parse(String(form.get("column_map"))), {
      email: "email",
      first_name: "first_name",
      last_name: "last_name",
    });
    const csv = await (form.get("file") as Blob).text();
    assert.equal(csv, "email,first_name,last_name\na@example.com,Ada,\nb@example.com,,");
    restore();
  });

  test("upsertContacts is a no-op for an empty contact list", async () => {
    const { calls, restore } = mockFetch({});
    const provider = new ResendBroadcastProvider("re_fake_key");

    await provider.upsertContacts("aud_123", []);

    assert.equal(calls.length, 0);
    restore();
  });

  test("createOrUpdateBroadcast POSTs to /broadcasts when no externalBroadcastId is given", async () => {
    const { calls, restore } = mockFetch({ "POST https://api.resend.com/broadcasts": { id: "brd_1" } });
    const provider = new ResendBroadcastProvider("re_fake_key");

    const result = await provider.createOrUpdateBroadcast({
      externalBroadcastId: null,
      audienceExternalId: "aud_123",
      from: { name: "Imerge", email: "hello@example.com" },
      subject: "Hello",
      html: "<p>Hi</p>",
      name: "Hello",
    });

    assert.equal(result.externalId, "brd_1");
    assert.equal(calls[0].method, "POST");
    assert.equal((calls[0].body as { segment_id: string }).segment_id, "aud_123");
    restore();
  });

  test("createOrUpdateBroadcast PATCHes the existing broadcast when an externalBroadcastId is given", async () => {
    const { calls, restore } = mockFetch({ "PATCH https://api.resend.com/broadcasts/brd_1": {} });
    const provider = new ResendBroadcastProvider("re_fake_key");

    const result = await provider.createOrUpdateBroadcast({
      externalBroadcastId: "brd_1",
      audienceExternalId: "aud_123",
      from: { email: "hello@example.com" },
      subject: "Updated subject",
      html: "<p>Updated</p>",
      name: "Updated subject",
    });

    // Should keep the same id rather than minting a new one
    assert.equal(result.externalId, "brd_1");
    assert.equal(calls[0].method, "PATCH");
    assert.equal(calls[0].url, "https://api.resend.com/broadcasts/brd_1");
    restore();
  });

  test("sendBroadcast with no date sends immediately (empty body)", async () => {
    const { calls, restore } = mockFetch({ "POST https://api.resend.com/broadcasts/brd_1/send": {} });
    const provider = new ResendBroadcastProvider("re_fake_key");

    await provider.sendBroadcast("brd_1");

    assert.deepEqual(calls[0].body, {});
    restore();
  });

  test("sendBroadcast with a date includes scheduled_at as an ISO string", async () => {
    const { calls, restore } = mockFetch({ "POST https://api.resend.com/broadcasts/brd_1/send": {} });
    const provider = new ResendBroadcastProvider("re_fake_key");
    const when = new Date("2026-12-25T09:00:00.000Z");

    await provider.sendBroadcast("brd_1", when);

    assert.equal((calls[0].body as { scheduled_at: string }).scheduled_at, "2026-12-25T09:00:00.000Z");
    restore();
  });

  test("cancelBroadcast sends a DELETE to /broadcasts/{id}", async () => {
    const { calls, restore } = mockFetch({ "DELETE https://api.resend.com/broadcasts/brd_1": {} });
    const provider = new ResendBroadcastProvider("re_fake_key");

    await provider.cancelBroadcast("brd_1");

    assert.equal(calls[0].method, "DELETE");
    restore();
  });

  test("throws with the API's error message on a non-ok response", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message: "Invalid audience_id" }), { status: 422 })) as typeof fetch;

    const provider = new ResendBroadcastProvider("re_fake_key");
    await assert.rejects(() => provider.cancelBroadcast("brd_missing"), /Invalid audience_id/);

    globalThis.fetch = originalFetch;
  });
});
