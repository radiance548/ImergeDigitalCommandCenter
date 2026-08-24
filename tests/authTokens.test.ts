import assert from "node:assert/strict";
import { describe, test } from "./harness";
import { permissionRank } from "../src/lib/server/authTokens";

// Password hashing and session-token tests used to live here, before the
// app moved to Supabase Auth (see src/lib/server/auth.ts + supabase.ts) —
// Supabase now owns credential verification and session issuance, so
// those concerns no longer exist as app code to unit-test here.

describe("authTokens: permissionRank", () => {
  test("orders permission levels correctly: none < view < edit < full", () => {
    assert.ok(permissionRank("none") < permissionRank("view"));
    assert.ok(permissionRank("view") < permissionRank("edit"));
    assert.ok(permissionRank("edit") < permissionRank("full"));
  });

  test("undefined/unknown levels are treated as 'none' (fail closed, not open)", () => {
    assert.equal(permissionRank(undefined), permissionRank("none"));
    assert.equal(permissionRank("some-typo"), permissionRank("none"));
  });

  test("'full' satisfies a 'view' or 'edit' requirement (higher access covers lower)", () => {
    assert.ok(permissionRank("full") >= permissionRank("view"));
    assert.ok(permissionRank("full") >= permissionRank("edit"));
  });

  test("'view' does NOT satisfy an 'edit' requirement — this is the core security invariant", () => {
    assert.ok(permissionRank("view") < permissionRank("edit"));
  });
});
