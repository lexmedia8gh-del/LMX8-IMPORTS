"use server";

import { prisma } from "@/lib/prisma";
import { ShipmentStatus } from "@/components/shipment-status";
import { getSession, requireAdminSession, requireCustomerSession, getCurrentCustomer } from "@/lib/auth";
import { Shipment as UIShipment, Batch as UIBatch } from "@/lib/db";
import { normalizeBatchStatus, getBatchCustomerLabel } from "@/lib/batch-status";
import { extractCustomerNameFields } from "@/lib/customer";
import {
  generateSignedUrl,
  uploadFileToPrivateStorage,
  deleteFileFromStorage,
  STORAGE_BUCKET,
} from "@/lib/storage";
import {
  sendShipmentMilestoneEmail,
  sendShippingFeeReminderEmail,
  isBrevoEmailMilestone,
} from "@/lib/email/brevo";

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

  // If shipment belongs to a batch and shipment is not individually completed or on hold,
  // the shipment inherits the batch's current logistics stage!
  const hasBatch = !!s.batch;
  const isIndividualOverride = s.status === "DELIVERED" || s.status === "ON_HOLD";
  const effectiveStatus: ShipmentStatus = (hasBatch && s.batch.status && s.batch.status !== "CLOSED" && !isIndividualOverride)
    ? normalizeBatchStatus(s.batch.status)
    : (s.status as ShipmentStatus);

  const batchStatusStr = s.batch?.status || undefined;
  const batchStageLabel = s.batch ? getBatchCustomerLabel(s.batch.status) : undefined;
  const estimatedArrivalStr = s.estimatedArrival
    ? s.estimatedArrival.toISOString().split("T")[0]
    : s.batch?.arrival
    ? s.batch.arrival.toISOString().split("T")[0]
    : undefined;

  return {
    id: s.trackingNumber,
    customerId: s.customer?.customerIdentifier || s.customerId,
    description: s.description,
    batch: s.batch?.batchNumber,
    batchName: s.batch?.name,
    batchStatus: batchStatusStr,
    batchStageLabel,
    status: effectiveStatus,
    registeredDate: s.createdAt.toISOString().split("T")[0],
    lastUpdated: s.updatedAt.toISOString().split("T")[0],
    fee: s.fee,
    origin: s.origin || "Shenzhen, China",
    destination: s.destination || "Accra, Ghana",
    shippingMethod: s.shippingMethod || (s.batch?.description?.toLowerCase().includes("air") ? "Air Freight" : "Sea Freight"),
    estimatedArrival: estimatedArrivalStr,
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
  try {
    const session = await getSession();
    if (!session) return [];

    let shipments;
    if (session.type === "admin") {
      shipments = await prisma.shipment.findMany({
        include: { trackingEvents: true, photos: true, customer: true, batch: true },
        orderBy: { updatedAt: "desc" },
      });
    } else {
      const customer = await getCurrentCustomer();
      if (!customer) return [];
      shipments = await prisma.shipment.findMany({
        where: {
          OR: [
            { customerId: customer.id },
            { customer: { customerIdentifier: customer.customerIdentifier } },
            { customerId: session.id },
          ],
        },
        include: { trackingEvents: true, photos: true, customer: true, batch: true },
        orderBy: { updatedAt: "desc" },
      });
    }

    return Promise.all(shipments.map(mapPrismaShipment));
  } catch (err) {
    console.warn("[Action] getShipmentsAction fallback triggered:", err);
    return [];
  }
}

export async function getShipmentByIdAction(trackingNumber: string): Promise<UIShipment | null> {
  try {
    const session = await getSession();
    if (!session) return null;

    const shipment = await prisma.shipment.findFirst({
      where: {
        OR: [
          { id: trackingNumber },
          { trackingNumber: trackingNumber },
          { trackingNumber: trackingNumber.toUpperCase() },
        ],
      },
      include: { trackingEvents: true, photos: true, customer: true, batch: true },
    });

    if (!shipment) return null;

    // Strict IDOR Protection: customer can only view their own shipment
    if (session.type === "customer" && shipment.customerId !== session.id) {
      throw new Error("Forbidden");
    }

    return mapPrismaShipment(shipment);
  } catch (err) {
    console.warn("[Action] getShipmentByIdAction fallback triggered:", err);
    return null;
  }
}

