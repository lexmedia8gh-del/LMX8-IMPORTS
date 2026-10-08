import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const logs = await prisma.$queryRawUnsafe(`
      SELECT
        migration_name,
        started_at,
        finished_at,
        rolled_back_at,
        logs
      FROM "_prisma_migrations"
      WHERE "migration_name" = '20261006170000_add_email_log';
    `);
    return NextResponse.json({ logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
