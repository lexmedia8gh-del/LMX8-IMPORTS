"use server";

import { prisma } from "@/lib/prisma";
import { requireCustomerSession } from "@/lib/auth";
import { initializePayment } from "@/lib/paystack";
import { processPaymentSuccess } from "@/lib/payment-processor";
import { CREDIT_PACKAGES, CreditPackageId } from "@/lib/credit-packages";

function getCustomerPaystackEmail(customer: { email?: string | null; customerIdentifier?: string; id: string }) {
  if (customer.email && customer.email.trim().includes("@")) {
    return customer.email.trim();
  }
  const identifier = (customer.customerIdentifier || customer.id || "customer")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
  return `${identifier}@lmx8imports.com`;
}

export async function initializeCreditPurchaseAction(packageId: keyof typeof CREDIT_PACKAGES, callbackUrl: string) {
  const customer = await requireCustomerSession();
  
  const pkg = CREDIT_PACKAGES[packageId];
  if (!pkg) {
    return { error: "Invalid credit package selected." };
  }

  const reference = `CRD-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

  try {
    // Create pending payment record
    const payment = await prisma.payment.create({
      data: {
        reference,
        amount: pkg.price,
        currency: "GHS",
        status: "PENDING",
        type: "CREDIT_PURCHASE",
        customerId: customer.id,
        metadata: {
          packageId,
          credits: pkg.credits,
        },
      },
    });

    console.log("Paystack configuration diagnostic:", {
      PAYSTACK_SECRET_KEY_configured: !!process.env.PAYSTACK_SECRET_KEY?.trim(),
      paymentType: "CREDIT_PURCHASE",
      amount: pkg.price,
      currency: "GHS",
      reference,
      customerId: customer.id,
    });

    const customerEmail = getCustomerPaystackEmail(customer);

    const paystackData = await initializePayment({
      amount: pkg.price,
      email: customerEmail,
      reference: payment.reference,
      callback_url: callbackUrl,
    });

    // Non-blocking audit log
    prisma.auditLog.create({
      data: {
        action: "PAYMENT_INITIALIZED",
        entityType: "Payment",
        entityId: payment.id,
        description: `Initialized ${pkg.name} credit purchase payment`,
      },
    }).catch(e => console.warn("Audit log non-blocking error:", e?.message));

    return { success: true, authorizationUrl: paystackData.authorization_url };
  } catch (error: any) {
    console.error("Paystack initialization failed", {
      paymentType: "CREDIT_PURCHASE",
      amount: pkg.price,
      currency: "GHS",
      reference,
      customerId: customer.id,
      errorMessage: error?.message,
    });
    return {
      error: error?.message?.includes("network") || error?.message?.includes("fetch")
        ? "Network issue connecting to payment provider. Please try again."
        : error?.message || "Failed to initialize payment."
    };
  }
}

export async function initializeShippingPaymentAction(shipmentId: string, callbackUrl: string) {
  const customer = await requireCustomerSession();
  
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { payments: true },
  });

  if (!shipment) {
    return { error: "Shipment not found." };
  }

  if (shipment.customerId !== customer.id) {
    return { error: "Unauthorized." };
  }

  if (!shipment.fee || shipment.fee <= 0) {
    return { error: "No shipping fee has been set for this shipment." };
  }

  // Calculate outstanding amount
  const successfulPayments = shipment.payments.filter(p => p.status === "SUCCESS" && p.type === "SHIPPING_FEE");
  const paidAmount = successfulPayments.reduce((acc, p) => acc + p.amount, 0);
  const outstanding = Math.max(0, shipment.fee - paidAmount);

  if (outstanding <= 0) {
    return { error: "This shipment's fee has already been paid." };
  }

  const reference = `SHP-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

  try {
    const payment = await prisma.payment.create({
      data: {
        reference,
        amount: outstanding,
        currency: "GHS",
        status: "PENDING",
        type: "SHIPPING_FEE",
        customerId: customer.id,
        shipmentId: shipment.id,
      },
    });

    console.log("Paystack configuration diagnostic:", {
      PAYSTACK_SECRET_KEY_configured: !!process.env.PAYSTACK_SECRET_KEY?.trim(),
      paymentType: "SHIPPING_FEE",
      amount: outstanding,
      currency: "GHS",
      reference,
      customerId: customer.id,
      shipmentId: shipment.id,
    });

    const customerEmail = getCustomerPaystackEmail(customer);

    const paystackData = await initializePayment({
      amount: outstanding,
      email: customerEmail,
      reference: payment.reference,
      callback_url: callbackUrl,
    });

    // Non-blocking audit log
    prisma.auditLog.create({
      data: {
        action: "PAYMENT_INITIALIZED",
        entityType: "Payment",
        entityId: payment.id,
        description: `Initialized shipping fee payment for ${shipment.trackingNumber}`,
      },
    }).catch(e => console.warn("Audit log non-blocking error:", e?.message));

    return { success: true, authorizationUrl: paystackData.authorization_url };

  } catch (error: any) {
    console.error("Paystack initialization failed", {
      paymentType: "SHIPPING_FEE",
      amount: outstanding,
      currency: "GHS",
      reference,
      customerId: customer.id,
      shipmentId: shipment.id,
      errorMessage: error?.message,
    });
    return {
      error: error?.message?.includes("network") || error?.message?.includes("fetch")
        ? "Network issue connecting to payment provider. Please try again."
        : error?.message || "Failed to initialize payment."
    };
  }
}


export async function verifyPaymentAction(reference: string) {
  const customer = await requireCustomerSession();

  const payment = await prisma.payment.findUnique({
    where: { reference },
  });

  if (!payment) {
    return { error: "Payment not found." };
  }

  if (payment.customerId !== customer.id) {
    return { error: "Unauthorized." };
  }

  if (payment.status === "PENDING") {
    // Attempt verification
    const result = await processPaymentSuccess(reference);
    if (result.success) {
      return { success: true, status: "SUCCESS" };
    } else {
      // Could be FAILED or still PENDING if Paystack hasn't processed it yet
      const updated = await prisma.payment.findUnique({ where: { reference } });
      return { success: true, status: updated?.status || "PENDING" };
    }
  }

  return { success: true, status: payment.status };
}
