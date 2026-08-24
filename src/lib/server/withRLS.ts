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
 */
export async function withRLS<T>(userId: string, fn: (tx: Db) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRawUnsafe(
      `select set_config('request.jwt.claims', $1, true)`,
      JSON.stringify({ sub: userId, role: "authenticated" })
    );
    return fn(tx);
  });
}
