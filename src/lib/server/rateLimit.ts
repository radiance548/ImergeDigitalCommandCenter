// ============================================================
// Rate limiting abstraction
//
// Two implementations:
//   - InMemoryRateLimiter: zero-setup fallback, per-process only
//     (see the correctness caveat in its docstring below).
//   - UpstashRateLimiter: Redis-backed via Upstash, correct across
//     every serverless instance. Used automatically whenever
//     UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are set.
//
// Everything else in the app (the login route) depends only on the
// small `RateLimiter` interface below, so this is a contained swap.
// ============================================================

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

export interface RateLimiter {
  /** Checks and records one attempt for `key`. */
  check(key: string): Promise<RateLimitResult>;
  /** Clears a key's bucket, e.g. after a successful login. */
  reset(key: string): Promise<void>;
}

interface Bucket {
  count: number;
  windowStart: number;
}

/**
 * Fixed-window rate limiter, in-memory. Zero setup, but state is scoped to
 * a single server process. On Vercel, concurrent requests can land on
 * different serverless instances that don't share memory, so a burst of
 * truly concurrent requests can exceed the configured limit (roughly:
 * limit × however many instances happen to be handling the burst). Fine
 * as a no-configuration fallback / local dev default; use
 * UpstashRateLimiter for a real deployment.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number
  ) {}

  async check(key: string, now: number = Date.now()): Promise<RateLimitResult> {
    const bucket = this.buckets.get(key);

    if (!bucket || now - bucket.windowStart >= this.windowMs) {
      this.buckets.set(key, { count: 1, windowStart: now });
      return { allowed: true, remaining: this.maxAttempts - 1 };
    }

    if (bucket.count >= this.maxAttempts) {
      return { allowed: false, remaining: 0, retryAfterMs: this.windowMs - (now - bucket.windowStart) };
    }

    bucket.count += 1;
    return { allowed: true, remaining: this.maxAttempts - bucket.count };
  }

  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }

  /** Periodic cleanup so the map doesn't grow unbounded under sustained traffic. */
  sweep(now: number = Date.now()): void {
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.windowStart >= this.windowMs) this.buckets.delete(key);
    }
  }
}

/**
 * Upstash Redis-backed rate limiter. Correct across every serverless
 * instance, since the counter lives in Upstash, not in any one process.
 * Uses a sliding window (smoother than a fixed window — no "reset cliff"
 * at the window boundary that a fixed window has).
 */
export class UpstashRateLimiter implements RateLimiter {
  private limiter: Ratelimit;
  private redis: Redis;

  constructor(maxAttempts: number, windowSeconds: number) {
    this.redis = Redis.fromEnv();
    this.limiter = new Ratelimit({
      redis: this.redis,
      limiter: Ratelimit.slidingWindow(maxAttempts, `${windowSeconds} s`),
      prefix: "imerge:ratelimit",
    });
  }

  async check(key: string): Promise<RateLimitResult> {
    const result = await this.limiter.limit(key);
    return {
      allowed: result.success,
      remaining: result.remaining,
      retryAfterMs: result.success ? undefined : Math.max(0, result.reset - Date.now()),
    };
  }

  async reset(key: string): Promise<void> {
    // @upstash/ratelimit doesn't expose a direct "reset" call; clearing
    // the underlying key(s) it maintains achieves the same effect.
    await this.redis.del(`imerge:ratelimit:${key}`);
  }
}

let instance: RateLimiter | undefined;

/**
 * Returns the active rate limiter for login attempts: Upstash if
 * configured (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN), else
 * the in-memory fallback — 5 attempts per 15 minutes either way.
 */
export function getLoginRateLimiter(): RateLimiter {
  if (!instance) {
    const hasUpstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
    if (hasUpstash) {
      instance = new UpstashRateLimiter(5, 15 * 60);
    } else {
      if (process.env.NODE_ENV === "production") {
        console.warn(
          "[rateLimit] UPSTASH_REDIS_REST_URL/TOKEN not set — falling back to the in-memory rate limiter, " +
            "which is not reliable across multiple serverless instances. See src/lib/server/rateLimit.ts."
        );
      }
      instance = new InMemoryRateLimiter(5, 15 * 60 * 1000);
    }
  }
  return instance;
}

/**
 * Builds a rate-limit key from the request IP and the email being
 * attempted, so one bad actor guessing many emails from one IP is still
 * throttled per-email, and a mistyped password doesn't lock out other
 * users behind the same NAT/proxy IP.
 */
export function loginRateLimitKey(ip: string, email: string): string {
  return `${ip}:${email.trim().toLowerCase()}`;
}
