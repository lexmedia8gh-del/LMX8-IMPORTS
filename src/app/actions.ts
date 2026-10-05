"use server";

import { prisma } from "@/lib/prisma";
import { ShipmentStatus } from "@/components/shipment-status";
import { getSession, requireAdminSession, requireCustomerSession } from "@/lib/auth";
import { Shipment as UIShipment, Batch as UIBatch } from "@/lib/db";
import {
  generateSignedUrl,
  uploadFileToPrivateStorage,
  deleteFileFromStorage,
  STORAGE_BUCKET,
} from "@/lib/storage";

// Helper to map Prisma Shipment to UI Shipment with temporary signed URLs
async function mapPrismaShipment(s: any): Promise<UIShipment> {
  // Resolve signed URLs for active photos
  const activePhotos = (s.photos || []).filter((p: any) => p.status !== "DELETED");
  const photosWithSignedUrls = await Promise.all(
    activePhotos.map(async (p: any) => {
      let signedUrl = await generateSignedUrl(p.objectPath, 900, p.bucket || STORAGE_BUCKET);
      return {
        id: p.id,
        url: signedUrl || p.objectPath,
        filename: p.filename,
        status: p.status,
        deletedAt: p.deletedAt ? p.deletedAt.toISOString() : null,
      };
    })
  );

  return {
    id: s.trackingNumber,
    customerId: s.customer.customerIdentifier,
    description: s.description,
    batch: s.batch?.batchNumber,
    batchStatus: s.batch?.status,
    status: s.status as ShipmentStatus,
    registeredDate: s.createdAt.toISOString().split("T")[0],
    lastUpdated: s.updatedAt.toISOString().split("T")[0],
    fee: s.fee,
    origin: s.origin || undefined,
    destination: s.destination || undefined,
    shippingMethod: s.shippingMethod || undefined,
    estimatedArrival: s.estimatedArrival ? s.estimatedArrival.toISOString().split("T")[0] : undefined,
    trackingEvents: (s.trackingEvents || []).map((e: any) => ({
      id: e.id,
      status: e.status as ShipmentStatus,
      date: e.timestamp.toISOString().split("T")[0],
      location: e.location || undefined,
      note: e.note || undefined,
    })),
    photos: photosWithSignedUrls,
  };
}

export async function getShipmentsAction(): Promise<UIShipment[]> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  let shipments;
  if (session.type === "admin") {
    shipments = await prisma.shipment.findMany({
      include: { trackingEvents: true, photos: true, customer: true, batch: true },
      orderBy: { updatedAt: "desc" },
    });
  } else {
    shipments = await prisma.shipment.findMany({
      where: { customerId: session.id },
      include: { trackingEvents: true, photos: true, customer: true, batch: true },
      orderBy: { updatedAt: "desc" },
    });
  }

  return Promise.all(shipments.map(mapPrismaShipment));
}

export async function getShipmentByIdAction(trackingNumber: string): Promise<UIShipment | null> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const shipment = await prisma.shipment.findUnique({
    where: { trackingNumber },
    include: { trackingEvents: true, photos: true, customer: true, batch: true },
  });

  if (!shipment) return null;

  // Strict IDOR Protection: customer can only view their own shipment
  if (session.type === "customer" && shipment.customerId !== session.id) {
    throw new Error("Forbidden");
  }

  return mapPrismaShipment(shipment);
}

export async function createShipmentAction(data: any): Promise<UIShipment> {
  const admin = await requireAdminSession();

  const customer = await prisma.customer.findUnique({
    where: { customerIdentifier: data.customerId },
  });

  if (!customer) throw new Error("Customer not found");

  const trackingNumber = `SHP-${Math.floor(Math.random() * 90000) + 10000}`;

  // data.status arrives as a Prisma enum value (e.g. "SHIPMENT_CREATED").
  // Default to SHIPMENT_CREATED if not provided or unrecognised.
  const validStatuses = [
    "SHIPMENT_CREATED", "PREPARING_SHIPMENT", "SHIPPED", "IN_TRANSIT",
    "ARRIVED_AT_DESTINATION", "CUSTOMS_CLEARANCE", "OUT_FOR_DELIVERY",
    "DELIVERED", "ON_HOLD",
  ] as const;
  type PrismaShipmentStatus = typeof validStatuses[number];
  const prismaStatus: PrismaShipmentStatus = validStatuses.includes(data.status)
    ? data.status
    : "SHIPMENT_CREATED";

  const shipment = await prisma.shipment.create({
    data: {
      trackingNumber,
      description: data.description,
      status: prismaStatus,
      origin: data.origin,
      destination: data.destination,
      shippingMethod: data.shippingMethod,
      estimatedArrival: data.estimatedArrival ? new Date(data.estimatedArrival) : null,
      customerId: customer.id,
      trackingEvents: {
        create: {
          status: prismaStatus,
          note: "Shipment created in system.",
          adminId: admin.id,
        },
      },
    },
    include: { trackingEvents: true, photos: true, customer: true, batch: true },
  });

  return mapPrismaShipment(shipment);
}


