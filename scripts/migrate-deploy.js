const { execSync } = require("child_process");

function runMigrate() {
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
    console.warn("[migrate-deploy] Warning during `npx prisma migrate deploy`:", err.message);
  }
}

runMigrate();
