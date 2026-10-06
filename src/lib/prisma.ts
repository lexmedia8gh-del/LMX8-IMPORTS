import { PrismaClient } from "@prisma/client";

// Ensure DATABASE_URL and DIRECT_URL are initialized in process.env so Prisma never crashes
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/postgres?schema=public";
}
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: [
      { emit: "event", level: "error" },
      { emit: "event", level: "warn" },
    ],
  });

// Handle Prisma events gracefully without dumping raw stderr messages
if (typeof (prisma as any).$on === "function") {
  (prisma as any).$on("error", (e: any) => {
    // Only log significant fatal non-connection errors if needed
    if (process.env.DEBUG_PRISMA === "true") {
      console.warn("[Prisma]", e?.message || e);
    }
  });
  (prisma as any).$on("warn", (e: any) => {
    if (process.env.DEBUG_PRISMA === "true") {
      console.warn("[Prisma Warning]", e?.message || e);
    }
  });
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
