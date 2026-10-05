import { NextResponse } from "next/server";
import { executeBatchFileRetentionCleanup } from "@/lib/retention";

/**
 * Server-side Cron/Job Handler for 7-Day Batch File Retention Cleanup
 * Can be invoked by Vercel Cron, Supabase pg_cron, or an external webhook trigger.
 * Protected by CRON_SECRET or admin bearer authorization.
 */
export async function GET(request: Request) {
  return handleCleanup(request);
}

export async function POST(request: Request) {
  return handleCleanup(request);
}

async function handleCleanup(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Enforce CRON_SECRET authorization
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
  }

  try {
    const result = await executeBatchFileRetentionCleanup();
    return NextResponse.json({
      status: "success",
      message: "File retention cleanup executed successfully.",
      ...result,
    });
  } catch (err: any) {
    console.error("[Cron File Retention] Execution failed:", err);
    return NextResponse.json(
      { error: "Cleanup execution failed", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
