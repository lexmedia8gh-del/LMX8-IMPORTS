-- CreateTable ResetAudit
CREATE TABLE IF NOT EXISTS "public"."ResetAudit" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "adminName" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "resetMode" TEXT NOT NULL,
    "selectedCategories" TEXT[] NOT NULL,
    "countsBefore" JSONB NOT NULL,
    "countsAfter" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "pendingCleanup" JSONB,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResetAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ResetAudit_operationId_key" ON "public"."ResetAudit"("operationId");
CREATE INDEX IF NOT EXISTS "ResetAudit_adminId_idx" ON "public"."ResetAudit"("adminId");
CREATE INDEX IF NOT EXISTS "ResetAudit_status_idx" ON "public"."ResetAudit"("status");
CREATE INDEX IF NOT EXISTS "ResetAudit_createdAt_idx" ON "public"."ResetAudit"("createdAt");

-- CreateTable SystemSettings
CREATE TABLE IF NOT EXISTS "public"."SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "defaultTimezone" TEXT NOT NULL DEFAULT 'Africa/Accra',
    "dateTimeFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'GHS',
    "shipmentEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "feeReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "feeReminderIntervalDays" INTEGER NOT NULL DEFAULT 3,
    "failedEmailRetryMax" INTEGER NOT NULL DEFAULT 3,
    "sessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 60,
    "maxLoginAttempts" INTEGER NOT NULL DEFAULT 5,
    "lockoutDurationMinutes" INTEGER NOT NULL DEFAULT 15,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);
