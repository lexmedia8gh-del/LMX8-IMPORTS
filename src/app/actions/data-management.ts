"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireAdminSession } from "@/lib/auth";
import { deleteFileFromStorage } from "@/lib/storage";
import {
  DatabaseOverviewResult,
  DataRecordsResult,
  OperationalResetPreviewResult,
} from "@/lib/data-management-types";

/**
 * Overview statistics for Admin Data Management dashboard
 */
export async function getDatabaseOverviewAction(): Promise<DatabaseOverviewResult> {
  const reqId = `ovw_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  try {
    await requireAdminSession();

    const errors: Record<string, string> = {};

    const safeCount = async (model: any, name: string): Promise<number | null> => {
      try {
        return await model.count();
      } catch (err: any) {
        console.error(`[getDatabaseOverviewAction][${reqId}] Failed to count ${name}:`, err?.message || err);
        errors[name] = `Failed to count ${name}`;
        return null;
      }
    };

    const [
      customersCount,
      batchesCount,
      shipmentsCount,
      trackingEventsCount,
      paymentsCount,
      notificationsCount,
      sourcingRequestsCount,
      photosCount,
      auditLogsCount,
    ] = await Promise.all([
      safeCount(prisma.customer, "customers"),
      safeCount(prisma.batch, "batches"),
      safeCount(prisma.shipment, "shipments"),
      safeCount(prisma.trackingEvent, "trackingEvents"),
      safeCount(prisma.payment, "payments"),
      safeCount(prisma.notification, "notifications"),
      safeCount(prisma.sourcingRequest, "sourcingRequests"),
      safeCount(prisma.shipmentPhoto, "photos"),
      safeCount(prisma.auditLog, "auditLogs"),
    ]);

    const hasAnySuccess = [
      customersCount,
      batchesCount,
      shipmentsCount,
      trackingEventsCount,
      paymentsCount,
      notificationsCount,
      sourcingRequestsCount,
      photosCount,
      auditLogsCount,
    ].some((c) => c !== null);

    return {
      success: hasAnySuccess,
      counts: {
        customers: customersCount,
        batches: batchesCount,
        shipments: shipmentsCount,
        trackingEvents: trackingEventsCount,
        payments: paymentsCount,
        notifications: notificationsCount,
        sourcingRequests: sourcingRequestsCount,
        photos: photosCount,
        auditLogs: auditLogsCount,
      },
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      error: !hasAnySuccess
        ? "Database connection error: Unable to retrieve overview counts."
        : undefined,
      requestId: reqId,
    };
  } catch (err: any) {
    console.error(`[getDatabaseOverviewAction][${reqId}] Error:`, err);
    return {
      success: false,
      counts: {
        customers: null,
        batches: null,
        shipments: null,
        trackingEvents: null,
        payments: null,
        notifications: null,
        sourcingRequests: null,
        photos: null,
        auditLogs: null,
      },
      error: err?.message?.includes("Unauthorized")
        ? "Unauthorized access. Please log in as an administrator."
        : "Failed to load database overview.",
      requestId: reqId,
    };
  }
}

/**
 * Fetch records for Data Management tabular explorer
 */
export async function getDataRecordsAction(
  entityType: "shipments" | "batches" | "customers" | "events" | "notifications" | "payments"
): Promise<DataRecordsResult> {
  const reqId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  try {
    await requireAdminSession();

    switch (entityType) {
      case "shipments": {
        const [records, total] = await Promise.all([
          prisma.shipment.findMany({
            include: {
              customer: { select: { id: true, customerIdentifier: true, name: true } },
              batch: { select: { id: true, batchNumber: true, name: true, status: true } },
              trackingEvents: { select: { id: true } },
              photos: { select: { id: true } },
              payments: { select: { id: true, status: true, amount: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
          prisma.shipment.count(),
        ]);

        const mapped = (records || []).map((s) => ({
          id: s.id,
          trackingNumber: s.trackingNumber || "N/A",
          description: s.description || "N/A",
          status: s.status || "SHIPMENT_CREATED",
          fee: s.fee ?? 0,
          weight: s.weight ?? null,
          quantity: s.quantity ?? null,
          createdAt: s.createdAt ? s.createdAt.toISOString() : new Date().toISOString(),
          customer: s.customer ? `${s.customer.name} (${s.customer.customerIdentifier})` : "N/A",
          customerId: s.customerId,
          customerIdentifier: s.customer?.customerIdentifier || s.customerId,
          batch: s.batch ? `${s.batch.name} (${s.batch.batchNumber})` : "Unassigned",
          batchId: s.batchId,
          eventsCount: (s.trackingEvents || []).length,
          photosCount: (s.photos || []).length,
          paymentsCount: (s.payments || []).length,
          hasPaidPayments: (s.payments || []).some((p) => p.status === "SUCCESS"),
        }));

        return { success: true, records: mapped, total, requestId: reqId };
      }

      case "batches": {
        const [records, total] = await Promise.all([
          prisma.batch.findMany({
            include: {
              shipments: { select: { id: true, trackingNumber: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
          prisma.batch.count(),
        ]);

        const mapped = (records || []).map((b) => ({
          id: b.id,
          batchNumber: b.batchNumber || "N/A",
          name: b.name || "N/A",
          description: b.description || "",
          status: b.status || "OPEN",
          shipmentsCount: (b.shipments || []).length,
          departure: b.departure ? b.departure.toISOString().split("T")[0] : null,
          arrival: b.arrival ? b.arrival.toISOString().split("T")[0] : null,
          closedAt: b.closedAt ? b.closedAt.toISOString() : null,
          fileDeletionAt: b.fileDeletionAt ? b.fileDeletionAt.toISOString() : null,
          createdAt: b.createdAt ? b.createdAt.toISOString() : new Date().toISOString(),
        }));

        return { success: true, records: mapped, total, requestId: reqId };
      }

      case "customers": {
        const [records, total] = await Promise.all([
          prisma.customer.findMany({
            include: {
              shipments: { select: { id: true } },
              payments: { select: { id: true, status: true } },
              sourcingRequests: { select: { id: true } },
              creditAccount: { select: { balance: true } },
              notifications: { select: { id: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
          prisma.customer.count(),
        ]);

        const mapped = (records || []).map((c) => ({
          id: c.id,
          customerIdentifier: c.customerIdentifier || "N/A",
          name: c.name || "N/A",
          phone: c.phone || "N/A",
          email: c.email || "N/A",
          status: c.status || "ACTIVE",
          credits: c.creditAccount?.balance || 0,
          shipmentsCount: (c.shipments || []).length,
          paymentsCount: (c.payments || []).length,
          sourcingCount: (c.sourcingRequests || []).length,
          notificationsCount: (c.notifications || []).length,
          createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
        }));

        return { success: true, records: mapped, total, requestId: reqId };
      }

      case "events": {
        const [records, total] = await Promise.all([
          prisma.trackingEvent.findMany({
            include: {
              shipment: { select: { id: true, trackingNumber: true, description: true } },
              admin: { select: { id: true, name: true, email: true } },
            },
            orderBy: { timestamp: "desc" },
            take: 100,
          }),
          prisma.trackingEvent.count(),
        ]);

        const mapped = (records || []).map((e) => ({
          id: e.id,
          status: e.status || "SHIPMENT_CREATED",
          location: e.location || "N/A",
          note: e.note || "N/A",
          timestamp: e.timestamp ? e.timestamp.toISOString() : new Date().toISOString(),
          shipmentTrackingNumber: e.shipment?.trackingNumber || "N/A",
          shipmentDescription: e.shipment?.description || "N/A",
          adminName: e.admin?.name || e.admin?.email || "System",
        }));

        return { success: true, records: mapped, total, requestId: reqId };
      }

      case "notifications": {
        const [records, total] = await Promise.all([
          prisma.notification.findMany({
            include: {
              customer: { select: { id: true, customerIdentifier: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
          prisma.notification.count(),
        ]);

        const mapped = (records || []).map((n) => ({
          id: n.id,
          type: n.type || "SYSTEM",
          title: n.title || "N/A",
          message: n.message || "N/A",
          read: Boolean(n.read),
          customerName: n.customer?.name || "N/A",
          customerIdentifier: n.customer?.customerIdentifier || "N/A",
          createdAt: n.createdAt ? n.createdAt.toISOString() : new Date().toISOString(),
        }));

        return { success: true, records: mapped, total, requestId: reqId };
      }

      case "payments": {
        const [records, total] = await Promise.all([
          prisma.payment.findMany({
            include: {
              customer: { select: { id: true, customerIdentifier: true, name: true } },
              shipment: { select: { id: true, trackingNumber: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
          prisma.payment.count(),
        ]);

        const mapped = (records || []).map((p) => ({
          id: p.id,
          reference: p.reference || "N/A",
          amount: p.amount ?? 0,
          currency: p.currency || "GHS",
          status: p.status || "PENDING",
          type: p.type || "CREDIT_PURCHASE",
          provider: p.provider || "PAYSTACK",
          createdAt: p.createdAt ? p.createdAt.toISOString() : new Date().toISOString(),
          customerName: p.customer?.name || "N/A",
          customerIdentifier: p.customer?.customerIdentifier || "N/A",
          shipmentTrackingNumber: p.shipment?.trackingNumber || "N/A",
        }));

        return { success: true, records: mapped, total, requestId: reqId };
      }

      default:
        return { success: false, records: [], total: 0, error: "Invalid entity type requested." };
    }
  } catch (err: any) {
    console.error(`[getDataRecordsAction][${reqId}] Error fetching ${entityType}:`, err?.message || err);
    return {
      success: false,
      records: [],
      total: 0,
      error: `Failed to load ${entityType} records from database. Please verify connectivity.`,
      requestId: reqId,
    };
  }
}

/**
 * Deep inspection of a record's dependencies and relationships before deletion
 */
export async function getRecordRelationshipsAction(entityType: string, recordId: string) {
  try {
    await requireAdminSession();

    switch (entityType) {
      case "Shipment": {
        const shipment = await prisma.shipment.findFirst({
          where: {
            OR: [{ id: recordId }, { trackingNumber: recordId }],
          },
          include: {
            customer: true,
            batch: true,
            trackingEvents: true,
            photos: true,
            payments: true,
          },
        });

        if (!shipment) return null;

        const notifsCount = await prisma.notification.count({
          where: { shipmentId: shipment.id },
        }).catch(() => 0);

        return {
          id: shipment.id,
          trackingNumber: shipment.trackingNumber,
          description: shipment.description,
          fee: shipment.fee,
          weight: shipment.weight,
          quantity: shipment.quantity,
          status: shipment.status,
          customer: shipment.customer ? {
            id: shipment.customer.id,
            name: shipment.customer.name,
            identifier: shipment.customer.customerIdentifier,
          } : null,
          batch: shipment.batch
            ? {
                id: shipment.batch.id,
                batchNumber: shipment.batch.batchNumber,
                name: shipment.batch.name,
              }
            : null,
          relationships: {
            trackingEventsCount: (shipment.trackingEvents || []).length,
            photosCount: (shipment.photos || []).length,
            paymentsCount: (shipment.payments || []).length,
            notificationsCount: notifsCount,
          },
          warnings: (shipment.payments || []).some((p) => p.status === "SUCCESS")
            ? ["This shipment has verified financial payments. Payment history is protected and will be preserved."]
            : [],
          canDelete: true,
        };
      }

      case "Batch": {
        const batch = await prisma.batch.findFirst({
          where: {
            OR: [{ id: recordId }, { batchNumber: recordId }],
          },
          include: {
            shipments: { select: { id: true, trackingNumber: true, description: true } },
          },
        });

        if (!batch) return null;

        const photosCount = await prisma.shipmentPhoto.count({
          where: { batchId: batch.id },
        }).catch(() => 0);

        const canDelete = (batch.shipments || []).length === 0;

        return {
          id: batch.id,
          batchNumber: batch.batchNumber,
          name: batch.name,
          description: batch.description,
          status: batch.status,
          departure: batch.departure ? batch.departure.toISOString().split("T")[0] : null,
          arrival: batch.arrival ? batch.arrival.toISOString().split("T")[0] : null,
          relationships: {
            shipmentsCount: (batch.shipments || []).length,
            photosCount,
          },
          assignedShipments: (batch.shipments || []).map((s) => s.trackingNumber),
          warnings:
            (batch.shipments || []).length > 0
              ? [
                  `This batch contains ${batch.shipments.length} assigned shipments (${batch.shipments.map((s) => s.trackingNumber).join(", ")}). You must reassign or remove all shipments before deleting this batch.`,
                ]
              : [],
          canDelete,
        };
      }

      case "Customer": {
        const customer = await prisma.customer.findFirst({
          where: {
            OR: [{ id: recordId }, { customerIdentifier: recordId }],
          },
          include: {
            shipments: { select: { id: true, trackingNumber: true } },
            payments: { select: { id: true, status: true, amount: true } },
            sourcingRequests: { select: { id: true } },
            creditAccount: true,
            notifications: { select: { id: true } },
          },
        });

        if (!customer) return null;

        const hasHistory =
          (customer.payments || []).length > 0 ||
          (customer.shipments || []).length > 0 ||
          (customer.sourcingRequests || []).length > 0;

        return {
          id: customer.id,
          customerIdentifier: customer.customerIdentifier,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          status: customer.status,
          relationships: {
            shipmentsCount: (customer.shipments || []).length,
            paymentsCount: (customer.payments || []).length,
            sourcingRequestsCount: (customer.sourcingRequests || []).length,
            creditBalance: customer.creditAccount?.balance || 0,
            notificationsCount: (customer.notifications || []).length,
          },
          warnings: hasHistory
            ? [
                "This customer account contains historical logistics or financial records. To preserve audit and accounting integrity, use 'Deactivate Customer' instead of permanent deletion.",
              ]
            : [],
          canDelete: !hasHistory,
        };
      }

      case "Payment": {
        const payment = await prisma.payment.findFirst({
          where: {
            OR: [{ id: recordId }, { reference: recordId }],
          },
          include: {
            customer: true,
            shipment: true,
            creditTransactions: true,
          },
        });

        if (!payment) return null;

        const notifsCount = await prisma.notification.count({
          where: { paymentId: payment.id },
        }).catch(() => 0);

        return {
          id: payment.id,
          reference: payment.reference,
          amount: payment.amount,
          currency: payment.currency || "GHS",
          status: payment.status,
          provider: payment.provider,
          customer: payment.customer
            ? { id: payment.customer.id, name: payment.customer.name, identifier: payment.customer.customerIdentifier }
            : null,
          shipment: payment.shipment ? { id: payment.shipment.id, trackingNumber: payment.shipment.trackingNumber } : null,
          relationships: {
            creditTransactionsCount: (payment.creditTransactions || []).length,
            notificationsCount: notifsCount,
          },
          warnings: payment.status === "SUCCESS"
            ? ["This payment was successfully completed. Deleting this record will remove it from local payment history while keeping audit logs intact."]
            : [],
          canDelete: true,
        };
      }

      default:
        return null;
    }
  } catch (err) {
    console.error("[getRecordRelationshipsAction] Error:", err);
    return null;
  }
}

/**
 * Authorized Update / Edit of a Data Management Record
 */
export async function updateDataRecordAction(
  entityType: string,
  recordId: string,
  data: Record<string, any>
) {
  try {
    const admin = await requireAdminSession();

    switch (entityType.toLowerCase()) {
      case "shipments":
      case "shipment": {
        const existing = await prisma.shipment.findUnique({ where: { id: recordId } });
        if (!existing) return { error: "Shipment record not found." };

        const updateData: any = {};
        if (data.description !== undefined) updateData.description = String(data.description);
        if (data.trackingNumber !== undefined && data.trackingNumber.trim()) updateData.trackingNumber = String(data.trackingNumber).trim();
        if (data.status !== undefined && data.status) updateData.status = data.status;
        if (data.fee !== undefined) updateData.fee = parseFloat(data.fee) || 0;
        if (data.weight !== undefined) updateData.weight = data.weight !== "" && data.weight !== null ? parseFloat(data.weight) : null;
        if (data.quantity !== undefined) updateData.quantity = data.quantity !== "" && data.quantity !== null ? parseInt(data.quantity) : null;
        if (data.batchId !== undefined) updateData.batchId = data.batchId ? String(data.batchId) : null;

        const updated = await prisma.shipment.update({
          where: { id: recordId },
          data: updateData,
        });

        await prisma.auditLog.create({
          data: {
            action: "SHIPMENT_EDITED",
            entityType: "Shipment",
            entityId: recordId,
            description: `Shipment ${updated.trackingNumber} updated by ${admin.name}`,
            adminId: admin.id,
            metadata: { updatedFields: Object.keys(updateData) },
          },
        }).catch(() => {});

        return { success: true, record: updated };
      }

      case "batches":
      case "batch": {
        const existing = await prisma.batch.findUnique({ where: { id: recordId } });
        if (!existing) return { error: "Batch record not found." };

        const updateData: any = {};
        if (data.batchNumber !== undefined && data.batchNumber.trim()) updateData.batchNumber = String(data.batchNumber).trim();
        if (data.name !== undefined) updateData.name = String(data.name);
        if (data.description !== undefined) updateData.description = String(data.description);
        if (data.status !== undefined && data.status) updateData.status = String(data.status);
        if (data.departure !== undefined) updateData.departure = data.departure ? new Date(data.departure) : null;
        if (data.arrival !== undefined) updateData.arrival = data.arrival ? new Date(data.arrival) : null;

        const updated = await prisma.batch.update({
          where: { id: recordId },
          data: updateData,
        });

        await prisma.auditLog.create({
          data: {
            action: "BATCH_EDITED",
            entityType: "Batch",
            entityId: recordId,
            description: `Batch ${updated.batchNumber} updated by ${admin.name}`,
            adminId: admin.id,
            metadata: { updatedFields: Object.keys(updateData) },
          },
        }).catch(() => {});

        return { success: true, record: updated };
      }

      case "customers":
      case "customer": {
        const existing = await prisma.customer.findUnique({ where: { id: recordId } });
        if (!existing) return { error: "Customer record not found." };

        const updateData: any = {};
        if (data.name !== undefined) updateData.name = String(data.name);
        if (data.phone !== undefined) updateData.phone = data.phone ? String(data.phone) : null;
        if (data.email !== undefined) updateData.email = data.email ? String(data.email) : null;
        if (data.status !== undefined && data.status) updateData.status = String(data.status);

        const updated = await prisma.customer.update({
          where: { id: recordId },
          data: updateData,
        });

        await prisma.auditLog.create({
          data: {
            action: "CUSTOMER_EDITED",
            entityType: "Customer",
            entityId: recordId,
            description: `Customer ${updated.customerIdentifier} updated by ${admin.name}`,
            adminId: admin.id,
            metadata: { updatedFields: Object.keys(updateData) },
          },
        }).catch(() => {});

        return { success: true, record: updated };
      }

      case "events":
      case "trackingevent": {
        const existing = await prisma.trackingEvent.findUnique({ where: { id: recordId } });
        if (!existing) return { error: "Tracking event record not found." };

        const updateData: any = {};
        if (data.status !== undefined && data.status) updateData.status = data.status;
        if (data.location !== undefined) updateData.location = data.location ? String(data.location) : null;
        if (data.note !== undefined) updateData.note = data.note ? String(data.note) : null;

        const updated = await prisma.trackingEvent.update({
          where: { id: recordId },
          data: updateData,
        });

        await prisma.auditLog.create({
          data: {
            action: "TRACKING_EVENT_EDITED",
            entityType: "TrackingEvent",
            entityId: recordId,
            description: `Tracking event updated by ${admin.name}`,
            adminId: admin.id,
            metadata: { updatedFields: Object.keys(updateData) },
          },
        }).catch(() => {});

        return { success: true, record: updated };
      }

      case "notifications":
      case "notification": {
        const existing = await prisma.notification.findUnique({ where: { id: recordId } });
        if (!existing) return { error: "Notification record not found." };

        const updateData: any = {};
        if (data.title !== undefined) updateData.title = String(data.title);
        if (data.message !== undefined) updateData.message = String(data.message);
        if (data.read !== undefined) updateData.read = Boolean(data.read);

        const updated = await prisma.notification.update({
          where: { id: recordId },
          data: updateData,
        });

        await prisma.auditLog.create({
          data: {
            action: "NOTIFICATION_EDITED",
            entityType: "Notification",
            entityId: recordId,
            description: `Notification '${updated.title}' updated by ${admin.name}`,
            adminId: admin.id,
            metadata: { updatedFields: Object.keys(updateData) },
          },
        }).catch(() => {});

        return { success: true, record: updated };
      }

      case "payments":
      case "payment": {
        const existing = await prisma.payment.findUnique({ where: { id: recordId } });
        if (!existing) return { error: "Payment record not found." };

        const updateData: any = {};
        if (data.amount !== undefined) updateData.amount = parseFloat(data.amount) || 0;
        if (data.status !== undefined && data.status) updateData.status = data.status;
        if (data.currency !== undefined) updateData.currency = String(data.currency);
        if (data.provider !== undefined) updateData.provider = data.provider ? String(data.provider) : null;

        const updated = await prisma.payment.update({
          where: { id: recordId },
          data: updateData,
        });

        await prisma.auditLog.create({
          data: {
            action: "PAYMENT_EDITED",
            entityType: "Payment",
            entityId: recordId,
            description: `Payment ${updated.reference} updated by ${admin.name}`,
            adminId: admin.id,
            metadata: { updatedFields: Object.keys(updateData) },
          },
        }).catch(() => {});

        return { success: true, record: updated };
      }

      default:
        return { error: "Invalid entity type for record editing." };
    }
  } catch (err: any) {
    console.error("[updateDataRecordAction] Error:", err);
    return { error: err?.message || "Failed to update record." };
  }
}

/**
 * Helper to verify Admin PIN if provided
 */
async function verifyAdminPinInternal(adminId: string, pin?: string) {
  if (!pin) return true;

  const fullAdmin = await prisma.adminUser.findUnique({
    where: { id: adminId },
  });

  if (!fullAdmin) return false;

  if (fullAdmin.pinHash) {
    const valid = await bcrypt.compare(pin, fullAdmin.pinHash);
    if (valid) return true;
  }

  if (fullAdmin.passwordHash) {
    return await bcrypt.compare(pin, fullAdmin.passwordHash);
  }

  return false;
}

/**
 * Safe Shipment Deletion with atomic transaction, cascade dependencies, and storage cleanup
 */
export async function deleteShipmentSafeAction(
  shipmentIdentifier: string,
  confirmationText: string,
  adminPin?: string
) {
  const admin = await requireAdminSession();

  if (confirmationText.trim().toUpperCase() !== "DELETE") {
    return { error: "Confirmation text must be 'DELETE'." };
  }

  if (adminPin) {
    const isPinValid = await verifyAdminPinInternal(admin.id, adminPin);
    if (!isPinValid) {
      return { error: "Invalid Admin PIN." };
    }
  }

  const shipment = await prisma.shipment.findFirst({
    where: {
      OR: [{ id: shipmentIdentifier }, { trackingNumber: shipmentIdentifier }],
    },
    include: {
      customer: true,
      batch: true,
      photos: true,
      trackingEvents: true,
      payments: true,
    },
  });

  if (!shipment) {
    return { error: "Shipment record not found." };
  }

  // 1. Clean up private Supabase Storage files associated with this shipment
  const photoPaths = shipment.photos.map((p) => ({ path: p.objectPath, bucket: p.bucket }));
  for (const item of photoPaths) {
    if (item.path && !item.path.startsWith("http")) {
      await deleteFileFromStorage(item.path, item.bucket).catch((err) =>
        console.warn("[DataManagement] File cleanup warning:", err)
      );
    }
  }

  // 2. Perform atomic database deletion
  await prisma.$transaction([
    // Unlink payments so financial accounting is preserved without hard foreign key error
    prisma.payment.updateMany({
      where: { shipmentId: shipment.id },
      data: { shipmentId: null },
    }),
    // Delete notifications tied to this shipment
    prisma.notification.deleteMany({
      where: { shipmentId: shipment.id },
    }),
    // Delete shipment photos
    prisma.shipmentPhoto.deleteMany({
      where: { shipmentId: shipment.id },
    }),
    // Delete tracking events
    prisma.trackingEvent.deleteMany({
      where: { shipmentId: shipment.id },
    }),
    // Delete shipment record
    prisma.shipment.delete({
      where: { id: shipment.id },
    }),
    // Create Audit Log
    prisma.auditLog.create({
      data: {
        action: "SHIPMENT_DELETED",
        entityType: "Shipment",
        entityId: shipment.id,
        description: `Shipment ${shipment.trackingNumber} (${shipment.description}) safely deleted by ${admin.name}`,
        adminId: admin.id,
        metadata: {
          trackingNumber: shipment.trackingNumber,
          customerIdentifier: shipment.customer.customerIdentifier,
          batchNumber: shipment.batch?.batchNumber || null,
          trackingEventsDeleted: shipment.trackingEvents.length,
          photosDeleted: shipment.photos.length,
          unlinkedPayments: shipment.payments.length,
        },
      },
    }),
  ]);

  return { success: true, trackingNumber: shipment.trackingNumber };
}

/**
 * Safe Batch Deletion — verifies no active shipments are orphaned
 */
export async function deleteBatchSafeAction(
  batchIdentifier: string,
  confirmationText: string,
  adminPin?: string
) {
  const admin = await requireAdminSession();

  if (confirmationText.trim().toUpperCase() !== "DELETE") {
    return { error: "Confirmation text must be 'DELETE'." };
  }

  if (adminPin) {
    const isPinValid = await verifyAdminPinInternal(admin.id, adminPin);
    if (!isPinValid) {
      return { error: "Invalid Admin PIN." };
    }
  }

  const batch = await prisma.batch.findFirst({
    where: {
      OR: [{ id: batchIdentifier }, { batchNumber: batchIdentifier }],
    },
    include: {
      shipments: { select: { id: true, trackingNumber: true } },
    },
  });

  if (!batch) {
    return { error: "Batch record not found." };
  }

  if (batch.shipments.length > 0) {
    return {
      error: `Cannot delete batch '${batch.batchNumber}' because ${batch.shipments.length} shipment(s) are assigned to it (${batch.shipments.map((s) => s.trackingNumber).join(", ")}). Please reassign or delete these shipments first.`,
    };
  }

  // Delete batch photos if any
  await prisma.shipmentPhoto.deleteMany({
    where: { batchId: batch.id },
  });

  await prisma.batch.delete({
    where: { id: batch.id },
  });

  await prisma.auditLog.create({
    data: {
      action: "BATCH_DELETED",
      entityType: "Batch",
      entityId: batch.id,
      description: `Batch ${batch.batchNumber} (${batch.name}) deleted by ${admin.name}`,
      adminId: admin.id,
      metadata: {
        batchNumber: batch.batchNumber,
        name: batch.name,
      },
    },
  });

  return { success: true, batchNumber: batch.batchNumber };
}

/**
 * Customer Deactivation (Recommended over hard deletion to preserve accounting history)
 */
export async function deactivateCustomerSafeAction(customerId: string) {
  const admin = await requireAdminSession();

  const customer = await prisma.customer.findFirst({
    where: {
      OR: [{ id: customerId }, { customerIdentifier: customerId }],
    },
  });

  if (!customer) {
    return { error: "Customer not found." };
  }

  const newStatus = customer.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  await prisma.customer.update({
    where: { id: customer.id },
    data: { status: newStatus },
  });

  await prisma.auditLog.create({
    data: {
      action: newStatus === "INACTIVE" ? "CUSTOMER_DEACTIVATED" : "CUSTOMER_REACTIVATED",
      entityType: "Customer",
      entityId: customer.id,
      description: `Customer ${customer.customerIdentifier} status changed to ${newStatus} by ${admin.name}`,
      adminId: admin.id,
      metadata: {
        customerIdentifier: customer.customerIdentifier,
        previousStatus: customer.status,
        newStatus,
      },
    },
  });

  return { success: true, status: newStatus };
}

/**
 * Safe Customer Deletion — allowed only for zero-history accounts
 */
export async function deleteCustomerSafeAction(
  customerId: string,
  confirmationText: string,
  adminPin?: string
) {
  const admin = await requireAdminSession();

  if (confirmationText.trim().toUpperCase() !== "DELETE") {
    return { error: "Confirmation text must be 'DELETE'." };
  }

  if (adminPin) {
    const isPinValid = await verifyAdminPinInternal(admin.id, adminPin);
    if (!isPinValid) {
      return { error: "Invalid Admin PIN." };
    }
  }

  const customer = await prisma.customer.findFirst({
    where: {
      OR: [{ id: customerId }, { customerIdentifier: customerId }],
    },
    include: {
      shipments: true,
      payments: true,
      sourcingRequests: true,
      creditAccount: true,
      notifications: true,
    },
  });

  if (!customer) {
    return { error: "Customer not found." };
  }

  if (customer.payments.length > 0 || customer.shipments.length > 0 || customer.sourcingRequests.length > 0) {
    return {
      error: `Customer '${customer.customerIdentifier}' cannot be deleted because historical shipments (${customer.shipments.length}) or payments (${customer.payments.length}) exist. Please use 'Deactivate Customer' instead to preserve financial records.`,
    };
  }

  await prisma.$transaction([
    prisma.notification.deleteMany({
      where: { customerId: customer.id },
    }),
    prisma.creditTransaction.deleteMany({
      where: { customerId: customer.id },
    }),
    prisma.creditAccount.deleteMany({
      where: { customerId: customer.id },
    }),
    prisma.customer.delete({
      where: { id: customer.id },
    }),
    prisma.auditLog.create({
      data: {
        action: "CUSTOMER_DELETED",
        entityType: "Customer",
        entityId: customer.id,
        description: `Customer account ${customer.customerIdentifier} (${customer.name}) deleted by ${admin.name}`,
        adminId: admin.id,
        metadata: {
          customerIdentifier: customer.customerIdentifier,
          name: customer.name,
        },
      },
    }),
  ]);

  return { success: true, customerIdentifier: customer.customerIdentifier };
}

/**
 * Safe Tracking Event Deletion
 */
export async function deleteTrackingEventSafeAction(eventId: string) {
  const admin = await requireAdminSession();

  const event = await prisma.trackingEvent.findUnique({
    where: { id: eventId },
    include: { shipment: true },
  });

  if (!event) {
    return { error: "Tracking event not found." };
  }

  await prisma.trackingEvent.delete({
    where: { id: eventId },
  });

  await prisma.auditLog.create({
    data: {
      action: "TRACKING_EVENT_DELETED",
      entityType: "TrackingEvent",
      entityId: eventId,
      description: `Tracking event (${event.status}) for shipment ${event.shipment?.trackingNumber || "N/A"} deleted by ${admin.name}`,
      adminId: admin.id,
      metadata: {
        shipmentTrackingNumber: event.shipment?.trackingNumber,
        status: event.status,
      },
    },
  });

  return { success: true };
}

/**
 * Safe Notification Deletion
 */
export async function deleteNotificationSafeAction(notificationId: string) {
  const admin = await requireAdminSession();

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    return { error: "Notification not found." };
  }

  await prisma.notification.delete({
    where: { id: notificationId },
  });

  await prisma.auditLog.create({
    data: {
      action: "NOTIFICATION_DELETED",
      entityType: "Notification",
      entityId: notificationId,
      description: `Notification '${notification.title}' deleted by ${admin.name}`,
      adminId: admin.id,
    },
  });

  return { success: true };
}

/**
 * Safe Payment Deletion
 */
export async function deletePaymentSafeAction(
  paymentIdentifier: string,
  confirmationText: string,
  adminPin?: string
) {
  const admin = await requireAdminSession();

  if (confirmationText.trim().toUpperCase() !== "DELETE") {
    return { error: "Confirmation text must be 'DELETE'." };
  }

  if (adminPin) {
    const isPinValid = await verifyAdminPinInternal(admin.id, adminPin);
    if (!isPinValid) {
      return { error: "Invalid Admin PIN." };
    }
  }

  const payment = await prisma.payment.findFirst({
    where: {
      OR: [{ id: paymentIdentifier }, { reference: paymentIdentifier }],
    },
    include: {
      customer: true,
      shipment: true,
      creditTransactions: true,
    },
  });

  if (!payment) {
    return { error: "Payment record not found." };
  }

  // Unlink foreign keys safely in atomic transaction without breaking relationships or Paystack
  await prisma.$transaction([
    prisma.creditTransaction.updateMany({
      where: { paymentId: payment.id },
      data: { paymentId: null },
    }),
    prisma.notification.updateMany({
      where: { paymentId: payment.id },
      data: { paymentId: null },
    }),
    prisma.payment.delete({
      where: { id: payment.id },
    }),
    prisma.auditLog.create({
      data: {
        action: "PAYMENT_DELETED",
        entityType: "Payment",
        entityId: payment.id,
        description: `Payment ${payment.reference} (${payment.currency || "GHS"} ${payment.amount}) deleted by ${admin.name}`,
        adminId: admin.id,
        metadata: {
          reference: payment.reference,
          amount: payment.amount,
          currency: payment.currency || "GHS",
          status: payment.status,
          customerIdentifier: payment.customer?.customerIdentifier || null,
          shipmentTrackingNumber: payment.shipment?.trackingNumber || null,
        },
      },
    }),
  ]);

  return { success: true, reference: payment.reference };
}

/**
 * Controlled Danger Zone: Test Data Cleanup
 * Only removes explicitly marked test records (e.g. prefix TEST-)
 * Requires Admin PIN verification.
 */
export async function cleanupTestDataAction(confirmationText: string, adminPin: string) {
  const admin = await requireAdminSession();

  if (confirmationText !== "DELETE TEST DATA") {
    return { error: "Confirmation text must exactly match 'DELETE TEST DATA'." };
  }

  if (!adminPin) {
    return { error: "Admin PIN is required for danger zone operations." };
  }

  const isPinValid = await verifyAdminPinInternal(admin.id, adminPin);
  if (!isPinValid) {
    return { error: "Invalid Admin PIN. Authentication failed." };
  }

  // Find test shipments (trackingNumber starts with TEST- or description contains [TEST])
  const testShipments = await prisma.shipment.findMany({
    where: {
      OR: [
        { trackingNumber: { startsWith: "TEST-" } },
        { description: { contains: "[TEST]" } },
      ],
    },
    include: { photos: true },
  });

  // Storage cleanup for test photos
  for (const s of testShipments) {
    for (const p of s.photos) {
      if (p.objectPath && !p.objectPath.startsWith("http")) {
        await deleteFileFromStorage(p.objectPath, p.bucket).catch(() => {});
      }
    }
  }

  const testShipmentIds = testShipments.map((s) => s.id);

  let deletedShipmentsCount = 0;
  if (testShipmentIds.length > 0) {
    await prisma.trackingEvent.deleteMany({
      where: { shipmentId: { in: testShipmentIds } },
    });
    await prisma.shipmentPhoto.deleteMany({
      where: { shipmentId: { in: testShipmentIds } },
    });
    await prisma.notification.deleteMany({
      where: { shipmentId: { in: testShipmentIds } },
    });
    const res = await prisma.shipment.deleteMany({
      where: { id: { in: testShipmentIds } },
    });
    deletedShipmentsCount = res.count;
  }

  // Delete test batches with 0 assigned shipments
  const testBatches = await prisma.batch.findMany({
    where: {
      OR: [
        { batchNumber: { startsWith: "TEST-" } },
        { name: { contains: "[TEST]" } },
      ],
      shipments: { none: {} },
    },
  });

  let deletedBatchesCount = 0;
  if (testBatches.length > 0) {
    const res = await prisma.batch.deleteMany({
      where: { id: { in: testBatches.map((b) => b.id) } },
    });
    deletedBatchesCount = res.count;
  }

  await prisma.auditLog.create({
    data: {
      action: "TEST_DATA_CLEANUP",
      entityType: "System",
      entityId: "test-data-purge",
      description: `Test data purge executed by ${admin.name}. Purged ${deletedShipmentsCount} test shipment(s) and ${deletedBatchesCount} test batch(es).`,
      adminId: admin.id,
      metadata: {
        deletedShipmentsCount,
        deletedBatchesCount,
      },
    },
  });

  return {
    success: true,
    deletedShipmentsCount,
    deletedBatchesCount,
  };
}

/**
 * Safe Bulk Reset / Delete Selected Records Action
 */
export async function deleteSelectedDataRecordsAction(
  entityType: "shipments" | "batches" | "customers" | "events" | "notifications" | "payments",
  recordIds: string[],
  confirmationText: string,
  adminPin?: string
) {
  const admin = await requireAdminSession();

  if (!Array.isArray(recordIds) || recordIds.length === 0) {
    return { error: "No records selected for deletion." };
  }

  if (confirmationText.trim().toUpperCase() !== "DELETE") {
    return { error: "Confirmation text must be 'DELETE'." };
  }

  if (adminPin) {
    const isPinValid = await verifyAdminPinInternal(admin.id, adminPin);
    if (!isPinValid) {
      return { error: "Invalid Admin PIN." };
    }
  }

  switch (entityType) {
    case "shipments": {
      const shipments = await prisma.shipment.findMany({
        where: {
          OR: [{ id: { in: recordIds } }, { trackingNumber: { in: recordIds } }],
        },
        include: {
          photos: true,
          trackingEvents: true,
          payments: true,
        },
      });

      if (shipments.length === 0) {
        return { error: "No matching shipment records found." };
      }

      const shipmentIds = shipments.map((s) => s.id);
      const trackingNumbers = shipments.map((s) => s.trackingNumber);

      for (const s of shipments) {
        for (const p of s.photos) {
          if (p.objectPath && !p.objectPath.startsWith("http")) {
            await deleteFileFromStorage(p.objectPath, p.bucket).catch(() => {});
          }
        }
      }

      await prisma.$transaction([
        prisma.payment.updateMany({
          where: { shipmentId: { in: shipmentIds } },
          data: { shipmentId: null },
        }),
        prisma.notification.deleteMany({
          where: { shipmentId: { in: shipmentIds } },
        }),
        prisma.shipmentPhoto.deleteMany({
          where: { shipmentId: { in: shipmentIds } },
        }),
        prisma.trackingEvent.deleteMany({
          where: { shipmentId: { in: shipmentIds } },
        }),
        prisma.shipment.deleteMany({
          where: { id: { in: shipmentIds } },
        }),
        prisma.auditLog.create({
          data: {
            action: "SHIPMENT_BULK_DELETED",
            entityType: "Shipment",
            entityId: shipmentIds.join(","),
            description: `Bulk deleted ${shipments.length} shipment(s) (${trackingNumbers.join(", ")}) by ${admin.name}`,
            adminId: admin.id,
            metadata: {
              count: shipments.length,
              trackingNumbers,
            },
          },
        }),
      ]);

      return {
        success: true,
        deletedCount: shipments.length,
        identifiers: trackingNumbers,
      };
    }

    case "batches": {
      const batches = await prisma.batch.findMany({
        where: {
          OR: [{ id: { in: recordIds } }, { batchNumber: { in: recordIds } }],
        },
        include: {
          shipments: { select: { id: true, trackingNumber: true } },
        },
      });

      if (batches.length === 0) {
        return { error: "No matching batch records found." };
      }

      const blockedBatches = batches.filter((b) => b.shipments.length > 0);
      if (blockedBatches.length > 0) {
        const details = blockedBatches
          .map((b) => `'${b.batchNumber}' (${b.shipments.length} assigned shipments)`)
          .join(", ");
        return {
          error: `Cannot delete selected batches. The following batch(es) contain active shipments: ${details}. Please reassign or delete their shipments first.`,
        };
      }

      const batchIds = batches.map((b) => b.id);
      const batchNumbers = batches.map((b) => b.batchNumber);

      await prisma.$transaction([
        prisma.shipmentPhoto.deleteMany({
          where: { batchId: { in: batchIds } },
        }),
        prisma.batch.deleteMany({
          where: { id: { in: batchIds } },
        }),
        prisma.auditLog.create({
          data: {
            action: "BATCH_BULK_DELETED",
            entityType: "Batch",
            entityId: batchIds.join(","),
            description: `Bulk deleted ${batches.length} batch(es) (${batchNumbers.join(", ")}) by ${admin.name}`,
            adminId: admin.id,
            metadata: {
              count: batches.length,
              batchNumbers,
            },
          },
        }),
      ]);

      return {
        success: true,
        deletedCount: batches.length,
        identifiers: batchNumbers,
      };
    }

    case "customers": {
      const customers = await prisma.customer.findMany({
        where: {
          OR: [{ id: { in: recordIds } }, { customerIdentifier: { in: recordIds } }],
        },
        include: {
          shipments: true,
          payments: true,
          sourcingRequests: true,
        },
      });

      if (customers.length === 0) {
        return { error: "No matching customer records found." };
      }

      const blockedCustomers = customers.filter(
        (c) => c.payments.length > 0 || c.shipments.length > 0 || c.sourcingRequests.length > 0
      );

      if (blockedCustomers.length > 0) {
        const details = blockedCustomers.map((c) => `'${c.customerIdentifier}'`).join(", ");
        return {
          error: `Cannot delete selected customer(s). The following account(s) have historical shipments/payments: ${details}. Please use 'Deactivate Customer' instead to preserve financial records.`,
        };
      }

      const customerIds = customers.map((c) => c.id);
      const customerIdentifiers = customers.map((c) => c.customerIdentifier);

      await prisma.$transaction([
        prisma.notification.deleteMany({
          where: { customerId: { in: customerIds } },
        }),
        prisma.creditTransaction.deleteMany({
          where: { customerId: { in: customerIds } },
        }),
        prisma.creditAccount.deleteMany({
          where: { customerId: { in: customerIds } },
        }),
        prisma.customer.deleteMany({
          where: { id: { in: customerIds } },
        }),
        prisma.auditLog.create({
          data: {
            action: "CUSTOMER_BULK_DELETED",
            entityType: "Customer",
            entityId: customerIds.join(","),
            description: `Bulk deleted ${customers.length} customer(s) (${customerIdentifiers.join(", ")}) by ${admin.name}`,
            adminId: admin.id,
            metadata: {
              count: customers.length,
              customerIdentifiers,
            },
          },
        }),
      ]);

      return {
        success: true,
        deletedCount: customers.length,
        identifiers: customerIdentifiers,
      };
    }

    case "events": {
      const events = await prisma.trackingEvent.findMany({
        where: { id: { in: recordIds } },
      });

      if (events.length === 0) {
        return { error: "No matching tracking events found." };
      }

      const eventIds = events.map((e) => e.id);

      await prisma.$transaction([
        prisma.trackingEvent.deleteMany({
          where: { id: { in: eventIds } },
        }),
        prisma.auditLog.create({
          data: {
            action: "TRACKING_EVENT_BULK_DELETED",
            entityType: "TrackingEvent",
            entityId: eventIds.join(","),
            description: `Bulk deleted ${events.length} tracking event(s) by ${admin.name}`,
            adminId: admin.id,
            metadata: {
              count: events.length,
            },
          },
        }),
      ]);

      return {
        success: true,
        deletedCount: events.length,
        identifiers: eventIds,
      };
    }

    case "notifications": {
      const notifications = await prisma.notification.findMany({
        where: { id: { in: recordIds } },
      });

      if (notifications.length === 0) {
        return { error: "No matching notifications found." };
      }

      const notifIds = notifications.map((n) => n.id);

      await prisma.$transaction([
        prisma.notification.deleteMany({
          where: { id: { in: notifIds } },
        }),
        prisma.auditLog.create({
          data: {
            action: "NOTIFICATION_BULK_DELETED",
            entityType: "Notification",
            entityId: notifIds.join(","),
            description: `Bulk deleted ${notifications.length} notification(s) by ${admin.name}`,
            adminId: admin.id,
            metadata: {
              count: notifications.length,
            },
          },
        }),
      ]);

      return {
        success: true,
        deletedCount: notifications.length,
        identifiers: notifIds,
      };
    }

    case "payments": {
      const payments = await prisma.payment.findMany({
        where: {
          OR: [{ id: { in: recordIds } }, { reference: { in: recordIds } }],
        },
        include: {
          customer: true,
          shipment: true,
        },
      });

      if (payments.length === 0) {
        return { error: "No matching payment records found." };
      }

      const paymentIds = payments.map((p) => p.id);
      const references = payments.map((p) => p.reference);

      await prisma.$transaction([
        prisma.creditTransaction.updateMany({
          where: { paymentId: { in: paymentIds } },
          data: { paymentId: null },
        }),
        prisma.notification.updateMany({
          where: { paymentId: { in: paymentIds } },
          data: { paymentId: null },
        }),
        prisma.payment.deleteMany({
          where: { id: { in: paymentIds } },
        }),
        prisma.auditLog.create({
          data: {
            action: "PAYMENT_BULK_DELETED",
            entityType: "Payment",
            entityId: paymentIds.join(","),
            description: `Bulk deleted ${payments.length} payment record(s) (${references.join(", ")}) by ${admin.name}`,
            adminId: admin.id,
            metadata: {
              count: payments.length,
              references,
            },
          },
        }),
      ]);

      return {
        success: true,
        deletedCount: payments.length,
        identifiers: references,
      };
    }

    default:
      return { error: "Invalid entity type for bulk deletion." };
  }
}

// ── OPERATIONAL DATA RESET SYSTEM ──────────────────────────────────────────

let isResetInProgress = false;

/**
 * 1. Generate live operational reset preview with real database counts
 */
export async function getOperationalResetPreviewAction(): Promise<OperationalResetPreviewResult> {
  const reqId = `prev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  try {
    await requireAdminSession();
    const { ensureResetAuditSchema } = await import("@/lib/reset-audit");
    await ensureResetAuditSchema();
    const { ensureEmailLogSchema } = await import("@/lib/email-log-schema");
    await ensureEmailLogSchema();

    const [
      shipmentsCount,
      trackingEventsCount,
      photosCount,
      sourcingRequestsCount,
      batchesCount,
      creditTransactionsCount,
      creditAccountsCount,
      paymentsCount,
      emailLogsCount,
      notificationsCount,
      auditLogsCount,
      // Protected records
      adminUsersCount,
      customersCount,
      brandSettingsCount,
      systemSettingsCount,
    ] = await Promise.all([
      prisma.shipment.count().catch(() => 0),
      prisma.trackingEvent.count().catch(() => 0),
      prisma.shipmentPhoto.count().catch(() => 0),
      prisma.sourcingRequest.count().catch(() => 0),
      prisma.batch.count().catch(() => 0),
      prisma.creditTransaction.count().catch(() => 0),
      prisma.creditAccount.count().catch(() => 0),
      prisma.payment.count().catch(() => 0),
      prisma.emailLog.count().catch(() => 0),
      prisma.notification.count().catch(() => 0),
      prisma.auditLog.count().catch(() => 0),
      prisma.adminUser.count().catch(() => 0),
      prisma.customer.count().catch(() => 0),
      prisma.brandSettings.count().catch(() => 1),
      prisma.systemSettings.count().catch(() => 1),
    ]);

    return {
      success: true,
      categories: {
        SHIPMENTS: {
          count: shipmentsCount,
          details: `${shipmentsCount} shipments, ${trackingEventsCount} tracking events, ${photosCount} photos`,
        },
        SOURCING_REQUESTS: {
          count: sourcingRequestsCount,
          details: `${sourcingRequestsCount} customer sourcing applications`,
        },
        BATCHES: {
          count: batchesCount,
          details: `${batchesCount} shipping batches`,
        },
        CREDIT_LEDGER: {
          count: creditTransactionsCount,
          details: `${creditTransactionsCount} transactions across ${creditAccountsCount} accounts`,
        },
        LOCAL_PAYMENTS: {
          count: paymentsCount,
          details: `${paymentsCount} local payment ledger records`,
        },
        EMAIL_LOGS_NOTIFICATIONS: {
          count: emailLogsCount + notificationsCount,
          details: `${emailLogsCount} email logs, ${notificationsCount} notifications`,
        },
        OPERATIONAL_AUDIT_LOGS: {
          count: auditLogsCount,
          details: `${auditLogsCount} administrative audit entries`,
        },
      },
      totalOperationalRecords:
        shipmentsCount +
        trackingEventsCount +
        photosCount +
        sourcingRequestsCount +
        batchesCount +
        creditTransactionsCount +
        paymentsCount +
        emailLogsCount +
        notificationsCount +
        auditLogsCount,
      protectedInfrastructure: {
        adminAccounts: adminUsersCount,
        customerAccounts: customersCount,
        brandSettings: brandSettingsCount,
        systemSettings: systemSettingsCount,
      },
      requestId: reqId,
    };
  } catch (err: any) {
    console.error(`[getOperationalResetPreviewAction][${reqId}] Error:`, err?.message || err);
    return {
      success: false,
      categories: {},
      totalOperationalRecords: 0,
      protectedInfrastructure: { adminAccounts: 0, customerAccounts: 0, brandSettings: 0, systemSettings: 0 },
      error: err?.message?.includes("Unauthorized")
        ? "Unauthorized access. Please log in as an administrator."
        : "Failed to load operational reset preview.",
      requestId: reqId,
    };
  }
}

