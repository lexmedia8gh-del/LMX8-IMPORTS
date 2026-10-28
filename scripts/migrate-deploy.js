const { execSync } = require("child_process");

async function runMigrate() {
  const dbUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL;
  if (!dbUrl || dbUrl.includes("localhost:5432")) {
    console.log("[migrate-deploy] No remote DATABASE_URL configured during build/startup. Skipping migration deployment.");
    return;
  }

  // Ensure DIRECT_URL is set so Prisma CLI doesn't throw P1012
  const directUrl = process.env.DIRECT_URL || process.env.POSTGRES_URL_NON_POOLING || dbUrl;
  const env = {
    ...process.env,
    DATABASE_URL: dbUrl,
    DIRECT_URL: directUrl,
  };

  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient({
    datasources: { db: { url: directUrl } },
  });

  try {
    console.log("[migrate-deploy] Connected to database. Verifying essential tables before migration deploy...");

    // ── 1. Proactively ensure EmailLog table exists ──────────────────────────
    const checkEmailLog = await prisma.$queryRawUnsafe(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND (table_name = 'EmailLog' OR table_name = 'emaillog');
    `).catch(() => []);

    const emailLogExists = Array.isArray(checkEmailLog) && checkEmailLog.length > 0;

    if (!emailLogExists) {
      console.log("[migrate-deploy] Table 'EmailLog' is missing. Creating table, enum, indexes, and constraints sequentially...");
      const statements = [
        `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmailEventStatus') THEN
                CREATE TYPE "EmailEventStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');
            END IF;
        END $$;`,
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
        `CREATE UNIQUE INDEX IF NOT EXISTS "EmailLog_idempotencyKey_key" ON "public"."EmailLog"("idempotencyKey");`,
        `CREATE INDEX IF NOT EXISTS "EmailLog_customerId_idx" ON "public"."EmailLog"("customerId");`,
        `CREATE INDEX IF NOT EXISTS "EmailLog_shipmentId_idx" ON "public"."EmailLog"("shipmentId");`,
        `CREATE INDEX IF NOT EXISTS "EmailLog_eventType_idx" ON "public"."EmailLog"("eventType");`,
        `CREATE INDEX IF NOT EXISTS "EmailLog_status_idx" ON "public"."EmailLog"("status");`,
        `CREATE INDEX IF NOT EXISTS "EmailLog_createdAt_idx" ON "public"."EmailLog"("createdAt");`,
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

      for (const stmt of statements) {
        try {
          await prisma.$executeRawUnsafe(stmt);
        } catch (stmtErr) {
          console.warn("[migrate-deploy] Statement notice:", stmtErr?.message || stmtErr);
        }
      }
      console.log("[migrate-deploy] Table 'EmailLog' and related constraints successfully created.");
    } else {
      console.log("[migrate-deploy] Verified: Table 'EmailLog' exists in public schema.");
    }

    // ── 1b. Proactively ensure CustomerAuthEvent & CustomerPageView exist ──
    const checkAnalytics = await prisma.$queryRawUnsafe(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND (table_name = 'CustomerAuthEvent' OR table_name = 'customerauthevent');
    `).catch(() => []);

    if (!Array.isArray(checkAnalytics) || checkAnalytics.length === 0) {
      console.log("[migrate-deploy] Creating CustomerAuthEvent & CustomerPageView tables...");
      const analyticsStmts = [
        `CREATE TABLE IF NOT EXISTS "public"."CustomerLoginLog" (
            "id" TEXT NOT NULL,
            "customerId" TEXT,
            "customerIdentifier" TEXT,
            "status" TEXT NOT NULL,
            "authMethod" TEXT NOT NULL DEFAULT 'PIN',
            "ipAddress" TEXT,
            "userAgent" TEXT,
            "failureReason" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "CustomerLoginLog_pkey" PRIMARY KEY ("id")
        );`,
        `CREATE TABLE IF NOT EXISTS "public"."CustomerAuthEvent" (
            "id" TEXT NOT NULL,
            "customerId" TEXT,
            "customerIdentifier" TEXT,
            "method" TEXT NOT NULL DEFAULT 'PIN',
            "outcome" TEXT NOT NULL,
            "ipAddress" TEXT,
            "userAgent" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "CustomerAuthEvent_pkey" PRIMARY KEY ("id")
        );`,
        `CREATE TABLE IF NOT EXISTS "public"."CustomerPageView" (
            "id" TEXT NOT NULL,
            "customerId" TEXT NOT NULL,
            "customerIdentifier" TEXT NOT NULL DEFAULT 'CUSTOMER',
            "path" TEXT NOT NULL,
            "title" TEXT,
            "pageTitle" TEXT,
            "sessionId" TEXT,
            "sessionRef" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "CustomerPageView_pkey" PRIMARY KEY ("id")
        );`,
        `CREATE INDEX IF NOT EXISTS "CustomerLoginLog_customerId_idx" ON "public"."CustomerLoginLog"("customerId");`,
        `CREATE INDEX IF NOT EXISTS "CustomerLoginLog_status_idx" ON "public"."CustomerLoginLog"("status");`,
        `CREATE INDEX IF NOT EXISTS "CustomerLoginLog_createdAt_idx" ON "public"."CustomerLoginLog"("createdAt");`,
        `CREATE INDEX IF NOT EXISTS "CustomerAuthEvent_customerId_idx" ON "public"."CustomerAuthEvent"("customerId");`,
        `CREATE INDEX IF NOT EXISTS "CustomerAuthEvent_customerIdentifier_idx" ON "public"."CustomerAuthEvent"("customerIdentifier");`,
        `CREATE INDEX IF NOT EXISTS "CustomerAuthEvent_outcome_idx" ON "public"."CustomerAuthEvent"("outcome");`,
        `CREATE INDEX IF NOT EXISTS "CustomerAuthEvent_createdAt_idx" ON "public"."CustomerAuthEvent"("createdAt");`,
        `CREATE INDEX IF NOT EXISTS "CustomerPageView_customerId_idx" ON "public"."CustomerPageView"("customerId");`,
        `CREATE INDEX IF NOT EXISTS "CustomerPageView_path_idx" ON "public"."CustomerPageView"("path");`,
        `CREATE INDEX IF NOT EXISTS "CustomerPageView_createdAt_idx" ON "public"."CustomerPageView"("createdAt");`,
        `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomerLoginLog_customerId_fkey') THEN
                ALTER TABLE "public"."CustomerLoginLog" ADD CONSTRAINT "CustomerLoginLog_customerId_fkey" 
                FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
            END IF;
        EXCEPTION WHEN duplicate_object THEN null; WHEN undefined_table THEN null; END $$;`,
        `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomerAuthEvent_customerId_fkey') THEN
                ALTER TABLE "public"."CustomerAuthEvent" ADD CONSTRAINT "CustomerAuthEvent_customerId_fkey" 
                FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
            END IF;
        EXCEPTION WHEN duplicate_object THEN null; WHEN undefined_table THEN null; END $$;`,
        `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomerPageView_customerId_fkey') THEN
                ALTER TABLE "public"."CustomerPageView" ADD CONSTRAINT "CustomerPageView_customerId_fkey" 
                FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
            END IF;
        EXCEPTION WHEN duplicate_object THEN null; WHEN undefined_table THEN null; END $$;`
      ];

      for (const stmt of analyticsStmts) {
        try {
          await prisma.$executeRawUnsafe(stmt);
        } catch (sErr) {
          console.warn("[migrate-deploy] Analytics schema notice:", sErr?.message || sErr);
        }
      }
      console.log("[migrate-deploy] Analytics tables verified successfully.");
    }

    // ── 1c. Proactively ensure Shipment discount columns exist ───────────────
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "public"."Shipment" ADD COLUMN IF NOT EXISTS "originalFee" DOUBLE PRECISION;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "public"."Shipment" ADD COLUMN IF NOT EXISTS "discountPercent" DOUBLE PRECISION DEFAULT 0.0;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "public"."Shipment" ADD COLUMN IF NOT EXISTS "discountAmount" DOUBLE PRECISION DEFAULT 0.0;`);
      console.log("[migrate-deploy] Shipment discount columns verified successfully.");
    } catch (colErr) {
      console.warn("[migrate-deploy] Shipment discount columns notice:", colErr?.message || colErr);
    }

    // ── 1c. Proactively ensure Invoice, InvoiceItem, InvoicePayment, InvoiceCommunicationLog exist ──
    try {
      const checkInvoice = await prisma.$queryRawUnsafe(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND (table_name = 'Invoice' OR table_name = 'invoice');
      `).catch(() => []);

      if (!Array.isArray(checkInvoice) || checkInvoice.length === 0) {
        console.log("[migrate-deploy] Creating Invoice, InvoiceItem, InvoicePayment, InvoiceCommunicationLog tables...");
        const invoiceStmts = [
          `DO $$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceStatus') THEN
                  CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');
              END IF;
          END $$;`,
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
          `CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_invoiceNumber_key" ON "public"."Invoice"("invoiceNumber");`,
          `CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_accessToken_key" ON "public"."Invoice"("accessToken");`,
          `CREATE INDEX IF NOT EXISTS "Invoice_customerId_idx" ON "public"."Invoice"("customerId");`,
          `CREATE INDEX IF NOT EXISTS "Invoice_shipmentId_idx" ON "public"."Invoice"("shipmentId");`,
          `CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "public"."Invoice"("status");`,
          `CREATE INDEX IF NOT EXISTS "Invoice_dueDate_idx" ON "public"."Invoice"("dueDate");`,
          `CREATE INDEX IF NOT EXISTS "Invoice_createdAt_idx" ON "public"."Invoice"("createdAt");`,
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
          `CREATE INDEX IF NOT EXISTS "InvoiceCommunicationLog_invoiceId_idx" ON "public"."InvoiceCommunicationLog"("invoiceId");`
        ];
        for (const stmt of invoiceStmts) {
          try {
            await prisma.$executeRawUnsafe(stmt);
          } catch (e) {
            console.warn("[migrate-deploy] Invoice DDL statement notice:", e?.message || e);
          }
        }
        console.log("[migrate-deploy] Invoice tables created successfully.");
      } else {
        console.log("[migrate-deploy] Verified: Table 'Invoice' exists in public schema.");
      }
    } catch (invErr) {
      console.warn("[migrate-deploy] Invoice setup notice:", invErr?.message || invErr);
    }

    // ── 1c. Proactively ensure Expense & EodReport tables exist ─────────────
    try {
      const eodStatements = [
        `CREATE TABLE IF NOT EXISTS "public"."Expense" (
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
        );`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "Expense_expenseNumber_key" ON "public"."Expense"("expenseNumber");`,
        `CREATE INDEX IF NOT EXISTS "Expense_date_idx" ON "public"."Expense"("date");`,
        `CREATE INDEX IF NOT EXISTS "Expense_category_idx" ON "public"."Expense"("category");`,
        `CREATE INDEX IF NOT EXISTS "Expense_paymentMethod_idx" ON "public"."Expense"("paymentMethod");`,
        `CREATE INDEX IF NOT EXISTS "Expense_createdAt_idx" ON "public"."Expense"("createdAt");`,
        `CREATE TABLE IF NOT EXISTS "public"."EodReport" (
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
        );`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "EodReport_reportNumber_key" ON "public"."EodReport"("reportNumber");`,
        `CREATE INDEX IF NOT EXISTS "EodReport_businessDate_idx" ON "public"."EodReport"("businessDate");`,
        `CREATE INDEX IF NOT EXISTS "EodReport_status_idx" ON "public"."EodReport"("status");`,
        `CREATE INDEX IF NOT EXISTS "EodReport_createdAt_idx" ON "public"."EodReport"("createdAt");`
      ];
      for (const stmt of eodStatements) {
        try {
          await prisma.$executeRawUnsafe(stmt);
        } catch (e) {
          console.warn("[migrate-deploy] EodReport / Expense DDL notice:", e?.message || e);
        }
      }
      console.log("[migrate-deploy] Expense and EodReport tables verified.");
    } catch (eodErr) {
      console.warn("[migrate-deploy] Expense/EOD setup notice:", eodErr?.message || eodErr);
    }

    // ── 2. Diagnose & clean up _prisma_migrations table state ────────────────
    const migrationsTableExists = await prisma.$queryRawUnsafe(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = '_prisma_migrations';
    `).catch(() => []);

    if (Array.isArray(migrationsTableExists) && migrationsTableExists.length > 0) {
      // Find any failed migrations (finished_at IS NULL)
      const failedMigrations = await prisma.$queryRawUnsafe(`
        SELECT migration_name, started_at, finished_at, rolled_back_at, logs
        FROM "_prisma_migrations"
        WHERE finished_at IS NULL;
      `).catch(() => []);

      for (const fm of failedMigrations) {
        const migName = fm.migration_name;
        console.log(`[migrate-deploy] Resolving incomplete migration in _prisma_migrations: "${migName}"...`);

        if (migName === "20261006170000_add_email_log") {
          console.log(`[migrate-deploy] Marking "${migName}" as applied since EmailLog is verified.`);
          try {
            execSync(`npx prisma migrate resolve --applied 20261006170000_add_email_log`, { stdio: "inherit", env });
          } catch (resErr) {
            console.warn(`[migrate-deploy] Notice resolving ${migName}:`, resErr?.message || resErr);
          }
        } else if (migName === "20261007180000_add_reset_audit_and_system_settings") {
          const checkResetAudit = await prisma.$queryRawUnsafe(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'ResetAudit';
          `).catch(() => []);
          if (Array.isArray(checkResetAudit) && checkResetAudit.length > 0) {
            console.log(`[migrate-deploy] Marking "${migName}" as applied since ResetAudit is verified.`);
            try {
              execSync(`npx prisma migrate resolve --applied 20261007180000_add_reset_audit_and_system_settings`, { stdio: "inherit", env });
            } catch (resErr) {
              console.warn(`[migrate-deploy] Notice resolving ${migName}:`, resErr?.message || resErr);
            }
          }
        }
      }
    }

    await prisma.$disconnect();

    // ── 3. Run standard prisma migrate deploy ───────────────────────────────
    console.log("[migrate-deploy] Executing `npx prisma migrate deploy`...");
    const deployOutput = execSync("npx prisma migrate deploy", { env, encoding: "utf8" });
    console.log("[migrate-deploy] Output from prisma migrate deploy:\n", deployOutput);
    console.log("[migrate-deploy] Production Prisma migrations deployed successfully.");
  } catch (err) {
    const combinedOutput = (err?.stdout || "") + "\n" + (err?.stderr || "") + "\n" + (err?.message || "");
    console.warn("[migrate-deploy] Notice during migration deployment:", combinedOutput);

    // Fallback recovery check if P3009 is caught
    if (combinedOutput.includes("P3009") || combinedOutput.includes("failed migrations")) {
      try {
        console.log("[migrate-deploy] Attempting P3009 resolution for 20261006170000_add_email_log...");
        execSync(`npx prisma migrate resolve --applied 20261006170000_add_email_log`, { stdio: "inherit", env });
        execSync("npx prisma migrate deploy", { stdio: "inherit", env });
        console.log("[migrate-deploy] Successfully resolved P3009 and deployed migrations.");
      } catch (innerErr) {
        console.warn("[migrate-deploy] P3009 resolution notice:", innerErr?.message || innerErr);
      }
    }
  } finally {
    try {
      await prisma.$disconnect();
    } catch {
      // ignore disconnect errors
    }
  }
}

runMigrate().catch((e) => {
  console.warn("[migrate-deploy] Unexpected top-level error:", e?.message || e);
});