/**
 * Public tracking lookup without exposing private customer documents or IDOR data
 */
export async function getPublicShipmentTrackingAction(trackingNumber: string) {
  if (!trackingNumber) return null;
  const cleanId = trackingNumber.trim().toUpperCase();

  const shipment = await prisma.shipment.findFirst({
    where: {
      OR: [
        { trackingNumber: cleanId },
        { trackingNumber: trackingNumber.trim() },
        { id: trackingNumber.trim() },
      ],
    },
    include: {
      trackingEvents: { orderBy: { timestamp: "asc" } },
      batch: true,
    },
  });

  if (!shipment) return null;

  const hasBatch = !!shipment.batch;
  const isIndividualOverride = shipment.status === "DELIVERED" || shipment.status === "ON_HOLD";
  const effectiveStatus: ShipmentStatus = (hasBatch && shipment.batch && shipment.batch.status && shipment.batch.status !== "CLOSED" && !isIndividualOverride)
    ? normalizeBatchStatus(shipment.batch.status)
    : (shipment.status as ShipmentStatus);

  const estimatedArrivalStr = shipment.estimatedArrival
    ? shipment.estimatedArrival.toISOString().split("T")[0]
    : shipment.batch?.arrival
    ? shipment.batch.arrival.toISOString().split("T")[0]
    : undefined;

  return {
    id: shipment.trackingNumber,
    description: shipment.description,
    batch: shipment.batch?.batchNumber,
    batchName: shipment.batch?.name,
    batchStatus: shipment.batch?.status,
    batchStageLabel: shipment.batch ? getBatchCustomerLabel(shipment.batch.status) : undefined,
    status: effectiveStatus,
    registeredDate: shipment.createdAt.toISOString().split("T")[0],
    lastUpdated: shipment.updatedAt.toISOString().split("T")[0],
    origin: shipment.origin || "Shenzhen, China",
    destination: shipment.destination || "Accra, Ghana",
    shippingMethod: shipment.shippingMethod || (shipment.batch?.description?.toLowerCase().includes("air") ? "Air Freight" : "Sea Freight"),
    estimatedArrival: estimatedArrivalStr,
    trackingEvents: (shipment.trackingEvents || []).map((e: any) => ({
      id: e.id,
      status: e.status as ShipmentStatus,
      date: e.timestamp.toISOString().split("T")[0],
      location: e.location || undefined,
      note: e.note || undefined,
    })),
  };
}

export async function createShipmentAction(data: any): Promise<UIShipment> {
  const admin = await requireAdminSession();

  const customer = await prisma.customer.findUnique({
    where: { customerIdentifier: data.customerId },
  });

  if (!customer) throw new Error("Customer not found");

  const trackingNumber = `SHP-${Math.floor(Math.random() * 90000) + 10000}`;

  // Batch lookup if batchId or batchNumber passed
  let batchRecord = null;
  if (data.batchId || data.batch) {
    batchRecord = await prisma.batch.findFirst({
      where: {
        OR: [
          { id: data.batchId || "" },
          { batchNumber: data.batch || data.batchId || "" },
        ]
      }
    });
    if (batchRecord && batchRecord.status === "CLOSED") {
      throw new Error("Cannot assign shipment to a closed batch.");
    }
  }

  // Derive status safely
  const rawStatus = data.status || (batchRecord ? batchRecord.status : "SHIPMENT_CREATED");
  const prismaStatus: ShipmentStatus = normalizeBatchStatus(rawStatus);

  const shipment = await prisma.shipment.create({
    data: {
      trackingNumber,
      description: data.description,
      status: prismaStatus,
      origin: data.origin || "Shenzhen, China",
      destination: data.destination || "Accra, Ghana",
      shippingMethod: data.shippingMethod || "Sea Freight",
      estimatedArrival: data.estimatedArrival 
        ? new Date(data.estimatedArrival) 
        : (batchRecord?.arrival ? new Date(batchRecord.arrival) : null),
      customerId: customer.id,
      batchId: batchRecord?.id || null,
      trackingEvents: {
        create: {
          status: prismaStatus,
          note: batchRecord 
            ? `Shipment registered and assigned to ${batchRecord.name} (${batchRecord.batchNumber}) at stage ${getBatchCustomerLabel(batchRecord.status)}`
            : "Shipment registered in system.",
          adminId: admin.id,
        },
      },
    },
    include: { trackingEvents: true, photos: true, customer: true, batch: true },
  });

  await prisma.auditLog.create({
    data: {
      action: "SHIPMENT_CREATED",
      entityType: "Shipment",
      entityId: shipment.id,
      description: `Shipment ${trackingNumber} created for customer ${customer.customerIdentifier}${batchRecord ? ` in ${batchRecord.batchNumber}` : ''}`,
      adminId: admin.id,
      metadata: {
        trackingNumber,
        customerIdentifier: customer.customerIdentifier,
        batchNumber: batchRecord?.batchNumber || null,
        status: prismaStatus,
      },
    },
  });

  // Milestone 1 / Initial Milestone: Trigger Brevo email if status is an email milestone
  if (isBrevoEmailMilestone(prismaStatus)) {
    sendShipmentMilestoneEmail({
      shipmentId: shipment.id,
      milestone: prismaStatus,
    }).catch((err) => console.error("[Brevo] Error sending initial milestone email:", err));
  }

  return mapPrismaShipment(shipment);
}

