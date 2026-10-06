import "server-only";
import { prisma } from "@/lib/prisma";

let schemaEnsured = false;

/**
 * Ensures all CreditAccount columns exist in the active PostgreSQL database.
 * This directly prevents the production error:
 * "The column selectedPackage does not exist in the current database"
 * when queries/upserts run before or alongside migrations.
 */
export async function ensureCreditAccountSchema(): Promise<boolean> {
  if (schemaEnsured) return true;

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "CreditAccount" 
        ADD COLUMN IF NOT EXISTS "selectedPackage" TEXT,
        ADD COLUMN IF NOT EXISTS "packagePrice" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        ADD COLUMN IF NOT EXISTS "creditsPurchased" INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "creditsUsed" INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "creditsRemaining" INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3);
    `);
    schemaEnsured = true;
    return true;
  } catch (err: any) {
    // If table doesn't exist yet or connection issue, log and continue
    console.warn("[CreditAccount] Schema check notification:", err?.message || err);
    return false;
  }
}
