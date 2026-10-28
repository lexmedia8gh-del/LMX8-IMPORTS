import { prisma } from "@/lib/prisma";

let eodSchemaEnsured = false;

/**
 * Ensures the Expense and EodReport tables exist in PostgreSQL
 * with all necessary columns, constraints, and indexes.
 */
export async function ensureEodAndExpenseSchema(): Promise<boolean> {
  if (eodSchemaEnsured) return true;

  try {
    // 1. Expense Table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "public"."Expense" (
        "id" TEXT NOT NULL,
        "expenseNumber" TEXT NOT NULL,
        "category" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "currency" TEXT NOT NULL DEFAULT 'GHS',
        "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
        "payee" TEXT,
        "reference" TEXT,
        "notes" TEXT,
        "receiptUrl" TEXT,
        "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "recordedById" TEXT,
        "recordedByName" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "Expense_expenseNumber_key" ON "public"."Expense"("expenseNumber");
      CREATE INDEX IF NOT EXISTS "Expense_date_idx" ON "public"."Expense"("date");
      CREATE INDEX IF NOT EXISTS "Expense_category_idx" ON "public"."Expense"("category");
      CREATE INDEX IF NOT EXISTS "Expense_paymentMethod_idx" ON "public"."Expense"("paymentMethod");
      CREATE INDEX IF NOT EXISTS "Expense_createdAt_idx" ON "public"."Expense"("createdAt");
    `);

    // 2. EodReport Table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "public"."EodReport" (
        "id" TEXT NOT NULL,
        "reportNumber" TEXT NOT NULL,
        "businessDate" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'DRAFT',
        "openingCash" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "actualClosingCash" DOUBLE PRECISION,
        "expectedClosingCash" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "cashVariance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "totalInvoiced" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "totalCollections" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "collectionsByMethod" JSONB,
        "totalExpenses" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "expensesByCategory" JSONB,
        "netCashMovement" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "receivablesTotal" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "invoicesCreatedCount" INTEGER NOT NULL DEFAULT 0,
        "invoicesSettledCount" INTEGER NOT NULL DEFAULT 0,
        "shipmentsProcessedCount" INTEGER NOT NULL DEFAULT 0,
        "newClientsCount" INTEGER NOT NULL DEFAULT 0,
        "notes" TEXT,
        "preparedByName" TEXT,
        "finalizedByName" TEXT,
        "finalizedAt" TIMESTAMP(3),
        "snapshotData" JSONB,
        "auditTrail" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "EodReport_pkey" PRIMARY KEY ("id")
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "EodReport_reportNumber_key" ON "public"."EodReport"("reportNumber");
      CREATE INDEX IF NOT EXISTS "EodReport_businessDate_idx" ON "public"."EodReport"("businessDate");
      CREATE INDEX IF NOT EXISTS "EodReport_status_idx" ON "public"."EodReport"("status");
      CREATE INDEX IF NOT EXISTS "EodReport_createdAt_idx" ON "public"."EodReport"("createdAt");
    `);

    eodSchemaEnsured = true;
    return true;
  } catch (err: any) {
    console.warn("[ensureEodAndExpenseSchema] Notice:", err?.message || err);
    return false;
  }
}
