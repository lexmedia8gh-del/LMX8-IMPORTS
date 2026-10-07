import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { initializePayment } from "@/lib/paystack";
import { getPaymentCallbackUrl, getAppBaseUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rawId = decodeURIComponent(id?.trim() || "");

  if (!rawId) {
    return NextResponse.redirect(new URL("/track", req.nextUrl.origin), 303);
  }

  try {
    // 1. Resolve shipment by ID or tracking number
    const shipment = await prisma.shipment.findFirst({
      where: {
        OR: [
          { id: rawId },
          { trackingNumber: rawId },
          { trackingNumber: rawId.toUpperCase() },
        ],
      },
      include: {
        customer: true,
        payments: true,
      },
    });

    if (!shipment) {
      console.warn(`[DirectPay] Shipment not found for identifier: ${rawId}`);
      return NextResponse.redirect(
        new URL(`/track?error=not_found&id=${encodeURIComponent(rawId)}`, req.nextUrl.origin),
        303
      );
    }

    // 2. Calculate outstanding balance
    const successfulPayments = (shipment.payments || []).filter(
      (p) => p.status === "SUCCESS" && p.type === "SHIPPING_FEE"
    );
    const amountPaid = successfulPayments.reduce((acc, p) => acc + p.amount, 0);
    const totalFee = shipment.fee || 0;
    const outstanding = Math.max(0, totalFee - amountPaid);

    // 3. If fee already fully paid or 0, redirect to public tracking page with confirmed status
    if (totalFee <= 0 || outstanding <= 0) {
      return NextResponse.redirect(
        new URL(`/track/${encodeURIComponent(shipment.trackingNumber)}?status=already_paid`, req.nextUrl.origin),
        303
      );
    }

    // 4. Generate unique payment reference and create pending payment record
    const reference = `SHP-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

    const payment = await prisma.payment.create({
      data: {
        reference,
        amount: outstanding,
        currency: "GHS",
        status: "PENDING",
        type: "SHIPPING_FEE",
        customerId: shipment.customerId,
        shipmentId: shipment.id,
        metadata: {
          trackingNumber: shipment.trackingNumber,
          customerIdentifier: shipment.customer?.customerIdentifier || null,
          directEmailCheckout: true,
        },
      },
    });

    // 5. Customer email resolution
    const customerEmail =
      shipment.customer?.email && shipment.customer.email.includes("@")
        ? shipment.customer.email.trim()
        : `${shipment.customer?.customerIdentifier || "customer"}`.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() + "@lmx8imports.com";

    const origin = req.nextUrl.origin || getAppBaseUrl();
    const callbackUrl = `${origin}/payment/verify?reference=${encodeURIComponent(payment.reference)}`;

    // 6. Initialize Paystack transaction
    const paystackData = await initializePayment({
      amount: outstanding,
      email: customerEmail,
      reference: payment.reference,
      callback_url: callbackUrl,
      metadata: {
        shipmentId: shipment.id,
        trackingNumber: shipment.trackingNumber,
        customerId: shipment.customerId,
        customerName: shipment.customer?.name,
        paymentType: "SHIPPING_FEE",
      },
    });

    if (paystackData?.authorization_url) {
      // Direct HTTP 303 redirect straight to Paystack checkout page
      return NextResponse.redirect(paystackData.authorization_url, 303);
    } else {
      throw new Error("Paystack did not return an authorization URL.");
    }
  } catch (error: any) {
    console.error(`[DirectPay] Initialization error for ${rawId}:`, error?.message || error);
    // Fallback redirect to public tracking page with error parameter (never forcing unauthenticated users to login)
    return NextResponse.redirect(
      new URL(`/track/${encodeURIComponent(rawId)}?error=${encodeURIComponent(error?.message || "checkout_failed")}`, req.nextUrl.origin),
      303
    );
  }
}
