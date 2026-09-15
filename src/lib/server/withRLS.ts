import { prisma } from "@/lib/server/db";
import type { Prisma, PrismaClient } from "@prisma/client";

export type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Runs `fn` inside a Postgres transaction with `request.jwt.claims` set to
 * the given user id, so RLS policies referencing `auth.uid()` (Supabase's
 * convention — see prisma/rls.sql) evaluate correctly even though the
 * query is issued via Prisma rather than Supabase's own client/PostgREST
 * layer, which sets that claim automatically.
 *
 * Must run set_config and the real query on the SAME connection, which is
 * why this is wrapped in `$transaction` — Prisma guarantees a
 * transaction's statements share one pooled connection for its duration;
 * two separate top-level queries could land on different pooled
 * connections and silently not see each other's session state.
 *
 * `options` forwards to Prisma's own `$transaction` options. Prisma's bare
 * default (5s) turned out too tight even for a single trivial
 * findUnique — measured directly, a cold-ish connection acquisition to
 * the Supabase instance this app talks to can itself take several
 * seconds independent of query complexity (the same class of latency that
 * made the bulk-import path need an explicit longer timeout — see
 * audienceService.importContacts), so every call gets a 10s floor by
 * default rather than each call site discovering this one at a time. Pass
 * a longer `timeout` for callers doing genuinely heavier single-statement
 * DB work, e.g. a large bulk upsert, where the ceiling is real
 * server-side work rather than connection latency.
 */
const DEFAULT_TIMEOUT_MS = 10_000;

export async function withRLS<T>(
  userId: string,
  fn: (tx: Db) => Promise<T>,
  options: { timeout?: number; maxWait?: number } = {}
): Promise<T> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRawUnsafe(
      `select set_config('request.jwt.claims', $1, true)`,
      JSON.stringify({ sub: userId, role: "authenticated" })
    );
    return fn(tx);
  }, { timeout: DEFAULT_TIMEOUT_MS, ...options });
}
