import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { executeBatchFileRetentionCleanup } from "@/lib/retention";

/**
 * Admin-only manual trigger for file retention cleanup.
 * Requires a valid admin session.
 */
export async function POST() {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await executeBatchFileRetentionCleanup();
    return NextResponse.json({ status: "success", ...result });
  } catch (err: any) {
    console.error("[Admin File Retention] Execution failed:", err);
    return NextResponse.json({ error: "Cleanup execution failed" }, { status: 500 });
  }
}
