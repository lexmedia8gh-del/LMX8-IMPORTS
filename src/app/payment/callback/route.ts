import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const rawRef = searchParams.get("reference") || searchParams.get("trxref") || searchParams.get("ref");
  
  const targetUrl = new URL("/payment/success", req.nextUrl.origin);
  if (rawRef) {
    targetUrl.searchParams.set("reference", rawRef.trim());
  }

  // Preserve all other searchParams if any
  searchParams.forEach((val, key) => {
    if (key !== "reference" && key !== "trxref" && key !== "ref") {
      targetUrl.searchParams.set(key, val);
    }
  });

  return NextResponse.redirect(targetUrl, 307);
}