export async function assignShipmentToBatchAction(trackingNumber: string, batchNumberOrId: string | null) {
  const admin = await requireAdminSession();

  const shipment = await prisma.shipment.findUnique({
    where: { trackingNumber },
  });

  if (!shipment) throw new Error("Shipment not found.");

  let targetBatch = null;
  if (batchNumberOrId && batchNumberOrId !== "unassigned") {
    targetBatch = await prisma.batch.findFirst({
      where: {
        OR: [
          { id: batchNumberOrId },
          { batchNumber: batchNumberOrId },
        ],
      },
    });
    if (!targetBatch) throw new Error("Target batch not found.");
    if (targetBatch.status === "CLOSED") throw new Error("Cannot assign to a closed batch.");
  }

  const updated = await prisma.shipment.update({
    where: { trackingNumber },
    data: {
      batchId: targetBatch ? targetBatch.id : null,
      // If assigned to an active batch, update shipment status to match
      status: targetBatch && targetBatch.status !== "CLOSED" 
        ? normalizeBatchStatus(targetBatch.status) 
        : shipment.status,
    },
    include: { trackingEvents: true, photos: true, customer: true, batch: true },
  });

  await prisma.auditLog.create({
    data: {
      action: targetBatch ? "SHIPMENT_ASSIGNED_TO_BATCH" : "SHIPMENT_REMOVED_FROM_BATCH",
      entityType: "Shipment",
      entityId: shipment.id,
      description: targetBatch 
        ? `Shipment ${trackingNumber} assigned to Batch ${targetBatch.batchNumber} (${targetBatch.name})`
        : `Shipment ${trackingNumber} unassigned from Batch`,
      adminId: admin.id,
      metadata: {
        trackingNumber,
        batchNumber: targetBatch?.batchNumber || null,
      },
    },
  });

  return mapPrismaShipment(updated);
}


