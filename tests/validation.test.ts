import assert from "node:assert/strict";
import { describe, test } from "./harness";
import {
  createAudienceSchema,
  createCampaignSchema,
  createStaffSchema,
  createTemplateSchema,
  importContactsSchema,
  scheduleCampaignSchema,
  updateCampaignSchema,
  updateStaffSchema,
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

  test("accepts an empty fromEmail (not chosen yet at creation time)", () => {
    // Regression: the "New campaign" button creates a draft before the
    // user has picked a sending address (see campaigns/page.tsx) — the
    // schema must not require a real email up front. ScheduleStep's
    // canSend check is what actually blocks sending until it's set.
    const result = createCampaignSchema.safeParse({
      subject: "Hello",
      bodyHtml: "<p>Hi</p>",
      fromEmail: "",
    });
    assert.ok(result.success);
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
      provider: "plunk",
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

describe("validation: createStaffSchema", () => {
  test("accepts a well-formed staff account", () => {
    const result = createStaffSchema.safeParse({
      name: "Jane CEO",
      email: "jane@example.com",
      password: "longenoughpw",
      role: "CEO",
    });
    assert.ok(result.success);
  });

  test("rejects a password under 8 characters", () => {
    const result = createStaffSchema.safeParse({
      name: "Jane CEO",
      email: "jane@example.com",
      password: "short1",
      role: "CEO",
    });
    assert.equal(result.success, false);
  });

  // Regression: there must be exactly one Super Admin, created once by
  // scripts/bootstrapSuperAdmin.ts, never through this API — see the
  // route handler's own-row guard for the other half of this invariant.
  test("rejects SUPER_ADMIN as a role — this endpoint can never mint a second one", () => {
    const result = createStaffSchema.safeParse({
      name: "Someone",
      email: "someone@example.com",
      password: "longenoughpw",
      role: "SUPER_ADMIN",
    });
    assert.equal(result.success, false);
  });
});

describe("validation: updateStaffSchema", () => {
  test("an empty object is valid (no-op update)", () => {
    assert.ok(updateStaffSchema.safeParse({}).success);
  });

  test("accepts a partial permissionMap update", () => {
    const result = updateStaffSchema.safeParse({ permissionMap: { marketing: "edit" } });
    assert.ok(result.success);
  });

  test("rejects SUPER_ADMIN as a role on update too", () => {
    const result = updateStaffSchema.safeParse({ role: "SUPER_ADMIN" });
    assert.equal(result.success, false);
  });

  test("has no password or email field to parse at all", () => {
    // Passwords/emails aren't settable post-creation through this schema —
    // confirm they're silently stripped, not merely optional.
    const result = updateStaffSchema.safeParse({ password: "whatever", email: "new@example.com" });
    assert.ok(result.success);
    if (result.success) {
      assert.equal("password" in result.data, false);
      assert.equal("email" in result.data, false);
    }
  });
});
