"use server";

import { prisma } from "@/lib/prisma";
import { requireCustomerSession, requireAdminSession } from "@/lib/auth";
import { ensureBuyForMeSchema } from "@/lib/buy-for-me-schema";
import { createNotificationInternal } from "@/app/actions/notifications";
import { 
  sendBuyForMeSubmittedAdminEmail, 
  sendBuyForMeQuotationReadyEmail 
} from "@/lib/email/brevo";
import { initializePayment } from "@/lib/paystack";
import { processPaymentSuccess } from "@/lib/payment-processor";
import { getPaymentCallbackUrl } from "@/lib/urls";
import { revalidatePath } from "next/cache";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCustomerPaystackEmail(customer: { email?: string | null; customerIdentifier?: string; id: string }) {
  if (customer.email && customer.email.trim().includes("@")) {
    return customer.email.trim();
  }
  const identifier = (customer.customerIdentifier || customer.id || "customer")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
  return `${identifier}@lmx8imports.com`;
}

async function generateUniqueRequestNumber(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const num = Math.floor(100000 + Math.random() * 900000);
    const candidate = `BFM-${num}`;
    const existing = await prisma.buyForMeRequest.findUnique({
      where: { requestNumber: candidate },
    });
    if (!existing) {
      return candidate;
    }
  }
  return `BFM-${Date.now().toString().slice(-6)}`;
}

// ── Customer: Create Buy for Me Request ──────────────────────────────────────

export interface CreateBuyForMeItemInput {
  productName: string;
  description?: string;
  productUrl?: string;
  quantity: number;
  preferredSpecs?: string;
  budget?: number;
  imageUrl?: string;
}

export interface CreateBuyForMeRequestInput {
  submissionType: "IMAGE_UPLOAD" | "MANUAL_LIST" | "LINK_SUBMISSION";
  items: CreateBuyForMeItemInput[];
  additionalInstructions?: string;
  purchasingPreferences?: string;
  deliveryPreferences?: string;
  idempotencyKey?: string;
}

export async function createBuyForMeRequestAction(input: CreateBuyForMeRequestInput) {
  try {
    const customer = await requireCustomerSession();
    await ensureBuyForMeSchema();

    if (!input.items || input.items.length === 0) {
      return { error: "Please add at least one product to your request." };
    }

    for (const item of input.items) {
      if (!item.productName || item.productName.trim().length === 0) {
        return { error: "Every product must have a name." };
      }
      if (!item.quantity || item.quantity < 1) {
        return { error: "Item quantity must be at least 1." };
      }
    }

    // Check idempotency if provided
    if (input.idempotencyKey) {
      const existing = await prisma.buyForMeRequest.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { items: true },
      });
      if (existing) {
        return {
          success: true,
          id: existing.id,
          requestNumber: existing.requestNumber,
          isDuplicate: true,
        };
      }
    }

    const requestNumber = await generateUniqueRequestNumber();

    const result = await prisma.$transaction(async (tx) => {
      const createdRequest = await tx.buyForMeRequest.create({
        data: {
          requestNumber,
          customerId: customer.id,
          submissionType: input.submissionType,
          status: "SUBMITTED",
          additionalInstructions: input.additionalInstructions?.trim() || null,
          purchasingPreferences: input.purchasingPreferences?.trim() || null,
          deliveryPreferences: input.deliveryPreferences?.trim() || null,
          idempotencyKey: input.idempotencyKey || null,
          items: {
            create: input.items.map((it) => ({
              productName: it.productName.trim(),
              description: it.description?.trim() || null,
              productUrl: it.productUrl?.trim() || null,
              quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
              preferredSpecs: it.preferredSpecs?.trim() || null,
              budget: it.budget ? Number(it.budget) : null,
              imageUrl: it.imageUrl || null,
            })),
          },
          statusHistory: {
            create: {
              status: "SUBMITTED",
              note: `Request submitted by customer with ${input.items.length} item(s)`,
            },
          },
        },
        include: {
          items: true,
        },
      });

      return createdRequest;
    });

    // Create in-app admin notification
    await createNotificationInternal({
      type: "BUY_FOR_ME",
      title: "New Buy for Me Request Received",
      message: `Customer ${customer.name || customer.customerIdentifier} submitted request ${result.requestNumber} with ${result.items.length} item(s).`,
      actionUrl: `/admin/buy-for-me?id=${result.id}`,
      idempotencyKey: `bfm-submitted-admin-${result.id}`,
      buyForMeRequestId: result.id,
    });

    // Create customer confirmation notification
    await createNotificationInternal({
      customerId: customer.id,
      type: "BUY_FOR_ME",
      title: "Buy for Me Request Submitted",
      message: `Your request (${result.requestNumber}) has been submitted successfully. Our sourcing team is reviewing it.`,
      actionUrl: `/portal/buy-for-me/${result.id}`,
      idempotencyKey: `bfm-submitted-customer-${result.id}`,
      buyForMeRequestId: result.id,
    });

    // Send admin email via Brevo
    sendBuyForMeSubmittedAdminEmail(result.id).catch((err) =>
      console.warn("[Brevo] Error dispatching Buy for Me submitted email:", err?.message || err)
    );

    revalidatePath("/portal/buy-for-me");
    revalidatePath("/admin/buy-for-me");

    return {
      success: true,
      id: result.id,
      requestNumber: result.requestNumber,
    };
  } catch (error: any) {
    console.error("createBuyForMeRequestAction error:", error);
    return { error: error?.message || "Failed to submit Buy for Me request." };
  }
}

