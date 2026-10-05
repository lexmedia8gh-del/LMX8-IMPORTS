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

export async function setShippingFeeAction(trackingNumber: string, fee: number) {
  const admin = await requireAdminSession();

  if (fee < 0) {
    return { error: "Shipping fee cannot be negative." };
  }

  const shipment = await prisma.shipment.findUnique({
    where: { trackingNumber },
  });

  if (!shipment) {
    return { error: "Shipment not found." };
  }

  const oldFee = shipment.fee;

  const updated = await prisma.shipment.update({
    where: { id: shipment.id },
    data: { fee },
  });

  await prisma.auditLog.create({
    data: {
      action: "SHIPPING_FEE_SET",
      entityType: "Shipment",
      entityId: shipment.id,
      description: `Shipping fee for ${trackingNumber} updated from GHS ${oldFee.toFixed(2)} to GHS ${fee.toFixed(2)} by ${admin.name}`,
      adminId: admin.id,
      metadata: { trackingNumber, oldFee, newFee: fee },
    },
  });

  if (fee > 0 && fee !== oldFee) {
    try {
      const { createNotificationInternal } = await import("@/app/actions/notifications");
      await createNotificationInternal({
        customerId: shipment.customerId,
        type: "PAYMENT",
        title: "Shipping Fee Due",
        message: `A shipping fee of GHS ${fee.toFixed(2)} has been set for your shipment ${trackingNumber}.`,
        actionUrl: `/portal/payments`,
        idempotencyKey: `shipping-fee-${shipment.id}-${fee}`,
        shipmentId: shipment.id,
      });
    } catch (err) {
      console.error("Fee notification error:", err);
    }
  }

  return { success: true, fee: updated.fee };
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
