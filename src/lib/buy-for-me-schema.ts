import { prisma } from "@/lib/prisma";

let buyForMeSchemaEnsured = false;

export async function ensureBuyForMeSchema(force = false): Promise<boolean> {
  if (buyForMeSchemaEnsured && !force) {
    return true;
  }

  const statements: string[] = [
    // 1. BuyForMeRequest table
    `CREATE TABLE IF NOT EXISTS "public"."BuyForMeRequest" (
        "id" TEXT NOT NULL,
        "requestNumber" TEXT NOT NULL,
        "customerId" TEXT NOT NULL,
        "submissionType" TEXT NOT NULL DEFAULT 'MANUAL_LIST',
        "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
        "additionalInstructions" TEXT,
        "purchasingPreferences" TEXT,
        "deliveryPreferences" TEXT,
        "adminNotes" TEXT,
        "idempotencyKey" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "BuyForMeRequest_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "BuyForMeRequest_requestNumber_key" ON "public"."BuyForMeRequest"("requestNumber");`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "BuyForMeRequest_idempotencyKey_key" ON "public"."BuyForMeRequest"("idempotencyKey");`,
    `CREATE INDEX IF NOT EXISTS "BuyForMeRequest_customerId_idx" ON "public"."BuyForMeRequest"("customerId");`,
    `CREATE INDEX IF NOT EXISTS "BuyForMeRequest_status_idx" ON "public"."BuyForMeRequest"("status");`,
    `CREATE INDEX IF NOT EXISTS "BuyForMeRequest_createdAt_idx" ON "public"."BuyForMeRequest"("createdAt");`,

    // FK for BuyForMeRequest -> Customer
    `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BuyForMeRequest_customerId_fkey') THEN
            ALTER TABLE "public"."BuyForMeRequest" ADD CONSTRAINT "BuyForMeRequest_customerId_fkey" 
            FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
    EXCEPTION WHEN duplicate_object THEN null; WHEN undefined_table THEN null; END $$;`,

    // 2. BuyForMeItem table
    `CREATE TABLE IF NOT EXISTS "public"."BuyForMeItem" (
        "id" TEXT NOT NULL,
        "requestId" TEXT NOT NULL,
        "productName" TEXT NOT NULL,
        "description" TEXT,
        "productUrl" TEXT,
        "quantity" INTEGER NOT NULL DEFAULT 1,
        "preferredSpecs" TEXT,
        "budget" DOUBLE PRECISION,
        "imageUrl" TEXT,
        "unitPrice" DOUBLE PRECISION,
        "subtotal" DOUBLE PRECISION,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "BuyForMeItem_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX IF NOT EXISTS "BuyForMeItem_requestId_idx" ON "public"."BuyForMeItem"("requestId");`,
    `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BuyForMeItem_requestId_fkey') THEN
            ALTER TABLE "public"."BuyForMeItem" ADD CONSTRAINT "BuyForMeItem_requestId_fkey" 
            FOREIGN KEY ("requestId") REFERENCES "public"."BuyForMeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
    EXCEPTION WHEN duplicate_object THEN null; WHEN undefined_table THEN null; END $$;`,

    // 3. BuyForMeQuotation table
    `CREATE TABLE IF NOT EXISTS "public"."BuyForMeQuotation" (
        "id" TEXT NOT NULL,
        "requestId" TEXT NOT NULL,
        "version" INTEGER NOT NULL DEFAULT 1,
        "status" TEXT NOT NULL DEFAULT 'DRAFT',
        "totalProductCost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "shippingFee" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "sourcingFee" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "serviceFee" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "otherCharges" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "otherChargesNotes" TEXT,
        "grandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "currency" TEXT NOT NULL DEFAULT 'GHS',
        "adminNotes" TEXT,
        "publishedAt" TIMESTAMP(3),
        "publishedById" TEXT,
        "publishedByName" TEXT,
        "isPaid" BOOLEAN NOT NULL DEFAULT false,
        "paidAt" TIMESTAMP(3),
        "paymentReference" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "BuyForMeQuotation_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX IF NOT EXISTS "BuyForMeQuotation_requestId_idx" ON "public"."BuyForMeQuotation"("requestId");`,
    `CREATE INDEX IF NOT EXISTS "BuyForMeQuotation_status_idx" ON "public"."BuyForMeQuotation"("status");`,
    `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BuyForMeQuotation_requestId_fkey') THEN
            ALTER TABLE "public"."BuyForMeQuotation" ADD CONSTRAINT "BuyForMeQuotation_requestId_fkey" 
            FOREIGN KEY ("requestId") REFERENCES "public"."BuyForMeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
    EXCEPTION WHEN duplicate_object THEN null; WHEN undefined_table THEN null; END $$;`,

    // 4. BuyForMeQuotationLineItem table
    `CREATE TABLE IF NOT EXISTS "public"."BuyForMeQuotationLineItem" (
        "id" TEXT NOT NULL,
        "quotationId" TEXT NOT NULL,
        "itemId" TEXT,
        "productName" TEXT NOT NULL,
        "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "quantity" INTEGER NOT NULL DEFAULT 1,
        "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "BuyForMeQuotationLineItem_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX IF NOT EXISTS "BuyForMeQuotationLineItem_quotationId_idx" ON "public"."BuyForMeQuotationLineItem"("quotationId");`,
    `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BuyForMeQuotationLineItem_quotationId_fkey') THEN
            ALTER TABLE "public"."BuyForMeQuotationLineItem" ADD CONSTRAINT "BuyForMeQuotationLineItem_quotationId_fkey" 
            FOREIGN KEY ("quotationId") REFERENCES "public"."BuyForMeQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
    EXCEPTION WHEN duplicate_object THEN null; WHEN undefined_table THEN null; END $$;`,

    // 5. BuyForMeStatusHistory table
    `CREATE TABLE IF NOT EXISTS "public"."BuyForMeStatusHistory" (
        "id" TEXT NOT NULL,
        "requestId" TEXT NOT NULL,
        "status" TEXT NOT NULL,
        "note" TEXT,
        "changedById" TEXT,
        "changedByName" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "BuyForMeStatusHistory_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX IF NOT EXISTS "BuyForMeStatusHistory_requestId_idx" ON "public"."BuyForMeStatusHistory"("requestId");`,
    `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BuyForMeStatusHistory_requestId_fkey') THEN
            ALTER TABLE "public"."BuyForMeStatusHistory" ADD CONSTRAINT "BuyForMeStatusHistory_requestId_fkey" 
            FOREIGN KEY ("requestId") REFERENCES "public"."BuyForMeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
    EXCEPTION WHEN duplicate_object THEN null; WHEN undefined_table THEN null; END $$;`,

    // 6. Add buyForMe columns to Payment table
    `ALTER TABLE "public"."Payment" ADD COLUMN IF NOT EXISTS "buyForMeRequestId" TEXT;`,
    `ALTER TABLE "public"."Payment" ADD COLUMN IF NOT EXISTS "buyForMeQuotationId" TEXT;`,
    `DO $$ BEGIN
        ALTER TYPE "PaymentType" ADD VALUE IF NOT EXISTS 'BUY_FOR_ME';
    EXCEPTION WHEN OTHERS THEN null;
    END $$;`,

    // 7. Notification model updates
    `DO $$ BEGIN
        ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BUY_FOR_ME';
    EXCEPTION WHEN OTHERS THEN null;
    END $$;`,
    `ALTER TABLE "public"."Notification" ADD COLUMN IF NOT EXISTS "buyForMeRequestId" TEXT;`
  ];

  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
    } catch (err: any) {
      console.warn("[ensureBuyForMeSchema] Statement notice:", err?.message || err);
    }
  }

  buyForMeSchemaEnsured = true;
  return true;
}
