-- CreateTable
CREATE TABLE IF NOT EXISTS "CustomerAuthEvent" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "customerIdentifier" TEXT,
    "method" TEXT NOT NULL DEFAULT 'PIN',
    "outcome" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerAuthEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CustomerPageView" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "pageTitle" TEXT,
    "sessionRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPageView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerAuthEvent_customerId_idx" ON "CustomerAuthEvent"("customerId");
CREATE INDEX IF NOT EXISTS "CustomerAuthEvent_customerIdentifier_idx" ON "CustomerAuthEvent"("customerIdentifier");
CREATE INDEX IF NOT EXISTS "CustomerAuthEvent_outcome_idx" ON "CustomerAuthEvent"("outcome");
CREATE INDEX IF NOT EXISTS "CustomerAuthEvent_createdAt_idx" ON "CustomerAuthEvent"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerPageView_customerId_idx" ON "CustomerPageView"("customerId");
CREATE INDEX IF NOT EXISTS "CustomerPageView_path_idx" ON "CustomerPageView"("path");
CREATE INDEX IF NOT EXISTS "CustomerPageView_createdAt_idx" ON "CustomerPageView"("createdAt");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomerAuthEvent_customerId_fkey') THEN
        ALTER TABLE "CustomerAuthEvent" ADD CONSTRAINT "CustomerAuthEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN undefined_table THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomerPageView_customerId_fkey') THEN
        ALTER TABLE "CustomerPageView" ADD CONSTRAINT "CustomerPageView_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN undefined_table THEN null;
END $$;
