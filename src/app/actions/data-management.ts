"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireAdminSession } from "@/lib/auth";
import { deleteFileFromStorage } from "@/lib/storage";

/**
 * Overview statistics for Admin Data Management dashboard
 */
export async function getDatabaseOverviewAction() {
  await requireAdminSession();

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
    prisma.customer.count(),
    prisma.batch.count(),
    prisma.shipment.count(),
    prisma.trackingEvent.count(),
    prisma.payment.count(),
    prisma.notification.count(),
    prisma.sourcingRequest.count(),
    prisma.shipmentPhoto.count(),
    prisma.auditLog.count(),
  ]);

  return {
    customers: customersCount,
    batches: batchesCount,
    shipments: shipmentsCount,
    trackingEvents: trackingEventsCount,
    payments: paymentsCount,
    notifications: notificationsCount,
    sourcingRequests: sourcingRequestsCount,
    photos: photosCount,
    auditLogs: auditLogsCount,
  };
}

/**
 * Fetch records for Data Management tabular explorer
 */
export async function getDataRecordsAction(entityType: "shipments" | "batches" | "customers" | "events" | "notifications") {
  await requireAdminSession();

  switch (entityType) {
    case "shipments": {
      const records = await prisma.shipment.findMany({
        include: {
          customer: { select: { id: true, customerIdentifier: true, name: true } },
          batch: { select: { id: true, batchNumber: true, name: true, status: true } },
          trackingEvents: { select: { id: true } },
          photos: { select: { id: true } },
          payments: { select: { id: true, status: true, amount: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      return records.map((s) => ({
        id: s.id,
        trackingNumber: s.trackingNumber,
        description: s.description,
        status: s.status,
        createdAt: s.createdAt.toISOString(),
        customer: s.customer ? `${s.customer.name} (${s.customer.customerIdentifier})` : "N/A",
        customerId: s.customerId,
        customerIdentifier: s.customer?.customerIdentifier || s.customerId,
        batch: s.batch ? `${s.batch.name} (${s.batch.batchNumber})` : "Unassigned",
        batchId: s.batchId,
        eventsCount: s.trackingEvents.length,
        photosCount: s.photos.length,
        paymentsCount: s.payments.length,
        hasPaidPayments: s.payments.some((p) => p.status === "SUCCESS"),
      }));
    }

    case "batches": {
      const records = await prisma.batch.findMany({
        include: {
          shipments: { select: { id: true, trackingNumber: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      return records.map((b) => ({
        id: b.id,
        batchNumber: b.batchNumber,
        name: b.name,
        description: b.description || "",
        status: b.status,
        shipmentsCount: b.shipments.length,
        departure: b.departure ? b.departure.toISOString().split("T")[0] : null,
        arrival: b.arrival ? b.arrival.toISOString().split("T")[0] : null,
        closedAt: b.closedAt ? b.closedAt.toISOString() : null,
        fileDeletionAt: b.fileDeletionAt ? b.fileDeletionAt.toISOString() : null,
        createdAt: b.createdAt.toISOString(),
      }));
    }

    case "customers": {
      const records = await prisma.customer.findMany({
        include: {
          shipments: { select: { id: true } },
          payments: { select: { id: true, status: true } },
          sourcingRequests: { select: { id: true } },
          creditAccount: { select: { balance: true } },
          notifications: { select: { id: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      return records.map((c) => ({
        id: c.id,
        customerIdentifier: c.customerIdentifier,
        name: c.name,
        phone: c.phone || "N/A",
        email: c.email || "N/A",
        status: c.status,
        credits: c.creditAccount?.balance || 0,
        shipmentsCount: c.shipments.length,
        paymentsCount: c.payments.length,
        sourcingCount: c.sourcingRequests.length,
        notificationsCount: c.notifications.length,
        createdAt: c.createdAt.toISOString(),
      }));
    }

    case "events": {
      const records = await prisma.trackingEvent.findMany({
        include: {
          shipment: { select: { id: true, trackingNumber: true, description: true } },
          admin: { select: { id: true, name: true, email: true } },
        },
        orderBy: { timestamp: "desc" },
        take: 100,
      });

      return records.map((e) => ({
        id: e.id,
        status: e.status,
        location: e.location || "N/A",
        note: e.note || "N/A",
        timestamp: e.timestamp.toISOString(),
        shipmentTrackingNumber: e.shipment?.trackingNumber || "N/A",
        shipmentDescription: e.shipment?.description || "N/A",
        adminName: e.admin?.name || e.admin?.email || "System",
      }));
    }

    case "notifications": {
      const records = await prisma.notification.findMany({
        include: {
          customer: { select: { id: true, customerIdentifier: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      return records.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        read: n.read,
        customerName: n.customer?.name || "N/A",
        customerIdentifier: n.customer?.customerIdentifier || "N/A",
        createdAt: n.createdAt.toISOString(),
      }));
    }

    default:
      return [];
  }
}

/**
 * Deep inspection of a record's dependencies and relationships before deletion
 */
export async function getRecordRelationshipsAction(entityType: string, recordId: string) {
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
      });

      return {
        id: shipment.id,
        trackingNumber: shipment.trackingNumber,
        description: shipment.description,
        customer: {
          id: shipment.customer.id,
          name: shipment.customer.name,
          identifier: shipment.customer.customerIdentifier,
        },
        batch: shipment.batch
          ? {
              id: shipment.batch.id,
              batchNumber: shipment.batch.batchNumber,
              name: shipment.batch.name,
            }
          : null,
        relationships: {
          trackingEventsCount: shipment.trackingEvents.length,
          photosCount: shipment.photos.length,
          paymentsCount: shipment.payments.length,
          notificationsCount: notifsCount,
        },
        warnings: shipment.payments.some((p) => p.status === "SUCCESS")
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
      });

      const canDelete = batch.shipments.length === 0;

      return {
        id: batch.id,
        batchNumber: batch.batchNumber,
        name: batch.name,
        description: batch.description,
        status: batch.status,
        relationships: {
          shipmentsCount: batch.shipments.length,
          photosCount,
        },
        assignedShipments: batch.shipments.map((s) => s.trackingNumber),
        warnings:
          batch.shipments.length > 0
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
        customer.payments.length > 0 ||
        customer.shipments.length > 0 ||
        customer.sourcingRequests.length > 0;

      return {
        id: customer.id,
        customerIdentifier: customer.customerIdentifier,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        status: customer.status,
        relationships: {
          shipmentsCount: customer.shipments.length,
          paymentsCount: customer.payments.length,
          sourcingRequestsCount: customer.sourcingRequests.length,
          creditBalance: customer.creditAccount?.balance || 0,
          notificationsCount: customer.notifications.length,
        },
        warnings: hasHistory
          ? [
              "This customer account contains historical logistics or financial records. To preserve audit and accounting integrity, use 'Deactivate Customer' instead of permanent deletion.",
            ]
          : [],
        canDelete: !hasHistory,
      };
    }

    default:
      return null;
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
