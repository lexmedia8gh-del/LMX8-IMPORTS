-- Safe forward-only migration: Ensure EmailEventStatus enum and EmailLog table exist

-- 1. CreateEnum EmailEventStatus
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmailEventStatus') THEN
        CREATE TYPE "EmailEventStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');
    END IF;
END $$;

-- 2. CreateTable EmailLog
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

-- 3. Create Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "EmailLog_idempotencyKey_key" ON "EmailLog"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "EmailLog_customerId_idx" ON "EmailLog"("customerId");
CREATE INDEX IF NOT EXISTS "EmailLog_shipmentId_idx" ON "EmailLog"("shipmentId");
CREATE INDEX IF NOT EXISTS "EmailLog_eventType_idx" ON "EmailLog"("eventType");
CREATE INDEX IF NOT EXISTS "EmailLog_status_idx" ON "EmailLog"("status");
CREATE INDEX IF NOT EXISTS "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

-- 4. Create Foreign Keys safely
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'EmailLog_customerId_fkey'
    ) THEN
        ALTER TABLE "EmailLog" 
        ADD CONSTRAINT "EmailLog_customerId_fkey" 
        FOREIGN KEY ("customerId") REFERENCES "Customer"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'EmailLog_shipmentId_fkey'
    ) THEN
        ALTER TABLE "EmailLog" 
        ADD CONSTRAINT "EmailLog_shipmentId_fkey" 
        FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'EmailLog_batchId_fkey'
    ) THEN
        ALTER TABLE "EmailLog" 
        ADD CONSTRAINT "EmailLog_batchId_fkey" 
        FOREIGN KEY ("batchId") REFERENCES "Batch"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
