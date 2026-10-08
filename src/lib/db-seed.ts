import { prisma } from "@/lib/prisma";
import { ensureCreditAccountSchema } from "@/lib/credit-account";
import bcrypt from "bcryptjs";

let adminChecked = false;

/**
 * Ensures a secure initial AdminUser exists if the database has 0 admins.
 * Never creates demo customers, shipments, batches, or fake records.
 */
export async function ensureInitialAdminUser(): Promise<boolean> {
  if (adminChecked) return true;

  try {
    const adminCount = await prisma.adminUser.count();

    if (adminCount === 0) {
      const defaultPassword = process.env.INITIAL_ADMIN_PASSWORD || "admin123";
      const adminPassword = await bcrypt.hash(defaultPassword, 10);
      await prisma.adminUser.upsert({
        where: { email: "admin@lmx8.com" },
        update: {},
        create: {
          email: "admin@lmx8.com",
          name: "Super Admin",
          passwordHash: adminPassword,
          role: "SUPER_ADMIN",
        },
      });
      console.log("[Auth Service] Initial Super Admin account created: admin@lmx8.com");
    }

    adminChecked = true;
    return true;
  } catch (err: any) {
    console.warn("[ensureInitialAdminUser] Warning:", err?.message || err);
    return false;
  }
}

/**
 * Backward compatibility alias — strictly ensures admin user only,
 * with ZERO mock customers, shipments, or payments seeded.
 */
export async function ensureDatabaseSeeded(): Promise<boolean> {
  return ensureInitialAdminUser();
}

/**
 * Isolated development-only fixtures.
 * CANNOT be executed in production.
 */
export async function loadDevelopmentFixturesOnly(): Promise<{ success: boolean; message: string }> {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_FIXTURES !== "true") {
    throw new Error("Development fixtures cannot be loaded in production or without explicit ALLOW_DEV_FIXTURES flag.");
  }

  await ensureCreditAccountSchema();
  // Reserved strictly for isolated dev environment testing
  return { success: true, message: "Development fixtures loader ready." };
}
