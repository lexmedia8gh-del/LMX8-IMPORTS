import { NextRequest, NextResponse } from "next/server";
import { GET as handlePay } from "../../[id]/route";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handlePay(req, context);
}
