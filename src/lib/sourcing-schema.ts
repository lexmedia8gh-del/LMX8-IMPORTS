import { prisma } from "@/lib/prisma";

let sourcingSchemaEnsured = false;

export async function ensureSourcingSchema(force = false): Promise<boolean> {
  if (sourcingSchemaEnsured && !force) {
    return true;
  }

  const statements: string[] = [
    // 1. Add pricing, image and draft columns to SourcingRequest
    `ALTER TABLE "public"."SourcingRequest" ADD COLUMN IF NOT EXISTS "unitPrice" DOUBLE PRECISION;`,
    `ALTER TABLE "public"."SourcingRequest" ADD COLUMN IF NOT EXISTS "totalCost" DOUBLE PRECISION;`,
    `ALTER TABLE "public"."SourcingRequest" ADD COLUMN IF NOT EXISTS "originalQuantity" INTEGER;`,
    `ALTER TABLE "public"."SourcingRequest" ADD COLUMN IF NOT EXISTS "priceUpdatedAt" TIMESTAMP(3);`,
    `ALTER TABLE "public"."SourcingRequest" ADD COLUMN IF NOT EXISTS "priceUpdatedBy" TEXT;`,
    `ALTER TABLE "public"."SourcingRequest" ADD COLUMN IF NOT EXISTS "priceNotes" TEXT;`,
    `ALTER TABLE "public"."SourcingRequest" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;`,
    `ALTER TABLE "public"."SourcingRequest" ADD COLUMN IF NOT EXISTS "customerConfirmationStatus" TEXT DEFAULT 'PENDING';`,
    `ALTER TABLE "public"."SourcingRequest" ADD COLUMN IF NOT EXISTS "isDraft" BOOLEAN DEFAULT true;`,
    `ALTER TABLE "public"."SourcingRequest" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);`,

    // 2. Create SourcingPriceHistory table
    `CREATE TABLE IF NOT EXISTS "public"."SourcingPriceHistory" (
        "id" TEXT NOT NULL,
        "sourcingRequestId" TEXT NOT NULL,
        "unitPrice" DOUBLE PRECISION NOT NULL,
        "quantity" INTEGER NOT NULL,
        "totalCost" DOUBLE PRECISION NOT NULL,
        "notes" TEXT,
        "updatedById" TEXT,
        "updatedByName" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SourcingPriceHistory_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX IF NOT EXISTS "SourcingPriceHistory_sourcingRequestId_idx" ON "public"."SourcingPriceHistory"("sourcingRequestId");`,
    `CREATE INDEX IF NOT EXISTS "SourcingPriceHistory_createdAt_idx" ON "public"."SourcingPriceHistory"("createdAt");`,

    // 3. Create SourcingItem table for admin-uploaded product photos, names, specs, pricing
    `CREATE TABLE IF NOT EXISTS "public"."SourcingItem" (
        "id" TEXT NOT NULL,
        "sourcingRequestId" TEXT NOT NULL,
        "productName" TEXT NOT NULL,
        "description" TEXT,
        "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "quantity" INTEGER NOT NULL DEFAULT 1,
        "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "imageUrl" TEXT,
        "isPublished" BOOLEAN NOT NULL DEFAULT false,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SourcingItem_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX IF NOT EXISTS "SourcingItem_sourcingRequestId_idx" ON "public"."SourcingItem"("sourcingRequestId");`,

    // 4. Foreign key constraints
    `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SourcingPriceHistory_sourcingRequestId_fkey') THEN
            ALTER TABLE "public"."SourcingPriceHistory" ADD CONSTRAINT "SourcingPriceHistory_sourcingRequestId_fkey" 
            FOREIGN KEY ("sourcingRequestId") REFERENCES "public"."SourcingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
    EXCEPTION
        WHEN duplicate_object THEN null;
        WHEN undefined_table THEN null;
    END $$;`,

    `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SourcingItem_sourcingRequestId_fkey') THEN
            ALTER TABLE "public"."SourcingItem" ADD CONSTRAINT "SourcingItem_sourcingRequestId_fkey" 
            FOREIGN KEY ("sourcingRequestId") REFERENCES "public"."SourcingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
    EXCEPTION
        WHEN duplicate_object THEN null;
        WHEN undefined_table THEN null;
    END $$;`
  ];

  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
    } catch (err: any) {
      console.warn("[ensureSourcingSchema] Statement notice:", err?.message || err);
    }
  }

  sourcingSchemaEnsured = true;
  return true;
}
