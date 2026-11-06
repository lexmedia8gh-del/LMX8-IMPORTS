"use server";

import { prisma } from "@/lib/prisma";
import { requireCustomerSession, requireAdminSession } from "@/lib/auth";
import { ensureCreditAccountSchema } from "@/lib/credit-account";
import { ensureSourcingSchema } from "@/lib/sourcing-schema";
import { revalidatePath } from "next/cache";

// ── SOURCING ─────────────────────────────────────────────────────────────────

async function resolveStorageImageUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  try {
    const { generateSignedUrl, STORAGE_BUCKET } = await import("@/lib/storage");
    const signedUrl = await generateSignedUrl(path, 86400, STORAGE_BUCKET);
    return signedUrl || path;
  } catch (err) {
    console.error("[Sourcing Action] Error signing image URL:", err);
    return path;
  }
}

export async function initiateSourcingItemPhotoUploadAction(
  filename: string,
  mimeType: string,
  size: number
) {
  await requireAdminSession();

  const MAX_SIZE = 10 * 1024 * 1024;
  if (size > MAX_SIZE) {
    return { error: "Product photo files are restricted to a maximum of 10MB." };
  }

  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
  ];
  if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
    return { error: `Unsupported file format (${mimeType}). Allowed formats: JPG, JPEG, PNG, WEBP.` };
  }

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueId = crypto.randomUUID();
  const objectPath = `sourcing/items/${uniqueId}-${safeFilename}`;

  const { generateSignedUploadUrl, STORAGE_BUCKET } = await import("@/lib/storage");
  const uploadResult = await generateSignedUploadUrl(objectPath, STORAGE_BUCKET);

  if ("error" in uploadResult) {
    console.error("[Sourcing Upload Action] Signed upload URL failed:", uploadResult.error);
    return {
      error: uploadResult.error === "Storage not configured."
        ? "SUPABASE_SERVICE_ROLE_KEY is not configured in .env. Real file storage requires Supabase service role key."
        : `Upload authorization failed: ${uploadResult.error}`,
    };
  }

  return {
    success: true,
    signedUrl: uploadResult.signedUrl,
    token: uploadResult.token,
    objectPath: uploadResult.path,
  };
}