export async function updateShipmentStatusAction(
  id: string,
  status: ShipmentStatus,
  note?: string,
  location?: string
): Promise<UIShipment> {
  const admin = await requireAdminSession();

  const shipment = await prisma.shipment.update({
    where: { trackingNumber: id },
    data: {
      status: status as any,
      trackingEvents: {
        create: {
          status: status as any,
          note,
          location,
          adminId: admin.id,
        },
      },
    },
    include: { trackingEvents: true, photos: true, customer: true, batch: true },
  });

  // Fire-and-forget notification — don't break status update if this fails
  const statusMessages: Partial<Record<ShipmentStatus, { title: string; message: string }>> = {
    PREPARING_SHIPMENT:     { title: "Shipment Update",    message: `Your shipment ${id} is being prepared for international shipping.` },
    SHIPPED:                { title: "Shipment Departed",  message: `Your shipment ${id} has departed China and is on its way to Ghana.` },
    IN_TRANSIT:             { title: "In Transit",         message: `Your shipment ${id} is currently in transit to Ghana.` },
    ARRIVED_AT_DESTINATION: { title: "Shipment Arrived",   message: `Your shipment ${id} has arrived in Ghana and is being processed.` },
    CUSTOMS_CLEARANCE:      { title: "Customs Clearance",  message: `Your shipment ${id} is going through customs clearance.` },
    OUT_FOR_DELIVERY:       { title: "Out for Delivery",   message: `Your shipment ${id} is out for delivery. Expect it soon!` },
    DELIVERED:              { title: "Shipment Delivered", message: `Your shipment ${id} has been successfully delivered. Thank you!` },
    ON_HOLD:                { title: "Shipment On Hold",   message: `Your shipment ${id} has been placed on hold. Contact us for details.` },
  };

  const notifData = statusMessages[status];
  if (notifData) {
    const { createNotificationInternal } = await import("@/app/actions/notifications");
    createNotificationInternal({
      customerId: shipment.customerId,
      type: "SHIPMENT",
      title: notifData.title,
      message: notifData.message,
      actionUrl: `/portal/shipments/${id}`,
      idempotencyKey: `shipment-status-${id}-${status}`,
      shipmentId: shipment.id,
    }).catch(console.error);
  }

  return mapPrismaShipment(shipment);
}


/**
 * Phase 2H: Direct Browser-to-Supabase Upload (Large File Fix)
 */
export async function initiateShipmentPhotoUploadAction(
  trackingNumber: string,
  filename: string,
  mimeType: string,
  size: number
) {
  const admin = await requireAdminSession();

  if (!trackingNumber) {
    return { error: "Missing tracking number." };
  }

  // 1. File size limit: 15MB
  const MAX_SIZE = 15 * 1024 * 1024;
  if (size > MAX_SIZE) {
    return { error: "File exceeds 15MB limit." };
  }

  // 2. MIME type validation
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
  ];
  if (!allowedMimeTypes.includes(mimeType)) {
    return { error: `Unsupported file type (${mimeType}). Allowed: JPG, PNG, WEBP, GIF, PDF.` };
  }

  // 3. Find shipment & verify batch status
  const shipment = await prisma.shipment.findUnique({
    where: { trackingNumber },
    include: { batch: true },
  });

  if (!shipment) {
    return { error: "Shipment not found." };
  }

  if (shipment.batch?.status === "CLOSED") {
    return { error: "Cannot upload photos to a closed batch. Uploads are frozen." };
  }

  // 4. Safe non-public storage path
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueId = crypto.randomUUID();
  const batchFolder = shipment.batch?.batchNumber || "unassigned";
  const objectPath = `batches/${batchFolder}/shipments/${trackingNumber}/${uniqueId}-${safeFilename}`;

  const { generateSignedUploadUrl } = await import("@/lib/storage");
  const uploadResult = await generateSignedUploadUrl(objectPath, STORAGE_BUCKET);

  if ("error" in uploadResult) {
    console.error("[Upload Action] Supabase signed upload URL failed:", uploadResult.error);
    return { error: uploadResult.error === "Storage not configured." ? "SUPABASE_SERVICE_ROLE_KEY is not configured in .env. Real file storage requires Supabase service role key." : `Storage upload initialization failed: ${uploadResult.error}` };
  }

  return {
    success: true,
    signedUrl: uploadResult.signedUrl,
    token: uploadResult.token,
    objectPath: uploadResult.path,
  };
}