/**
 * 2. Execute Operational Data Reset
 */
export async function executeOperationalResetAction(params: {
  mode: "ALL_OPERATIONAL" | "SELECTED_CATEGORIES";
  categories: string[];
  confirmationPhrase: string;
  adminPin: string;
}): Promise<{
  success: boolean;
  operationId?: string;
  deletedCounts?: Record<string, number>;
  pendingCleanup?: string[];
  error?: string;
}> {
  const admin = await requireAdminSession();
  const { ensureResetAuditSchema } = await import("@/lib/reset-audit");
  await ensureResetAuditSchema();

  const { mode, categories, confirmationPhrase, adminPin } = params;

  // Strict confirmation phrase
  if (confirmationPhrase.trim() !== "RESET LMX8 OPERATIONAL DATA") {
    return { success: false, error: "Confirmation phrase must exactly match 'RESET LMX8 OPERATIONAL DATA'." };
  }

  // Admin PIN is strictly required for operational resets
  if (!adminPin || adminPin.trim().length === 0) {
    return { success: false, error: "Admin PIN is required to authorize an operational data reset." };
  }

  const isPinValid = await verifyAdminPinInternal(admin.id, adminPin.trim());
  if (!isPinValid) {
    return { success: false, error: "Authentication failed. Invalid Admin PIN." };
  }

  // Prevent concurrent resets
  if (isResetInProgress) {
    return { success: false, error: "Another operational reset is currently in progress. Please wait." };
  }

  isResetInProgress = true;
  const operationId = `RESET-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const startedAt = new Date();

  const activeCategories = mode === "ALL_OPERATIONAL"
    ? ["SHIPMENTS", "SOURCING_REQUESTS", "BATCHES", "CREDIT_LEDGER", "LOCAL_PAYMENTS", "EMAIL_LOGS_NOTIFICATIONS", "OPERATIONAL_AUDIT_LOGS"]
    : categories.filter((c) =>
        ["SHIPMENTS", "SOURCING_REQUESTS", "BATCHES", "CREDIT_LEDGER", "LOCAL_PAYMENTS", "EMAIL_LOGS_NOTIFICATIONS", "OPERATIONAL_AUDIT_LOGS"].includes(c)
      );

  if (activeCategories.length === 0) {
    isResetInProgress = false;
    return { success: false, error: "At least one valid operational category must be selected." };
  }

  try {
    const { ensureResetAuditSchema, isResetAuditTableAvailable } = await import("@/lib/reset-audit");
    await ensureResetAuditSchema();
    const hasResetAuditTable = await isResetAuditTableAvailable();

    const { ensureEmailLogSchema, isEmailLogTableAvailable } = await import("@/lib/email-log-schema");
    await ensureEmailLogSchema(true);
    const hasEmailLogTable = await isEmailLogTableAvailable();

    // 1. Snapshot counts before
    const [
      bShipments,
      bTracking,
      bPhotos,
      bSourcing,
      bBatches,
      bCredits,
      bPayments,
      bEmails,
      bNotifications,
      bAudits,
    ] = await Promise.all([
      prisma.shipment.count(),
      prisma.trackingEvent.count(),
      prisma.shipmentPhoto.count(),
      prisma.sourcingRequest.count(),
      prisma.batch.count(),
      prisma.creditTransaction.count(),
      prisma.payment.count(),
      hasEmailLogTable ? prisma.emailLog.count().catch(() => 0) : Promise.resolve(0),
      prisma.notification.count(),
      prisma.auditLog.count(),
    ]);

    const countsBefore: Record<string, number> = {
      shipments: bShipments,
      trackingEvents: bTracking,
      photos: bPhotos,
      sourcingRequests: bSourcing,
      batches: bBatches,
      creditTransactions: bCredits,
      payments: bPayments,
      emailLogs: bEmails,
      notifications: bNotifications,
      auditLogs: bAudits,
    };

    const pendingCleanup: string[] = [];

    // 2. Identify Shipment Photos for storage cleanup ONLY after the DB transaction succeeds
    let photosToDelete: Array<{ objectPath: string; bucket: string }> = [];
    if (activeCategories.includes("SHIPMENTS")) {
      photosToDelete = await prisma.shipmentPhoto.findMany({
        where: { status: { not: "DELETED" } },
        select: { objectPath: true, bucket: true },
      });
    }

    // 3. Foreign-key safe database deletions in a single atomic transaction
    await prisma.$transaction(async (tx) => {
      // Step A: Email logs & notifications
      if (activeCategories.includes("EMAIL_LOGS_NOTIFICATIONS")) {
        if (hasEmailLogTable) {
          await tx.emailLog.deleteMany({});
        }
        await tx.notification.deleteMany({});
      }

      // Step B: Sourcing Requests
      if (activeCategories.includes("SOURCING_REQUESTS")) {
        await tx.sourcingRequest.deleteMany({});
      }

      // Step C: Credit Ledger
      if (activeCategories.includes("CREDIT_LEDGER")) {
        await tx.creditTransaction.deleteMany({});
        await tx.creditAccount.updateMany({
          data: {
            balance: 0,
            creditsRemaining: 0,
            creditsUsed: 0,
            creditsPurchased: 0,
            lastActivityAt: new Date(),
          },
        });
      }

      // Step D: Local Payments
      if (activeCategories.includes("LOCAL_PAYMENTS")) {
        // Disconnect relations before deleting payments
        await tx.creditTransaction.updateMany({
          where: { paymentId: { not: null } },
          data: { paymentId: null },
        });
        await tx.notification.updateMany({
          where: { paymentId: { not: null } },
          data: { paymentId: null },
        });
        await tx.payment.deleteMany({});
      }

      // Step E: Shipments & dependent tracking events/photos
      if (activeCategories.includes("SHIPMENTS")) {
        // Unlink payments if payments category wasn't wiped
        await tx.payment.updateMany({
          where: { shipmentId: { not: null } },
          data: { shipmentId: null },
        });
        if (hasEmailLogTable) {
          await tx.emailLog.updateMany({
            where: { shipmentId: { not: null } },
            data: { shipmentId: null },
          });
        }
        await tx.notification.updateMany({
          where: { shipmentId: { not: null } },
          data: { shipmentId: null },
        });
        await tx.trackingEvent.deleteMany({});
        await tx.shipmentPhoto.deleteMany({});
        await tx.shipment.deleteMany({});
      }

      // Step F: Batches
      if (activeCategories.includes("BATCHES")) {
        await tx.shipment.updateMany({
          where: { batchId: { not: null } },
          data: { batchId: null },
        });
        if (hasEmailLogTable) {
          await tx.emailLog.updateMany({
            where: { batchId: { not: null } },
            data: { batchId: null },
          });
        }
        await tx.batch.deleteMany({});
      }

      // Step G: General Audit Logs (preserving ResetAudit)
      if (activeCategories.includes("OPERATIONAL_AUDIT_LOGS")) {
        await tx.auditLog.deleteMany({});
      }
    });

    // 4. Perform photo file storage cleanup only after DB transaction commits successfully
    if (photosToDelete.length > 0) {
      for (const p of photosToDelete) {
        if (p.objectPath && !p.objectPath.startsWith("http")) {
          try {
            await deleteFileFromStorage(p.objectPath, p.bucket);
          } catch {
            pendingCleanup.push(p.objectPath);
          }
        }
      }
    }

    // 5. Snapshot counts after
    const [
      aShipments,
      aTracking,
      aPhotos,
      aSourcing,
      aBatches,
      aCredits,
      aPayments,
      aEmails,
      aNotifications,
      aAudits,
    ] = await Promise.all([
      prisma.shipment.count(),
      prisma.trackingEvent.count(),
      prisma.shipmentPhoto.count(),
      prisma.sourcingRequest.count(),
      prisma.batch.count(),
      prisma.creditTransaction.count(),
      prisma.payment.count(),
      hasEmailLogTable ? prisma.emailLog.count().catch(() => 0) : Promise.resolve(0),
      prisma.notification.count(),
      prisma.auditLog.count(),
    ]);

    const countsAfter: Record<string, number> = {
      shipments: aShipments,
      trackingEvents: aTracking,
      photos: aPhotos,
      sourcingRequests: aSourcing,
      batches: aBatches,
      creditTransactions: aCredits,
      payments: aPayments,
      emailLogs: aEmails,
      notifications: aNotifications,
      auditLogs: aAudits,
    };

    // 6. Persist permanent ResetAudit record (survives any reset)
    if (hasResetAuditTable) {
      try {
        await prisma.resetAudit.create({
          data: {
            operationId,
            adminId: admin.id,
            adminName: admin.name,
            adminEmail: admin.email,
            resetMode: mode,
            selectedCategories: activeCategories,
            countsBefore,
            countsAfter,
            startedAt,
            completedAt: new Date(),
            status: "SUCCESS",
            pendingCleanup: pendingCleanup.length > 0 ? (pendingCleanup as unknown as import("@prisma/client").Prisma.InputJsonValue) : undefined,
          },
        });
      } catch (auditErr) {
        console.warn("[executeOperationalResetAction] Notice persisting success ResetAudit:", auditErr);
      }
    }

    isResetInProgress = false;

    return {
      success: true,
      operationId,
      deletedCounts: {
        shipments: Math.max(0, bShipments - aShipments),
        trackingEvents: Math.max(0, bTracking - aTracking),
        sourcingRequests: Math.max(0, bSourcing - aSourcing),
        batches: Math.max(0, bBatches - aBatches),
        creditTransactions: Math.max(0, bCredits - aCredits),
        payments: Math.max(0, bPayments - aPayments),
        emailLogs: Math.max(0, bEmails - aEmails),
        notifications: Math.max(0, bNotifications - aNotifications),
        auditLogs: Math.max(0, bAudits - aAudits),
      },
      pendingCleanup,
    };
  } catch (err: any) {
    isResetInProgress = false;
    console.error("[executeOperationalResetAction] Error:", err);

    // Record failure in ResetAudit
    try {
      const { isResetAuditTableAvailable } = await import("@/lib/reset-audit");
      const hasResetAuditTable = await isResetAuditTableAvailable();
      if (hasResetAuditTable) {
        await prisma.resetAudit.create({
          data: {
            operationId,
            adminId: admin.id,
            adminName: admin.name,
            adminEmail: admin.email,
            resetMode: mode,
            selectedCategories: activeCategories,
            countsBefore: {},
            countsAfter: {},
            startedAt,
            completedAt: new Date(),
            status: "FAILED",
            errorMessage: err?.message || String(err),
          },
        });
      }
    } catch {}

    return {
      success: false,
      error: `Reset failed: ${err?.message || "Internal database transaction error."}`,
    };
  }
}

/**
 * 3. Fetch past operational reset audits
 */
export async function getResetAuditHistoryAction() {
  try {
    await requireAdminSession();
    const { getResetAuditHistory } = await import("@/lib/reset-audit");
    const history = await getResetAuditHistory();
    return Array.isArray(history) ? history : [];
  } catch (err: any) {
    console.error("[getResetAuditHistoryAction] Error:", err);
    return [];
  }
}

