import assert from "node:assert/strict";
import { describe, test } from "./harness";
import {
  dateISO,
  daysAgo,
  groupBy,
  money,
  monthKey,
  pct,
  sanitizeFileName,
  sum,
  uid,
  normalizeEmail,
  getDateFiltered,
} from "../src/lib/utils";

describe("utils: formatting", () => {
  test("money formats with currency symbol and thousands separators", () => {
    assert.equal(money("$", 1234), "$1,234");
    assert.equal(money("₦", 500), "₦500");
  });

  test("money treats undefined/NaN-ish input as 0", () => {
    assert.equal(money("$", undefined), "$0");
  });

  test("pct formats to one decimal with a % sign", () => {
    assert.equal(pct(12.345), "12.3%");
    assert.equal(pct(undefined), "0.0%");
  });

  test("sanitizeFileName produces a safe, lowercase, hyphenated slug", () => {
    assert.equal(sanitizeFileName("Q4 Revenue (Final)!!"), "q4-revenue-final");
    assert.equal(sanitizeFileName(""), "chart");
  });

  test("normalizeEmail trims and lowercases", () => {
    assert.equal(normalizeEmail("  Ada@Example.COM "), "ada@example.com");
    assert.equal(normalizeEmail(undefined), "");
  });
});

describe("utils: dates", () => {
  test("dateISO always returns YYYY-MM-DD", () => {
    assert.equal(dateISO("2026-03-15T10:00:00Z"), "2026-03-15");
  });

  test("daysAgo(0) is today", () => {
    assert.equal(daysAgo(0), dateISO(new Date()));
  });

  test("daysAgo(1) is strictly before today", () => {
    assert.ok(daysAgo(1) < daysAgo(0));
  });

  test("monthKey extracts YYYY-MM", () => {
    assert.equal(monthKey("2026-07-04"), "2026-07");
  });
});

describe("utils: aggregation", () => {
  test("groupBy buckets by the key function", () => {
    const rows = [{ c: "a" }, { c: "b" }, { c: "a" }];
    const grouped = groupBy(rows, (r) => r.c);
    assert.equal(grouped.a.length, 2);
    assert.equal(grouped.b.length, 1);
  });

  test("sum accepts a plain key", () => {
    assert.equal(sum([{ amount: 10 }, { amount: 5 }], "amount"), 15);
  });

  test("sum accepts a derived accessor function", () => {
    assert.equal(
      sum([{ a: 2, b: 3 }, { a: 4, b: 1 }], (r) => r.a * r.b),
      2 * 3 + 4 * 1
    );
  });

  test("sum treats missing/non-numeric values as 0, not NaN", () => {
    const rows = [{ amount: undefined as unknown as number }, { amount: 5 }];
    assert.equal(sum(rows, "amount"), 5);
  });

  test("uid produces distinct ids across calls", () => {
    const a = uid("tx");
    const b = uid("tx");
    assert.notEqual(a, b);
    assert.ok(a.startsWith("tx_"));
  });
});

describe("utils: date range filtering", () => {
  const records = [
    { date: daysAgo(0), label: "today" },
    { date: daysAgo(5), label: "5 days ago" },
    { date: daysAgo(29), label: "29 days ago" },
    { date: daysAgo(60), label: "60 days ago" },
  ];

  test("last7 excludes anything older than 7 days", () => {
    const filtered = getDateFiltered(records, "last7");
    assert.ok(filtered.some((r) => r.label === "today"));
    assert.ok(filtered.some((r) => r.label === "5 days ago"));
    assert.ok(!filtered.some((r) => r.label === "29 days ago"));
    assert.ok(!filtered.some((r) => r.label === "60 days ago"));
  });

  test("last30 includes the 29-day-old record but not the 60-day-old one", () => {
    const filtered = getDateFiltered(records, "last30");
    assert.ok(filtered.some((r) => r.label === "29 days ago"));
    assert.ok(!filtered.some((r) => r.label === "60 days ago"));
  });

  test("undefined range falls back to a sane default rather than throwing", () => {
    assert.doesNotThrow(() => getDateFiltered(records, undefined));
  });
});
