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
 * `options` forwards to Prisma's own `$transaction` options (default
 * timeout is 5s) — most callers should leave this at the default, since a
 * long-held interactive transaction is exactly what it's there to catch
 * (see the comment on `create` in audienceService.ts). Only pass a longer
 * `timeout` for callers doing genuinely heavier single-statement DB work,
 * e.g. a large bulk upsert, where 5s isn't the query hanging — it's real
 * server-side work that legitimately takes longer.
 */
export async function withRLS<T>(
  userId: string,
  fn: (tx: Db) => Promise<T>,
  options?: { timeout?: number; maxWait?: number }
): Promise<T> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRawUnsafe(
      `select set_config('request.jwt.claims', $1, true)`,
      JSON.stringify({ sub: userId, role: "authenticated" })
    );
    return fn(tx);
  }, options);
}