/**
 * Step 2: Confirm upload and record metadata
 */
export async function confirmShipmentPhotoUploadAction(
  trackingNumber: string,
  objectPath: string,
  filename: string,
  mimeType: string,
  size: number
) {
  const admin = await requireAdminSession();

  const shipment = await prisma.shipment.findUnique({
    where: { trackingNumber },
    include: { batch: true },
  });

  if (!shipment) {
    return { error: "Shipment not found." };
  }

  if (!objectPath.includes(`/shipments/${trackingNumber}/`)) {
    return { error: "Invalid storage path." };
  }

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");

  const photo = await prisma.shipmentPhoto.create({
    data: {
      bucket: STORAGE_BUCKET,
      objectPath,
      filename,
      mimeType,
      size,
      status: "ACTIVE",
      shipmentId: shipment.id,
      adminId: admin.id,
      batchId: shipment.batchId,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "FILE_UPLOADED",
      entityType: "ShipmentPhoto",
      entityId: photo.id,
      description: `Photo '${filename}' (${(size / 1024).toFixed(1)} KB) uploaded for shipment ${trackingNumber}`,
      adminId: admin.id,
      metadata: {
        trackingNumber,
        batchNumber: shipment.batch?.batchNumber,
        filename,
      },
    },
  });

  return { success: true, photoId: photo.id };
}

/**
 * Legacy URL-based photo action (kept for backward compatibility)
 */
export async function addShipmentPhotoAction(trackingNumber: string, photoUrl: string, filename: string) {
  const admin = await requireAdminSession();

  const shipment = await prisma.shipment.findUnique({
    where: { trackingNumber },
  });
  if (!shipment) throw new Error("Shipment not found");

  const photo = await prisma.shipmentPhoto.create({
    data: {
      bucket: STORAGE_BUCKET,
      objectPath: photoUrl,
      filename,
      shipmentId: shipment.id,
      batchId: shipment.batchId,
      adminId: admin.id,
      status: "ACTIVE",
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "FILE_UPLOADED",
      entityType: "ShipmentPhoto",
      entityId: photo.id,
      description: `Legacy photo URL '${filename}' registered for shipment ${trackingNumber}`,
      adminId: admin.id,
    },
  });

  return getShipmentByIdAction(trackingNumber);
}

/**
 * Remove a photo from Supabase Storage and database
 */
export async function removeShipmentPhotoAction(trackingNumber: string, photoId: string) {
  const admin = await requireAdminSession();

  const photo = await prisma.shipmentPhoto.findUnique({
    where: { id: photoId },
    include: { shipment: true },
  });

  if (!photo) return getShipmentByIdAction(trackingNumber);
  if (photo.shipment.trackingNumber !== trackingNumber) {
    throw new Error("Photo does not belong to this shipment");
  }

  // Delete from Supabase Storage
  if (photo.bucket !== "local-fallback" && !photo.objectPath.startsWith("http")) {
    await deleteFileFromStorage(photo.objectPath, photo.bucket);
  }

  // Remove DB record
  await prisma.shipmentPhoto.delete({
    where: { id: photoId },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: "FILE_REMOVED_MANUAL",
      entityType: "ShipmentPhoto",
      entityId: photoId,
      description: `Photo '${photo.filename}' manually removed from shipment ${trackingNumber} by ${admin.name}`,
      adminId: admin.id,
      metadata: {
        trackingNumber,
        filename: photo.filename,
        objectPath: photo.objectPath,
      },
    },
  });

  return getShipmentByIdAction(trackingNumber);
}

// â”€â”€ BATCH LIFECYCLE ACTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getBatchesAction(): Promise<UIBatch[]> {
  await requireAdminSession();
  const batches = await prisma.batch.findMany({
    include: { shipments: true },
    orderBy: { createdAt: "desc" },
  });

  return batches.map((b) => ({
    id: b.batchNumber,
    dbId: b.id,
    name: b.name,
    description: b.description || "",
    shipmentCount: b.shipments.length,
    departure: b.departure ? b.departure.toISOString().split("T")[0] : "",
    arrival: b.arrival ? b.arrival.toISOString().split("T")[0] : "",
    status: b.status,
    closedAt: b.closedAt ? b.closedAt.toISOString() : null,
    fileDeletionAt: b.fileDeletionAt ? b.fileDeletionAt.toISOString() : null,
    createdAt: b.createdAt.toISOString().split("T")[0],
  }));
}

