import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const allMigrations = await prisma.$queryRawUnsafe(`
      SELECT
        migration_name,
        started_at,
        finished_at,
        rolled_back_at,
        applied_steps_count,
        logs
      FROM "_prisma_migrations"
      ORDER BY started_at DESC;
    `).catch((err: any) => ({ error: err?.message || String(err) }));

    const failedMigrations = Array.isArray(allMigrations)
      ? allMigrations.filter((m: any) => m.finished_at === null && m.rolled_back_at === null)
      : [];

    const tablesCheck = await prisma.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `).catch(() => []);

    const existingTables = Array.isArray(tablesCheck)
      ? tablesCheck.map((t: any) => t.table_name || t.TABLE_NAME)
      : [];

    return NextResponse.json({
      status: failedMigrations.length === 0 ? "HEALTHY" : "MIGRATION_BLOCKED",
      failedCount: failedMigrations.length,
      failedMigrations,
      allMigrations: Array.isArray(allMigrations) ? allMigrations : [],
      existingTables,
      emailLogExists: existingTables.includes("EmailLog"),
      resetAuditExists: existingTables.includes("ResetAudit"),
      systemSettingsExists: existingTables.includes("SystemSettings"),
      brandSettingsExists: existingTables.includes("BrandSettings"),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
