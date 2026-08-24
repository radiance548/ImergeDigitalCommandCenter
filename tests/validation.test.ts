import assert from "node:assert/strict";
import { describe, test } from "./harness";
import {
  createAudienceSchema,
  createCampaignSchema,
  createTemplateSchema,
  importContactsSchema,
  scheduleCampaignSchema,
  updateCampaignSchema,
} from "../src/lib/server/validation";

describe("validation: createCampaignSchema", () => {
  test("accepts a minimal valid campaign and applies the fromName default", () => {
    const result = createCampaignSchema.safeParse({
      subject: "Hello",
      bodyHtml: "<p>Hi</p>",
      fromEmail: "hello@example.com",
    });
    assert.ok(result.success);
    if (result.success) {
      // Regression test: an earlier version of the shared parseJsonBody<T>
      // helper inferred T from the wrong side of the Zod schema, making
      // `fromName` appear optional/undefined here even though `.default()`
      // guarantees it's always populated after parsing. This must never be
      // undefined.
      assert.equal(result.data.fromName, "Imerge");
      assert.equal(typeof result.data.fromName, "string");
    }
  });

  test("accepts an explicit fromName, overriding the default", () => {
    const result = createCampaignSchema.safeParse({
      subject: "Hello",
      bodyHtml: "<p>Hi</p>",
      fromEmail: "hello@example.com",
      fromName: "Custom Sender",
    });
    assert.ok(result.success);
    if (result.success) assert.equal(result.data.fromName, "Custom Sender");
  });

  test("rejects a missing subject", () => {
    const result = createCampaignSchema.safeParse({
      bodyHtml: "<p>Hi</p>",
      fromEmail: "hello@example.com",
    });
    assert.equal(result.success, false);
  });

  test("rejects an empty subject", () => {
    const result = createCampaignSchema.safeParse({
      subject: "",
      bodyHtml: "<p>Hi</p>",
      fromEmail: "hello@example.com",
    });
    assert.equal(result.success, false);
  });

  test("rejects an invalid fromEmail", () => {
    const result = createCampaignSchema.safeParse({
      subject: "Hello",
      bodyHtml: "<p>Hi</p>",
      fromEmail: "not-an-email",
    });
    assert.equal(result.success, false);
  });

  test("rejects a subject over 200 characters", () => {
    const result = createCampaignSchema.safeParse({
      subject: "x".repeat(201),
      bodyHtml: "<p>Hi</p>",
      fromEmail: "hello@example.com",
    });
    assert.equal(result.success, false);
  });

  test("accepts optional templateId/audienceId/provider when provided", () => {
    const result = createCampaignSchema.safeParse({
      subject: "Hello",
      bodyHtml: "<p>Hi</p>",
      fromEmail: "hello@example.com",
      templateId: "tmpl_1",
      audienceId: "aud_1",
      provider: "resend",
    });
    assert.ok(result.success);
  });
});

describe("validation: updateCampaignSchema", () => {
  test("allows a partial update with just one field", () => {
    const result = updateCampaignSchema.safeParse({ subject: "New subject" });
    assert.ok(result.success);
  });

  test("allows explicitly nulling templateId/audienceId (to unset selection)", () => {
    const result = updateCampaignSchema.safeParse({ templateId: null, audienceId: null });
    assert.ok(result.success);
  });

  test("still rejects an invalid fromEmail if provided", () => {
    const result = updateCampaignSchema.safeParse({ fromEmail: "nope" });
    assert.equal(result.success, false);
  });

  test("an empty object is valid (no-op update)", () => {
    const result = updateCampaignSchema.safeParse({});
    assert.ok(result.success);
  });
});

describe("validation: scheduleCampaignSchema", () => {
  test("requires scheduledAt — 'send now' is a separate endpoint, not schedule-with-no-date", () => {
    const result = scheduleCampaignSchema.safeParse({});
    assert.equal(result.success, false);
  });

  test("accepts a valid ISO datetime", () => {
    const result = scheduleCampaignSchema.safeParse({ scheduledAt: new Date().toISOString() });
    assert.ok(result.success);
  });

  test("rejects a non-datetime string", () => {
    const result = scheduleCampaignSchema.safeParse({ scheduledAt: "next tuesday" });
    assert.equal(result.success, false);
  });
});

describe("validation: createTemplateSchema", () => {
  test("requires name and html", () => {
    assert.equal(createTemplateSchema.safeParse({ html: "<p>x</p>" }).success, false);
    assert.equal(createTemplateSchema.safeParse({ name: "Foo" }).success, false);
  });

  test("accepts a well-formed template", () => {
    const result = createTemplateSchema.safeParse({ name: "Foo", html: "<p>x</p>" });
    assert.ok(result.success);
  });
});

describe("validation: createAudienceSchema", () => {
  test("requires a name", () => {
    assert.equal(createAudienceSchema.safeParse({}).success, false);
  });

  test("description is optional", () => {
    const result = createAudienceSchema.safeParse({ name: "VIPs" });
    assert.ok(result.success);
  });
});

describe("validation: importContactsSchema", () => {
  test("rejects an empty contacts array", () => {
    const result = importContactsSchema.safeParse({ contacts: [] });
    assert.equal(result.success, false);
  });

  test("rejects a contact with an invalid email", () => {
    const result = importContactsSchema.safeParse({ contacts: [{ email: "nope" }] });
    assert.equal(result.success, false);
  });

  test("accepts a well-formed contact list with optional fields", () => {
    const result = importContactsSchema.safeParse({
      contacts: [
        { email: "ada@example.com", firstName: "Ada" },
        { email: "kofi@example.com" },
      ],
    });
    assert.ok(result.success);
    if (result.success) assert.equal(result.data.contacts.length, 2);
  });

  test("rejects more than 5000 contacts in one request", () => {
    const contacts = Array.from({ length: 5001 }, (_, i) => ({ email: `user${i}@example.com` }));
    const result = importContactsSchema.safeParse({ contacts });
    assert.equal(result.success, false);
  });
});