export async function getCustomerSourcingRequestsAction() {
  const customer = await requireCustomerSession();
  await ensureSourcingSchema();

  const requests = await prisma.sourcingRequest.findMany({
    where: { customerId: customer.id },
    include: {
      sourcingItems: {
        where: { isPublished: true },
        orderBy: { sortOrder: "asc" },
      },
      priceHistory: {
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return Promise.all(
    requests.map(async (r) => {
      const unitPrice = r.unitPrice ?? null;
      const qty = r.quantity || 1;
      const totalCost = r.totalCost ?? (unitPrice != null ? Math.round(unitPrice * qty * 100) / 100 : null);

      const itemsWithSignedUrls = await Promise.all(
        (r.sourcingItems || []).map(async (it) => ({
          id: it.id,
          productName: it.productName,
          description: it.description,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
          subtotal: it.subtotal,
          imageUrl: await resolveStorageImageUrl(it.imageUrl),
        }))
      );

      return {
        id: r.id,
        requestNumber: r.requestNumber,
        productDetails: r.productDetails,
        quantity: r.quantity,
        originalQuantity: r.originalQuantity ?? r.quantity,
        preferredSizeColor: r.preferredSizeColor,
        additionalInstructions: r.additionalInstructions,
        adminNotes: r.adminNotes,
        status: r.status,
        creditsUsed: r.creditsUsed,
        unitPrice,
        totalCost,
        isDraft: r.isDraft ?? true,
        publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
        priceUpdatedAt: r.priceUpdatedAt ? r.priceUpdatedAt.toISOString() : null,
        priceUpdatedBy: r.priceUpdatedBy ?? null,
        priceNotes: r.priceNotes ?? null,
        imageUrl: await resolveStorageImageUrl(r.imageUrl),
        customerConfirmationStatus: r.customerConfirmationStatus ?? "PENDING",
        createdAt: r.createdAt.toISOString().split("T")[0],
        updatedAt: r.updatedAt.toISOString(),
        sourcingItems: itemsWithSignedUrls,
        priceHistory: (r.priceHistory || []).map((ph) => ({
          id: ph.id,
          unitPrice: ph.unitPrice,
          quantity: ph.quantity,
          totalCost: ph.totalCost,
          notes: ph.notes,
          updatedByName: ph.updatedByName || "Admin",
          createdAt: ph.createdAt.toISOString(),
        })),
      };
    })
  );
}

export async function createSourcingRequestAction(data: {
  productDetails: string;
  quantity?: number;
  preferredSizeColor?: string;
  additionalInstructions?: string;
  imageUrl?: string;
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
  const imageUrlClean = data.imageUrl?.trim() || null;
  const creditCost = 1;

  await ensureCreditAccountSchema();
  await ensureSourcingSchema();

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
        return { requestNumber: existing.requestNumber, requestId: existing.id, alreadyProcessed: true };
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
          originalQuantity: quantityClean,
          preferredSizeColor: preferredSizeColorClean,
          additionalInstructions: additionalInstructionsClean,
          imageUrl: imageUrlClean,
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

      return { requestNumber, requestId: request.id, alreadyProcessed: false };
    });

    if (result && !result.alreadyProcessed && result.requestId) {
      // 1. Email customer
      import("@/lib/email/brevo").then(({ sendSourcingRequestCreatedEmail }) => {
        sendSourcingRequestCreatedEmail(result.requestId!).catch((err) =>
          console.error("[Brevo] Error sending sourcing confirmation email:", err)
        );
      });

      // 2. Notify Admin
      const { createNotificationInternal } = await import("@/app/actions/notifications");
      const { sendSourcingRequestAdminNotificationEmail } = await import("@/lib/email/brevo");
      
      const adminNotifPromise = createNotificationInternal({
        customerId: customer.id,
        type: "SOURCING_REQUEST",
        title: `New Sourcing Request: ${result.requestNumber}`,
        message: `Customer ${customer.name} (${customer.customerIdentifier}) submitted a new sourcing request: ${productDetailsClean.slice(0, 50)}`,
        actionUrl: `/admin/sourcing`,
        idempotencyKey: `admin-sourcing-notif-${result.requestId}`,
        sourcingRequestId: result.requestId!,
      });

      const adminEmailPromise = sendSourcingRequestAdminNotificationEmail(result.requestId!);
      
      Promise.all([adminNotifPromise, adminEmailPromise]).catch(err => 
        console.error("Admin notification failed:", err)
      );
    }

    return { success: true, requestNumber: result.requestNumber };

  } catch (err: any) {
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
  await ensureSourcingSchema();

  const requests = await prisma.sourcingRequest.findMany({
    include: {
      customer: true,
      sourcingItems: {
        orderBy: { sortOrder: "asc" },
      },
      priceHistory: {
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return Promise.all(
    requests.map(async (r) => {
      const unitPrice = r.unitPrice ?? null;
      const qty = r.quantity || 1;
      const totalCost = r.totalCost ?? (unitPrice != null ? Math.round(unitPrice * qty * 100) / 100 : null);

      const itemsWithSignedUrls = await Promise.all(
        (r.sourcingItems || []).map(async (it) => ({
          id: it.id,
          productName: it.productName,
          description: it.description,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
          subtotal: it.subtotal,
          imageUrl: await resolveStorageImageUrl(it.imageUrl),
          imagePath: it.imageUrl,
          isPublished: it.isPublished,
        }))
      );

      return {
        id: r.id,
        requestNumber: r.requestNumber,
        productDetails: r.productDetails,
        quantity: r.quantity,
        originalQuantity: r.originalQuantity ?? r.quantity,
        status: r.status,
        customerId: r.customer.customerIdentifier,
        customerDbId: r.customer.id,
        customerName: r.customer.name,
        customerEmail: r.customer.email,
        customerPhone: r.customer.phone,
        creditsUsed: r.creditsUsed,
        preferredSizeColor: r.preferredSizeColor,
        additionalInstructions: r.additionalInstructions,
        adminNotes: r.adminNotes,
        unitPrice,
        totalCost,
        isDraft: r.isDraft ?? true,
        publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
        priceUpdatedAt: r.priceUpdatedAt ? r.priceUpdatedAt.toISOString() : null,
        priceUpdatedBy: r.priceUpdatedBy ?? null,
        priceNotes: r.priceNotes ?? null,
        imageUrl: await resolveStorageImageUrl(r.imageUrl),
        customerConfirmationStatus: r.customerConfirmationStatus ?? "PENDING",
        createdAt: r.createdAt.toISOString().split("T")[0],
        updatedAt: r.updatedAt.toISOString(),
        sourcingItems: itemsWithSignedUrls,
        priceHistory: (r.priceHistory || []).map((ph) => ({
          id: ph.id,
          unitPrice: ph.unitPrice,
          quantity: ph.quantity,
          totalCost: ph.totalCost,
          notes: ph.notes,
          updatedByName: ph.updatedByName || "Admin",
          createdAt: ph.createdAt.toISOString(),
        })),
      };
    })
  );
}

export async function getSourcingRequestDetailsAction(requestId: string) {
  await requireAdminSession();
  await ensureSourcingSchema();

  const request = await prisma.sourcingRequest.findUnique({
    where: { id: requestId },
    include: {
      customer: true,
      sourcingItems: {
        orderBy: { sortOrder: "asc" },
      },
      priceHistory: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!request) return { error: "Sourcing request not found." };

  const unitPrice = request.unitPrice ?? null;
  const qty = request.quantity || 1;
  const totalCost = request.totalCost ?? (unitPrice != null ? Math.round(unitPrice * qty * 100) / 100 : null);

  const itemsWithSignedUrls = await Promise.all(
    (request.sourcingItems || []).map(async (it) => ({
      id: it.id,
      productName: it.productName,
      description: it.description,
      unitPrice: it.unitPrice,
      quantity: it.quantity,
      subtotal: it.subtotal,
      imageUrl: await resolveStorageImageUrl(it.imageUrl),
      imagePath: it.imageUrl,
      isPublished: it.isPublished,
    }))
  );

  return {
    success: true,
    request: {
      id: request.id,
      requestNumber: request.requestNumber,
      productDetails: request.productDetails,
      quantity: request.quantity,
      originalQuantity: request.originalQuantity ?? request.quantity,
      preferredSizeColor: request.preferredSizeColor,
      additionalInstructions: request.additionalInstructions,
      adminNotes: request.adminNotes,
      status: request.status,
      creditsUsed: request.creditsUsed,
      unitPrice,
      totalCost,
      isDraft: request.isDraft ?? true,
      publishedAt: request.publishedAt ? request.publishedAt.toISOString() : null,
      priceUpdatedAt: request.priceUpdatedAt ? request.priceUpdatedAt.toISOString() : null,
      priceUpdatedBy: request.priceUpdatedBy,
      priceNotes: request.priceNotes,
      imageUrl: await resolveStorageImageUrl(request.imageUrl),
      customerConfirmationStatus: request.customerConfirmationStatus ?? "PENDING",
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
      customer: {
        id: request.customer.id,
        name: request.customer.name,
        customerIdentifier: request.customer.customerIdentifier,
        email: request.customer.email,
        phone: request.customer.phone,
      },
      sourcingItems: itemsWithSignedUrls,
      priceHistory: request.priceHistory.map((ph) => ({
        id: ph.id,
        unitPrice: ph.unitPrice,
        quantity: ph.quantity,
        totalCost: ph.totalCost,
        notes: ph.notes,
        updatedByName: ph.updatedByName || "Admin",
        createdAt: ph.createdAt.toISOString(),
      })),
    },
  };
}

export async function adminSaveOrPublishSourcingWorkspaceAction(params: {
  requestId: string;
  adminNotes?: string;
  status?: string;
  action: "draft" | "publish";
  items: Array<{
    id?: string;
    productName: string;
    description?: string;
    unitPrice: number;
    quantity: number;
    imageUrl?: string;
  }>;
}) {
  const admin = await requireAdminSession();
  await ensureSourcingSchema();

  const { requestId, adminNotes, status, action, items } = params;
  if (!requestId) return { error: "Request ID is required." };

  const request = await prisma.sourcingRequest.findUnique({
    where: { id: requestId },
    include: { customer: true, sourcingItems: true },
  });

  if (!request) return { error: "Sourcing request not found." };

  const isPublish = action === "publish";

  // Validate and strictly convert items to numeric types
  const rawItems = Array.isArray(items) ? items : [];
  if (rawItems.length === 0) {
    return { error: "At least one product item is required." };
  }

  const validatedItems: Array<{
    id?: string;
    productName: string;
    description: string | null;
    unitPrice: number;
    quantity: number;
    subtotal: number;
    imageUrl: string | null;
    sortOrder: number;
  }> = [];

  let calculatedTotalCost = 0;

  for (let idx = 0; idx < rawItems.length; idx++) {
    const it = rawItems[idx];
    const productNameClean = String(it.productName || "").trim();
    if (!productNameClean) {
      return { error: `Product item #${idx + 1} must have a valid title.` };
    }

    // Convert unitPrice strictly to JS Number
    const rawPrice = it.unitPrice;
    const parsedUnitPrice = typeof rawPrice === "number" ? rawPrice : parseFloat(String(rawPrice));
    if (!Number.isFinite(parsedUnitPrice) || parsedUnitPrice < 0) {
      return { error: `Please enter a valid non-negative unit price for "${productNameClean}".` };
    }

    // Convert quantity strictly to JS Number
    const rawQty = it.quantity;
    const parsedQty = typeof rawQty === "number" ? rawQty : parseInt(String(rawQty), 10);
    if (!Number.isFinite(parsedQty) || parsedQty < 1) {
      return { error: `Please enter a valid quantity (at least 1) for "${productNameClean}".` };
    }

    // Calculate subtotal
    const subtotal = Math.round(parsedUnitPrice * parsedQty * 100) / 100;
    calculatedTotalCost += subtotal;

    validatedItems.push({
      id: it.id ? String(it.id).trim() : undefined,
      productName: productNameClean,
      description: it.description ? String(it.description).trim() : null,
      unitPrice: parsedUnitPrice,
      quantity: parsedQty,
      subtotal,
      imageUrl: it.imageUrl ? String(it.imageUrl).trim() : null,
      sortOrder: Number(idx),
    });
  }

  calculatedTotalCost = Math.round(calculatedTotalCost * 100) / 100;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Remove items not in list
      const incomingIds = validatedItems.map(i => i.id).filter(Boolean);
      if (incomingIds.length > 0) {
        await tx.sourcingItem.deleteMany({
          where: {
            sourcingRequestId: requestId,
            id: { notIn: incomingIds as string[] },
          },
        });
      } else {
        await tx.sourcingItem.deleteMany({
          where: { sourcingRequestId: requestId },
        });
      }

      // 2. Upsert validated items with strict numeric types
      for (const item of validatedItems) {
        if (item.id) {
          await tx.sourcingItem.update({
            where: { id: item.id },
            data: {
              productName: item.productName,
              description: item.description,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              subtotal: item.subtotal,
              imageUrl: item.imageUrl,
              isPublished: isPublish,
              sortOrder: item.sortOrder,
            },
          });
        } else {
          await tx.sourcingItem.create({
            data: {
              sourcingRequestId: requestId,
              productName: item.productName,
              description: item.description,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              subtotal: item.subtotal,
              imageUrl: item.imageUrl,
              isPublished: isPublish,
              sortOrder: item.sortOrder,
            },
          });
        }
      }

      const newStatus = status ? String(status).trim() : (isPublish && request.status === "PENDING" ? "QUOTED" : request.status);

      const firstUnitPrice = validatedItems.length > 0 ? validatedItems[0].unitPrice : (Number(request.unitPrice) || 0);
      const totalQuantity = validatedItems.length > 0 ? validatedItems.reduce((sum, i) => sum + i.quantity, 0) : (Number(request.quantity) || 1);

      const updatedReq = await tx.sourcingRequest.update({
        where: { id: requestId },
        data: {
          adminNotes: adminNotes ? String(adminNotes).trim() : null,
          status: newStatus as any,
          unitPrice: firstUnitPrice,
          quantity: totalQuantity,
          totalCost: calculatedTotalCost > 0 ? calculatedTotalCost : (Number(request.totalCost) || 0),
          isDraft: !isPublish,
          publishedAt: isPublish ? new Date() : request.publishedAt,
          customerConfirmationStatus: isPublish ? "AWAITING_CONFIRMATION" : request.customerConfirmationStatus,
          priceUpdatedAt: isPublish ? new Date() : request.priceUpdatedAt,
          priceUpdatedBy: isPublish ? admin.name : request.priceUpdatedBy,
        },
      });

      if (isPublish && calculatedTotalCost > 0) {
        await tx.sourcingPriceHistory.create({
          data: {
            sourcingRequestId: request.id,
            unitPrice: firstUnitPrice,
            quantity: totalQuantity,
            totalCost: calculatedTotalCost,
            notes: adminNotes ? String(adminNotes).trim() : "Published product quotation update",
            updatedById: admin.id,
            updatedByName: admin.name,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: isPublish ? "SOURCING_UPDATE_PUBLISHED" : "SOURCING_DRAFT_SAVED",
          entityType: "SourcingRequest",
          entityId: request.id,
          description: `${isPublish ? "Published" : "Saved draft"} sourcing update for ${request.requestNumber} by ${admin.name} (${validatedItems.length} items, Total: GH₵${calculatedTotalCost.toFixed(2)})`,
          adminId: admin.id,
        },
      });

      return updatedReq;
    });

    if (isPublish) {
      try {
        const { createNotificationInternal } = await import("@/app/actions/notifications");
        await createNotificationInternal({
          customerId: request.customerId,
          type: "SOURCING_REQUEST",
          title: `Sourcing Quotation Ready: ${request.requestNumber}`,
          message: `Our procurement team has updated and published product details & pricing for your sourcing request ${request.requestNumber} (Total: GH₵${updated.totalCost?.toFixed(2) || "0.00"}). Please review in your portal.`,
          actionUrl: `/portal/sourcing`,
          idempotencyKey: `sourcing-pub-${request.id}-${Date.now()}`,
          sourcingRequestId: request.id,
        });
      } catch (notifErr) {
        console.warn("Notice sending in-app notification:", notifErr);
      }

      try {
        const { sendSourcingPriceUpdatedEmail } = await import("@/lib/email/brevo");
        sendSourcingPriceUpdatedEmail(request.id).catch((emailErr) =>
          console.error("[Brevo] Error sending sourcing update email:", emailErr)
        );
      } catch (emailErr) {
        console.warn("Notice sending email:", emailErr);
      }
    }

    revalidatePath("/admin/sourcing");
    revalidatePath("/portal/sourcing");
    return { success: true };
  } catch (err: any) {
    console.error("[adminSaveOrPublishSourcingWorkspaceAction] Error:", err);
    return { error: err?.message || "Failed to save sourcing update." };
  }
}

export async function adminUpdateSourcingPriceAction(params: {
  requestId: string;
  unitPrice: any;
  quantity?: any;
  priceNotes?: string;
}) {
  const admin = await requireAdminSession();
  await ensureSourcingSchema();

  const { requestId, priceNotes } = params;

  if (!requestId) return { error: "Request ID is required." };

  const parsedUnitPrice = Number(params.unitPrice);
  if (!Number.isFinite(parsedUnitPrice) || parsedUnitPrice < 0) {
    return { error: "Please provide a valid non-negative unit price." };
  }

  const request = await prisma.sourcingRequest.findUnique({
    where: { id: requestId },
    include: { customer: true },
  });

  if (!request) return { error: "Sourcing request not found." };

  const originalQty = Math.max(1, Math.floor(Number(request.originalQuantity || request.quantity || 1)));
  const rawInputQty = params.quantity !== undefined && params.quantity !== null ? params.quantity : request.quantity;
  const parsedInputQty = Number(rawInputQty);
  const updatedQty = Number.isFinite(parsedInputQty) && parsedInputQty > 0 ? Math.floor(parsedInputQty) : originalQty;

  const totalCost = Math.round(parsedUnitPrice * updatedQty * 100) / 100;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Create price revision history record
      await tx.sourcingPriceHistory.create({
        data: {
          sourcingRequestId: request.id,
          unitPrice: parsedUnitPrice,
          quantity: updatedQty,
          totalCost,
          notes: priceNotes ? String(priceNotes).trim() : null,
          updatedById: admin.id,
          updatedByName: admin.name,
        },
      });

      // 2. Update request with confirmed price & status
      const updatedReq = await tx.sourcingRequest.update({
        where: { id: request.id },
        data: {
          unitPrice: parsedUnitPrice,
          quantity: updatedQty,
          originalQuantity: originalQty,
          totalCost,
          priceUpdatedAt: new Date(),
          priceUpdatedBy: admin.name,
          priceNotes: priceNotes ? String(priceNotes).trim() : null,
          status: request.status === "PENDING" ? "QUOTED" : request.status,
          customerConfirmationStatus: "AWAITING_CONFIRMATION",
        },
      });

      // 3. Record in Audit Log
      await tx.auditLog.create({
        data: {
          action: "SOURCING_PRICE_UPDATE",
          entityType: "SourcingRequest",
          entityId: request.id,
          description: `Price updated for ${request.requestNumber} by ${admin.name}: GH₵${parsedUnitPrice.toFixed(2)}/unit, Qty: ${updatedQty}, Total: GH₵${totalCost.toFixed(2)}`,
          adminId: admin.id,
          metadata: {
            requestId: request.id,
            previousUnitPrice: request.unitPrice,
            newUnitPrice: parsedUnitPrice,
            quantity: updatedQty,
            totalCost,
            priceNotes,
          },
        },
      });

      return updatedReq;
    });

    // 4. Send in-app notification to customer
    try {
      const { createNotificationInternal } = await import("@/app/actions/notifications");
      await createNotificationInternal({
        customerId: request.customerId,
        type: "SOURCING_REQUEST",
        title: `Price Quotation Ready: ${request.requestNumber}`,
        message: `Our procurement team updated the price for "${request.productDetails.slice(0, 40)}" to GH₵${parsedUnitPrice.toFixed(2)} (Total: GH₵${totalCost.toFixed(2)}). Please review and confirm in your portal.`,
        actionUrl: `/portal/sourcing`,
        idempotencyKey: `sourcing-price-update-${request.id}-${Date.now()}`,
        sourcingRequestId: request.id,
      });
    } catch (notifErr) {
      console.warn("Notice sending in-app notification for price update:", notifErr);
    }

    // 5. Send Brevo email alert to customer
    try {
      const { sendSourcingPriceUpdatedEmail } = await import("@/lib/email/brevo");
      sendSourcingPriceUpdatedEmail(request.id).catch((emailErr) =>
        console.error("[Brevo] Error dispatching sourcing price update email:", emailErr)
      );
    } catch (emailErr) {
      console.warn("Notice dispatching email for price update:", emailErr);
    }

    revalidatePath("/admin/sourcing");
    revalidatePath("/portal/sourcing");

    return { success: true, request: updated };
  } catch (err: any) {
    console.error("[adminUpdateSourcingPriceAction] Error:", err);
    return { error: err?.message || "Failed to update sourcing item price." };
  }
}

export async function customerRespondToSourcingPriceAction(params: {
  requestId: string;
  action: "CONFIRM" | "DECLINE";
  note?: string;
}) {
  const customer = await requireCustomerSession();
  await ensureSourcingSchema();

  const { requestId, action, note } = params;
  if (!requestId) return { error: "Request ID is required." };

  const request = await prisma.sourcingRequest.findUnique({
    where: { id: requestId },
  });

  if (!request || request.customerId !== customer.id) {
    return { error: "Sourcing request not found." };
  }

  const isConfirm = action === "CONFIRM";
  const newConfirmationStatus = isConfirm ? "CONFIRMED" : "DECLINED";
  const newStatus = isConfirm ? "APPROVED" : "REJECTED";

  try {
    const updated = await prisma.sourcingRequest.update({
      where: { id: requestId },
      data: {
        customerConfirmationStatus: newConfirmationStatus,
        status: newStatus,
        adminNotes: note?.trim() ? `${request.adminNotes ? request.adminNotes + "\n" : ""}Customer ${isConfirm ? "confirmed" : "declined"}: ${note.trim()}` : request.adminNotes,
      },
    });

    // Notify admin
    try {
      const { createNotificationInternal } = await import("@/app/actions/notifications");
      await createNotificationInternal({
        customerId: customer.id,
        type: "SOURCING_REQUEST",
        title: `Customer ${isConfirm ? "Confirmed" : "Declined"} Quotation: ${request.requestNumber}`,
        message: `Customer ${customer.name} has ${isConfirm ? "approved" : "declined"} the price quotation of GH₵${(request.totalCost || 0).toFixed(2)} for ${request.requestNumber}.${note ? ` Note: "${note}"` : ""}`,
        actionUrl: `/admin/sourcing`,
        idempotencyKey: `customer-price-resp-${request.id}-${Date.now()}`,
        sourcingRequestId: request.id,
      });
    } catch (e) {
      console.warn("Notice sending notification on price response:", e);
    }

    revalidatePath("/portal/sourcing");
    revalidatePath("/admin/sourcing");

    return { success: true, request: updated };
  } catch (err: any) {
    console.error("[customerRespondToSourcingPriceAction] Error:", err);
    return { error: err?.message || "Failed to submit response." };
  }
}

export async function updateSourcingRequestStatusAction(params: {
  requestId: string;
  status: "PENDING" | "QUOTED" | "APPROVED" | "REJECTED" | "PURCHASED" | "SHIPPED";
  adminNotes?: string;
}) {
  const admin = await requireAdminSession();
  const { requestId, status, adminNotes } = params;

  if (!requestId) return { error: "Request ID is required." };

  const request = await prisma.sourcingRequest.findUnique({
    where: { id: requestId },
    include: { customer: true },
  });

  if (!request) return { error: "Sourcing request not found." };

  const updated = await prisma.sourcingRequest.update({
    where: { id: requestId },
    data: {
      status,
      adminNotes: adminNotes ?? request.adminNotes,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "SOURCING_STATUS_UPDATE",
      entityType: "SourcingRequest",
      entityId: request.id,
      description: `Sourcing request ${request.requestNumber} status changed to ${status} by ${admin.name}`,
      adminId: admin.id,
      metadata: { requestId, oldStatus: request.status, newStatus: status, adminNotes },
    },
  });

  try {
    const { createNotificationInternal } = await import("@/app/actions/notifications");
    await createNotificationInternal({
      customerId: request.customerId,
      type: "SYSTEM",
      title: `Sourcing Request Update: ${request.requestNumber}`,
      message: `Your sourcing request for "${request.productDetails.slice(0, 40)}" has been updated to ${status}.`,
      actionUrl: `/portal/sourcing`,
      idempotencyKey: `sourcing-notif-${request.id}-${status}`,
    });
  } catch (err) {
    console.error("Sourcing notification error:", err);
  }

  return { success: true, request: updated };
}

// ── CREDITS ───────────────────────────────────────────────────────────────────

export async function getCustomerCreditAccountAction() {
  const customer = await requireCustomerSession();
  await ensureCreditAccountSchema();

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

  await ensureCreditAccountSchema();

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

// ── Admin: Credit overview & adjustments ─────────────────────────────────────

export async function getAdminCreditsOverviewAction() {
  await requireAdminSession();
  await ensureCreditAccountSchema();

  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      customerIdentifier: true,
      name: true,
      phone: true,
      email: true,
      creditAccount: {
        select: {
          id: true,
          balance: true,
          creditsPurchased: true,
          creditsUsed: true,
          lastActivityAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const { CREDIT_PACKAGES } = await import("@/lib/credit-packages");
  const packagesList = Object.entries(CREDIT_PACKAGES).map(([key, pkg]) => ({
    id: key,
    name: pkg.name,
    credits: pkg.credits,
    price: pkg.price,
  }));

  return {
    packages: packagesList,
    customers: customers.map((c) => ({
      id: c.id,
      customerIdentifier: c.customerIdentifier,
      name: c.name,
      phone: c.phone || "N/A",
      email: c.email || "N/A",
      credits: c.creditAccount?.balance ?? 0,
      creditsPurchased: c.creditAccount?.creditsPurchased ?? 0,
      creditsUsed: c.creditAccount?.creditsUsed ?? 0,
      lastActivityAt: c.creditAccount?.lastActivityAt?.toISOString() ?? null,
    })),
  };
}

export async function adminAdjustCustomerCreditsAction(params: {
  customerId: string;
  amount: number;
  note: string;
}) {
  const admin = await requireAdminSession();
  await ensureCreditAccountSchema();

  const { customerId, amount, note } = params;

  if (!customerId) return { error: "Customer ID is required." };
  if (!amount || isNaN(amount) || amount === 0) return { error: "Valid non-zero credit adjustment is required." };

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { creditAccount: true },
  });

  if (!customer) return { error: "Customer not found." };

  try {
    const updated = await prisma.$transaction(async (tx) => {
      let account = customer.creditAccount;
      if (!account) {
        account = await tx.creditAccount.create({
          data: {
            customerId: customer.id,
            balance: 0,
            creditsRemaining: 0,
          },
        });
      }

      const balanceBefore = account.balance;
      const balanceAfter = Math.max(0, balanceBefore + amount);

      const updatedAccount = await tx.creditAccount.update({
        where: { id: account.id },
        data: {
          balance: balanceAfter,
          creditsRemaining: balanceAfter,
          creditsPurchased: amount > 0 ? (account.creditsPurchased || 0) + amount : account.creditsPurchased,
          lastActivityAt: new Date(),
        },
      });

      await tx.creditTransaction.create({
        data: {
          type: "ADMIN_ADJUSTMENT",
          amount,
          balanceBefore,
          balanceAfter,
          reference: `ADJ-${Date.now()}`,
          description: note || `Admin credit adjustment by ${admin.name}`,
          customerId: customer.id,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "ADMIN_CREDIT_ADJUSTMENT",
          entityType: "Customer",
          entityId: customer.id,
          description: `Adjusted credits for ${customer.name} (${customer.customerIdentifier}) by ${amount > 0 ? "+" : ""}${amount} credits (New balance: ${balanceAfter}). Note: ${note || "None"}`,
          adminId: admin.id,
          metadata: { customerId: customer.id, amount, balanceBefore, balanceAfter, note },
        },
      });

      return updatedAccount;
    });

    return { success: true, balance: updated.balance };
  } catch (err: any) {
    console.error("[adminAdjustCustomerCreditsAction] Error:", err);
    return { error: err?.message || "Failed to adjust credits." };
  }
}
