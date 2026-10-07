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

export async function sendTestEmailAction(recipientEmail: string): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
  category?: string;
  provider: "brevo";
}> {
  try {
    const admin = await requireAdminSession();
    await ensureEmailLogSchema();

    const cleanEmail = recipientEmail?.trim();
    if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      return {
        success: false,
        error: "Please provide a valid recipient email address.",
        category: "VALIDATION_ERROR",
        provider: "brevo",
      };
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

    // Resolve valid Customer record for foreign key integrity
    let customerId: string | null = null;
    try {
      const existingCustomer = await prisma.customer.findFirst({ select: { id: true } });
      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const sysCustomer = await prisma.customer.upsert({
          where: { customerIdentifier: "SYS-DIAG" },
          update: {},
          create: {
            customerIdentifier: "SYS-DIAG",
            name: "System Diagnostic",
            phone: "+233000000000",
            email: "system@lmx8imports.com",
          },
          select: { id: true },
        });
        customerId = sysCustomer.id;
      }
    } catch (custErr) {
      console.warn("[sendTestEmailAction] Could not resolve customer for email log:", custErr);
    }

    let logCreated = false;
    if (customerId) {
      try {
        await prisma.emailLog.create({
          data: {
            customerId,
            eventType: "DIAGNOSTIC_TEST",
            status: "PENDING",
            recipient: cleanEmail,
            subject,
            idempotencyKey,
          },
        });
        logCreated = true;
      } catch (dbErr) {
        console.warn("[sendTestEmailAction] DB emailLog create bypassed:", dbErr);
      }
    }

    const result = await sendBrevoEmail({
      to: [{ email: cleanEmail, name: admin.name || "Admin" }],
      subject,
      htmlContent,
    });

    if (logCreated) {
      try {
        await prisma.emailLog.update({
          where: { idempotencyKey },
          data: {
            status: result.success ? "SENT" : "FAILED",
            providerMessageId: result.messageId || null,
            sentAt: result.success ? new Date() : undefined,
            failedAt: result.success ? undefined : new Date(),
            errorMessage: result.error || null,
          },
        });
      } catch (dbUpdateErr) {
        console.warn("[sendTestEmailAction] DB emailLog update bypassed:", dbUpdateErr);
      }
    }

    try {
      revalidatePath("/admin/emails");
    } catch (revalErr) {
      console.warn("[sendTestEmailAction] revalidatePath bypassed:", revalErr);
    }

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
      category: result.category || (result.success ? "SUCCESS" : "BREVO_API_ERROR"),
      provider: "brevo",
    };
  } catch (err: any) {
    console.error("[sendTestEmailAction] Top-level failure:", err);
    return {
      success: false,
      error: typeof err?.message === "string" ? err.message : "Internal application error dispatching test email.",
      category: "APPLICATION_ERROR",
      provider: "brevo",
    };
  }
}

export async function retryEmailLogAction(logId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminSession();
    await ensureEmailLogSchema();

    const log = await prisma.emailLog.findUnique({
      where: { id: logId },
    });

    if (!log) {
      return { success: false, error: "Email log record not found." };
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
      } else if (isBrevoEmailMilestone(log.eventType) || (log.eventType && ["SHIPMENT_ORDER_CONFIRMED", "SHIPMENT_PREPARING", "SHIPMENT_DEPARTED_CHINA", "SHIPMENT_IN_TRANSIT", "SHIPMENT_ARRIVED_GHANA", "SHIPMENT_CUSTOMS_CLEARANCE"].includes(log.eventType))) {
        const milestoneMap: Record<string, any> = {
          SHIPMENT_ORDER_CONFIRMED: "SHIPMENT_CREATED",
          SHIPMENT_PREPARING: "PREPARING_SHIPMENT",
          SHIPMENT_DEPARTED_CHINA: "SHIPPED",
          SHIPMENT_IN_TRANSIT: "IN_TRANSIT",
          SHIPMENT_ARRIVED_GHANA: "ARRIVED_AT_DESTINATION",
          SHIPMENT_CUSTOMS_CLEARANCE: "CUSTOMS_CLEARANCE",
        };
        const targetMilestone = milestoneMap[log.eventType] || log.eventType;
        if (log.shipmentId) {
          result = await sendShipmentMilestoneEmail({ shipmentId: log.shipmentId, milestone: targetMilestone });
        } else {
          result = { success: false, error: "Shipment ID missing on log." };
        }
      } else {
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
    } catch (execErr: any) {
      result = { success: false, error: execErr?.message || "Execution exception during retry." };
    }

    if (result.success) {
      await prisma.emailLog.update({
        where: { id: logId },
        data: {
          status: "SENT",
          sentAt: new Date(),
          errorMessage: null,
        },
      }).catch(() => {});
      try { revalidatePath("/admin/emails"); } catch {}
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
      try { revalidatePath("/admin/emails"); } catch {}
      return { success: false, error: result.error };
    }
  } catch (err: any) {
    console.error("[retryEmailLogAction] Top-level failure:", err);
    return { success: false, error: err?.message || "Failed to retry email log." };
  }
}
