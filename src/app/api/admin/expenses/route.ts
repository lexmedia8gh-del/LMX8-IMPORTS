import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { ensureEodAndExpenseSchema } from "@/lib/eod-schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminSession();
    await ensureEodAndExpenseSchema();

    const expenses = await prisma.expense.findMany({
      orderBy: { date: "desc" },
      take: 100,
    });

    return NextResponse.json({ expenses });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unauthorized" }, { status: 401 });
  }
}
