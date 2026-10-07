const { execSync } = require("child_process");

function runMigrate() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.includes("localhost:5432")) {
    console.log("[migrate-deploy] No remote DATABASE_URL configured during build. Skipping build-time migration.");
    return;
  }

  // Ensure DIRECT_URL is set so prisma doesn't throw P1012 if only DATABASE_URL is in environment
  if (!process.env.DIRECT_URL) {
    process.env.DIRECT_URL = dbUrl;
  }

  try {
    console.log("[migrate-deploy] Deploying pending Prisma migrations...");
    execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
    console.log("[migrate-deploy] Prisma migrations deployed successfully.");
  } catch (err) {
    console.warn("[migrate-deploy] Warning during migration deployment:", err.message);
  }
}

runMigrate();
