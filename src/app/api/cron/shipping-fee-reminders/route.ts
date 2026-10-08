import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendShippingFeeReminderEmail, ensureEmailLogSchema } from "@/lib/email/brevo";
import { getSystemSettings } from "@/lib/system-settings";

/**
 * Server-side Cron Handler for Shipping Fee Reminders (every 3 days cadence)
 * Protected by CRON_SECRET authorization header.
 */
export async function GET(request: Request) {
  return handleReminders(request);
}

export async function POST(request: Request) {
  return handleReminders(request);
}

async function handleReminders(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
  }

  try {
    await ensureEmailLogSchema();

    const settings = await getSystemSettings().catch(() => null);
    if (settings && !settings.feeReminderEnabled) {
      return NextResponse.json({
        status: "skipped",
        message: "Shipping fee reminders are currently disabled in System Settings.",
      });
    }

    // Find active shipments with shipping fees
    const shipments = await prisma.shipment.findMany({
      where: {
        fee: { gt: 0 },
        status: { not: "DELIVERED" },
      },
      include: { payments: true, customer: true },
    });

    let sentCount = 0;
    let skippedCount = 0;

    for (const s of shipments) {
      const successfulPayments = s.payments.filter((p) => p.status === "SUCCESS" && p.type === "SHIPPING_FEE");
      const paid = successfulPayments.reduce((acc, p) => acc + p.amount, 0);
      const outstanding = Math.max(0, s.fee - paid);

      // If fully paid, skip
      if (outstanding <= 0) {
        skippedCount++;
        continue;
      }

      // Respect the 3-day frequency gate
      const res = await sendShippingFeeReminderEmail({
        shipmentId: s.id,
        force: false,
      });

      if (res.success && !res.skipped) {
        sentCount++;
      } else {
        skippedCount++;
      }
    }

    return NextResponse.json({
      status: "success",
      totalShipmentsEvaluated: shipments.length,
      remindersSent: sentCount,
      remindersSkipped: skippedCount,
    });
  } catch (err: any) {
    console.error("[Cron Shipping Fee Reminders] Error:", err);
    return NextResponse.json(
      { error: "Cron execution failed", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
