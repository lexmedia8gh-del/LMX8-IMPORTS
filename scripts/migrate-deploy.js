const { execSync } = require("child_process");

async function runMigrate() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;
  if (!dbUrl || dbUrl.includes("localhost:5432")) {
    console.log("[migrate-deploy] No remote DATABASE_URL configured during build/startup. Skipping migration deployment.");
    return;
  }

  // Ensure DIRECT_URL is set so prisma doesn't throw P1012 if only DATABASE_URL is in environment
  const directUrl = process.env.DIRECT_URL || process.env.POSTGRES_URL_NON_POOLING || dbUrl;
  const env = {
    ...process.env,
    DATABASE_URL: dbUrl,
    DIRECT_URL: directUrl,
  };

  try {
    console.log("[migrate-deploy] Executing `npx prisma migrate deploy` for production database...");
    execSync("npx prisma migrate deploy", { stdio: "inherit", env });
    console.log("[migrate-deploy] Production Prisma migrations deployed successfully.");
  } catch (err) {
    const errMsg = err?.message || String(err);
    console.warn("[migrate-deploy] Warning during `npx prisma migrate deploy`:", errMsg);

    // Detect Prisma P3009 (failed migration blocking deployment)
    if (errMsg.includes("P3009") || errMsg.includes("failed migrations")) {
      console.log("[migrate-deploy] P3009 detected. Diagnosing failed migrations in _prisma_migrations...");

      try {
        const { PrismaClient } = require("@prisma/client");
        const prisma = new PrismaClient({
          datasources: { db: { url: directUrl } },
        });

        const failedMigrations = await prisma.$queryRawUnsafe(`
          SELECT migration_name, started_at, finished_at, rolled_back_at, logs
          FROM "_prisma_migrations"
          WHERE finished_at IS NULL AND rolled_back_at IS NULL;
        `);

        console.log(`[migrate-deploy] Found ${failedMigrations.length} failed migration(s):`, failedMigrations.map(m => m.migration_name));

        for (const fm of failedMigrations) {
          const migName = fm.migration_name;
          console.log(`[migrate-deploy] Inspecting schema objects for failed migration "${migName}"...`);

          if (migName === "20261006170000_add_email_log") {
            // Check if EmailLog table exists
            const checkTable = await prisma.$queryRawUnsafe(`
              SELECT table_name FROM information_schema.tables 
              WHERE table_schema = 'public' AND table_name = 'EmailLog';
            `);
            const tableExists = Array.isArray(checkTable) && checkTable.length > 0;

            if (tableExists) {
              console.log(`[migrate-deploy] Verified: "EmailLog" table exists in database. Safely resolving migration as applied.`);
              execSync(`npx prisma migrate resolve --applied 20261006170000_add_email_log`, { stdio: "inherit", env });
            } else {
              console.log(`[migrate-deploy] "EmailLog" table does NOT exist. Safely resolving migration as rolled-back.`);
              execSync(`npx prisma migrate resolve --rolled-back 20261006170000_add_email_log`, { stdio: "inherit", env });
            }
          } else if (migName === "20261007180000_add_reset_audit_and_system_settings") {
            // Check if ResetAudit table exists
            const checkTable = await prisma.$queryRawUnsafe(`
              SELECT table_name FROM information_schema.tables 
              WHERE table_schema = 'public' AND table_name = 'ResetAudit';
            `);
            const tableExists = Array.isArray(checkTable) && checkTable.length > 0;

            if (tableExists) {
              console.log(`[migrate-deploy] Verified: "ResetAudit" table exists in database. Safely resolving migration as applied.`);
              execSync(`npx prisma migrate resolve --applied 20261007180000_add_reset_audit_and_system_settings`, { stdio: "inherit", env });
            } else {
              console.log(`[migrate-deploy] "ResetAudit" table does NOT exist. Safely resolving migration as rolled-back.`);
              execSync(`npx prisma migrate resolve --rolled-back 20261007180000_add_reset_audit_and_system_settings`, { stdio: "inherit", env });
            }
          } else {
            console.log(`[migrate-deploy] Unhandled failed migration "${migName}". Recorded logs:`, fm.logs);
          }
        }

        await prisma.$disconnect();

        // Re-attempt migration deployment after resolution
        console.log("[migrate-deploy] Re-running `npx prisma migrate deploy` after safe resolution...");
        execSync("npx prisma migrate deploy", { stdio: "inherit", env });
        console.log("[migrate-deploy] Migrations successfully deployed following P3009 resolution.");
      } catch (recoveryErr) {
        console.error("[migrate-deploy] Recovery check encountered an error:", recoveryErr?.message || recoveryErr);
      }
    }
  }
}

runMigrate().catch((e) => {
  console.warn("[migrate-deploy] Unexpected top-level error:", e?.message || e);
});
