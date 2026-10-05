"use server";

import { prisma } from "@/lib/prisma";
import { requireCustomerSession, requireAdminSession } from "@/lib/auth";

// ── SOURCING ─────────────────────────────────────────────────────────────────

export async function getCustomerSourcingRequestsAction() {
  const customer = await requireCustomerSession();

  const requests = await prisma.sourcingRequest.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
  });

  return requests.map((r) => ({
    id: r.id,
    requestNumber: r.requestNumber,
    productDetails: r.productDetails,
    quantity: r.quantity,
    preferredSizeColor: r.preferredSizeColor,
    additionalInstructions: r.additionalInstructions,
    status: r.status,
    creditsUsed: r.creditsUsed,
    createdAt: r.createdAt.toISOString().split("T")[0],
  }));
}

export async function createSourcingRequestAction(data: {
  productDetails: string;
  quantity?: number;
  preferredSizeColor?: string;
  additionalInstructions?: string;
  idempotencyKey: string; // Required — generated client-side per logical submission
}) {
  const customer = await requireCustomerSession();

  if (!data.productDetails || data.productDetails.trim().length === 0) {
    return { error: "Product details are required." };
  }
  if (!data.idempotencyKey || data.idempotencyKey.trim().length === 0) {
    return { error: "Invalid request. Please try again." };
  }

  // Validate key format (must be a UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(data.idempotencyKey.trim())) {
    return { error: "Invalid request. Please try again." };
  }

  const idempotencyKey = data.idempotencyKey.trim();
  const productDetailsClean = data.productDetails.trim();
  const quantityClean = data.quantity || 1;
  const preferredSizeColorClean = data.preferredSizeColor?.trim();
  const additionalInstructionsClean = data.additionalInstructions?.trim();
  const creditCost = 1;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Idempotency check — look up the key first (inside the transaction)
      //    If this key was already successfully processed, return the existing result
      //    without deducting credits again.
      const existing = await tx.sourcingRequest.findUnique({
        where: { idempotencyKey },
      });

      if (existing) {
        // Same key already committed — return idempotent success
        return { requestNumber: existing.requestNumber, alreadyProcessed: true };
      }

      // 2. Atomic credit deduction with DB-level concurrency lock:
      //    UPDATE only if balance >= cost, return nothing if insufficient.
      const updatedAccounts = await tx.$queryRaw<any[]>`
        UPDATE "CreditAccount"
        SET balance = balance - ${creditCost}, "updatedAt" = NOW()
        WHERE "customerId" = ${customer.id} AND balance >= ${creditCost}
        RETURNING id, balance;
      `;

      if (!updatedAccounts || updatedAccounts.length === 0) {
        throw new Error("INSUFFICIENT_CREDITS");
      }

      const balanceAfter = updatedAccounts[0].balance;
      const balanceBefore = balanceAfter + creditCost;

      // 3. Generate request number
      const requestNumber = `SRC-${Math.floor(Math.random() * 900000) + 100000}`;

      // 4. Create SourcingRequest — storing idempotencyKey guarantees uniqueness
      //    at the DB level. If two concurrent requests with the same key slip through
      //    step 1, the unique index on idempotencyKey will reject the second INSERT,
      //    triggering a transaction rollback and refunding the credit deduction.
      const request = await tx.sourcingRequest.create({
        data: {
          requestNumber,
          productDetails: productDetailsClean,
          quantity: quantityClean,
          preferredSizeColor: preferredSizeColorClean,
          additionalInstructions: additionalInstructionsClean,
          creditsUsed: creditCost,
          customerId: customer.id,
          idempotencyKey,
        },
      });

      // 5. Create ledger entry (amount negative = debit)
      await tx.creditTransaction.create({
        data: {
          type: "SOURCING_REQUEST",
          amount: -creditCost,
          balanceBefore,
          balanceAfter,
          description: `Sourcing request (${requestNumber}): ${productDetailsClean.slice(0, 50)}`,
          reference: request.id,
          customerId: customer.id,
        },
      });

      return { requestNumber, alreadyProcessed: false };
    });

    return { success: true, requestNumber: result.requestNumber };

  } catch (err: any) {
    // Unique constraint violation on idempotencyKey — concurrent duplicate that
    // slipped past the initial findUnique check. Safe to treat as "already processed".
    if (err?.code === "P2002" && err?.meta?.target?.includes?.("idempotencyKey")) {
      const existing = await prisma.sourcingRequest.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return { success: true, requestNumber: existing.requestNumber };
      }
      return { error: "This request has already been processed." };
    }
    if (err.message === "INSUFFICIENT_CREDITS") {
      return { error: "Insufficient credits." };
    }
    console.error("[Sourcing Action Error]", err);
    return { error: "An unexpected error occurred while processing your request." };
  }
}

