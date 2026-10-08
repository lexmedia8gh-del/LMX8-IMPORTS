"use server";

import { prisma } from "@/lib/prisma";
import { requireCustomerSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ── INTERNAL helpers (server-side only, not exported as actions) ──────────────

/**
 * Create a notification safely. Deduplicates via idempotencyKey.
 * Should be called from server-side business logic (webhooks, actions).
 */
export async function createNotificationInternal({
  customerId,
  type,
  title,
  message,
  actionUrl,
  idempotencyKey,
  shipmentId,
  paymentId,
}: {
  customerId: string;
  type: "SHIPMENT" | "PAYMENT" | "DELIVERY" | "ACCOUNT" | "SYSTEM";
  title: string;
  message: string;
  actionUrl?: string;
  idempotencyKey?: string;
  shipmentId?: string;
  paymentId?: string;
}) {
  try {
    if (idempotencyKey) {
      const existing = await prisma.notification.findUnique({
        where: { idempotencyKey },
      });
      if (existing) return existing; // Already exists — idempotent
    }

    return await prisma.notification.create({
      data: {
        customerId,
        type,
        title,
        message,
        actionUrl,
        idempotencyKey,
        shipmentId,
        paymentId,
      },
    });
  } catch (err) {
    // Don't throw — notification failures should never break business logic
    console.error("createNotification failed:", err);
    return null;
  }
}

// ── CUSTOMER-FACING SERVER ACTIONS ────────────────────────────────────────────

/** Fetch the authenticated customer's notifications (latest 50). */
export async function getNotificationsAction() {
  const customer = await requireCustomerSession();

  const notifications = await prisma.notification.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    read: n.read,
    actionUrl: n.actionUrl,
    shipmentId: n.shipmentId,
    paymentId: n.paymentId,
    createdAt: n.createdAt.toISOString(),
  }));
}

/** Count unread notifications for the authenticated customer. */
export async function getUnreadCountAction(): Promise<number> {
  const customer = await requireCustomerSession();
  return prisma.notification.count({
    where: { customerId: customer.id, read: false },
  });
}

/** Mark a single notification as read (customer must own it). */
export async function markNotificationReadAction(notificationId: string) {
  const customer = await requireCustomerSession();

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification || notification.customerId !== customer.id) {
    return { error: "Notification not found." };
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });

  revalidatePath("/portal/notifications");
  return { success: true };
}

/** Mark ALL of the authenticated customer's notifications as read. */
export async function markAllNotificationsReadAction() {
  const customer = await requireCustomerSession();

  await prisma.notification.updateMany({
    where: { customerId: customer.id, read: false },
    data: { read: true },
  });

  revalidatePath("/portal/notifications");
  return { success: true };
}

// ── ADMIN-FACING SERVER ACTIONS ──────────────────────────────────────────────

export async function getAdminNotificationsAndAuditAction() {
  const { requireAdminSession } = await import("@/lib/auth");
  await requireAdminSession();

  const [notifications, auditLogs] = await Promise.all([
    prisma.notification.findMany({
      include: {
        customer: {
          select: { id: true, name: true, customerIdentifier: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.auditLog.findMany({
      include: {
        admin: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { timestamp: "desc" },
      take: 60,
    }),
  ]);

  return {
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      actionUrl: n.actionUrl,
      createdAt: n.createdAt.toISOString(),
      customer: n.customer ? {
        id: n.customer.id,
        name: n.customer.name,
        customerIdentifier: n.customer.customerIdentifier,
      } : null,
    })),
    auditLogs: auditLogs.map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      description: a.description || "",
      timestamp: a.timestamp.toISOString(),
      adminName: a.admin?.name || "System Admin",
      adminRole: a.admin?.role || "ADMIN",
    })),
  };
}
