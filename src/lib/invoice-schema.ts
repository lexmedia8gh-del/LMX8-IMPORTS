import { prisma } from "@/lib/prisma";

let invoiceSchemaEnsured = false;

/**
 * Checks whether the public.Invoice table exists in the PostgreSQL database.
 */
export async function isInvoiceTableAvailable(): Promise<boolean> {
  try {
    const result = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND (table_name = 'Invoice' OR table_name = 'invoice')
      ) as "exists";
    `);
    return Boolean(result?.[0]?.exists);
  } catch (err: any) {
    console.warn("[isInvoiceTableAvailable] Notice:", err?.message || err);
    return false;
  }
}

/**
 * Ensures the Invoice, InvoiceItem, InvoicePayment, and InvoiceCommunicationLog tables,
 * enum, indexes, and constraints exist in the PostgreSQL database.
 */
export async function ensureInvoiceSchema(force = false): Promise<boolean> {
  if (invoiceSchemaEnsured && !force) {
    return true;
  }

  const ddlStatements: string[] = [
    // 1. Enum
    `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceStatus') THEN
            CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');
        END IF;
    END $$;`,

    // 2. Invoice Table
    `CREATE TABLE IF NOT EXISTS "public"."Invoice" (
        "id" TEXT NOT NULL,
        "invoiceNumber" TEXT NOT NULL,
        "accessToken" TEXT NOT NULL,
        "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
        "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "dueDate" TIMESTAMP(3) NOT NULL,
        "currency" TEXT NOT NULL DEFAULT 'GHS',
        "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "discountPercent" DOUBLE PRECISION DEFAULT 0.0,
        "shippingCharges" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "handlingCharges" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "customsCharges" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "otherCharges" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "taxRate" DOUBLE PRECISION DEFAULT 0.0,
        "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "outstandingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "paymentInstructions" TEXT,
        "clientNotes" TEXT,
        "internalNotes" TEXT,
        "purchaseOrderRef" TEXT,
        "lastDeliveryMethod" TEXT,
        "lastSentAt" TIMESTAMP(3),
        "sentCount" INTEGER NOT NULL DEFAULT 0,
        "customerId" TEXT NOT NULL,
        "shipmentId" TEXT,
        "createdById" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
    );`,

    // 3. Unique Indexes
    `CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_invoiceNumber_key" ON "public"."Invoice"("invoiceNumber");`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_accessToken_key" ON "public"."Invoice"("accessToken");`,

    // 4. Performance Indexes
    `CREATE INDEX IF NOT EXISTS "Invoice_customerId_idx" ON "public"."Invoice"("customerId");`,
    `CREATE INDEX IF NOT EXISTS "Invoice_shipmentId_idx" ON "public"."Invoice"("shipmentId");`,
    `CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "public"."Invoice"("status");`,
    `CREATE INDEX IF NOT EXISTS "Invoice_dueDate_idx" ON "public"."Invoice"("dueDate");`,
    `CREATE INDEX IF NOT EXISTS "Invoice_createdAt_idx" ON "public"."Invoice"("createdAt");`,

    // 5. Foreign Keys for Invoice
    `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_customerId_fkey') THEN
            ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" 
            FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
    EXCEPTION
        WHEN duplicate_object THEN null;
        WHEN undefined_table THEN null;
    END $$;`,

    `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_shipmentId_fkey') THEN
            ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_shipmentId_fkey" 
            FOREIGN KEY ("shipmentId") REFERENCES "public"."Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    EXCEPTION
        WHEN duplicate_object THEN null;
        WHEN undefined_table THEN null;
    END $$;`,

    `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_createdById_fkey') THEN
            ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_createdById_fkey" 
            FOREIGN KEY ("createdById") REFERENCES "public"."AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    EXCEPTION
        WHEN duplicate_object THEN null;
        WHEN undefined_table THEN null;
    END $$;`,

    // 6. InvoiceItem Table
    `CREATE TABLE IF NOT EXISTS "public"."InvoiceItem" (
        "id" TEXT NOT NULL,
        "invoiceId" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "sku" TEXT,
        "quantity" INTEGER NOT NULL DEFAULT 1,
        "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "discount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "lineTotal" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX IF NOT EXISTS "InvoiceItem_invoiceId_idx" ON "public"."InvoiceItem"("invoiceId");`,
    `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceItem_invoiceId_fkey') THEN
            ALTER TABLE "public"."InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" 
            FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
    EXCEPTION
        WHEN duplicate_object THEN null;
        WHEN undefined_table THEN null;
    END $$;`,

    // 7. InvoicePayment Table
    `CREATE TABLE IF NOT EXISTS "public"."InvoicePayment" (
        "id" TEXT NOT NULL,
        "invoiceId" TEXT NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "paymentMethod" TEXT NOT NULL,
        "reference" TEXT,
        "notes" TEXT,
        "recordedBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX IF NOT EXISTS "InvoicePayment_invoiceId_idx" ON "public"."InvoicePayment"("invoiceId");`,
    `CREATE INDEX IF NOT EXISTS "InvoicePayment_paymentDate_idx" ON "public"."InvoicePayment"("paymentDate");`,
    `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoicePayment_invoiceId_fkey') THEN
            ALTER TABLE "public"."InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoiceId_fkey" 
            FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
    EXCEPTION
        WHEN duplicate_object THEN null;
        WHEN undefined_table THEN null;
    END $$;`,

    // 8. InvoiceCommunicationLog Table
    `CREATE TABLE IF NOT EXISTS "public"."InvoiceCommunicationLog" (
        "id" TEXT NOT NULL,
        "invoiceId" TEXT NOT NULL,
        "channel" TEXT NOT NULL,
        "recipient" TEXT NOT NULL,
        "subject" TEXT,
        "status" TEXT NOT NULL,
        "providerMessageId" TEXT,
        "errorMessage" TEXT,
        "metadata" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "InvoiceCommunicationLog_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX IF NOT EXISTS "InvoiceCommunicationLog_invoiceId_idx" ON "public"."InvoiceCommunicationLog"("invoiceId");`,
    `CREATE INDEX IF NOT EXISTS "InvoiceCommunicationLog_channel_idx" ON "public"."InvoiceCommunicationLog"("channel");`,
    `CREATE INDEX IF NOT EXISTS "InvoiceCommunicationLog_createdAt_idx" ON "public"."InvoiceCommunicationLog"("createdAt");`,
    `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceCommunicationLog_invoiceId_fkey') THEN
            ALTER TABLE "public"."InvoiceCommunicationLog" ADD CONSTRAINT "InvoiceCommunicationLog_invoiceId_fkey" 
            FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
    EXCEPTION
        WHEN duplicate_object THEN null;
        WHEN undefined_table THEN null;
    END $$;`
  ];

  for (const stmt of ddlStatements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
    } catch (err: any) {
      console.warn("[ensureInvoiceSchema] Notice executing DDL statement:", err?.message || err);
    }
  }

  invoiceSchemaEnsured = true;
  return true;
}
