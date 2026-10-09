import { prisma } from "@/lib/prisma";

let emailLogSchemaEnsured = false;

/**
 * Checks whether the public.EmailLog table exists in the PostgreSQL database.
 */
export async function isEmailLogTableAvailable(): Promise<boolean> {
  try {
    const result = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND (table_name = 'EmailLog' OR table_name = 'emaillog')
      ) as "exists";
    `);
    return Boolean(result?.[0]?.exists);
  } catch (err: any) {
    console.warn("[isEmailLogTableAvailable] Notice:", err?.message || err);
    return false;
  }
}

/**
 * Ensures the EmailLog table, EmailEventStatus enum, indexes, and foreign keys
 * exist in the PostgreSQL database.
 *
 * Executes statements individually to prevent PostgreSQL extended query protocol
 * "cannot insert multiple commands into a prepared statement" errors.
 */
export async function ensureEmailLogSchema(force = false): Promise<boolean> {
  if (emailLogSchemaEnsured && !force) {
    return true;
  }

  const ddlStatements: string[] = [
    // 1. Enum
    `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmailEventStatus') THEN
            CREATE TYPE "EmailEventStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');
        END IF;
    END $$;`,

    // 2. Table
    `CREATE TABLE IF NOT EXISTS "public"."EmailLog" (
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
    );`,

    // 3. Unique Index on idempotencyKey
    `CREATE UNIQUE INDEX IF NOT EXISTS "EmailLog_idempotencyKey_key" ON "public"."EmailLog"("idempotencyKey");`,

    // 4. Performance Indexes
    `CREATE INDEX IF NOT EXISTS "EmailLog_customerId_idx" ON "public"."EmailLog"("customerId");`,
    `CREATE INDEX IF NOT EXISTS "EmailLog_shipmentId_idx" ON "public"."EmailLog"("shipmentId");`,
    `CREATE INDEX IF NOT EXISTS "EmailLog_eventType_idx" ON "public"."EmailLog"("eventType");`,
    `CREATE INDEX IF NOT EXISTS "EmailLog_status_idx" ON "public"."EmailLog"("status");`,
    `CREATE INDEX IF NOT EXISTS "EmailLog_createdAt_idx" ON "public"."EmailLog"("createdAt");`,

    // 5. Foreign Key Constraints (safely guarded against missing parent tables or duplicate keys)
    `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmailLog_customerId_fkey') THEN
            ALTER TABLE "public"."EmailLog" ADD CONSTRAINT "EmailLog_customerId_fkey" 
            FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
    EXCEPTION
        WHEN duplicate_object THEN null;
        WHEN undefined_table THEN null;
    END $$;`,

    `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmailLog_shipmentId_fkey') THEN
            ALTER TABLE "public"."EmailLog" ADD CONSTRAINT "EmailLog_shipmentId_fkey" 
            FOREIGN KEY ("shipmentId") REFERENCES "public"."Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    EXCEPTION
        WHEN duplicate_object THEN null;
        WHEN undefined_table THEN null;
    END $$;`,

    `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmailLog_batchId_fkey') THEN
            ALTER TABLE "public"."EmailLog" ADD CONSTRAINT "EmailLog_batchId_fkey" 
            FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    EXCEPTION
        WHEN duplicate_object THEN null;
        WHEN undefined_table THEN null;
    END $$;`
  ];

  try {
    for (const stmt of ddlStatements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (stmtErr: any) {
        console.warn("[ensureEmailLogSchema] Statement notice:", stmtErr?.message || stmtErr);
      }
    }

    const exists = await isEmailLogTableAvailable();
    if (exists) {
      emailLogSchemaEnsured = true;
    }
    return exists;
  } catch (err: any) {
    console.warn("[ensureEmailLogSchema] Schema check notice:", err?.message || err);
    return false;
  }
}
