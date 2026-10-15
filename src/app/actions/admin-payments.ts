"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";

// ── Admin: read all payments ──────────────────────────────────────────────────

export async function getAllPaymentsAction() {
  await requireAdminSession();

  const payments = await prisma.payment.findMany({
    include: {
      customer: { select: { id: true, name: true, customerIdentifier: true } },
      shipment: { select: { id: true, trackingNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return payments.map((p) => ({
    id: p.id,
    reference: p.reference,
    type: p.type,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    provider: p.provider,
    providerTransactionId: p.providerTransactionId,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    customer: {
      id: p.customer.customerIdentifier,
      name: p.customer.name,
      internalId: p.customer.id,
    },
    shipment: p.shipment
      ? { id: p.shipment.id, trackingNumber: p.shipment.trackingNumber }
      : null,
  }));
}

// ── Admin: set or update shipping fee ────────────────────────────────────────

export async function setShippingFeeAction(
  trackingNumber: string,
  feeOrOriginalFee: number,
  discountPercent: number = 0
) {
  const admin = await requireAdminSession();

  if (typeof feeOrOriginalFee !== "number" || isNaN(feeOrOriginalFee) || feeOrOriginalFee < 0) {
    return { error: "Original shipping fee cannot be negative." };
  }

  const rawPercent = typeof discountPercent === "number" ? discountPercent : parseFloat(String(discountPercent)) || 0;
  if (isNaN(rawPercent) || rawPercent < 0 || rawPercent > 100) {
    return { error: "Discount percentage must be between 0% and 100%." };
  }

  const shipment = await prisma.shipment.findUnique({
    where: { trackingNumber },
    include: { payments: { where: { type: "SHIPPING_FEE", status: "SUCCESS" } } },
  });

  if (!shipment) {
    return { error: "Shipment not found." };
  }

  // Precise 2-decimal calculations to avoid floating point inaccuracies
  const cleanOriginalFee = Math.round(feeOrOriginalFee * 100) / 100;
  const cleanDiscountPercent = Math.round(rawPercent * 100) / 100;
  const discountAmount = cleanDiscountPercent > 0 
    ? Math.round(cleanOriginalFee * (cleanDiscountPercent / 100) * 100) / 100 
    : 0;
  const finalFee = Math.max(0, Math.round((cleanOriginalFee - discountAmount) * 100) / 100);

  const oldFee = shipment.fee;
  const oldOriginalFee = shipment.originalFee ?? oldFee;
  const oldDiscountPercent = shipment.discountPercent ?? 0;

  // Check existing payments
  const totalPaid = (shipment.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const remainingOutstanding = Math.max(0, finalFee - totalPaid);

  const updated = await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      fee: finalFee,
      originalFee: cleanOriginalFee,
      discountPercent: cleanDiscountPercent,
      discountAmount: discountAmount,
    },
  });

  const discountSummary = cleanDiscountPercent > 0
    ? ` (${cleanDiscountPercent}% discount applied to original fee of GHS ${cleanOriginalFee.toFixed(2)}, saved GHS ${discountAmount.toFixed(2)})`
    : cleanOriginalFee !== finalFee
    ? ` (reset discount to 0%)`
    : "";

  await prisma.auditLog.create({
    data: {
      action: "SHIPPING_FEE_SET",
      entityType: "Shipment",
      entityId: shipment.id,
      description: `Shipping fee for ${trackingNumber} updated from GHS ${oldFee.toFixed(2)} to GHS ${finalFee.toFixed(2)}${discountSummary} by ${admin.name}`,
      adminId: admin.id,
      metadata: {
        trackingNumber,
        oldFee,
        oldOriginalFee,
        oldDiscountPercent,
        newFinalFee: finalFee,
        originalFee: cleanOriginalFee,
        discountPercent: cleanDiscountPercent,
        discountAmount,
        totalPaid,
        remainingOutstanding,
      },
    },
  });

  if (finalFee > 0 && finalFee !== oldFee) {
    try {
      const { createNotificationInternal } = await import("@/app/actions/notifications");
      const notifMsg = cleanDiscountPercent > 0
        ? `A shipping fee of GHS ${finalFee.toFixed(2)} (${cleanDiscountPercent}% discount applied — you saved GHS ${discountAmount.toFixed(2)}) has been set for your shipment ${trackingNumber}.`
        : `A shipping fee of GHS ${finalFee.toFixed(2)} has been set for your shipment ${trackingNumber}.`;

      await createNotificationInternal({
        customerId: shipment.customerId,
        type: "PAYMENT",
        title: cleanDiscountPercent > 0 ? "Shipping Fee Discount Applied" : "Shipping Fee Due",
        message: notifMsg,
        actionUrl: `/portal/payments`,
        idempotencyKey: `shipping-fee-${shipment.id}-${finalFee}-${cleanDiscountPercent}`,
        shipmentId: shipment.id,
      });
    } catch (err) {
      console.error("Fee notification error:", err);
    }
  }

  return {
    success: true,
    fee: updated.fee,
    originalFee: updated.originalFee ?? updated.fee,
    discountPercent: updated.discountPercent ?? 0,
    discountAmount: updated.discountAmount ?? 0,
    outstanding: remainingOutstanding,
    isPaid: finalFee > 0 ? remainingOutstanding === 0 : true,
  };
}

// ── Admin: trigger server-side re-verification of a payment ──────────────────

export async function adminReVerifyPaymentAction(paymentId: string) {
  await requireAdminSession();

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });

  if (!payment) {
    return { error: "Payment not found." };
  }

  if (payment.status === "SUCCESS") {
    return { error: "Payment already marked as successful." };
  }

  const { processPaymentSuccess } = await import("@/lib/payment-processor");
  const result = await processPaymentSuccess(payment.reference);

  if (!result.success) {
    return { error: result.error || "Verification failed." };
  }

  await prisma.auditLog.create({
    data: {
      action: "PAYMENT_RECONCILIATION_REQUIRED",
      entityType: "Payment",
      entityId: paymentId,
      description: `Admin re-verification triggered for payment ${payment.reference}`,
    },
  });

  return { success: true };
}
