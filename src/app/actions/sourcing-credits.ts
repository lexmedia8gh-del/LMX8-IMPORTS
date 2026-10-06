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
      //    We select and lock the CreditAccount row FOR UPDATE.
      const accounts = await tx.$queryRaw<any[]>`
        SELECT id, balance, "creditsUsed", "creditsRemaining" FROM "CreditAccount"
        WHERE "customerId" = ${customer.id}
        FOR UPDATE
      `;

      if (accounts.length === 0 || accounts[0].balance < creditCost) {
        throw new Error("INSUFFICIENT_CREDITS");
      }

      const account = accounts[0];
      const balanceBefore = account.balance;
      const balanceAfter = balanceBefore - creditCost;
      const newCreditsUsed = (account.creditsUsed || 0) + creditCost;
      const newCreditsRemaining = balanceAfter;

      await tx.creditAccount.update({
        where: { id: account.id },
        data: {
          balance: balanceAfter,
          creditsUsed: newCreditsUsed,
          creditsRemaining: newCreditsRemaining,
          lastActivityAt: new Date(),
        },
      });

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
    selectedPackage: account?.selectedPackage ?? "None",
    packagePrice: account?.packagePrice ?? 0.0,
    creditsPurchased: account?.creditsPurchased ?? 0,
    creditsUsed: account?.creditsUsed ?? 0,
    creditsRemaining: account?.creditsRemaining ?? (account?.balance ?? 0),
    lastActivityAt: account?.lastActivityAt ? account.lastActivityAt.toISOString() : null,
    createdAt: account?.createdAt ? account.createdAt.toISOString() : null,
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
      // Lock the row FOR UPDATE
      const accounts = await tx.$queryRaw<any[]>`
        SELECT id, balance, "creditsPurchased", "creditsUsed", "creditsRemaining" FROM "CreditAccount"
        WHERE id = ${creditAccount.id}
        FOR UPDATE
      `;

      if (accounts.length === 0) {
        throw new Error("CREDIT_ACCOUNT_NOT_FOUND");
      }

      const dbAccount = accounts[0];
      const balanceBefore = dbAccount.balance;
      const balanceAfter = balanceBefore + amount;

      if (balanceAfter < 0) {
        throw new Error("INSUFFICIENT_CREDITS");
      }

      const newCreditsPurchased = amount > 0 ? (dbAccount.creditsPurchased || 0) + amount : (dbAccount.creditsPurchased || 0);
      const newCreditsUsed = amount < 0 ? (dbAccount.creditsUsed || 0) + Math.abs(amount) : (dbAccount.creditsUsed || 0);
      const newCreditsRemaining = balanceAfter;

      await tx.creditAccount.update({
        where: { id: creditAccount.id },
        data: {
          balance: balanceAfter,
          creditsPurchased: newCreditsPurchased,
          creditsUsed: newCreditsUsed,
          creditsRemaining: newCreditsRemaining,
          lastActivityAt: new Date(),
        },
      });

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

export async function getCustomerRecentActivitiesAction() {
  const customer = await requireCustomerSession();

  // 1. Fetch Credit Transactions
  const creditTx = await prisma.creditTransaction.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // 2. Fetch Shipments and their tracking events
  const shipments = await prisma.shipment.findMany({
    where: { customerId: customer.id },
    include: { trackingEvents: { orderBy: { timestamp: "desc" } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // 3. Fetch Payments
  const payments = await prisma.payment.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // 4. Fetch Customer record to get creation date
  const customerRecord = await prisma.customer.findUnique({
    where: { id: customer.id },
  });

  // Combine into unified activity feed
  type ActivityItem = {
    id: string;
    type: "ACCOUNT_CREATED" | "PACKAGE_PURCHASED" | "CREDITS_ADDED" | "CREDITS_USED" | "SHIPMENT_CREATED" | "SHIPMENT_UPDATED" | "SHIPMENT_DELIVERED" | "PAYMENT_SUCCESSFUL" | "PAYMENT_FAILED";
    title: string;
    description: string;
    timestamp: Date;
    icon: string;
  };

  const activities: ActivityItem[] = [];

  // Account Created
  if (customerRecord) {
    activities.push({
      id: `acc-created-${customerRecord.id}`,
      type: "ACCOUNT_CREATED",
      title: "Account Created",
      description: "Customer account created and activated.",
      timestamp: customerRecord.createdAt,
      icon: "👤",
    });
  }

  // Credit Transactions
  for (const tx of creditTx) {
    if (tx.type === "PURCHASE") {
      activities.push({
        id: `credit-tx-${tx.id}`,
        type: "PACKAGE_PURCHASED",
        title: "Credits Added",
        description: tx.description || `${tx.amount} credits added`,
        timestamp: tx.createdAt,
        icon: "💳",
      });
    } else if (tx.type === "SOURCING_REQUEST") {
      activities.push({
        id: `credit-tx-${tx.id}`,
        type: "CREDITS_USED",
        title: "Credits Used",
        description: tx.description || `${Math.abs(tx.amount)} credits used for sourcing`,
        timestamp: tx.createdAt,
        icon: "📦",
      });
    } else {
      // Admin adjustment or other
      activities.push({
        id: `credit-tx-${tx.id}`,
        type: tx.amount > 0 ? "CREDITS_ADDED" : "CREDITS_USED",
        title: tx.amount > 0 ? "Credits Added" : "Credits Used",
        description: tx.description || `Adjusted credits by ${tx.amount}`,
        timestamp: tx.createdAt,
        icon: tx.amount > 0 ? "💳" : "📋",
      });
    }
  }

  // Shipment Created
  for (const s of shipments) {
    activities.push({
      id: `shipment-created-${s.id}`,
      type: "SHIPMENT_CREATED",
      title: "Shipment Created",
      description: `Shipment #${s.trackingNumber} — ${s.description}`,
      timestamp: s.createdAt,
      icon: "📦",
    });

    // Tracking Events as updates
    for (const e of s.trackingEvents) {
      if (e.status === "SHIPMENT_CREATED" && Math.abs(e.timestamp.getTime() - s.createdAt.getTime()) < 1000) {
        continue;
      }
      
      const isDelivered = e.status === "DELIVERED";
      activities.push({
        id: `tracking-event-${e.id}`,
        type: isDelivered ? "SHIPMENT_DELIVERED" : "SHIPMENT_UPDATED",
        title: isDelivered ? "Shipment Delivered" : "Shipment Updated",
        description: `Shipment #${s.trackingNumber} — ${e.note || e.status.replace(/_/g, " ")}`,
        timestamp: e.timestamp,
        icon: isDelivered ? "✅" : "📦",
      });
    }
  }

  // Payments
  for (const p of payments) {
    if (p.status === "SUCCESS") {
      activities.push({
        id: `payment-success-${p.id}`,
        type: "PAYMENT_SUCCESSFUL",
        title: "Payment Successful",
        description: `${p.type === "CREDIT_PURCHASE" ? "Credit Purchase" : "Shipping Fee"} — GH₵${p.amount} paid`,
        timestamp: p.createdAt,
        icon: "💰",
      });
    } else if (p.status === "FAILED") {
      activities.push({
        id: `payment-fail-${p.id}`,
        type: "PAYMENT_FAILED",
        title: "Payment Failed",
        description: `Failed payment reference ${p.reference} of GH₵${p.amount}`,
        timestamp: p.createdAt,
        icon: "⚠️",
      });
    }
  }

  return activities
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 8)
    .map(a => ({
      id: a.id,
      type: a.type,
      title: a.title,
      description: a.description,
      timestamp: a.timestamp.toISOString(),
      icon: a.icon,
    }));
}
