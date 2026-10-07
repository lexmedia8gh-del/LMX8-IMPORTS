import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { getBrevoDiagnostics } from "@/lib/email/config";

export async function GET() {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
  }

  const diagnostics = getBrevoDiagnostics();
  return NextResponse.json({
    success: true,
    diagnostics,
  });
}
