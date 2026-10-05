"use server";

import { prisma } from "@/lib/prisma";
import { requireCustomerSession, getCurrentCustomer } from "@/lib/auth";
import { initializePayment, verifyPayment } from "@/lib/paystack";
import { processPaymentSuccess } from "@/lib/payment-processor";
import { CREDIT_PACKAGES, CreditPackageId } from "@/lib/credit-packages";
import { getPaymentCallbackUrl } from "@/lib/urls";

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
    const effectiveCallbackUrl = callbackUrl?.trim() || getPaymentCallbackUrl();

    const paystackData = await initializePayment({
      amount: pkg.price,
      email: customerEmail,
      reference: payment.reference,
      callback_url: effectiveCallbackUrl,
    });

    // If Paystack generated or altered the reference, update our local record
    if (paystackData?.reference && paystackData.reference !== payment.reference) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { reference: paystackData.reference },
      });
    }

    // Non-blocking audit log
    prisma.auditLog.create({
      data: {
        action: "PAYMENT_INITIALIZED",
        entityType: "Payment",
        entityId: payment.id,
        description: `Initialized ${pkg.name} credit purchase payment`,
      },
    }).catch(e => console.warn("Audit log non-blocking error:", e?.message));

    return { 
      success: true, 
      authorizationUrl: paystackData.authorization_url,
      reference: paystackData.reference || payment.reference,
    };
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
    const effectiveCallbackUrl = callbackUrl?.trim() || getPaymentCallbackUrl();

    const paystackData = await initializePayment({
      amount: outstanding,
      email: customerEmail,
      reference: payment.reference,
      callback_url: effectiveCallbackUrl,
    });

    // If Paystack generated or altered the reference, update our local record
    if (paystackData?.reference && paystackData.reference !== payment.reference) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { reference: paystackData.reference },
      });
    }

    // Non-blocking audit log
    prisma.auditLog.create({
      data: {
        action: "PAYMENT_INITIALIZED",
        entityType: "Payment",
        entityId: payment.id,
        description: `Initialized shipping fee payment for ${shipment.trackingNumber}`,
      },
    }).catch(e => console.warn("Audit log non-blocking error:", e?.message));

    return { 
      success: true, 
      authorizationUrl: paystackData.authorization_url,
      reference: paystackData.reference || payment.reference,
    };

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
  try {
    const cleanRef = decodeURIComponent(reference?.trim() || "");
    if (!cleanRef) {
      return { error: "No payment reference provided." };
    }

    const customer = await getCurrentCustomer();
    if (!customer) {
      return { 
        unauthorized: true, 
        error: "Please log in to your account to confirm and view your payment." 
      };
    }

    // Find the payment record by internal reference or provider transaction ID
    let payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { reference: cleanRef },
          { providerTransactionId: cleanRef },
        ],
      },
      include: {
        shipment: { select: { id: true, trackingNumber: true, description: true } },
      },
    });

    // If not found locally, check with Paystack in case Paystack returned its own reference
    if (!payment) {
      try {
        const paystackData = await verifyPayment(cleanRef);
        if (paystackData?.reference) {
          payment = await prisma.payment.findUnique({
            where: { reference: paystackData.reference },
            include: {
              shipment: { select: { id: true, trackingNumber: true, description: true } },
            },
          });
        }
      } catch (lookupErr) {
        console.warn("Paystack remote lookup error for ref:", cleanRef, lookupErr);
      }
    }

    if (!payment) {
      return { error: `Payment record not found. Please contact support with reference: ${cleanRef}` };
    }

    // IDOR protection: Verify payment belongs to current authenticated customer
    if (payment.customerId !== customer.id) {
      return { error: "Unauthorized: This payment does not belong to your account." };
    }

    // If already verified and marked SUCCESS (idempotent path - refresh protection)
    if (payment.status === "SUCCESS") {
      return {
        success: true,
        status: "SUCCESS",
        alreadyProcessed: true,
        payment: {
          reference: payment.reference,
          amount: payment.amount,
          currency: payment.currency,
          type: payment.type,
          shipmentTrackingNumber: payment.shipment?.trackingNumber || null,
        },
      };
    }

    // Process payment atomically via processPaymentSuccess
    const result = await processPaymentSuccess(payment.reference);
    if (result.success) {
      const updated = await prisma.payment.findUnique({
        where: { id: payment.id },
        include: {
          shipment: { select: { id: true, trackingNumber: true, description: true } },
        },
      });
      return {
        success: true,
        status: "SUCCESS",
        payment: {
          reference: updated?.reference || payment.reference,
          amount: updated?.amount || payment.amount,
          currency: updated?.currency || payment.currency,
          type: updated?.type || payment.type,
          shipmentTrackingNumber: updated?.shipment?.trackingNumber || null,
        },
      };
    } else {
      const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
      return {
        success: false,
        status: updated?.status || "FAILED",
        error: result.error || "Payment verification could not be confirmed.",
      };
    }
  } catch (error: any) {
    console.error("verifyPaymentAction unexpected error:", error);
    return { error: error?.message || "An unexpected error occurred during verification." };
  }
}