export async function updateShipmentStatusAction(
  id: string,
  status: ShipmentStatus,
  note?: string,
  location?: string
): Promise<UIShipment> {
  const admin = await requireAdminSession();

  // 1. Fetch current status before updating to detect actual status transitions
  const existing = await prisma.shipment.findUnique({
    where: { trackingNumber: id },
  });

  if (!existing) {
    throw new Error(`Shipment with tracking number ${id} not found.`);
  }

  const previousStatus = existing.status;
  const isStatusChanged = previousStatus !== status;

  // 2. Commit shipment update and tracking event to database
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

  // 3. Fire in-app customer notification on status change
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
  if (notifData && isStatusChanged) {
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

  // 4. Brevo Email Milestone Dispatch
  // Only the 6 defined milestones trigger Brevo emails (PREPARING_SHIPMENT and IN_TRANSIT do NOT)
  if (isStatusChanged && isBrevoEmailMilestone(status)) {
    sendShipmentMilestoneEmail({
      shipmentId: shipment.id,
      milestone: status,
    }).catch((err) => {
      console.error(`[Brevo] Error dispatching milestone email for ${id} (${status}):`, err);
    });
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
  try {
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
  } catch (err) {
    console.warn("[Action] getBatchesAction fallback triggered:", err);
    return [];
  }
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
 * Updates batch operational logistics stage.
 * Automatically propagates to all assigned shipments, records timeline events,
 * and notifies affected customers idempotently.
 * If CLOSED is selected, delegates to closeBatchAction.
 */
export async function updateBatchStatusAction(
  batchNumber: string, 
  newStatus: string,
  note?: string,
  location?: string
) {
  const admin = await requireAdminSession();

  if (newStatus === "CLOSED") {
    return closeBatchAction(batchNumber);
  }

  const batch = await prisma.batch.findUnique({
    where: { batchNumber },
    include: {
      shipments: {
        include: {
          customer: true,
        },
      },
    },
  });

  if (!batch) {
    throw new Error("Batch not found.");
  }

  const previousStatus = batch.status;
  const normalizedStage = normalizeBatchStatus(newStatus);
  const stageLabel = getBatchCustomerLabel(newStatus);

  // 1. Update batch status
  const updatedBatch = await prisma.batch.update({
    where: { batchNumber },
    data: { status: newStatus },
  });

  // 2. If status transitioned, propagate to all non-delivered/non-hold shipments and notify customers
  if (previousStatus !== newStatus) {
    const { createNotificationInternal } = await import("@/app/actions/notifications");

    for (const shipment of batch.shipments) {
      if (shipment.status !== "DELIVERED" && shipment.status !== "ON_HOLD") {
        // Update shipment status in database
        await prisma.shipment.update({
          where: { id: shipment.id },
          data: { status: normalizedStage },
        });

        // Add tracking event to shipment timeline
        await prisma.trackingEvent.create({
          data: {
            status: normalizedStage,
            note: note || `Batch ${batch.name || batch.batchNumber} updated to '${stageLabel}'`,
            location: location || (normalizedStage === "ARRIVED_AT_DESTINATION" || normalizedStage === "CUSTOMS_CLEARANCE" || normalizedStage === "OUT_FOR_DELIVERY" ? "Accra, Ghana" : "China / International Transit"),
            shipmentId: shipment.id,
            adminId: admin.id,
          },
        });
      }

      // Idempotent customer notification
      await createNotificationInternal({
        customerId: shipment.customerId,
        type: "SHIPMENT",
        title: `Shipment Update: ${stageLabel}`,
        message: `Your shipment ${shipment.trackingNumber} (${batch.name || batch.batchNumber}) is now: ${stageLabel}.`,
        actionUrl: `/portal/shipments/${shipment.trackingNumber}`,
        idempotencyKey: `batch-status-${batch.id}-${shipment.id}-${newStatus}`,
        shipmentId: shipment.id,
      }).catch(console.error);

      // Brevo Email Milestone Dispatch for batch status transition
      // Only 6 milestones trigger emails; PREPARING_SHIPMENT and IN_TRANSIT do NOT.
      if (isBrevoEmailMilestone(normalizedStage)) {
        sendShipmentMilestoneEmail({
          shipmentId: shipment.id,
          milestone: normalizedStage,
        }).catch((err) => {
          console.error(`[Brevo] Error sending batch milestone email for shipment ${shipment.trackingNumber}:`, err);
        });
      }
    }
  }

  await prisma.auditLog.create({
    data: {
      action: "BATCH_STATUS_UPDATED",
      entityType: "Batch",
      entityId: batch.id,
      description: `Batch ${batchNumber} (${batch.name}) status updated to '${newStatus}' by ${admin.name}. ${batch.shipments.length} shipment(s) updated.`,
      adminId: admin.id,
      metadata: {
        batchNumber,
        previousStatus,
        newStatus,
        normalizedStage,
        shipmentsCount: batch.shipments.length,
      },
    },
  });

  return { success: true, status: updatedBatch.status, stageLabel };
}

/**
 * Fetches single batch details along with all assigned shipments for admin view
 */
export async function getBatchDetailsAction(batchNumber: string) {
  await requireAdminSession();

  const batch = await prisma.batch.findUnique({
    where: { batchNumber },
    include: {
      shipments: {
        include: {
          customer: true,
          trackingEvents: true,
          photos: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!batch) return null;

  const mappedShipments = await Promise.all(batch.shipments.map(mapPrismaShipment));

  return {
    id: batch.batchNumber,
    dbId: batch.id,
    name: batch.name,
    description: batch.description || "",
    status: batch.status,
    stageLabel: getBatchCustomerLabel(batch.status),
    departure: batch.departure ? batch.departure.toISOString().split("T")[0] : "",
    arrival: batch.arrival ? batch.arrival.toISOString().split("T")[0] : "",
    closedAt: batch.closedAt ? batch.closedAt.toISOString() : null,
    fileDeletionAt: batch.fileDeletionAt ? batch.fileDeletionAt.toISOString() : null,
    createdAt: batch.createdAt.toISOString().split("T")[0],
    shipmentCount: batch.shipments.length,
    shipments: mappedShipments,
  };
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



// ── USER / ADMIN SESSION ACTIONS ────────────────────────────────────────────

export async function getCurrentCustomerAction() {
  try {
    const customer = await getCurrentCustomer();
    if (!customer) {
      return null;
    }

    let creditAccount = null;
    try {
      creditAccount = await prisma.creditAccount.findUnique({
        where: { customerId: customer.id },
      });
    } catch {
      // Gracefully continue even if credit account query fails
    }

    const { displayName, firstName, lastName } = extractCustomerNameFields(customer);

    return {
      id: customer.customerIdentifier,
      customerIdentifier: customer.customerIdentifier,
      internalId: customer.id,
      name: displayName,
      fullName: displayName,
      firstName,
      lastName,
      email: customer.email || "",
      phone: customer.phone || "",
      status: customer.status || "ACTIVE",
      credits: creditAccount?.balance ?? 0,
      createdAt: customer.createdAt ? customer.createdAt.toISOString() : null,
    };
  } catch (err) {
    console.error("[Action] getCurrentCustomerAction error:", err);
    return null;
  }
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
  try {
    await requireAdminSession();
    const { ensureDatabaseSeeded } = await import("@/lib/db-seed");
    await ensureDatabaseSeeded();
    const custs = await prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
    });
    return custs.map((c) => ({
      id: c.customerIdentifier,
      name: c.name,
      phone: c.phone || undefined,
      email: c.email || undefined,
    }));
  } catch (err) {
    console.warn("[Action] getCustomersAction fallback triggered:", err);
    return [];
  }
}

/**
 * Admin action to send a shipping fee statement / payment reminder email via Brevo.
 */
export async function sendShippingFeeReminderAction(trackingNumber: string) {
  const admin = await requireAdminSession();

  const shipment = await prisma.shipment.findUnique({
    where: { trackingNumber },
  });

  if (!shipment) {
    return { error: "Shipment not found." };
  }

  const result = await sendShippingFeeReminderEmail({
    shipmentId: shipment.id,
    force: true, // Admin manual action bypasses the 3-day frequency gate
  });

  if (!result.success) {
    return { error: result.error || "Failed to send shipping fee reminder." };
  }

  await prisma.auditLog.create({
    data: {
      action: "SHIPPING_FEE_REMINDER_SENT",
      entityType: "Shipment",
      entityId: shipment.id,
      description: `Shipping fee statement email sent for ${trackingNumber} by ${admin.name || admin.email}`,
      adminId: admin.id,
    },
  });

  return {
    success: true,
    message: result.skipped ? `Reminder skipped: ${result.reason}` : "Shipping fee reminder email sent successfully.",
  };
}

/**
 * Admin action to fetch email logs for a shipment.
 */
export async function getShipmentEmailLogsAction(trackingNumber: string) {
  await requireAdminSession();

  const shipment = await prisma.shipment.findUnique({
    where: { trackingNumber },
  });

  if (!shipment) return [];

  try {
    const logs = await prisma.emailLog.findMany({
      where: { shipmentId: shipment.id },
      orderBy: { createdAt: "desc" },
    });

    return logs.map((l) => ({
      id: l.id,
      eventType: l.eventType,
      status: l.status,
      recipient: l.recipient,
      subject: l.subject,
      sentAt: l.sentAt ? l.sentAt.toISOString() : null,
      failedAt: l.failedAt ? l.failedAt.toISOString() : null,
      errorMessage: l.errorMessage,
      createdAt: l.createdAt.toISOString(),
    }));
  } catch {
    return [];
  }
}
