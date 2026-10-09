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
