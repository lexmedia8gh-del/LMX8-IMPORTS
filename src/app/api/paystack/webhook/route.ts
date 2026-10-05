import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import { processPaymentSuccess } from "@/lib/payment-processor";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature") || "";

    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    // Only process charge.success events
    if (event.event === "charge.success") {
      const reference = event.data.reference;

      const result = await processPaymentSuccess(reference);
      
      if (!result.success) {
        console.error("Webhook processing failed:", result.error);
        // We still return 200 to Paystack so they don't retry unnecessarily if it's an internal error
        // Reconcile via logs/audit.
        return NextResponse.json({ status: "processing_failed" }, { status: 200 });
      }

      return NextResponse.json({ status: "success", alreadyProcessed: "alreadyProcessed" in result ? result.alreadyProcessed : false }, { status: 200 });
    }

    return NextResponse.json({ status: "ignored" }, { status: 200 });
  } catch (error: any) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: "Webhook Error" }, { status: 500 });
  }
}
