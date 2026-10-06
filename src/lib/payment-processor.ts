import { prisma } from "@/lib/prisma";
import { verifyPayment } from "@/lib/paystack";
import { Prisma } from "@prisma/client";
import { CREDIT_PACKAGES } from "@/lib/credit-packages";

export async function processPaymentSuccess(reference: string) {
  // 1. Verify with Paystack API
  let paystackData;
  try {
    paystackData = await verifyPayment(reference);
  } catch (error: any) {
    console.error(`Paystack verification failed for ${reference}:`, error);
    return { success: false, error: "Verification failed" };
  }

  if (paystackData.status !== "success") {
    // Update local payment status if it failed
    await prisma.payment.update({
      where: { reference },
      data: { status: "FAILED", providerTransactionId: String(paystackData.id) },
    });
    return { success: false, error: "Payment was not successful" };
  }

  // 2. We have a valid successful payment from Paystack.
  // Now process it atomically. We must ensure we don't process it twice.
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Lock the payment row
      const payments = await tx.$queryRaw<any[]>`
        SELECT * FROM "Payment"
        WHERE reference = ${reference}
        FOR UPDATE
      `;

      if (payments.length === 0) {
        throw new Error("Payment not found");
      }

      const payment = payments[0];

      // Idempotency check: If already SUCCESS, do nothing.
      if (payment.status === "SUCCESS") {
        return { alreadyProcessed: true, payment };
      }

      // Verify amounts and currency (Paystack returns amount in kobo/pesewas)
      const expectedAmount = payment.amount;
      const actualAmount = paystackData.amount / 100;
      if (actualAmount < expectedAmount) {
        throw new Error(`Amount mismatch. Expected ${expectedAmount}, got ${actualAmount}`);
      }

      const expectedCurrency = payment.currency || "GHS";
      if (paystackData.currency !== expectedCurrency) {
        throw new Error(`Currency mismatch. Expected ${expectedCurrency}, got ${paystackData.currency}`);
      }

      // Mark payment as SUCCESS
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "SUCCESS",
          providerTransactionId: String(paystackData.id),
        },
      });

      // Process based on type
      if (payment.type === "CREDIT_PURCHASE") {
        const metadata = payment.metadata as any;
        const packageId = metadata?.packageId as keyof typeof CREDIT_PACKAGES;
        const pkg = CREDIT_PACKAGES[packageId];

        const creditsToAdd = pkg ? pkg.credits : (metadata?.credits || 0);
        const packagePrice = pkg ? pkg.price : payment.amount;
        const packageName = pkg ? pkg.name : "Custom";

        if (creditsToAdd > 0) {
          // Find or create credit account
          let creditAccount = await tx.creditAccount.findUnique({
            where: { customerId: payment.customerId },
          });

          if (!creditAccount) {
            creditAccount = await tx.creditAccount.create({
              data: { customerId: payment.customerId, balance: 0 },
            });
          }

          const balanceBefore = creditAccount.balance;
          const balanceAfter = balanceBefore + creditsToAdd;

          const newCreditsPurchased = (creditAccount.creditsPurchased || 0) + creditsToAdd;
          const newCreditsRemaining = balanceAfter;

          await tx.creditAccount.update({
            where: { id: creditAccount.id },
            data: {
              balance: balanceAfter,
              selectedPackage: packageName,
              packagePrice: parseFloat(String(packagePrice)),
              creditsPurchased: newCreditsPurchased,
              creditsRemaining: newCreditsRemaining,
              lastActivityAt: new Date(),
            },
          });

          await tx.creditTransaction.create({
            data: {
              type: "PURCHASE",
              amount: creditsToAdd,
              balanceBefore,
              balanceAfter,
              description: `Purchased ${packageName} Package (${creditsToAdd} credits) for GH₵${packagePrice}`,
              reference: payment.reference,
              customerId: payment.customerId,
              paymentId: payment.id,
            },
          });
        }
      } else if (payment.type === "SHIPPING_FEE") {
        if (payment.shipmentId) {
          // If we had an invoice model, we would update it here.
          // For now, tracking the payment as SUCCESS is sufficient since shipment fee is paid.
        }
      }

      await tx.auditLog.create({
        data: {
          action: "PAYMENT_VERIFIED",
          entityType: "Payment",
          entityId: payment.id,
          description: `Payment ${payment.reference} processed successfully`,
        },
      });

      return { alreadyProcessed: false, payment: updatedPayment, customerId: payment.customerId, paymentId: payment.id, type: payment.type, amount: payment.amount };
    });

    // Fire notification after transaction completes
    if (!result.alreadyProcessed) {
      try {
        const { createNotificationInternal } = await import("@/app/actions/notifications");
        const isCredit = result.type === "CREDIT_PURCHASE";
        await createNotificationInternal({
          customerId: result.customerId,
          type: "PAYMENT",
          title: isCredit ? "Credits Added" : "Payment Confirmed",
          message: isCredit
            ? `Your payment of GHS ${result.amount?.toFixed(2)} was successful. Credits have been added to your account.`
            : `Your shipping fee payment of GHS ${result.amount?.toFixed(2)} was confirmed.`,
          actionUrl: "/portal/payments",
          idempotencyKey: `payment-success-${result.paymentId}`,
          paymentId: result.paymentId,
        });
      } catch (notifErr) {
        console.error("Payment notification failed:", notifErr);
      }
    }

    return { success: true, ...result };
  } catch (error: any) {
    console.error(`Failed to process payment ${reference}:`, error);
    
    // Log reconciliation required
    await prisma.auditLog.create({
      data: {
        action: "PAYMENT_RECONCILIATION_REQUIRED",
        entityType: "Payment",
        entityId: reference,
        description: `Failed to process successful Paystack payment: ${error.message}`,
      },
    }).catch(console.error);

    return { success: false, error: "Internal processing error" };
  }
}
