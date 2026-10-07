"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { sendBrevoEmail, ensureEmailLogSchema, getBrevoDiagnostics } from "@/lib/email/brevo";
import { revalidatePath } from "next/cache";

export async function getEmailDiagnosticsAction() {
  await requireAdminSession();
  await ensureEmailLogSchema();

  const config = getBrevoDiagnostics();

  try {
    const logs = await prisma.emailLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 150,
      include: {
        customer: {
          select: { name: true, customerIdentifier: true, email: true },
        },
        shipment: {
          select: { trackingNumber: true },
        },
      },
    });

    const stats = {
      total: logs.length,
      sent: logs.filter((l) => l.status === "SENT").length,
      failed: logs.filter((l) => l.status === "FAILED").length,
      pending: logs.filter((l) => l.status === "PENDING").length,
      skipped: logs.filter((l) => l.status === "SKIPPED").length,
    };

    return {
      success: true,
      config,
      stats,
      logs: logs.map((l) => ({
        id: l.id,
        eventType: l.eventType,
        status: l.status,
        recipient: l.recipient,
        subject: l.subject,
        providerMessageId: l.providerMessageId || null,
        errorMessage: l.errorMessage || null,
        createdAt: l.createdAt.toISOString(),
        customerName: l.customer?.name || "Unknown",
        customerIdentifier: l.customer?.customerIdentifier || "",
        trackingNumber: l.shipment?.trackingNumber || null,
      })),
    };
  } catch (err: any) {
    console.error("[getEmailDiagnosticsAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Failed to load email diagnostics.",
      config,
      stats: { total: 0, sent: 0, failed: 0, pending: 0, skipped: 0 },
      logs: [],
    };
  }
}

export async function sendTestEmailAction(recipientEmail: string) {
  const admin = await requireAdminSession();
  await ensureEmailLogSchema();

  const cleanEmail = recipientEmail?.trim();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { error: "Please provide a valid recipient email address." };
  }

  const subject = `LMX8 IMPORTS — Brevo Diagnostic Test (${new Date().toLocaleTimeString()})`;
  const htmlContent = `
    <div style="font-family: sans-serif; padding: 24px; background: #F8FAFC; border-radius: 12px; color: #172236;">
      <h2 style="color: #141B47; margin-top: 0;">LMX8 IMPORTS — Brevo Diagnostic Test</h2>
      <p>This is a test email dispatched from the <strong>LMX8 IMPORTS Ctrl Room</strong> diagnostic dashboard.</p>
      <p><strong>Triggered By:</strong> Admin (${admin.name || admin.email})</p>
      <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 16px 0;" />
      <p style="font-size: 12px; color: #64748B;">If you received this email, Brevo REST API v3 integration is fully operational and authenticated.</p>
    </div>
  `;

  const idempotencyKey = `diagnostic-test-${Date.now()}`;

  // Record pending log
  await prisma.emailLog.create({
    data: {
      customerId: admin.id, // fallback association
      eventType: "DIAGNOSTIC_TEST",
      status: "PENDING",
      recipient: cleanEmail,
      subject,
      idempotencyKey,
    },
  });

  const result = await sendBrevoEmail({
    to: [{ email: cleanEmail, name: admin.name || "Admin" }],
    subject,
    htmlContent,
  });

  if (result.success) {
    await prisma.emailLog.update({
      where: { idempotencyKey },
      data: {
        status: "SENT",
        providerMessageId: result.messageId || null,
        sentAt: new Date(),
      },
    });
    revalidatePath("/admin/emails");
    return { success: true, messageId: result.messageId };
  } else {
    await prisma.emailLog.update({
      where: { idempotencyKey },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        errorMessage: result.error || "Failed to dispatch test email.",
      },
    });
    revalidatePath("/admin/emails");
    return { success: false, error: result.error || "Brevo API returned an error." };
  }
}

