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
import { broadcastShipmentUpdate } from "@/lib/supabase-realtime-server";
import { revalidatePath } from "next/cache";

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

  // Authoritative Shipment Status: Persisted shipment status is the single source of truth
  const effectiveStatus: ShipmentStatus = (s.status as ShipmentStatus) || "SHIPMENT_CREATED";

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
    trackingEvents: (s.trackingEvents || [])
      .slice()
      .sort((a: any, b: any) => new Date(a.timestamp || a.createdAt).getTime() - new Date(b.timestamp || b.createdAt).getTime())
      .map((e: any) => ({
        id: e.id,
        status: e.status as ShipmentStatus,
        date: e.timestamp ? e.timestamp.toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        location: e.location || undefined,
        note: e.note || undefined,
        timestamp: e.timestamp ? e.timestamp.toISOString() : undefined,
        createdAt: e.createdAt ? e.createdAt.toISOString() : undefined,
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
 * Public shipment lookup without requiring an active user session.
 * Exposes only safe tracking metadata and photos, mapped to the full UIShipment type.
 */
export async function getPublicShipmentAction(trackingNumber: string): Promise<UIShipment | null> {
  try {
    if (!trackingNumber) return null;
    const cleanId = trackingNumber.trim().toUpperCase();

    const shipment = await prisma.shipment.findFirst({
      where: {
        OR: [
          { id: trackingNumber.trim() },
          { trackingNumber: cleanId },
          { trackingNumber: trackingNumber.trim() },
        ],
      },
      include: { trackingEvents: true, photos: true, customer: true, batch: true },
    });

    if (!shipment) return null;

    return mapPrismaShipment(shipment);
  } catch (err) {
    console.warn("[Action] getPublicShipmentAction fallback triggered:", err);
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

  const mapped = await mapPrismaShipment(updated);

  // Broadcast real-time update
  broadcastShipmentUpdate({
    shipmentId: shipment.id,
    trackingNumber: shipment.trackingNumber,
    status: mapped.status,
    shipment: mapped,
    source: "assignShipmentToBatchAction",
  }).catch(() => {});

  return mapped;
}


export async function updateShipmentStatusAction(
  id: string,
  status: ShipmentStatus,
  note?: string,
  location?: string
): Promise<UIShipment> {
  const admin = await requireAdminSession();

  // 1. Fetch current status before updating to detect actual status transitions
  const existing = await prisma.shipment.findFirst({
    where: {
      OR: [
        { id: id },
        { trackingNumber: id },
        { trackingNumber: id.toUpperCase() },
      ],
    },
    include: { customer: true, batch: true },
  });

  if (!existing) {
    throw new Error(`Shipment with tracking number or ID ${id} not found.`);
  }

  const previousStatus = existing.status;
  const isStatusChanged = previousStatus !== status;

  // 2. Commit shipment update and tracking event to database
  const shipment = await prisma.shipment.update({
    where: { id: existing.id },
    data: {
      status: status as any,
      trackingEvents: {
        create: {
          status: status as any,
          note: note?.trim() || undefined,
          location: location?.trim() || undefined,
          adminId: admin.id,
        },
      },
    },
    include: {
      trackingEvents: { orderBy: { timestamp: "asc" } },
      photos: true,
      customer: true,
      batch: true,
    },
  });

  // 3. Fire in-app customer notification on status change
  const statusMessages: Partial<Record<ShipmentStatus, { title: string; message: string }>> = {
    PREPARING_SHIPMENT:     { title: "Shipment Update",    message: `Your shipment ${existing.trackingNumber} is being prepared for international shipping.` },
    SHIPPED:                { title: "Shipment Departed",  message: `Your shipment ${existing.trackingNumber} has departed China and is on its way to Ghana.` },
    IN_TRANSIT:             { title: "In Transit",         message: `Your shipment ${existing.trackingNumber} is currently in transit to Ghana.` },
    ARRIVED_AT_DESTINATION: { title: "Shipment Arrived",   message: `Your shipment ${existing.trackingNumber} has arrived in Ghana and is being processed.` },
    CUSTOMS_CLEARANCE:      { title: "Customs Clearance",  message: `Your shipment ${existing.trackingNumber} is going through customs clearance.` },
    OUT_FOR_DELIVERY:       { title: "Out for Delivery",   message: `Your shipment ${existing.trackingNumber} is out for delivery. Expect it soon!` },
    DELIVERED:              { title: "Shipment Delivered", message: `Your shipment ${existing.trackingNumber} has been successfully delivered. Thank you!` },
    ON_HOLD:                { title: "Shipment On Hold",   message: `Your shipment ${existing.trackingNumber} has been placed on hold. Contact us for details.` },
  };

  const notifData = statusMessages[status];
  if (notifData && isStatusChanged) {
    const { createNotificationInternal } = await import("@/app/actions/notifications");
    createNotificationInternal({
      customerId: shipment.customerId,
      type: "SHIPMENT",
      title: notifData.title,
      message: notifData.message,
      actionUrl: `/portal/shipments/${existing.trackingNumber}`,
      idempotencyKey: `shipment-status-${existing.trackingNumber}-${status}-${Date.now()}`,
      shipmentId: shipment.id,
    }).catch(console.error);
  }

  // 4. Brevo Email Milestone Dispatch
  // Only the first 6 defined milestones trigger Brevo emails (OUT_FOR_DELIVERY and DELIVERED do NOT)
  if (isStatusChanged && isBrevoEmailMilestone(status)) {
    sendShipmentMilestoneEmail({
      shipmentId: shipment.id,
      milestone: status,
    }).catch((err) => {
      console.error(`[Brevo] Error dispatching milestone email for ${existing.trackingNumber} (${status}):`, err);
    });
  }

  revalidatePath("/admin/shipments");
  revalidatePath(`/admin/shipments/${existing.trackingNumber}`);
  revalidatePath(`/admin/shipments/${existing.id}`);
  revalidatePath("/portal/shipments");
  revalidatePath(`/portal/shipments/${existing.trackingNumber}`);
  revalidatePath(`/portal/shipments/${existing.id}`);
  revalidatePath("/track");

  const mappedShipment = await mapPrismaShipment(shipment);

  // Broadcast real-time update to Supabase channel
  broadcastShipmentUpdate({
    shipmentId: existing.id,
    trackingNumber: existing.trackingNumber,
    status: shipment.status,
    shipment: mappedShipment,
    source: "updateShipmentStatusAction",
  }).catch(() => {});

  return mappedShipment;
}

/**
 * Adds a new tracking checkpoint event to a shipment and returns both the created event
 * and the fresh complete shipment record for instant UI state synchronization.
 */
export async function addTrackingEventAction(
  shipmentIdOrTrackingNumber: string,
  data: {
    status: ShipmentStatus;
    note?: string;
    location?: string;
    timestamp?: string;
    updateShipmentStatus?: boolean;
  }
) {
  try {
    const admin = await requireAdminSession();

    const existing = await prisma.shipment.findFirst({
      where: {
        OR: [
          { id: shipmentIdOrTrackingNumber },
          { trackingNumber: shipmentIdOrTrackingNumber },
          { trackingNumber: shipmentIdOrTrackingNumber.toUpperCase() },
        ],
      },
      include: { customer: true, batch: true },
    });

    if (!existing) {
      return { error: `Shipment '${shipmentIdOrTrackingNumber}' not found.` };
    }

    const shouldUpdateStatus = data.updateShipmentStatus !== false;
    const previousStatus = existing.status;
    const isStatusChanged = previousStatus !== data.status;
    const eventTimestamp = data.timestamp ? new Date(data.timestamp) : new Date();

    // 1. Create real database tracking event
    const createdEvent = await prisma.trackingEvent.create({
      data: {
        shipmentId: existing.id,
        status: data.status as any,
        note: data.note?.trim() || null,
        location: data.location?.trim() || null,
        timestamp: eventTimestamp,
        adminId: admin.id,
      },
    });

    // 2. If status changed and we should update the shipment status
    if (shouldUpdateStatus && isStatusChanged) {
      await prisma.shipment.update({
        where: { id: existing.id },
        data: { status: data.status as any },
      });

      // Fire customer notifications
      const statusMessages: Partial<Record<ShipmentStatus, { title: string; message: string }>> = {
        PREPARING_SHIPMENT:     { title: "Shipment Update",    message: `Your shipment ${existing.trackingNumber} is being prepared for international shipping.` },
        SHIPPED:                { title: "Shipment Departed",  message: `Your shipment ${existing.trackingNumber} has departed China and is on its way to Ghana.` },
        IN_TRANSIT:             { title: "In Transit",         message: `Your shipment ${existing.trackingNumber} is currently in transit to Ghana.` },
        ARRIVED_AT_DESTINATION: { title: "Shipment Arrived",   message: `Your shipment ${existing.trackingNumber} has arrived in Ghana and is being processed.` },
        CUSTOMS_CLEARANCE:      { title: "Customs Clearance",  message: `Your shipment ${existing.trackingNumber} is going through customs clearance.` },
        OUT_FOR_DELIVERY:       { title: "Out for Delivery",   message: `Your shipment ${existing.trackingNumber} is out for delivery. Expect it soon!` },
        DELIVERED:              { title: "Shipment Delivered", message: `Your shipment ${existing.trackingNumber} has been successfully delivered. Thank you!` },
        ON_HOLD:                { title: "Shipment On Hold",   message: `Your shipment ${existing.trackingNumber} has been placed on hold. Contact us for details.` },
      };

      const notifData = statusMessages[data.status];
      if (notifData) {
        const { createNotificationInternal } = await import("@/app/actions/notifications");
        createNotificationInternal({
          customerId: existing.customerId,
          type: "SHIPMENT",
          title: notifData.title,
          message: notifData.message,
          actionUrl: `/portal/shipments/${existing.trackingNumber}`,
          idempotencyKey: `shipment-status-${existing.trackingNumber}-${data.status}-${Date.now()}`,
          shipmentId: existing.id,
        }).catch(console.error);
      }

      if (isBrevoEmailMilestone(data.status)) {
        sendShipmentMilestoneEmail({
          shipmentId: existing.id,
          milestone: data.status,
        }).catch((err) => {
          console.error(`[Brevo] Error dispatching milestone email for ${existing.trackingNumber} (${data.status}):`, err);
        });
      }
    }

    // 3. Audit log
    await prisma.auditLog.create({
      data: {
        action: "TRACKING_EVENT_CREATED",
        entityType: "TrackingEvent",
        entityId: createdEvent.id,
        description: `Added checkpoint event '${data.status}' for shipment ${existing.trackingNumber} by ${admin.name || admin.email}`,
        adminId: admin.id,
        metadata: {
          shipmentTrackingNumber: existing.trackingNumber,
          status: data.status,
          location: data.location,
          note: data.note,
        },
      },
    });

    // 4. Fetch complete updated shipment
    const updatedShipmentRecord = await prisma.shipment.findUnique({
      where: { id: existing.id },
      include: {
        trackingEvents: { orderBy: { timestamp: "asc" } },
        photos: true,
        customer: true,
        batch: true,
      },
    });

    const uiShipment = updatedShipmentRecord ? await mapPrismaShipment(updatedShipmentRecord) : null;

    revalidatePath("/admin/shipments");
    revalidatePath(`/admin/shipments/${existing.trackingNumber}`);
    revalidatePath(`/admin/shipments/${existing.id}`);
    revalidatePath("/portal/shipments");
    revalidatePath(`/portal/shipments/${existing.trackingNumber}`);
    revalidatePath(`/portal/shipments/${existing.id}`);
    revalidatePath("/track");

    // Broadcast real-time update
    broadcastShipmentUpdate({
      shipmentId: existing.id,
      trackingNumber: existing.trackingNumber,
      status: data.status,
      shipment: uiShipment,
      source: "addTrackingEventAction",
    }).catch(() => {});

    return {
      success: true,
      event: {
        id: createdEvent.id,
        status: createdEvent.status as ShipmentStatus,
        date: createdEvent.timestamp.toISOString().split("T")[0],
        location: createdEvent.location || undefined,
        note: createdEvent.note || undefined,
        timestamp: createdEvent.timestamp.toISOString(),
        createdAt: createdEvent.createdAt.toISOString(),
      },
      shipment: uiShipment!,
    };
  } catch (err: any) {
    console.error("[addTrackingEventAction] Error:", err);
    return { error: err?.message || "Failed to add tracking event." };
  }
}

/**
 * Updates an existing tracking event in the database and returns the updated event and shipment.
 */
export async function updateTrackingEventAction(
  eventId: string,
  data: {
    status?: ShipmentStatus;
    note?: string;
    location?: string;
    timestamp?: string;
  }
) {
  try {
    const admin = await requireAdminSession();

    const event = await prisma.trackingEvent.findUnique({
      where: { id: eventId },
      include: { shipment: true },
    });

    if (!event) {
      return { error: "Tracking event not found." };
    }

    const updatedData: any = {};
    if (data.status) updatedData.status = data.status;
    if (data.note !== undefined) updatedData.note = data.note.trim() || null;
    if (data.location !== undefined) updatedData.location = data.location.trim() || null;
    if (data.timestamp) updatedData.timestamp = new Date(data.timestamp);

    const updated = await prisma.trackingEvent.update({
      where: { id: eventId },
      data: updatedData,
    });

    await prisma.auditLog.create({
      data: {
        action: "TRACKING_EVENT_UPDATED",
        entityType: "TrackingEvent",
        entityId: eventId,
        description: `Tracking event (${updated.status}) updated for shipment ${event.shipment.trackingNumber} by ${admin.name || admin.email}`,
        adminId: admin.id,
        metadata: {
          shipmentTrackingNumber: event.shipment.trackingNumber,
          changes: data,
        },
      },
    });

    const updatedShipmentRecord = await prisma.shipment.findUnique({
      where: { id: event.shipmentId },
      include: {
        trackingEvents: { orderBy: { timestamp: "asc" } },
        photos: true,
        customer: true,
        batch: true,
      },
    });

    const uiShipment = updatedShipmentRecord ? await mapPrismaShipment(updatedShipmentRecord) : null;

    revalidatePath("/admin/shipments");
    revalidatePath(`/admin/shipments/${event.shipment.trackingNumber}`);
    revalidatePath(`/admin/shipments/${event.shipmentId}`);
    revalidatePath("/portal/shipments");
    revalidatePath(`/portal/shipments/${event.shipment.trackingNumber}`);
    revalidatePath(`/portal/shipments/${event.shipmentId}`);
    revalidatePath("/track");

    // Broadcast real-time update
    broadcastShipmentUpdate({
      shipmentId: event.shipmentId,
      trackingNumber: event.shipment.trackingNumber,
      status: updated.status,
      shipment: uiShipment,
      source: "updateTrackingEventAction",
    }).catch(() => {});

    return {
      success: true,
      event: {
        id: updated.id,
        status: updated.status as ShipmentStatus,
        date: updated.timestamp.toISOString().split("T")[0],
        location: updated.location || undefined,
        note: updated.note || undefined,
        timestamp: updated.timestamp.toISOString(),
        createdAt: updated.createdAt.toISOString(),
      },
      shipment: uiShipment!,
    };
  } catch (err: any) {
    console.error("[updateTrackingEventAction] Error:", err);
    return { error: err?.message || "Failed to update tracking event." };
  }
}

/**
 * Deletes a tracking event from the database and returns the fresh shipment record.
 */
export async function deleteTrackingEventAction(eventId: string) {
  try {
    const admin = await requireAdminSession();

    const event = await prisma.trackingEvent.findUnique({
      where: { id: eventId },
      include: { shipment: true },
    });

    if (!event) {
      return { error: "Tracking event not found." };
    }

    const shipmentId = event.shipmentId;
    const trackingNumber = event.shipment.trackingNumber;

    await prisma.trackingEvent.delete({
      where: { id: eventId },
    });

    await prisma.auditLog.create({
      data: {
        action: "TRACKING_EVENT_DELETED",
        entityType: "TrackingEvent",
        entityId: eventId,
        description: `Tracking event (${event.status}) for shipment ${trackingNumber} deleted by ${admin.name || admin.email}`,
        adminId: admin.id,
        metadata: {
          shipmentTrackingNumber: trackingNumber,
          status: event.status,
        },
      },
    });

    const updatedShipmentRecord = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        trackingEvents: { orderBy: { timestamp: "asc" } },
        photos: true,
        customer: true,
        batch: true,
      },
    });

    const uiShipment = updatedShipmentRecord ? await mapPrismaShipment(updatedShipmentRecord) : null;

    revalidatePath("/admin/shipments");
    revalidatePath(`/admin/shipments/${trackingNumber}`);
    revalidatePath(`/admin/shipments/${shipmentId}`);
    revalidatePath("/portal/shipments");
    revalidatePath(`/portal/shipments/${trackingNumber}`);
    revalidatePath(`/portal/shipments/${shipmentId}`);
    revalidatePath("/track");

    // Broadcast real-time update
    broadcastShipmentUpdate({
      shipmentId: shipmentId,
      trackingNumber: trackingNumber,
      status: uiShipment?.status || "IN_TRANSIT",
      shipment: uiShipment,
      source: "deleteTrackingEventAction",
    }).catch(() => {});

    return {
      success: true,
      deletedEventId: eventId,
      shipment: uiShipment!,
    };
  } catch (err: any) {
    console.error("[deleteTrackingEventAction] Error:", err);
    return { error: err?.message || "Failed to delete tracking event." };
  }
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
      // Only the first 6 milestones trigger emails; OUT_FOR_DELIVERY and DELIVERED do NOT.
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
