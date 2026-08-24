import { PrismaClient } from "@prisma/client";

// Prevents exhausting DB connections from hot-reloading in dev and from
// serverless function reuse in prod. Standard Next.js + Prisma pattern.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
