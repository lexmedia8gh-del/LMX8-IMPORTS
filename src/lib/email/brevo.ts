import "server-only";
import { prisma } from "@/lib/prisma";
import { ShipmentStatus, SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_ADMIN_LABELS } from "@/components/shipment-status";

// ─────────────────────────────────────────────────────────────────────────────
// Brevo Configuration & Constants
// ─────────────────────────────────────────────────────────────────────────────
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "LEXMEDIA.GH";
const DEFAULT_SENDER_EMAIL = "lexmedia8gh@gmail.com";

// Milestone definition: ONLY these 6 stages trigger Brevo emails
export const BREVO_EMAIL_MILESTONES = [
  "SHIPMENT_CREATED",
  "SHIPPED",
  "ARRIVED_AT_DESTINATION",
  "CUSTOMS_CLEARANCE",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const;

export type BrevoMilestone = (typeof BREVO_EMAIL_MILESTONES)[number];

export function isBrevoEmailMilestone(status: string): status is BrevoMilestone {
  return (BREVO_EMAIL_MILESTONES as readonly string[]).includes(status);
}

// Milestone-specific factual descriptions (Anti-marketing, clear and direct)
export const MILESTONE_EMAIL_MESSAGES: Record<BrevoMilestone, string> = {
  SHIPMENT_CREATED: "Your order has been confirmed and is being registered in the LMX8 IMPORTS system.",
  SHIPPED: "Your shipment has departed China and is now on its way to Ghana.",
  ARRIVED_AT_DESTINATION: "Your shipment has arrived in Ghana.",
  CUSTOMS_CLEARANCE: "Your shipment is currently undergoing customs clearance.",
  OUT_FOR_DELIVERY: "Your shipment has been released for delivery.",
  DELIVERED: "Your shipment has been marked as delivered.",
};

// Milestone-specific email subjects (Dynamic batch substitution)
export function getMilestoneEmailSubject(milestone: BrevoMilestone, batchDisplay: string): string {
  const batchPrefix = batchDisplay ? ` — ${batchDisplay}` : "";
  switch (milestone) {
    case "SHIPMENT_CREATED":
      return `LMX8 IMPORTS${batchPrefix} Order Confirmed`;
    case "SHIPPED":
      return `LMX8 IMPORTS${batchPrefix} Shipment Has Departed China`;
    case "ARRIVED_AT_DESTINATION":
      return `LMX8 IMPORTS${batchPrefix} Shipment Has Arrived in Ghana`;
    case "CUSTOMS_CLEARANCE":
      return `LMX8 IMPORTS${batchPrefix} Shipment Is Under Customs Clearance`;
    case "OUT_FOR_DELIVERY":
      return `LMX8 IMPORTS${batchPrefix} Shipment Is Out for Delivery`;
    case "DELIVERED":
      return `LMX8 IMPORTS${batchPrefix} Shipment Delivered`;
    default:
      return `LMX8 IMPORTS${batchPrefix} Shipment Update`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Database Self-Healing DDL Helper
// ─────────────────────────────────────────────────────────────────────────────
let emailLogSchemaEnsured = false;

export async function ensureEmailLogSchema(): Promise<boolean> {
  if (emailLogSchemaEnsured) return true;
  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
          CREATE TYPE "EmailEventStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS "EmailLog" (
          "id" TEXT NOT NULL,
          "customerId" TEXT NOT NULL,
          "shipmentId" TEXT,
          "batchId" TEXT,
          "eventType" TEXT NOT NULL,
          "status" "EmailEventStatus" NOT NULL DEFAULT 'PENDING',
          "recipient" TEXT NOT NULL,
          "subject" TEXT NOT NULL,
          "providerMessageId" TEXT,
          "idempotencyKey" TEXT NOT NULL,
          "sentAt" TIMESTAMP(3),
          "failedAt" TIMESTAMP(3),
          "errorMessage" TEXT,
          "metadata" JSONB,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "EmailLog_idempotencyKey_key" ON "EmailLog"("idempotencyKey");
      CREATE INDEX IF NOT EXISTS "EmailLog_customerId_idx" ON "EmailLog"("customerId");
      CREATE INDEX IF NOT EXISTS "EmailLog_shipmentId_idx" ON "EmailLog"("shipmentId");
      CREATE INDEX IF NOT EXISTS "EmailLog_eventType_idx" ON "EmailLog"("eventType");
      CREATE INDEX IF NOT EXISTS "EmailLog_status_idx" ON "EmailLog"("status");
      CREATE INDEX IF NOT EXISTS "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");
    `);
    emailLogSchemaEnsured = true;
    return true;
  } catch (err: any) {
    console.warn("[EmailLog] ensureEmailLogSchema warning:", err?.message || err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Low-Level Brevo HTTP Dispatcher
// ─────────────────────────────────────────────────────────────────────────────
export interface SendBrevoEmailParams {
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export interface BrevoSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Dispatches an email via Brevo REST API v3.
 * Server-side only, non-blocking to business logic.
 */
export async function sendBrevoEmail(params: SendBrevoEmailParams): Promise<BrevoSendResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || DEFAULT_SENDER_EMAIL;

  if (!apiKey || apiKey.trim() === "") {
    console.warn("[Brevo] BREVO_API_KEY is not configured in environment. Skipping email dispatch.");
    return {
      success: false,
      error: "BREVO_API_KEY is not configured.",
    };
  }

  if (!params.to || params.to.length === 0 || !params.to[0].email) {
    return {
      success: false,
      error: "No recipient email provided.",
    };
  }

  // Basic email syntax validation
  const recipientEmail = params.to[0].email.trim();
  if (!recipientEmail.includes("@") || !recipientEmail.includes(".")) {
    return {
      success: false,
      error: `Invalid recipient email format: ${recipientEmail}`,
    };
  }

  try {
    console.log(`[EMAIL_SEND_START] Recipient: ${recipientEmail}, Subject: "${params.subject}"`);

    const payload = {
      sender: {
        name: SENDER_NAME,
        email: senderEmail,
      },
      to: params.to.map((t) => ({
        email: t.email.trim(),
        name: t.name ? t.name.trim() : undefined,
      })),
      subject: params.subject,
      htmlContent: params.htmlContent,
      textContent: params.textContent || undefined,
    };

    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey.trim(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data?.message || data?.error || `Brevo HTTP ${response.status}: ${response.statusText}`;
      console.error(`[EMAIL_SEND_FAILURE] Recipient: ${recipientEmail}, Error: ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
      };
    }

    const messageId = data?.messageId || data?.id || `brevo-${Date.now()}`;
    console.log(`[EMAIL_SEND_SUCCESS] Recipient: ${recipientEmail}, MessageId: ${messageId}`);
    return {
      success: true,
      messageId: String(messageId),
    };
  } catch (err: any) {
    const errorMsg = err?.message || "Unexpected error dispatching Brevo email.";
    console.error(`[EMAIL_SEND_FAILURE] Recipient: ${recipientEmail}, Exception: ${errorMsg}`);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML Email Templates (Branded, Responsive, Professional)
// ─────────────────────────────────────────────────────────────────────────────
function getPortalBaseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return "https://lmx8imports.com";
}

