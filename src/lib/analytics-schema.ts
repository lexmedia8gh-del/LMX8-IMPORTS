import { prisma } from "@/lib/prisma";

let analyticsSchemaEnsured = false;

/**
 * Ensures CustomerLoginLog and CustomerPageView tables exist in PostgreSQL
 * so tracking calls never crash even before or during migration runs.
 */
export async function ensureAnalyticsSchema(): Promise<boolean> {
  if (analyticsSchemaEnsured) return true;

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "public"."CustomerLoginLog" (
        "id" TEXT NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text),
        "customerId" TEXT,
        "customerIdentifier" TEXT,
        "status" TEXT NOT NULL,
        "authMethod" TEXT NOT NULL DEFAULT 'PIN',
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "failureReason" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CustomerLoginLog_pkey" PRIMARY KEY ("id")
      );

      CREATE INDEX IF NOT EXISTS "CustomerLoginLog_customerId_idx" ON "public"."CustomerLoginLog"("customerId");
      CREATE INDEX IF NOT EXISTS "CustomerLoginLog_status_idx" ON "public"."CustomerLoginLog"("status");
      CREATE INDEX IF NOT EXISTS "CustomerLoginLog_createdAt_idx" ON "public"."CustomerLoginLog"("createdAt");
      CREATE INDEX IF NOT EXISTS "CustomerLoginLog_customerIdentifier_idx" ON "public"."CustomerLoginLog"("customerIdentifier");

      CREATE TABLE IF NOT EXISTS "public"."CustomerPageView" (
        "id" TEXT NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text),
        "customerId" TEXT NOT NULL,
        "customerIdentifier" TEXT NOT NULL,
        "path" TEXT NOT NULL,
        "title" TEXT,
        "sessionId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CustomerPageView_pkey" PRIMARY KEY ("id")
      );

      CREATE INDEX IF NOT EXISTS "CustomerPageView_customerId_idx" ON "public"."CustomerPageView"("customerId");
      CREATE INDEX IF NOT EXISTS "CustomerPageView_path_idx" ON "public"."CustomerPageView"("path");
      CREATE INDEX IF NOT EXISTS "CustomerPageView_createdAt_idx" ON "public"."CustomerPageView"("createdAt");

      DO $$ BEGIN
        ALTER TABLE "public"."CustomerLoginLog" 
          ADD CONSTRAINT "CustomerLoginLog_customerId_fkey" 
          FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") 
          ON DELETE SET NULL ON UPDATE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        ALTER TABLE "public"."CustomerPageView" 
          ADD CONSTRAINT "CustomerPageView_customerId_fkey" 
          FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") 
          ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    analyticsSchemaEnsured = true;
    return true;
  } catch (err: any) {
    console.warn("[ensureAnalyticsSchema] Notice:", err?.message || err);
    return false;
  }
}
