/**
 * Prisma client singleton.
 *
 * Next.js hot-reloads modules in development, which would otherwise spawn a
 * new PrismaClient on every reload and exhaust database connections. In
 * production (Vercel serverless), the global cache persists per lambda warm
 * instance, which is the recommended pattern for pooled Neon connections.
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** Generic typed error thrown by database operations in API routes. */
export class DatabaseError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "DatabaseError";
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
