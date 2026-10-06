"use server";

import { prisma } from "@/lib/prisma";
import { requireCustomerSession } from "@/lib/auth";

// ── Customer: list their own payments ────────────────────────────────────────

export async function getCustomerPaymentsAction() {
  const customer = await requireCustomerSession();

  const payments = await prisma.payment.findMany({
    where: { customerId: customer.id },
    include: {
      shipment: { select: { id: true, trackingNumber: true, description: true } },
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
    createdAt: p.createdAt.toISOString(),
    shipment: p.shipment
      ? {
          trackingNumber: p.shipment.trackingNumber,
          description: p.shipment.description,
        }
      : null,
  }));
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
    paidAmount,
    outstanding,
    isPaid,
  };
}
