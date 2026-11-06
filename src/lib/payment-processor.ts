import { prisma } from "@/lib/prisma";
import { verifyPayment } from "@/lib/paystack";
import { Prisma } from "@prisma/client";
import { CREDIT_PACKAGES } from "@/lib/credit-packages";
import { ensureCreditAccountSchema } from "@/lib/credit-account";

export async function processPaymentSuccess(reference: string) {
  await ensureCreditAccountSchema();
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
          // Shipment fee is paid.
        }
      } else if (payment.type === "BUY_FOR_ME") {
        const metadata = (payment.metadata as any) || {};
        const requestId = payment.buyForMeRequestId || metadata.requestId;
        const quotationId = payment.buyForMeQuotationId || metadata.quotationId;

        if (quotationId) {
          await tx.buyForMeQuotation.update({
            where: { id: quotationId },
            data: {
              isPaid: true,
              paidAt: new Date(),
              paymentReference: payment.reference,
              status: "PUBLISHED",
            },
          });
        }

        if (requestId) {
          await tx.buyForMeRequest.update({
            where: { id: requestId },
            data: {
              status: "PAYMENT_CONFIRMED",
            },
          });

          await tx.buyForMeStatusHistory.create({
            data: {
              requestId,
              status: "PAYMENT_CONFIRMED",
              note: `Payment confirmed via Paystack (Ref: ${payment.reference}, Amount: GHS ${payment.amount})`,
            },
          });
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

      return { 
        alreadyProcessed: false, 
        payment: updatedPayment, 
        customerId: payment.customerId, 
        paymentId: payment.id, 
        type: payment.type, 
        amount: payment.amount,
        buyForMeRequestId: payment.buyForMeRequestId || (payment.metadata as any)?.requestId
      };
    });

    // Fire notification after transaction completes
    if (!result.alreadyProcessed) {
      try {
        const { createNotificationInternal } = await import("@/app/actions/notifications");
        const isCredit = result.type === "CREDIT_PURCHASE";
        const isBuyForMe = result.type === "BUY_FOR_ME";
        await createNotificationInternal({
          customerId: result.customerId,
          type: isBuyForMe ? "BUY_FOR_ME" : "PAYMENT",
          title: isCredit
            ? "Credits Added"
            : isBuyForMe
            ? "Buy for Me Payment Confirmed"
            : "Payment Confirmed",
          message: isCredit
            ? `Your payment of GHS ${result.amount?.toFixed(2)} was successful. Credits have been added to your account.`
            : isBuyForMe
            ? `Your Buy for Me payment of GHS ${result.amount?.toFixed(2)} has been confirmed! Our team will now proceed with purchasing your items.`
            : `Your shipping fee payment of GHS ${result.amount?.toFixed(2)} was confirmed.`,
          actionUrl: isBuyForMe && result.buyForMeRequestId
            ? `/portal/buy-for-me/${result.buyForMeRequestId}`
            : "/portal/payments",
          idempotencyKey: `payment-success-${result.paymentId}`,
          paymentId: result.paymentId,
          buyForMeRequestId: result.buyForMeRequestId,
        });
      } catch (notifErr) {
        console.error("Payment notification failed:", notifErr);
      }

      try {
        const { 
          sendCreditPurchaseSuccessEmail, 
          sendShippingFeePaidSuccessEmail,
          sendBuyForMePaymentConfirmedEmail
        } = await import("@/lib/email/brevo");

        if (result.type === "CREDIT_PURCHASE") {
          sendCreditPurchaseSuccessEmail(result.paymentId).catch((err) =>
            console.error("[Brevo] Error dispatching credit purchase email:", err)
          );
        } else if (result.type === "SHIPPING_FEE") {
          sendShippingFeePaidSuccessEmail(result.paymentId).catch((err) =>
            console.error("[Brevo] Error dispatching shipping fee email:", err)
          );
        } else if (result.type === "BUY_FOR_ME") {
          sendBuyForMePaymentConfirmedEmail(result.paymentId).catch((err) =>
            console.error("[Brevo] Error dispatching Buy for Me payment email:", err)
          );
        }
      } catch (emailErr) {
        console.error("[Brevo] Error dispatching payment success emails:", emailErr);
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