// ── ADMIN SOURCING ────────────────────────────────────────────────────────────

export async function getAllSourcingRequestsAction() {
  await requireAdminSession();

  const requests = await prisma.sourcingRequest.findMany({
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  });

  return requests.map((r) => ({
    id: r.id,
    requestNumber: r.requestNumber,
    productDetails: r.productDetails,
    quantity: r.quantity,
    status: r.status,
    customerId: r.customer.customerIdentifier,
    customerName: r.customer.name,
    creditsUsed: r.creditsUsed,
    createdAt: r.createdAt.toISOString().split("T")[0],
  }));
}

// ── CREDITS ───────────────────────────────────────────────────────────────────

export async function getCustomerCreditAccountAction() {
  const customer = await requireCustomerSession();

  const account = await prisma.creditAccount.findUnique({
    where: { customerId: customer.id },
  });

  const transactions = await prisma.creditTransaction.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return {
    balance: account?.balance ?? 0,
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      balanceBefore: t.balanceBefore,
      balanceAfter: t.balanceAfter,
      description: t.description,
      createdAt: t.createdAt.toISOString().split("T")[0],
    })),
  };
}
export async function adjustCustomerCreditsAction(customerId: string, amount: number, reason: string) {
  const admin = await requireAdminSession();

  if (!amount || amount === 0) {
    return { error: "Adjustment amount cannot be zero." };
  }
  if (!reason || reason.trim().length === 0) {
    return { error: "Adjustment reason is required." };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Find the account or create it if it doesn't exist
      let creditAccount = await tx.creditAccount.findUnique({
        where: { customerId },
      });

      if (!creditAccount) {
        creditAccount = await tx.creditAccount.create({
          data: { customerId, balance: 0 },
        });
      }

      // 1. Atomic adjustment
      let queryResult;
      if (amount > 0) {
        queryResult = await tx.$queryRaw<any[]>`
          UPDATE "CreditAccount"
          SET balance = balance + ${amount}, "updatedAt" = NOW()
          WHERE id = ${creditAccount.id}
          RETURNING id, balance;
        `;
      } else {
        // Negative amount: ensure we don't drop below 0
        const absAmount = Math.abs(amount);
        queryResult = await tx.$queryRaw<any[]>`
          UPDATE "CreditAccount"
          SET balance = balance - ${absAmount}, "updatedAt" = NOW()
          WHERE id = ${creditAccount.id} AND balance >= ${absAmount}
          RETURNING id, balance;
        `;
        
        if (!queryResult || queryResult.length === 0) {
          throw new Error("INSUFFICIENT_CREDITS");
        }
      }

      const balanceAfter = queryResult[0].balance;
      const balanceBefore = balanceAfter - amount;

      // 2. Create Ledger Transaction
      const transaction = await tx.creditTransaction.create({
        data: {
          type: "ADMIN_ADJUSTMENT",
          amount: amount,
          balanceBefore,
          balanceAfter,
          description: reason.trim(),
          customerId,
        },
      });

      // 3. Create Audit Log
      await tx.auditLog.create({
        data: {
          action: "ADMIN_CREDIT_ADJUSTMENT",
          entityType: "Customer",
          entityId: customerId,
          description: `Adjusted credits by ${amount} (${reason.trim()})`,
          adminId: admin.id,
          metadata: {
            amount,
            balanceBefore,
            balanceAfter,
            reason: reason.trim(),
            transactionId: transaction.id,
          },
        },
      });

      return { balance: balanceAfter };
    });

    return { success: true, balance: result.balance };
  } catch (err: any) {
    if (err.message === "INSUFFICIENT_CREDITS") {
      return { error: "Customer does not have enough credits for this deduction." };
    }
    console.error("[Admin Credit Adjustment Error]", err);
    return { error: "An unexpected error occurred while adjusting credits." };
  }
}
