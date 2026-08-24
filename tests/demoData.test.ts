import assert from "node:assert/strict";
import { describe, test } from "./harness";
import { generateDemoData, SEED_USERS } from "../src/lib/demoData";

describe("demoData: structural integrity", () => {
  test("generates non-empty collections for every dashboard", () => {
    const data = generateDemoData();
    assert.ok(data.transactions.length > 0, "transactions");
    assert.ok(data.campaigns.length > 0, "campaigns");
    assert.ok(data.daily_metrics.length > 0, "daily_metrics");
    assert.ok(data.clients.length > 0, "clients");
    assert.ok(data.time_entries.length > 0, "time_entries");
    assert.ok(data.deals.length > 0, "deals");
    assert.ok(data.team.length > 0, "team");
    assert.ok(data.customers.length > 0, "customers");
    assert.ok(data.users.length > 0, "users");
  });

  test("every time entry references a client that actually exists", () => {
    const data = generateDemoData();
    const clientIds = new Set(data.clients.map((c) => c.id));
    const orphaned = data.time_entries.filter((t) => !clientIds.has(t.clientId));
    assert.equal(orphaned.length, 0, `${orphaned.length} time entries reference a non-existent client`);
  });

  test("no transaction has a NaN or negative amount", () => {
    const data = generateDemoData();
    for (const t of data.transactions) {
      assert.ok(Number.isFinite(t.amount), `transaction ${t.id} has non-finite amount`);
      assert.ok(t.amount > 0, `transaction ${t.id} has non-positive amount`);
      assert.ok(t.type === "income" || t.type === "expense", `transaction ${t.id} has invalid type "${t.type}"`);
    }
  });

  test("every date field is a valid, parseable date string", () => {
    const data = generateDemoData();
    for (const t of data.transactions) {
      assert.ok(!Number.isNaN(new Date(t.date).getTime()), `invalid date on transaction ${t.id}: ${t.date}`);
    }
    for (const c of data.customers) {
      assert.ok(!Number.isNaN(new Date(c.acquisitionDate).getTime()), `invalid acquisitionDate on customer ${c.id}`);
    }
  });

  test("deal stages are always one of the four valid values", () => {
    const data = generateDemoData();
    const validStages = new Set(["Proposal", "Negotiation", "Closed Won", "Closed Lost"]);
    for (const d of data.deals) {
      assert.ok(validStages.has(d.stage), `deal ${d.id} has invalid stage "${d.stage}"`);
    }
  });

  test("client tiers are always A, B, or C", () => {
    const data = generateDemoData();
    for (const c of data.clients) {
      assert.ok(["A", "B", "C"].includes(c.tier), `client ${c.id} has invalid tier "${c.tier}"`);
    }
  });

  test("every id is unique within its own collection", () => {
    const data = generateDemoData();
    const collections: [string, { id: string }[]][] = [
      ["transactions", data.transactions],
      ["clients", data.clients],
      ["deals", data.deals],
      ["customers", data.customers],
    ];
    for (const [name, rows] of collections) {
      const ids = rows.map((r) => r.id);
      assert.equal(new Set(ids).size, ids.length, `duplicate ids found in ${name}`);
    }
  });

  test("settings.categoryBudgets has no zero/negative/NaN values", () => {
    const data = generateDemoData();
    for (const [category, budget] of Object.entries(data.settings.categoryBudgets)) {
      assert.ok(Number.isFinite(budget) && budget > 0, `budget for ${category} is invalid: ${budget}`);
    }
  });

  test("two separate calls produce independent data (no shared mutable state)", () => {
    const first = generateDemoData();
    const second = generateDemoData();
    first.transactions.push({
      id: "injected",
      date: "2026-01-01",
      type: "income",
      category: "Test",
      amount: 1,
      description: "test",
    });
    assert.notEqual(second.transactions.length, first.transactions.length);
  });
});

describe("demoData: seed users", () => {
  test("every seed user has a full 7-key permission map", () => {
    const dashboards = ["income", "marketing", "health", "clients", "pipeline", "ltv", "settings"];
    for (const user of SEED_USERS) {
      for (const dash of dashboards) {
        assert.ok(
          dash in user.permissions,
          `${user.email} is missing a permission entry for "${dash}"`
        );
      }
    }
  });

  test("emails are unique across seed users", () => {
    const emails = SEED_USERS.map((u) => u.email.toLowerCase());
    assert.equal(new Set(emails).size, emails.length);
  });

  test("the admin account has full access to every dashboard", () => {
    const admin = SEED_USERS.find((u) => u.id === "admin");
    assert.ok(admin);
    for (const level of Object.values(admin!.permissions)) {
      assert.equal(level, "full");
    }
  });
});
