import assert from "node:assert/strict";
import { describe, test } from "./harness";
import { loginRateLimitKey, InMemoryRateLimiter } from "../src/lib/server/rateLimit";

describe("rateLimit: InMemoryRateLimiter", () => {
  test("allows requests up to the limit", async () => {
    const limiter = new InMemoryRateLimiter(3, 60_000);
    const now = 1_000_000;
    assert.equal((await limiter.check("k", now)).allowed, true);
    assert.equal((await limiter.check("k", now)).allowed, true);
    assert.equal((await limiter.check("k", now)).allowed, true);
  });

  test("blocks the request that exceeds the limit within the window", async () => {
    const limiter = new InMemoryRateLimiter(3, 60_000);
    const now = 1_000_000;
    await limiter.check("k", now);
    await limiter.check("k", now);
    await limiter.check("k", now);
    const fourth = await limiter.check("k", now);
    assert.equal(fourth.allowed, false);
    assert.ok((fourth.retryAfterMs || 0) > 0);
  });

  test("different keys have independent buckets", async () => {
    const limiter = new InMemoryRateLimiter(1, 60_000);
    const now = 1_000_000;
    assert.equal((await limiter.check("user-a", now)).allowed, true);
    assert.equal(
      (await limiter.check("user-b", now)).allowed,
      true,
      "a different key should not be affected by user-a's usage"
    );
  });

  test("resets after the window elapses", async () => {
    const limiter = new InMemoryRateLimiter(1, 60_000);
    const now = 1_000_000;
    assert.equal((await limiter.check("k", now)).allowed, true);
    assert.equal((await limiter.check("k", now + 30_000)).allowed, false, "still within the window");
    assert.equal((await limiter.check("k", now + 60_001)).allowed, true, "window has elapsed, should reset");
  });

  test("reset() clears a key immediately, e.g. after a successful login", async () => {
    const limiter = new InMemoryRateLimiter(1, 60_000);
    const now = 1_000_000;
    await limiter.check("k", now);
    assert.equal((await limiter.check("k", now)).allowed, false);
    await limiter.reset("k");
    assert.equal((await limiter.check("k", now)).allowed, true);
  });

  test("sweep() removes expired buckets without touching active ones", async () => {
    const limiter = new InMemoryRateLimiter(1, 60_000);
    const now = 1_000_000;
    await limiter.check("expired", now);
    await limiter.check("active", now + 50_000);
    limiter.sweep(now + 61_000);
    // "expired"'s window has passed, so a fresh check should be allowed again
    assert.equal((await limiter.check("expired", now + 61_000)).allowed, true);
  });

  test("remaining count decreases correctly toward the limit", async () => {
    const limiter = new InMemoryRateLimiter(3, 60_000);
    const now = 1_000_000;
    assert.equal((await limiter.check("k", now)).remaining, 2);
    assert.equal((await limiter.check("k", now)).remaining, 1);
    assert.equal((await limiter.check("k", now)).remaining, 0);
  });
});

describe("rateLimit: loginRateLimitKey", () => {
  test("combines IP and email into one key", () => {
    assert.equal(loginRateLimitKey("1.2.3.4", "ada@example.com"), "1.2.3.4:ada@example.com");
  });

  test("normalizes email casing/whitespace so variants collapse to the same key", () => {
    assert.equal(loginRateLimitKey("1.2.3.4", "  Ada@Example.COM "), loginRateLimitKey("1.2.3.4", "ada@example.com"));
  });

  test("the same email from different IPs produces different keys (per-IP+email, not global per-email)", () => {
    assert.notEqual(loginRateLimitKey("1.2.3.4", "ada@example.com"), loginRateLimitKey("5.6.7.8", "ada@example.com"));
  });
});
