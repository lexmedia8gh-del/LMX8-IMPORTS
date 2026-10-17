"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";

import { PAYMENT_METHOD_LABELS } from "@/lib/payment-methods";

export async function getAllPaymentsAction() {
  await requireAdminSession();

  const payments = await prisma.payment.findMany({
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
      (meta.paymentMethod && PAYMENT_METHOD_LABELS[meta.paymentMethod]) ||
      (p.provider === "OFFLINE" ? "Offline Payment" : "Paystack Online");

    const isOffline = p.provider === "OFFLINE" || meta.source === "offline";

    return {
      id: p.id,
      reference: p.reference,
      type: p.type,
      amount: typeof p.amount === "number" ? p.amount : parseFloat(String(p.amount || 0)) || 0,
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
      updatedAt: p.updatedAt.toISOString(),
      customer: {
        id: p.customer.customerIdentifier,
        name: p.customer.name,
        internalId: p.customer.id,
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

// ── Admin: Get customers for payment recording ────────────────────────────────

export async function getCustomersForPaymentAction(searchQuery?: string) {
  await requireAdminSession();

  const term = (searchQuery || "").trim().toLowerCase();

  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      customerIdentifier: true,
      name: true,
      phone: true,
      email: true,
      status: true,
    },
    orderBy: { name: "asc" },
  });

  const mapped = customers.map((c) => ({
    id: c.id,
    customerIdentifier: c.customerIdentifier,
    name: c.name,
    phone: c.phone || "",
    email: c.email || "",
    status: c.status,
  }));

  if (!term) return mapped;

  return mapped.filter(
    (c) =>
      c.name.toLowerCase().includes(term) ||
      c.customerIdentifier.toLowerCase().includes(term) ||
      c.phone.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term)
  );
}

// ── Admin: Get shipments for a specific customer with fee and balance info ───

export async function getCustomerShipmentsForPaymentAction(customerLookup: string) {
  await requireAdminSession();

  const clean = customerLookup.trim();
  if (!clean) return [];

  // Find customer
  const customer = await prisma.customer.findFirst({
    where: {
      OR: [
        { id: clean },
        { customerIdentifier: clean },
        { customerIdentifier: clean.toUpperCase() },
      ],
    },
  });

  if (!customer) return [];

  const shipments = await prisma.shipment.findMany({
    where: {
      OR: [
        { customerId: customer.id },
        { customerId: customer.customerIdentifier },
      ],
    },
    include: {
      payments: {
        where: { type: "SHIPPING_FEE", status: "SUCCESS" },
        select: { id: true, amount: true, reference: true, createdAt: true, provider: true },
      },
      batch: { select: { batchNumber: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return shipments.map((s) => {
    const fee = typeof s.fee === "number" ? s.fee : parseFloat(String(s.fee || 0)) || 0;
    const originalFee = s.originalFee != null ? (typeof s.originalFee === "number" ? s.originalFee : parseFloat(String(s.originalFee || fee)) || fee) : fee;
    const discountPercent = typeof s.discountPercent === "number" ? s.discountPercent : parseFloat(String(s.discountPercent || 0)) || 0;
    const discountAmount = typeof s.discountAmount === "number" ? s.discountAmount : parseFloat(String(s.discountAmount || 0)) || 0;
    const paidAmount = s.payments.reduce((acc, p) => acc + (p.amount || 0), 0);
    const cleanPaid = Math.round(paidAmount * 100) / 100;
    const cleanFee = Math.round(fee * 100) / 100;
    const outstanding = Math.max(0, Math.round((cleanFee - cleanPaid) * 100) / 100);
    const isPaid = cleanFee > 0 ? outstanding === 0 : true;

    const paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" =
      cleanFee <= 0
        ? "PAID"
        : outstanding === 0
        ? "PAID"
        : cleanPaid > 0
        ? "PARTIALLY_PAID"
        : "UNPAID";

    return {
      id: s.id,
      trackingNumber: s.trackingNumber,
      description: s.description,
      status: s.status,
      batch: s.batch?.batchNumber || null,
      batchName: s.batch?.name || null,
      fee: cleanFee,
      originalFee,
      discountPercent,
      discountAmount,
      paidAmount: cleanPaid,
      outstanding,
      isPaid,
      paymentStatus,
    };
  });
}

// ── Admin: Record Offline Payment ────────────────────────────────────────────

export interface RecordOfflinePaymentInput {
  customerId: string;
  shipmentId?: string | null;
  amount: number;
  paymentMethod: "CASH" | "MTN_MOMO" | "TELECEL_CASH" | "AT_MONEY" | "BANK_TRANSFER" | "OTHER";
  paymentDate?: string;
  paymentType?: "SHIPPING_FEE" | "CREDIT_PURCHASE";
  receiptNumber?: string;
  payerName?: string;
  notes?: string;
  receiptAttachmentUrl?: string;
  allowOverpayment?: boolean;
  idempotencyKey?: string;
}

export async function recordOfflinePaymentAction(input: RecordOfflinePaymentInput) {
  const admin = await requireAdminSession();
  const { revalidatePath } = await import("next/cache");

  // 1. Validate customer
  const cleanCustomerId = (input.customerId || "").trim();
  if (!cleanCustomerId) {
    return { error: "Please select a customer for this payment." };
  }

  const customer = await prisma.customer.findFirst({
    where: {
      OR: [
        { id: cleanCustomerId },
        { customerIdentifier: cleanCustomerId },
        { customerIdentifier: cleanCustomerId.toUpperCase() },
      ],
    },
  });

  if (!customer) {
    return { error: "Customer not found." };
  }

  // 2. Validate amount
  const rawAmount = typeof input.amount === "number" ? input.amount : parseFloat(String(input.amount));
  if (isNaN(rawAmount) || rawAmount <= 0) {
    return { error: "Payment amount must be greater than zero." };
  }
  const cleanAmount = Math.round(rawAmount * 100) / 100;

  // 3. Validate payment method
  const cleanMethod = (input.paymentMethod || "CASH").trim().toUpperCase();
  const allowedMethods = ["CASH", "MTN_MOMO", "TELECEL_CASH", "AT_MONEY", "BANK_TRANSFER", "OTHER"];
  if (!allowedMethods.includes(cleanMethod)) {
    return { error: "Invalid payment method selected. Please choose Cash, MTN MoMo, Telecel Cash, AT Money, Bank Transfer, or Other." };
  }
  const methodLabel = PAYMENT_METHOD_LABELS[cleanMethod] || "Offline Payment";

  // 4. Validate payment date
  let paymentDateObj = new Date();
  if (input.paymentDate && input.paymentDate.trim()) {
    const parsed = new Date(input.paymentDate.trim());
    if (!isNaN(parsed.getTime())) {
      paymentDateObj = parsed;
    }
  }

  // 5. Validate shipment (if provided) and calculate balance
  let shipment: any = null;
  let remainingBefore = 0;
  let cleanFee = 0;
  let previousPaid = 0;

  if (input.shipmentId && input.shipmentId.trim()) {
    const cleanShipmentId = input.shipmentId.trim();
    shipment = await prisma.shipment.findFirst({
      where: {
        OR: [
          { id: cleanShipmentId },
          { trackingNumber: cleanShipmentId },
          { trackingNumber: cleanShipmentId.toUpperCase() },
        ],
      },
      include: {
        payments: {
          where: { type: "SHIPPING_FEE", status: "SUCCESS" },
        },
      },
    });

    if (!shipment) {
      return { error: "Specified shipment not found." };
    }

    // Security check: ensure shipment belongs to customer
    if (shipment.customerId !== customer.id && shipment.customerId !== customer.customerIdentifier) {
      return { error: `Shipment ${shipment.trackingNumber} is not registered to customer ${customer.name}.` };
    }

    cleanFee = Math.round((typeof shipment.fee === "number" ? shipment.fee : parseFloat(String(shipment.fee || 0)) || 0) * 100) / 100;
    previousPaid = Math.round(shipment.payments.reduce((acc: number, p: any) => acc + (p.amount || 0), 0) * 100) / 100;
    remainingBefore = Math.max(0, Math.round((cleanFee - previousPaid) * 100) / 100);

    // Overpayment check
    if (cleanFee > 0 && cleanAmount > remainingBefore && !input.allowOverpayment) {
      return {
        error: `Payment amount of GHS ${cleanAmount.toFixed(2)} exceeds the remaining outstanding balance of GHS ${remainingBefore.toFixed(2)}.`,
        requiresOverpaymentConfirm: true,
        remainingBalance: remainingBefore,
        cleanFee,
        previousPaid,
        amount: cleanAmount,
      };
    }
  }

  // 6. Idempotency / duplicate reference guard
  const cleanReceiptNumber = (input.receiptNumber || "").trim() || null;
  const cleanPayerName = (input.payerName || "").trim() || customer.name;
  const cleanNotes = (input.notes || "").trim() || null;
  const cleanAttachmentUrl = (input.receiptAttachmentUrl || "").trim() || null;

  if (cleanReceiptNumber) {
    const duplicate = await prisma.payment.findFirst({
      where: {
        providerTransactionId: cleanReceiptNumber,
        customerId: customer.id,
        status: "SUCCESS",
      },
    });
    if (duplicate) {
      return {
        error: `A payment with receipt/reference number "${cleanReceiptNumber}" has already been recorded for this customer.`,
      };
    }
  }

  // 7. Atomic transaction
  const reference = `LMX-OFF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const paymentType = shipment ? "SHIPPING_FEE" : (input.paymentType || "SHIPPING_FEE");

  try {
    const result = await prisma.$transaction(async (tx) => {
      const newPayment = await tx.payment.create({
        data: {
          reference,
          amount: cleanAmount,
          currency: "GHS",
          status: "SUCCESS",
          type: paymentType,
          provider: "OFFLINE",
          providerTransactionId: cleanReceiptNumber,
          customerId: customer.id,
          shipmentId: shipment ? shipment.id : null,
          metadata: {
            source: "offline",
            paymentMethod: cleanMethod,
            methodLabel,
            paymentDate: paymentDateObj.toISOString(),
            payerName: cleanPayerName,
            notes: cleanNotes,
            receiptNumber: cleanReceiptNumber,
            receiptAttachmentUrl: cleanAttachmentUrl,
            recordedByAdminId: admin.id,
            recordedByAdminName: admin.name,
            recordedAt: new Date().toISOString(),
          },
        },
      });

      // If credit purchase was recorded offline
      if (paymentType === "CREDIT_PURCHASE") {
        let creditAccount = await tx.creditAccount.findUnique({
          where: { customerId: customer.id },
        });

        if (!creditAccount) {
          creditAccount = await tx.creditAccount.create({
            data: { customerId: customer.id, balance: 0 },
          });
        }

        // Estimate or credit amount based on 1 credit per package unit or direct amount
        const creditsToAdd = Math.max(1, Math.floor(cleanAmount / 10));
        const balanceBefore = creditAccount.balance;
        const balanceAfter = balanceBefore + creditsToAdd;

        await tx.creditAccount.update({
          where: { id: creditAccount.id },
          data: {
            balance: balanceAfter,
            creditsPurchased: (creditAccount.creditsPurchased || 0) + creditsToAdd,
            creditsRemaining: balanceAfter,
            lastActivityAt: new Date(),
          },
        });

        await tx.creditTransaction.create({
          data: {
            type: "PURCHASE",
            amount: creditsToAdd,
            balanceBefore,
            balanceAfter,
            description: `Offline Payment (${methodLabel}) credited ${creditsToAdd} credits for GHS ${cleanAmount.toFixed(2)}`,
            reference: newPayment.reference,
            customerId: customer.id,
            paymentId: newPayment.id,
          },
        });
      }

      // Create Admin Audit Log
      await tx.auditLog.create({
        data: {
          action: "OFFLINE_PAYMENT_RECORDED",
          entityType: "Payment",
          entityId: newPayment.id,
          description: `Offline payment of GHS ${cleanAmount.toFixed(2)} (${methodLabel}) recorded for customer ${customer.name} (${customer.customerIdentifier})${shipment ? ` for shipment ${shipment.trackingNumber}` : ""} by admin ${admin.name}`,
          adminId: admin.id,
          metadata: {
            paymentId: newPayment.id,
            reference: newPayment.reference,
            amount: cleanAmount,
            currency: "GHS",
            paymentMethod: cleanMethod,
            methodLabel,
            receiptNumber: cleanReceiptNumber,
            payerName: cleanPayerName,
            customerId: customer.id,
            customerIdentifier: customer.customerIdentifier,
            shipmentId: shipment?.id || null,
            trackingNumber: shipment?.trackingNumber || null,
            fee: cleanFee,
            previousPaid,
            remainingBefore,
            newRemaining: Math.max(0, remainingBefore - cleanAmount),
            recordedByAdminId: admin.id,
            recordedByAdminName: admin.name,
          },
        },
      });

      return newPayment;
    });

    // 8. Calculations for return value
    const newTotalPaid = Math.round((previousPaid + cleanAmount) * 100) / 100;
    const newOutstanding = Math.max(0, Math.round((cleanFee - newTotalPaid) * 100) / 100);
    const newPaymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" =
      cleanFee <= 0
        ? "PAID"
        : newOutstanding === 0
        ? "PAID"
        : newTotalPaid > 0
        ? "PARTIALLY_PAID"
        : "UNPAID";

    // 9. Post-transaction customer notification
    try {
      const { createNotificationInternal } = await import("@/app/actions/notifications");
      await createNotificationInternal({
        customerId: customer.id,
        type: "PAYMENT",
        title: "Payment Confirmed",
        message: `An offline payment of GHS ${cleanAmount.toFixed(2)} via ${methodLabel} has been recorded for your account${shipment ? ` (Shipment: ${shipment.trackingNumber})` : ""}.`,
        actionUrl: "/portal/payments",
        idempotencyKey: `offline-payment-notif-${result.id}`,
        paymentId: result.id,
        shipmentId: shipment?.id || undefined,
      });
    } catch (notifErr) {
      console.warn("[Offline Payment] Notification dispatch notice:", notifErr);
    }

    // 10. Post-transaction Brevo email dispatch
    if (shipment && paymentType === "SHIPPING_FEE") {
      try {
        const { sendShippingFeePaidSuccessEmail } = await import("@/lib/email/brevo");
        sendShippingFeePaidSuccessEmail(result.id).catch((emailErr) => {
          console.warn("[Offline Payment] Brevo email notice:", emailErr);
        });
      } catch (err) {
        console.warn("[Offline Payment] Brevo import notice:", err);
      }
    }

    // 11. Revalidate relevant paths
    try {
      revalidatePath("/admin/payments");
      revalidatePath("/admin/shipments");
      revalidatePath("/admin/customers");
      revalidatePath("/portal/payments");
      revalidatePath("/portal/shipments");
      if (shipment) {
        revalidatePath(`/admin/shipments/${shipment.id}`);
        revalidatePath(`/admin/shipments/${shipment.trackingNumber}`);
        revalidatePath(`/portal/shipments/${shipment.id}`);
        revalidatePath(`/portal/shipments/${shipment.trackingNumber}`);
      }
    } catch (revalErr) {
      console.warn("[Offline Payment] Path revalidation notice:", revalErr);
    }

    return {
      success: true,
      message: `Successfully recorded ${methodLabel} payment of GHS ${cleanAmount.toFixed(2)} for ${customer.name}.`,
      payment: {
        id: result.id,
        reference: result.reference,
        amount: cleanAmount,
        currency: "GHS",
        status: result.status,
        provider: result.provider,
        paymentMethod: cleanMethod,
        paymentMethodLabel: methodLabel,
        receiptNumber: cleanReceiptNumber,
        payerName: cleanPayerName,
        notes: cleanNotes,
        receiptAttachmentUrl: cleanAttachmentUrl,
        recordedBy: admin.name,
        paymentDate: paymentDateObj.toISOString(),
        createdAt: result.createdAt.toISOString(),
        customer: {
          id: customer.customerIdentifier,
          internalId: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
        },
        shipment: shipment
          ? {
              id: shipment.id,
              trackingNumber: shipment.trackingNumber,
              description: shipment.description,
              fee: cleanFee,
              originalFee: shipment.originalFee ?? cleanFee,
              discountPercent: shipment.discountPercent ?? 0,
              discountAmount: shipment.discountAmount ?? 0,
            }
          : null,
      },
      newTotalPaid,
      newOutstanding,
      paymentStatus: newPaymentStatus,
    };
  } catch (error: any) {
    console.error("[recordOfflinePaymentAction] Error:", error);
    return { error: error?.message || "Failed to record offline payment due to an unexpected error." };
  }
}
