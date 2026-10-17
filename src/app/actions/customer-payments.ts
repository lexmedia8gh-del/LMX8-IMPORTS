"use server";

import { prisma } from "@/lib/prisma";
import { requireCustomerSession } from "@/lib/auth";

// ── Customer: list their own payments ────────────────────────────────────────

export async function getCustomerPaymentsAction() {
  const customer = await requireCustomerSession();

  const payments = await prisma.payment.findMany({
    where: { customerId: customer.id },
    include: {
      customer: { select: { id: true, name: true, customerIdentifier: true, phone: true, email: true } },
      shipment: { select: { id: true, trackingNumber: true, description: true, fee: true, originalFee: true, discountPercent: true, discountAmount: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return payments.map((p) => {
    const meta = typeof p.metadata === "object" && p.metadata !== null ? (p.metadata as any) : {};
    const methodLabel =
      meta.methodLabel ||
      (meta.paymentMethod === "CASH"
        ? "Cash"
        : meta.paymentMethod === "MTN_MOMO"
        ? "MTN Mobile Money"
        : meta.paymentMethod === "TELECEL_CASH"
        ? "Telecel Cash"
        : meta.paymentMethod === "AT_MONEY"
        ? "AT Money"
        : meta.paymentMethod === "BANK_TRANSFER"
        ? "Bank Transfer"
        : meta.paymentMethod === "OTHER"
        ? "Other Offline"
        : p.provider === "OFFLINE"
        ? "Offline Payment"
        : "Paystack Online");

    const isOffline = p.provider === "OFFLINE" || meta.source === "offline";

    return {
      id: p.id,
      reference: p.reference,
      type: p.type,
      amount: typeof p.amount === "number" ? p.amount : parseFloat(p.amount) || 0,
      currency: p.currency || "GHS",
      status: p.status,
      provider: p.provider || (isOffline ? "OFFLINE" : "PAYSTACK"),
      providerTransactionId: p.providerTransactionId || meta.receiptNumber || null,
      paymentMethod: meta.paymentMethod || (isOffline ? "OFFLINE" : "PAYSTACK"),
      paymentMethodLabel: methodLabel,
      isOffline,
      receiptNumber: meta.receiptNumber || p.providerTransactionId || null,
      payerName: meta.payerName || p.customer?.name || null,
      notes: meta.notes || null,
      receiptAttachmentUrl: meta.receiptAttachmentUrl || null,
      recordedBy: meta.recordedByAdminName || null,
      paymentDate: meta.paymentDate || p.createdAt.toISOString(),
      createdAt: p.createdAt.toISOString(),
      customer: {
        id: p.customer.customerIdentifier,
        name: p.customer.name,
        phone: p.customer.phone || null,
        email: p.customer.email || null,
      },
      shipment: p.shipment
        ? {
            id: p.shipment.id,
            trackingNumber: p.shipment.trackingNumber,
            description: p.shipment.description,
            fee: p.shipment.fee,
            originalFee: p.shipment.originalFee ?? p.shipment.fee,
            discountPercent: p.shipment.discountPercent ?? 0,
            discountAmount: p.shipment.discountAmount ?? 0,
          }
        : null,
    };
  });
}

// ── Customer: list shipments that have outstanding shipping fees ─────────────

export async function getOutstandingShipmentsAction() {
  const customer = await requireCustomerSession();

  const shipments = await prisma.shipment.findMany({
    where: {
      customerId: customer.id,
      fee: { gt: 0 },
    },
    include: {
      payments: {
        where: { type: "SHIPPING_FEE", status: "SUCCESS" },
        select: { id: true, amount: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return shipments.map((s) => {
    const paidAmount = s.payments.reduce((sum, p) => sum + p.amount, 0);
    const outstanding = Math.max(0, s.fee - paidAmount);
    const isPaid = outstanding === 0;
    return {
      id: s.id,
      trackingNumber: s.trackingNumber,
      description: s.description,
      fee: s.fee,
      originalFee: s.originalFee ?? s.fee,
      discountPercent: s.discountPercent ?? 0,
      discountAmount: s.discountAmount ?? 0,
      paidAmount,
      outstanding,
      isPaid,
      status: s.status,
    };
  });
}

export async function getShipmentForCheckoutAction(id: string) {
  const customer = await requireCustomerSession();

  const shipment = await prisma.shipment.findFirst({
    where: {
      OR: [
        { id },
        { trackingNumber: id },
        { trackingNumber: id.toUpperCase() },
      ],
    },
    include: {
      payments: {
        where: { type: "SHIPPING_FEE", status: "SUCCESS" },
      },
    },
  });

  if (!shipment || shipment.customerId !== customer.id) {
    return null;
  }

  const paidAmount = shipment.payments.reduce((sum, p) => sum + p.amount, 0);
  const outstanding = Math.max(0, shipment.fee - paidAmount);
  const isPaid = outstanding === 0;

  return {
    id: shipment.id,
    trackingNumber: shipment.trackingNumber,
    description: shipment.description,
    fee: shipment.fee,
    originalFee: shipment.originalFee ?? shipment.fee,
    discountPercent: shipment.discountPercent ?? 0,
    discountAmount: shipment.discountAmount ?? 0,
    paidAmount,
    outstanding,
    isPaid,
  };
}