export async function createBatchAction(data: any): Promise<UIBatch> {
  const admin = await requireAdminSession();
  const batchNumber = `BATCH-${Math.floor(Math.random() * 9000) + 1000}`;

  const batch = await prisma.batch.create({
    data: {
      batchNumber,
      name: data.name,
      description: data.description,
      status: data.status || "OPEN",
      departure: data.departure ? new Date(data.departure) : null,
      arrival: data.arrival ? new Date(data.arrival) : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "BATCH_CREATED",
      entityType: "Batch",
      entityId: batch.id,
      description: `Batch ${batchNumber} created by ${admin.name} with initial status '${batch.status}'`,
      adminId: admin.id,
    },
  });

  return {
    id: batch.batchNumber,
    dbId: batch.id,
    name: batch.name,
    description: batch.description || "",
    shipmentCount: 0,
    departure: batch.departure ? batch.departure.toISOString().split("T")[0] : "",
    arrival: batch.arrival ? batch.arrival.toISOString().split("T")[0] : "",
    status: batch.status,
    closedAt: null,
    fileDeletionAt: null,
    createdAt: batch.createdAt.toISOString().split("T")[0],
  };
}

/**
 * Updates batch operational status (OPEN, IN TRANSIT, ARRIVED IN GHANA, PROCESSING / COLLECTION).
 * If CLOSED is selected, delegates to closeBatchAction.
 */
export async function updateBatchStatusAction(batchNumber: string, newStatus: string) {
  const admin = await requireAdminSession();

  if (newStatus === "CLOSED") {
    return closeBatchAction(batchNumber);
  }

  const batch = await prisma.batch.update({
    where: { batchNumber },
    data: { status: newStatus },
  });

  await prisma.auditLog.create({
    data: {
      action: "BATCH_STATUS_UPDATED",
      entityType: "Batch",
      entityId: batch.id,
      description: `Batch ${batchNumber} status updated to '${newStatus}' by ${admin.name}`,
      adminId: admin.id,
      metadata: {
        batchNumber,
        newStatus,
      },
    },
  });

  return { success: true, status: batch.status };
}

/**
 * Phase 2D: Explicit Close Batch Workflow
 * Requires explicit administrator confirmation.
 * Sets closedAt = current server time.
 * Sets fileDeletionAt = closedAt + 7 days.
 * Transitions photos to PENDING_DELETION.
 * Preserves all operational and business records.
 */
export async function closeBatchAction(batchNumber: string) {
  const admin = await requireAdminSession();

  const batch = await prisma.batch.findUnique({
    where: { batchNumber },
    include: { shipments: { select: { id: true } } },
  });

  if (!batch) {
    return { error: "Batch not found." };
  }

  if (batch.status === "CLOSED") {
    return { error: "Batch is already closed." };
  }

  // Exact server timestamps
  const closedAt = new Date();
  const RETENTION_DAYS = 7;
  const fileDeletionAt = new Date(closedAt.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const shipmentIds = batch.shipments.map((s) => s.id);

  // Atomic database update
  await prisma.$transaction([
    // Update batch to CLOSED with retention window
    prisma.batch.update({
      where: { id: batch.id },
      data: {
        status: "CLOSED",
        closedAt,
        fileDeletionAt,
      },
    }),
    // Transition photos to PENDING_DELETION state
    prisma.shipmentPhoto.updateMany({
      where: {
        OR: [
          { batchId: batch.id },
          { shipmentId: { in: shipmentIds } },
        ],
        status: "ACTIVE",
      },
      data: {
        status: "PENDING_DELETION",
      },
    }),
    // Audit log
    prisma.auditLog.create({
      data: {
        action: "BATCH_CLOSED",
        entityType: "Batch",
        entityId: batch.id,
        description: `Batch ${batchNumber} (${batch.name}) explicitly closed by ${admin.name}. 7-day retention period begins; permanent file deletion scheduled for ${fileDeletionAt.toISOString()}.`,
        adminId: admin.id,
        metadata: {
          batchNumber,
          closedAt: closedAt.toISOString(),
          fileDeletionAt: fileDeletionAt.toISOString(),
          retentionPeriodDays: RETENTION_DAYS,
          shipmentsCount: shipmentIds.length,
        },
      },
    }),
  ]);

  return {
    success: true,
    closedAt: closedAt.toISOString(),
    fileDeletionAt: fileDeletionAt.toISOString(),
  };
}



// â”€â”€ USER / ADMIN SESSION ACTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getCurrentCustomerAction() {
  const customer = await requireCustomerSession();
  return {
    id: customer.customerIdentifier,
    internalId: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    credits: 0,
  };
}

export async function getCurrentAdminAction() {
  const admin = await requireAdminSession();
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
  };
}

export async function getCustomersAction() {
  await requireAdminSession();
  const custs = await prisma.customer.findMany();
  return custs.map((c) => ({ id: c.customerIdentifier, name: c.name }));
}