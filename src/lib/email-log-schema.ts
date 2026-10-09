import { prisma } from "@/lib/prisma";

let emailLogSchemaEnsured = false;

/**
 * Ensures the EmailLog table, EmailEventStatus enum, indexes, and foreign keys
 * exist in the PostgreSQL database.
 *
 * This directly prevents the error:
 * "The table public.EmailLog does not exist in the current database"
 * across all operational reset, email diagnostics, and background workers.
 */
export async function ensureEmailLogSchema(force = false): Promise<boolean> {
  if (emailLogSchemaEnsured && !force) {
    return true;
  }

  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmailEventStatus') THEN
              CREATE TYPE "EmailEventStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');
          END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS "EmailLog" (
          "id" TEXT NOT NULL,
          "customerId" TEXT NOT NULL,
          "shipmentId" TEXT,
          "batchId" TEXT,
          "eventType" TEXT NOT NULL,
          "status" "EmailEventStatus" NOT NULL DEFAULT 'PENDING',
          "recipient" TEXT NOT NULL,
          "subject" TEXT NOT NULL,
          "providerMessageId" TEXT,
          "idempotencyKey" TEXT NOT NULL,
          "sentAt" TIMESTAMP(3),
          "failedAt" TIMESTAMP(3),
          "errorMessage" TEXT,
          "metadata" JSONB,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "EmailLog_idempotencyKey_key" ON "EmailLog"("idempotencyKey");
      CREATE INDEX IF NOT EXISTS "EmailLog_customerId_idx" ON "EmailLog"("customerId");
      CREATE INDEX IF NOT EXISTS "EmailLog_shipmentId_idx" ON "EmailLog"("shipmentId");
      CREATE INDEX IF NOT EXISTS "EmailLog_eventType_idx" ON "EmailLog"("eventType");
      CREATE INDEX IF NOT EXISTS "EmailLog_status_idx" ON "EmailLog"("status");
      CREATE INDEX IF NOT EXISTS "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

      DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmailLog_customerId_fkey') THEN
              ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_customerId_fkey" 
              FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmailLog_shipmentId_fkey') THEN
              ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_shipmentId_fkey" 
              FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmailLog_batchId_fkey') THEN
              ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_batchId_fkey" 
              FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;
    `);

    emailLogSchemaEnsured = true;
    return true;
  } catch (err: any) {
    // If table already exists or query fails due to lack of DB connection, do not crash
    console.warn("[ensureEmailLogSchema] Schema check notice:", err?.message || err);
    return false;
  }
}