export async function retryEmailLogAction(logId: string) {
  await requireAdminSession();
  await ensureEmailLogSchema();

  const log = await prisma.emailLog.findUnique({
    where: { id: logId },
  });

  if (!log) {
    return { error: "Email log record not found." };
  }

  const { 
    sendCustomerCreatedEmail, 
    sendSourcingRequestCreatedEmail, 
    sendShipmentCreatedEmail, 
    sendShipmentMilestoneEmail, 
    sendShippingFeeReminderEmail, 
    sendCreditPurchaseSuccessEmail, 
    sendShippingFeePaidSuccessEmail,
    isBrevoEmailMilestone,
    sendBrevoEmail
  } = await import("@/lib/email/brevo");

  let result: { success: boolean; error?: string } = { success: false, error: "Unsupported event type for retry" };

  try {
    if (log.eventType === "CUSTOMER_WELCOME") {
      result = await sendCustomerCreatedEmail(log.customerId);
    } else if (log.eventType === "SOURCING_REQUEST_CREATED") {
      const requestId = log.idempotencyKey.replace("sourcing-created-", "");
      result = await sendSourcingRequestCreatedEmail(requestId);
    } else if (log.eventType === "SHIPMENT_CREATED") {
      if (log.shipmentId) {
        result = await sendShipmentCreatedEmail(log.shipmentId);
      } else {
        result = { success: false, error: "Shipment ID missing on log." };
      }
    } else if (log.eventType === "CREDIT_PURCHASE_SUCCESS") {
      const paymentRef = log.idempotencyKey.replace("credit-purchase-success-", "");
      const p = await prisma.payment.findUnique({ where: { reference: paymentRef } });
      if (p) {
        result = await sendCreditPurchaseSuccessEmail(p.id);
      } else {
        result = { success: false, error: "Associated payment not found." };
      }
    } else if (log.eventType === "SHIPPING_FEE_PAID") {
      const paymentRef = log.idempotencyKey.replace("shipping-fee-success-", "");
      const p = await prisma.payment.findUnique({ where: { reference: paymentRef } });
      if (p) {
        result = await sendShippingFeePaidSuccessEmail(p.id);
      } else {
        result = { success: false, error: "Associated payment not found." };
      }
    } else if (log.eventType === "SHIPPING_FEE_REMINDER") {
      if (log.shipmentId) {
        result = await sendShippingFeeReminderEmail({ shipmentId: log.shipmentId, force: true });
      } else {
        result = { success: false, error: "Shipment ID missing on log." };
      }
    } else if (isBrevoEmailMilestone(log.eventType)) {
      if (log.shipmentId) {
        result = await sendShipmentMilestoneEmail({ shipmentId: log.shipmentId, milestone: log.eventType as any });
      } else {
        result = { success: false, error: "Shipment ID missing on log." };
      }
    } else {
      // Fallback manual dispatch for test / generic emails
      const r = await sendBrevoEmail({
        to: [{ email: log.recipient }],
        subject: log.subject,
        htmlContent: `
          <div style="font-family: sans-serif; padding: 24px; background: #F8FAFC; border-radius: 12px; color: #172236; border: 1px solid #E2E8F0;">
            <h3 style="color: #141B47; margin-top: 0;">LMX8 IMPORTS (Retry Statement)</h3>
            <p><strong>Original Event:</strong> ${log.eventType}</p>
            <p><strong>Original Subject:</strong> ${log.subject}</p>
            <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 16px 0;" />
            <p style="font-size: 11px; color: #64748B;">This is a system-triggered diagnostic retry dispatch.</p>
          </div>
        `,
      });
      result = { success: r.success, error: r.error };
    }
  } catch (err: any) {
    result = { success: false, error: err?.message || "Execution exception during retry." };
  }

  if (result.success) {
    // If the helper updated a separate row or we used the fallback, make sure this logId row is synced
    await prisma.emailLog.update({
      where: { id: logId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        errorMessage: null,
      },
    }).catch(() => {});
    revalidatePath("/admin/emails");
    return { success: true };
  } else {
    await prisma.emailLog.update({
      where: { id: logId },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        errorMessage: result.error || "Retry failed.",
      },
    }).catch(() => {});
    revalidatePath("/admin/emails");
    return { success: false, error: result.error };
  }
}