export function generateMilestoneEmailHtml(data: {
  customerName: string;
  customerIdentifier: string;
  batchDisplay: string;
  trackingNumber: string;
  description: string;
  milestone: BrevoMilestone;
  statusDate: string;
  portalUrl: string;
}): string {
  const milestoneLabel = SHIPMENT_STATUS_ADMIN_LABELS[data.milestone] || data.milestone;
  const message = MILESTONE_EMAIL_MESSAGES[data.milestone];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LMX8 IMPORTS Shipment Update</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #F8FAFC; color: #172236; }
    .container { max-width: 600px; margin: 24px auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: #141B47; padding: 28px 32px; text-align: left; }
    .logo { color: #FFFFFF; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; margin: 0; }
    .logo span { color: #F2901F; }
    .tagline { color: #94A3B8; font-size: 12px; font-weight: 500; margin-top: 4px; }
    .body { padding: 32px; }
    .greeting { font-size: 16px; font-weight: 600; color: #141B47; margin: 0 0 12px 0; }
    .lead { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0; }
    .status-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .status-badge { display: inline-block; background: #141B47; color: #FFFFFF; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
    .status-badge.delivered { background: #10B981; }
    .status-message { font-size: 14px; font-weight: 600; color: #141B47; margin: 0 0 16px 0; line-height: 1.5; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-top: 1px solid #EDF2F7; font-size: 13px; }
    .detail-label { color: #64748B; font-weight: 500; }
    .detail-value { color: #0F172A; font-weight: 700; text-align: right; }
    .btn { display: inline-block; background: #F2901F; color: #FFFFFF !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 10px; text-align: center; margin: 8px 0 24px 0; }
    .footer { background: #F1F5F9; padding: 20px 32px; font-size: 12px; color: #64748B; line-height: 1.6; border-top: 1px solid #E2E8F0; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="logo">LMX8 <span>IMPORTS</span></h1>
      <div class="tagline">Your Goods. Our Priority. · China to Ghana Logistics</div>
    </div>
    <div class="body">
      <p class="greeting">Hello ${data.customerName || "Valued Customer"},</p>
      <p class="lead">Your shipment status has been updated. Here are the latest details on your consignment:</p>
      
      <div class="status-card">
        <div class="status-badge ${data.milestone === 'DELIVERED' ? 'delivered' : ''}">${milestoneLabel}</div>
        <p class="status-message">${message}</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
          <tr style="border-top: 1px solid #E2E8F0;">
            <td style="padding: 8px 0; color: #64748B; font-size: 13px; font-weight: 500;">Batch</td>
            <td style="padding: 8px 0; color: #0F172A; font-size: 13px; font-weight: 700; text-align: right;">${data.batchDisplay}</td>
          </tr>
          <tr style="border-top: 1px solid #E2E8F0;">
            <td style="padding: 8px 0; color: #64748B; font-size: 13px; font-weight: 500;">Tracking Number</td>
            <td style="padding: 8px 0; color: #141B47; font-size: 13px; font-weight: 800; font-family: monospace; text-align: right;">${data.trackingNumber}</td>
          </tr>
          <tr style="border-top: 1px solid #E2E8F0;">
            <td style="padding: 8px 0; color: #64748B; font-size: 13px; font-weight: 500;">Description</td>
            <td style="padding: 8px 0; color: #0F172A; font-size: 13px; font-weight: 600; text-align: right;">${data.description}</td>
          </tr>
          <tr style="border-top: 1px solid #E2E8F0;">
            <td style="padding: 8px 0; color: #64748B; font-size: 13px; font-weight: 500;">Update Date</td>
            <td style="padding: 8px 0; color: #0F172A; font-size: 13px; font-weight: 600; text-align: right;">${data.statusDate}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center;">
        <a href="${data.portalUrl}" class="btn">View Full 8-Stage Timeline in Portal</a>
      </div>

      <p style="font-size: 13px; color: #64748B; line-height: 1.5; margin: 0;">
        You can log in to your LMX8 IMPORTS customer portal at any time to inspect the full timeline, photos, and tracking events for your cargo.
      </p>
    </div>
    <div class="footer">
      <strong>LMX8 IMPORTS CTRL ROOM</strong><br>
      Tema Port & Accra, Ghana · Shenzhen & Guangzhou, China<br>
      This is an automated milestone notification regarding your shipment.
    </div>
  </div>
</body>
</html>`;
}

export function generateShippingFeeReminderHtml(data: {
  customerName: string;
  customerIdentifier: string;
  batchDisplay: string;
  trackingNumber: string;
  totalShippingFee: number;
  amountPaid: number;
  outstandingBalance: number;
  paymentUrl: string;
  portalUrl: string;
}): string {
  const formatGHS = (val: number) => `GH₵ ${val.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LMX8 IMPORTS Shipping Fee Notice</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #F8FAFC; color: #172236; }
    .container { max-width: 600px; margin: 24px auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #E2E8F0; }
    .header { background: #141B47; padding: 28px 32px; text-align: left; }
    .logo { color: #FFFFFF; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; margin: 0; }
    .logo span { color: #F2901F; }
    .body { padding: 32px; }
    .greeting { font-size: 16px; font-weight: 600; color: #141B47; margin: 0 0 12px 0; }
    .card { background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .btn { display: inline-block; background: #141B47; color: #FFFFFF !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 10px; text-align: center; }
    .footer { background: #F1F5F9; padding: 20px 32px; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="logo">LMX8 <span>IMPORTS</span></h1>
      <div style="color: #94A3B8; font-size: 12px; font-weight: 500; margin-top: 4px;">Shipping Fee Statement</div>
    </div>
    <div class="body">
      <p class="greeting">Hello ${data.customerName || "Valued Customer"},</p>
      <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
        This is a statement regarding the shipping fee for your consignment <strong>${data.trackingNumber}</strong> (${data.batchDisplay}).
      </p>

      <div class="card">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #92400E; font-size: 13px;">Total Shipping Fee:</td>
            <td style="padding: 6px 0; color: #141B47; font-size: 13px; font-weight: 700; text-align: right;">${formatGHS(data.totalShippingFee)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #92400E; font-size: 13px;">Amount Paid to Date:</td>
            <td style="padding: 6px 0; color: #10B981; font-size: 13px; font-weight: 700; text-align: right;">${formatGHS(data.amountPaid)}</td>
          </tr>
          <tr style="border-top: 2px solid #FDE68A;">
            <td style="padding: 10px 0 4px 0; color: #92400E; font-size: 15px; font-weight: 800;">Outstanding Balance:</td>
            <td style="padding: 10px 0 4px 0; color: #B45309; font-size: 16px; font-weight: 800; text-align: right;">${formatGHS(data.outstandingBalance)}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${data.paymentUrl}" class="btn">Pay Outstanding Balance (${formatGHS(data.outstandingBalance)})</a>
      </div>

      <p style="font-size: 13px; color: #64748B; margin: 0;">
        You can also log in to your <a href="${data.portalUrl}" style="color: #141B47; font-weight: 600;">Customer Portal</a> to view payment receipts and invoice details.
      </p>
    </div>
    <div class="footer">
      <strong>LMX8 IMPORTS CTRL ROOM</strong><br>
      Secure payment processing powered by Paystack.
    </div>
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// High-Level Milestone Dispatcher (With Database Idempotency)
// ─────────────────────────────────────────────────────────────────────────────
export async function sendShipmentMilestoneEmail(params: {
  shipmentId: string;
  milestone: ShipmentStatus;
}): Promise<{ success: boolean; skipped?: boolean; reason?: string; error?: string }> {
  // 1. Strict Milestone Filter: Only 6 stages send emails
  if (!isBrevoEmailMilestone(params.milestone)) {
    return {
      success: true,
      skipped: true,
      reason: `Status '${params.milestone}' is a portal-only stage and does not send emails.`,
    };
  }

  const milestone = params.milestone as BrevoMilestone;

  try {
    await ensureEmailLogSchema();

    // 2. Fetch fresh shipment details from database
    const shipment = await prisma.shipment.findUnique({
      where: { id: params.shipmentId },
      include: { customer: true, batch: true },
    });

    if (!shipment) {
      return { success: false, error: "Shipment not found." };
    }

    const customer = shipment.customer;
    if (!customer) {
      return { success: false, error: "Associated customer not found." };
    }

    // 3. Dynamic batch name resolution (never hardcode Batch 6)
    const batch = shipment.batch;
    let batchDisplay = "Consignment";
    if (batch) {
      if (batch.name && batch.batchNumber && batch.name !== batch.batchNumber) {
        batchDisplay = `${batch.name} (${batch.batchNumber})`;
      } else {
        batchDisplay = batch.name || batch.batchNumber || "Consignment";
      }
    }

    // 4. Idempotency Check: One successful email per shipment milestone
    const idempotencyKey = `milestone-${shipment.id}-${milestone}`;
    const existingLog = await prisma.emailLog.findUnique({
      where: { idempotencyKey },
    });

    if (existingLog && existingLog.status === "SENT") {
      return {
        success: true,
        skipped: true,
        reason: `Milestone '${milestone}' email already sent for shipment ${shipment.trackingNumber}.`,
      };
    }

    // 5. Customer Email Check
    const recipientEmail = customer.email?.trim();
    if (!recipientEmail || !recipientEmail.includes("@")) {
      console.warn(`[Brevo] Customer ${customer.customerIdentifier} has no valid email. Skipping.`);
      await prisma.emailLog.upsert({
        where: { idempotencyKey },
        update: {
          status: "SKIPPED",
          errorMessage: "Customer has no valid email address.",
          updatedAt: new Date(),
        },
        create: {
          customerId: customer.id,
          shipmentId: shipment.id,
          batchId: batch?.id || null,
          eventType: milestone,
          status: "SKIPPED",
          recipient: recipientEmail || "NONE",
          subject: getMilestoneEmailSubject(milestone, batchDisplay),
          idempotencyKey,
          errorMessage: "Customer has no valid email address.",
        },
      });
      return { success: true, skipped: true, reason: "Customer has no valid email address." };
    }

    // 6. Build Content
    const subject = getMilestoneEmailSubject(milestone, batchDisplay);
    const portalBase = getPortalBaseUrl();
    const portalUrl = `${portalBase}/portal/shipments/${shipment.trackingNumber}`;
    const statusDate = new Date().toLocaleDateString("en-GH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    const htmlContent = generateMilestoneEmailHtml({
      customerName: customer.name,
      customerIdentifier: customer.customerIdentifier,
      batchDisplay,
      trackingNumber: shipment.trackingNumber,
      description: shipment.description,
      milestone,
      statusDate,
      portalUrl,
    });

    const textContent = `LMX8 IMPORTS\n\nHello ${customer.name},\n\nYour shipment status has been updated.\n\nBatch: ${batchDisplay}\nShipment: ${shipment.trackingNumber}\nStatus: ${SHIPMENT_STATUS_ADMIN_LABELS[milestone] || milestone}\nDate: ${statusDate}\n\n${MILESTONE_EMAIL_MESSAGES[milestone]}\n\nView full tracking timeline in portal: ${portalUrl}\n\nRegards,\nLMX8 IMPORTS`;

    // 7. Record Pending EmailLog
    await prisma.emailLog.upsert({
      where: { idempotencyKey },
      update: {
        status: "PENDING",
        recipient: recipientEmail,
        subject,
        updatedAt: new Date(),
      },
      create: {
        customerId: customer.id,
        shipmentId: shipment.id,
        batchId: batch?.id || null,
        eventType: milestone,
        status: "PENDING",
        recipient: recipientEmail,
        subject,
        idempotencyKey,
      },
    });

    // 8. Dispatch through Brevo
    const sendResult = await sendBrevoEmail({
      to: [{ email: recipientEmail, name: customer.name }],
      subject,
      htmlContent,
      textContent,
    });

    // 9. Record Final Status
    if (sendResult.success) {
      await prisma.emailLog.update({
        where: { idempotencyKey },
        data: {
          status: "SENT",
          providerMessageId: sendResult.messageId || null,
          sentAt: new Date(),
          errorMessage: null,
        },
      });
      return { success: true };
    } else {
      await prisma.emailLog.update({
        where: { idempotencyKey },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          errorMessage: sendResult.error || "Failed to send email.",
        },
      });
      return { success: false, error: sendResult.error };
    }
  } catch (err: any) {
    console.error("[sendShipmentMilestoneEmail] Exception caught:", err?.message || err);
    return { success: false, error: err?.message || "Internal error sending email." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// High-Level Shipping Fee Reminder Dispatcher
// ─────────────────────────────────────────────────────────────────────────────
export async function sendShippingFeeReminderEmail(params: {
  shipmentId: string;
  force?: boolean; // bypass 3-day frequency check for explicit manual admin trigger
}): Promise<{ success: boolean; skipped?: boolean; reason?: string; error?: string }> {
  try {
    await ensureEmailLogSchema();

    const shipment = await prisma.shipment.findUnique({
      where: { id: params.shipmentId },
      include: { customer: true, batch: true, payments: true },
    });

    if (!shipment) return { success: false, error: "Shipment not found." };
    if (!shipment.fee || shipment.fee <= 0) {
      return { success: true, skipped: true, reason: "No shipping fee assigned to shipment." };
    }

    const customer = shipment.customer;
    if (!customer) return { success: false, error: "Customer not found." };

    // Calculate actual outstanding balance
    const successfulPayments = shipment.payments.filter((p) => p.status === "SUCCESS" && p.type === "SHIPPING_FEE");
    const amountPaid = successfulPayments.reduce((acc, p) => acc + p.amount, 0);
    const outstandingBalance = Math.max(0, shipment.fee - amountPaid);

    // If fully paid, STOP all reminders
    if (outstandingBalance <= 0) {
      return { success: true, skipped: true, reason: "Shipping fee is fully paid. No reminder needed." };
    }

    const recipientEmail = customer.email?.trim();
    if (!recipientEmail || !recipientEmail.includes("@")) {
      return { success: true, skipped: true, reason: "Customer has no valid email." };
    }

    // Dynamic batch
    const batch = shipment.batch;
    const batchDisplay = batch ? (batch.name || batch.batchNumber || "Consignment") : "Consignment";

    // Frequency & Cadence: Allow max 1 reminder every 3 days unless force=true
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const recentReminder = await prisma.emailLog.findFirst({
      where: {
        shipmentId: shipment.id,
        eventType: "SHIPPING_FEE_REMINDER",
        status: "SENT",
        createdAt: { gte: threeDaysAgo },
      },
      orderBy: { createdAt: "desc" },
    });

    if (recentReminder && !params.force) {
      return {
        success: true,
        skipped: true,
        reason: `Reminder already sent within the last 3 days (${recentReminder.createdAt.toISOString().split("T")[0]}).`,
      };
    }

    const idempotencyKey = `fee-reminder-${shipment.id}-${Date.now()}`;
    const subject = `LMX8 IMPORTS — Shipping Fee Statement for ${shipment.trackingNumber}`;
    const portalBase = getPortalBaseUrl();
    const portalUrl = `${portalBase}/portal/shipments/${shipment.trackingNumber}`;
    const paymentUrl = `${portalBase}/portal/shipments/${shipment.trackingNumber}`;

    const htmlContent = generateShippingFeeReminderHtml({
      customerName: customer.name,
      customerIdentifier: customer.customerIdentifier,
      batchDisplay,
      trackingNumber: shipment.trackingNumber,
      totalShippingFee: shipment.fee,
      amountPaid,
      outstandingBalance,
      paymentUrl,
      portalUrl,
    });

    await prisma.emailLog.create({
      data: {
        customerId: customer.id,
        shipmentId: shipment.id,
        batchId: batch?.id || null,
        eventType: "SHIPPING_FEE_REMINDER",
        status: "PENDING",
        recipient: recipientEmail,
        subject,
        idempotencyKey,
        metadata: {
          totalShippingFee: shipment.fee,
          amountPaid,
          outstandingBalance,
        },
      },
    });

    const sendResult = await sendBrevoEmail({
      to: [{ email: recipientEmail, name: customer.name }],
      subject,
      htmlContent,
    });

    if (sendResult.success) {
      await prisma.emailLog.update({
        where: { idempotencyKey },
        data: {
          status: "SENT",
          providerMessageId: sendResult.messageId || null,
          sentAt: new Date(),
        },
      });
      return { success: true };
    } else {
      await prisma.emailLog.update({
        where: { idempotencyKey },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          errorMessage: sendResult.error || "Failed to send reminder.",
        },
      });
      return { success: false, error: sendResult.error };
    }
  } catch (err: any) {
    console.error("[sendShippingFeeReminderEmail] Exception caught:", err?.message || err);
    return { success: false, error: err?.message || "Internal error sending reminder." };
  }
}

export function getBrevoDiagnostics() {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || DEFAULT_SENDER_EMAIL;
  const senderName = SENDER_NAME;

  return {
    BREVO_API_KEY: apiKey && apiKey.trim().length > 0 ? "configured" : "missing",
    BREVO_SENDER_EMAIL: senderEmail ? "configured" : "missing",
    BREVO_SENDER_NAME: senderName ? "configured" : "missing",
    senderEmailValue: senderEmail,
  };
}
