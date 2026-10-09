import "server-only";
import { prisma } from "@/lib/prisma";

let resetAuditSchemaEnsured = false;

/**
 * Ensures the ResetAudit table exists in PostgreSQL.
 * Survives any reset operations and persists complete forensic history.
 */
export async function ensureResetAuditSchema(): Promise<boolean> {
  if (resetAuditSchemaEnsured) return true;

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "public"."ResetAudit" (
        "id" TEXT NOT NULL,
        "operationId" TEXT NOT NULL,
        "adminId" TEXT NOT NULL,
        "adminName" TEXT NOT NULL,
        "adminEmail" TEXT NOT NULL,
        "resetMode" TEXT NOT NULL,
        "selectedCategories" TEXT[] NOT NULL,
        "countsBefore" JSONB NOT NULL,
        "countsAfter" JSONB NOT NULL,
        "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "completedAt" TIMESTAMP(3),
        "status" TEXT NOT NULL,
        "pendingCleanup" JSONB,
        "errorMessage" TEXT,
        "metadata" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ResetAudit_pkey" PRIMARY KEY ("id")
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "ResetAudit_operationId_key" ON "public"."ResetAudit"("operationId");
      CREATE INDEX IF NOT EXISTS "ResetAudit_adminId_idx" ON "public"."ResetAudit"("adminId");
      CREATE INDEX IF NOT EXISTS "ResetAudit_status_idx" ON "public"."ResetAudit"("status");
      CREATE INDEX IF NOT EXISTS "ResetAudit_createdAt_idx" ON "public"."ResetAudit"("createdAt");
    `);
    resetAuditSchemaEnsured = true;
    return true;
  } catch (err: any) {
    console.warn("[ResetAudit Service] Unable to ensure ResetAudit table via raw SQL:", err?.message || err);
    return false;
  }
}

export interface ResetAuditRecord {
  id: string;
  operationId: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  resetMode: string;
  selectedCategories: string[];
  countsBefore: Record<string, number>;
  countsAfter: Record<string, number>;
  startedAt: string;
  completedAt: string | null;
  status: "SUCCESS" | "FAILED" | "IN_PROGRESS";
  pendingCleanup: string[] | null;
  errorMessage: string | null;
  metadata?: any;
}

export async function getResetAuditHistory(): Promise<ResetAuditRecord[]> {
  await ensureResetAuditSchema();

  try {
    const audits = await prisma.resetAudit.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return audits.map((a) => ({
      id: a.id,
      operationId: a.operationId,
      adminId: a.adminId,
      adminName: a.adminName,
      adminEmail: a.adminEmail,
      resetMode: a.resetMode,
      selectedCategories: Array.isArray(a.selectedCategories) ? a.selectedCategories : [],
      countsBefore: (a.countsBefore as Record<string, number>) || {},
      countsAfter: (a.countsAfter as Record<string, number>) || {},
      startedAt: a.startedAt.toISOString(),
      completedAt: a.completedAt ? a.completedAt.toISOString() : null,
      status: a.status as any,
      pendingCleanup: (a.pendingCleanup as string[]) || null,
      errorMessage: a.errorMessage,
      metadata: a.metadata,
    }));
  } catch (err) {
    console.warn("[getResetAuditHistory] Failed to retrieve reset history:", err);
    return [];
  }
}