// ── Customer: List Buy for Me Requests ──────────────────────────────────────

export async function getCustomerBuyForMeRequestsAction() {
  const customer = await requireCustomerSession();
  await ensureBuyForMeSchema();

  const requests = await prisma.buyForMeRequest.findMany({
    where: { customerId: customer.id },
    include: {
      items: true,
      quotations: {
        orderBy: { version: "desc" },
        take: 1,
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return requests.map((r) => {
    const latestQuote = r.quotations[0] || null;
    return {
      id: r.id,
      requestNumber: r.requestNumber,
      submissionType: r.submissionType,
      status: r.status,
      additionalInstructions: r.additionalInstructions,
      purchasingPreferences: r.purchasingPreferences,
      deliveryPreferences: r.deliveryPreferences,
      itemCount: r.items.length,
      firstItemName: r.items[0]?.productName || "Product",
      firstItemImage: r.items[0]?.imageUrl || null,
      latestQuotation: latestQuote
        ? {
            id: latestQuote.id,
            version: latestQuote.version,
            status: latestQuote.status,
            totalProductCost: latestQuote.totalProductCost,
            shippingFee: latestQuote.shippingFee,
            sourcingFee: latestQuote.sourcingFee,
            serviceFee: latestQuote.serviceFee,
            otherCharges: latestQuote.otherCharges,
            grandTotal: latestQuote.grandTotal,
            currency: latestQuote.currency,
            isPaid: latestQuote.isPaid,
            publishedAt: latestQuote.publishedAt?.toISOString() || null,
          }
        : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  });
}

// ── Customer: Get Single Request Details ────────────────────────────────────

export async function getCustomerBuyForMeRequestByIdAction(idOrNumber: string) {
  const customer = await requireCustomerSession();
  await ensureBuyForMeSchema();

  const request = await prisma.buyForMeRequest.findFirst({
    where: {
      OR: [
        { id: idOrNumber },
        { requestNumber: idOrNumber },
      ],
    },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
      },
      quotations: {
        include: {
          lineItems: {
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { version: "desc" },
      },
      statusHistory: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!request || request.customerId !== customer.id) {
    return null;
  }

  return {
    id: request.id,
    requestNumber: request.requestNumber,
    submissionType: request.submissionType,
    status: request.status,
    additionalInstructions: request.additionalInstructions,
    purchasingPreferences: request.purchasingPreferences,
    deliveryPreferences: request.deliveryPreferences,
    adminNotes: request.adminNotes,
    items: request.items.map((it) => ({
      id: it.id,
      productName: it.productName,
      description: it.description,
      productUrl: it.productUrl,
      quantity: it.quantity,
      preferredSpecs: it.preferredSpecs,
      budget: it.budget,
      imageUrl: it.imageUrl,
      unitPrice: it.unitPrice,
      subtotal: it.subtotal,
    })),
    quotations: request.quotations.map((q) => ({
      id: q.id,
      version: q.version,
      status: q.status,
      totalProductCost: q.totalProductCost,
      shippingFee: q.shippingFee,
      sourcingFee: q.sourcingFee,
      serviceFee: q.serviceFee,
      otherCharges: q.otherCharges,
      otherChargesNotes: q.otherChargesNotes,
      grandTotal: q.grandTotal,
      currency: q.currency,
      adminNotes: q.adminNotes,
      publishedAt: q.publishedAt?.toISOString() || null,
      publishedByName: q.publishedByName,
      isPaid: q.isPaid,
      paidAt: q.paidAt?.toISOString() || null,
      paymentReference: q.paymentReference,
      lineItems: q.lineItems.map((li) => ({
        id: li.id,
        itemId: li.itemId,
        productName: li.productName,
        unitPrice: li.unitPrice,
        quantity: li.quantity,
        subtotal: li.subtotal,
        notes: li.notes,
      })),
    })),
    statusHistory: request.statusHistory.map((sh) => ({
      id: sh.id,
      status: sh.status,
      note: sh.note,
      changedByName: sh.changedByName,
      createdAt: sh.createdAt.toISOString(),
    })),
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}

// ── Admin: List All Buy for Me Requests ─────────────────────────────────────

export async function getAllBuyForMeRequestsAdminAction(filters?: {
  status?: string;
  search?: string;
}) {
  await requireAdminSession();
  await ensureBuyForMeSchema();

  const whereClause: any = {};

  if (filters?.status && filters.status !== "ALL") {
    whereClause.status = filters.status;
  }

  if (filters?.search && filters.search.trim()) {
    const s = filters.search.trim();
    whereClause.OR = [
      { requestNumber: { contains: s, mode: "insensitive" } },
      { customer: { name: { contains: s, mode: "insensitive" } } },
      { customer: { customerIdentifier: { contains: s, mode: "insensitive" } } },
      { customer: { phone: { contains: s, mode: "insensitive" } } },
      { customer: { email: { contains: s, mode: "insensitive" } } },
      { items: { some: { productName: { contains: s, mode: "insensitive" } } } },
    ];
  }

  const requests = await prisma.buyForMeRequest.findMany({
    where: whereClause,
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          customerIdentifier: true,
          phone: true,
          email: true,
        },
      },
      items: true,
      quotations: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return requests.map((r) => {
    const latestQuote = r.quotations[0] || null;
    return {
      id: r.id,
      requestNumber: r.requestNumber,
      submissionType: r.submissionType,
      status: r.status,
      additionalInstructions: r.additionalInstructions,
      customer: {
        id: r.customer.id,
        name: r.customer.name,
        customerIdentifier: r.customer.customerIdentifier,
        phone: r.customer.phone,
        email: r.customer.email,
      },
      itemCount: r.items.length,
      itemsSummary: r.items.map((i) => `${i.productName} (x${i.quantity})`).join(", "),
      firstItemImage: r.items[0]?.imageUrl || null,
      latestQuotation: latestQuote
        ? {
            id: latestQuote.id,
            version: latestQuote.version,
            status: latestQuote.status,
            grandTotal: latestQuote.grandTotal,
            isPaid: latestQuote.isPaid,
            publishedAt: latestQuote.publishedAt?.toISOString() || null,
          }
        : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  });
}

// ── Admin: Get Single Request Details ───────────────────────────────────────

export async function getBuyForMeRequestDetailsAdminAction(requestId: string) {
  await requireAdminSession();
  await ensureBuyForMeSchema();

  const request = await prisma.buyForMeRequest.findUnique({
    where: { id: requestId },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          customerIdentifier: true,
          phone: true,
          email: true,
        },
      },
      items: {
        orderBy: { createdAt: "asc" },
      },
      quotations: {
        include: {
          lineItems: {
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { version: "desc" },
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!request) return null;

  return {
    id: request.id,
    requestNumber: request.requestNumber,
    submissionType: request.submissionType,
    status: request.status,
    additionalInstructions: request.additionalInstructions,
    purchasingPreferences: request.purchasingPreferences,
    deliveryPreferences: request.deliveryPreferences,
    adminNotes: request.adminNotes,
    customer: {
      id: request.customer.id,
      name: request.customer.name,
      customerIdentifier: request.customer.customerIdentifier,
      phone: request.customer.phone,
      email: request.customer.email,
    },
    items: request.items.map((it) => ({
      id: it.id,
      productName: it.productName,
      description: it.description,
      productUrl: it.productUrl,
      quantity: it.quantity,
      preferredSpecs: it.preferredSpecs,
      budget: it.budget,
      imageUrl: it.imageUrl,
      unitPrice: it.unitPrice,
      subtotal: it.subtotal,
    })),
    quotations: request.quotations.map((q) => ({
      id: q.id,
      version: q.version,
      status: q.status,
      totalProductCost: q.totalProductCost,
      shippingFee: q.shippingFee,
      sourcingFee: q.sourcingFee,
      serviceFee: q.serviceFee,
      otherCharges: q.otherCharges,
      otherChargesNotes: q.otherChargesNotes,
      grandTotal: q.grandTotal,
      currency: q.currency,
      adminNotes: q.adminNotes,
      publishedAt: q.publishedAt?.toISOString() || null,
      publishedByName: q.publishedByName,
      isPaid: q.isPaid,
      paidAt: q.paidAt?.toISOString() || null,
      paymentReference: q.paymentReference,
      lineItems: q.lineItems.map((li) => ({
        id: li.id,
        itemId: li.itemId,
        productName: li.productName,
        unitPrice: li.unitPrice,
        quantity: li.quantity,
        subtotal: li.subtotal,
        notes: li.notes,
      })),
    })),
    statusHistory: request.statusHistory.map((sh) => ({
      id: sh.id,
      status: sh.status,
      note: sh.note,
      changedByName: sh.changedByName,
      createdAt: sh.createdAt.toISOString(),
    })),
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}

// ── Admin: Save or Publish Quotation ────────────────────────────────────────

export interface QuotationLineItemInput {
  itemId?: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
}

export interface SaveQuotationInput {
  requestId: string;
  quotationId?: string;
  lineItems: QuotationLineItemInput[];
  shippingFee?: number;
  sourcingFee?: number;
  serviceFee?: number;
  otherCharges?: number;
  otherChargesNotes?: string;
  adminNotes?: string;
  publish?: boolean;
}

export async function adminSaveOrPublishQuotationAction(input: SaveQuotationInput) {
  try {
    const admin = await requireAdminSession();
    await ensureBuyForMeSchema();

    const request = await prisma.buyForMeRequest.findUnique({
      where: { id: input.requestId },
      include: {
        customer: true,
        quotations: { orderBy: { version: "desc" } },
      },
    });

    if (!request) {
      return { error: "Buy for Me request not found." };
    }

    if (!input.lineItems || input.lineItems.length === 0) {
      return { error: "Quotation must have at least one line item." };
    }

    // Compute line item subtotals and product total
    let totalProductCost = 0;
    const computedLineItems = input.lineItems.map((li) => {
      const uPrice = Math.max(0, Number(li.unitPrice) || 0);
      const qty = Math.max(1, Math.round(Number(li.quantity) || 1));
      const sub = uPrice * qty;
      totalProductCost += sub;
      return {
        itemId: li.itemId || null,
        productName: li.productName.trim(),
        unitPrice: uPrice,
        quantity: qty,
        subtotal: sub,
        notes: li.notes?.trim() || null,
      };
    });

    const shippingFee = Math.max(0, Number(input.shippingFee) || 0);
    const sourcingFee = Math.max(0, Number(input.sourcingFee) || 0);
    const serviceFee = Math.max(0, Number(input.serviceFee) || 0);
    const otherCharges = Math.max(0, Number(input.otherCharges) || 0);
    const grandTotal = totalProductCost + shippingFee + sourcingFee + serviceFee + otherCharges;

    const willPublish = !!input.publish;
    const newStatus = willPublish ? "PUBLISHED" : "DRAFT";

    const nextVersion = (request.quotations[0]?.version || 0) + 1;

    const quotation = await prisma.$transaction(async (tx) => {
      // Create new quotation version
      const created = await tx.buyForMeQuotation.create({
        data: {
          requestId: request.id,
          version: nextVersion,
          status: newStatus,
          totalProductCost,
          shippingFee,
          sourcingFee,
          serviceFee,
          otherCharges,
          otherChargesNotes: input.otherChargesNotes?.trim() || null,
          grandTotal,
          currency: "GHS",
          adminNotes: input.adminNotes?.trim() || null,
          publishedAt: willPublish ? new Date() : null,
          publishedById: willPublish ? admin.id : null,
          publishedByName: willPublish ? admin.name : null,
          lineItems: {
            create: computedLineItems,
          },
        },
        include: {
          lineItems: true,
        },
      });

      // Update unit prices on individual items
      for (const li of computedLineItems) {
        if (li.itemId) {
          await tx.buyForMeItem.update({
            where: { id: li.itemId },
            data: {
              unitPrice: li.unitPrice,
              subtotal: li.subtotal,
            },
          }).catch(() => null);
        }
      }

      // Update request status if publishing
      if (willPublish) {
        await tx.buyForMeRequest.update({
          where: { id: request.id },
          data: {
            status: "QUOTATION_READY",
            updatedAt: new Date(),
          },
        });

        await tx.buyForMeStatusHistory.create({
          data: {
            requestId: request.id,
            status: "QUOTATION_READY",
            note: `Quotation v${nextVersion} published by ${admin.name} (Grand Total: GH₵ ${grandTotal.toFixed(2)})`,
            changedById: admin.id,
            changedByName: admin.name,
          },
        });
      }

      return created;
    });

    if (willPublish) {
      // In-app customer notification
      await createNotificationInternal({
        customerId: request.customerId,
        type: "BUY_FOR_ME",
        title: "Quotation Ready for Your Review",
        message: `A quotation of GH₵ ${grandTotal.toFixed(2)} is ready for your Buy for Me request (${request.requestNumber}).`,
        actionUrl: `/portal/buy-for-me/${request.id}`,
        idempotencyKey: `bfm-quote-ready-${quotation.id}`,
        buyForMeRequestId: request.id,
      });

      // Brevo email to customer
      sendBuyForMeQuotationReadyEmail(request.id, quotation.id).catch((err) =>
        console.warn("[Brevo] Error dispatching quotation ready email:", err?.message || err)
      );
    }

    revalidatePath("/admin/buy-for-me");
    revalidatePath("/portal/buy-for-me");

    return {
      success: true,
      quotationId: quotation.id,
      published: willPublish,
      grandTotal,
    };
  } catch (error: any) {
    console.error("adminSaveOrPublishQuotationAction error:", error);
    return { error: error?.message || "Failed to process quotation." };
  }
}

// ── Admin: Update Request Status ────────────────────────────────────────────

const VALID_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "QUOTATION_READY",
  "PAYMENT_PENDING",
  "PAYMENT_CONFIRMED",
  "PURCHASING",
  "RECEIVED_AT_WAREHOUSE",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED",
] as const;

export async function adminUpdateBuyForMeStatusAction(
  requestId: string,
  newStatus: string,
  note?: string
) {
  try {
    const admin = await requireAdminSession();
    await ensureBuyForMeSchema();

    if (!VALID_STATUSES.includes(newStatus as any)) {
      return { error: `Invalid status: ${newStatus}` };
    }

    const request = await prisma.buyForMeRequest.findUnique({
      where: { id: requestId },
      include: { customer: true },
    });

    if (!request) {
      return { error: "Buy for Me request not found." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.buyForMeRequest.update({
        where: { id: requestId },
        data: {
          status: newStatus,
          updatedAt: new Date(),
        },
      });

      await tx.buyForMeStatusHistory.create({
        data: {
          requestId,
          status: newStatus,
          note: note?.trim() || `Status updated to ${newStatus.replace(/_/g, " ")} by ${admin.name}`,
          changedById: admin.id,
          changedByName: admin.name,
        },
      });
    });

    // Notify customer about significant milestones
    const statusLabels: Record<string, string> = {
      PURCHASING: "Items being purchased",
      RECEIVED_AT_WAREHOUSE: "Items received at our warehouse",
      IN_TRANSIT: "Items in transit to Ghana",
      DELIVERED: "Items delivered successfully",
      CANCELLED: "Request cancelled",
    };

    if (statusLabels[newStatus]) {
      await createNotificationInternal({
        customerId: request.customerId,
        type: "BUY_FOR_ME",
        title: `Buy for Me Update: ${statusLabels[newStatus]}`,
        message: `Your request (${request.requestNumber}) is now ${statusLabels[newStatus]}. ${note ? `Note: ${note}` : ""}`,
        actionUrl: `/portal/buy-for-me/${request.id}`,
        idempotencyKey: `bfm-status-${request.id}-${newStatus}`,
        buyForMeRequestId: request.id,
      });
    }

    revalidatePath("/admin/buy-for-me");
    revalidatePath("/portal/buy-for-me");

    return { success: true };
  } catch (error: any) {
    console.error("adminUpdateBuyForMeStatusAction error:", error);
    return { error: error?.message || "Failed to update status." };
  }
}

// ── Customer: Initialize Paystack Payment for Quotation ──────────────────────

export async function initializeBuyForMePaymentAction(requestId: string, callbackUrl?: string) {
  try {
    const customer = await requireCustomerSession();
    await ensureBuyForMeSchema();

    const request = await prisma.buyForMeRequest.findUnique({
      where: { id: requestId },
      include: {
        quotations: {
          where: { status: "PUBLISHED" },
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });

    if (!request || request.customerId !== customer.id) {
      return { error: "Request not found or access denied." };
    }

    const quotation = request.quotations[0];
    if (!quotation) {
      return { error: "No published quotation available for this request." };
    }

    if (quotation.isPaid) {
      return { error: "This quotation has already been paid." };
    }

    if (quotation.grandTotal <= 0) {
      return { error: "Quotation total must be greater than zero." };
    }

    const reference = `BFM-PAY-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const payment = await prisma.payment.create({
      data: {
        reference,
        amount: quotation.grandTotal,
        currency: quotation.currency || "GHS",
        status: "PENDING",
        type: "BUY_FOR_ME",
        customerId: customer.id,
        buyForMeRequestId: request.id,
        buyForMeQuotationId: quotation.id,
        metadata: {
          requestId: request.id,
          requestNumber: request.requestNumber,
          quotationId: quotation.id,
          quotationVersion: quotation.version,
          grandTotal: quotation.grandTotal,
          customerIdentifier: customer.customerIdentifier,
        },
      },
    });

    const customerEmail = getCustomerPaystackEmail(customer);
    const effectiveCallbackUrl = callbackUrl?.trim() || getPaymentCallbackUrl();

    const paystackData = await initializePayment({
      amount: quotation.grandTotal,
      email: customerEmail,
      reference: payment.reference,
      callback_url: effectiveCallbackUrl,
    });

    if (paystackData?.reference && paystackData.reference !== payment.reference) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { reference: paystackData.reference },
      });
    }

    return {
      success: true,
      authorizationUrl: paystackData.authorization_url,
      reference: paystackData.reference || payment.reference,
    };
  } catch (error: any) {
    console.error("initializeBuyForMePaymentAction error:", error);
    return {
      error: error?.message || "Failed to initialize payment for Buy for Me quotation.",
    };
  }
}

// ── Customer / Admin: Verify Payment ────────────────────────────────────────

export async function verifyBuyForMePaymentAction(reference: string) {
  try {
    const cleanRef = decodeURIComponent(reference?.trim() || "");
    if (!cleanRef) {
      return { error: "No reference provided." };
    }

    const result = await processPaymentSuccess(cleanRef);
    if (!result.success) {
      return { error: result.error || "Payment verification failed." };
    }

    revalidatePath("/portal/buy-for-me");
    revalidatePath("/admin/buy-for-me");

    return {
      success: true,
      buyForMeRequestId: (result as any).buyForMeRequestId,
      amount: (result as any).amount,
    };
  } catch (error: any) {
    console.error("verifyBuyForMePaymentAction error:", error);
    return { error: error?.message || "Payment verification failed." };
  }
}
