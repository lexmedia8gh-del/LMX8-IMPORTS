import { prisma } from "@/lib/prisma";
import { ShipmentStatus, SHIPMENT_STATUS_ADMIN_LABELS } from "@/components/shipment-status";
import { getBrandingForEmail, EmailBrandingInfo } from "@/lib/branding";
import { getSystemSettings } from "@/lib/system-settings";
import {
  getBrevoServerConfig,
  validateBrevoConfig,
  getBrevoDiagnostics,
  BrevoServerConfig,
  BrevoValidationResult,
  BrevoDiagnosticsReport,
} from "./config";

export {
  getBrevoServerConfig,
  validateBrevoConfig,
  getBrevoDiagnostics,
  type BrevoServerConfig,
  type BrevoValidationResult,
  type BrevoDiagnosticsReport,
};

// ─────────────────────────────────────────────────────────────────────────────
// Brevo Configuration & Constants
// ─────────────────────────────────────────────────────────────────────────────
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

// Milestone definition: Shipment timeline stages trigger automatic Brevo emails:
// Note: OUT_FOR_DELIVERY and DELIVERED do NOT trigger automatic status update emails, but OUT_FOR_DELIVERY remains eligible for fee reminders if unpaid.
export const SHIPMENT_EMAIL_EVENTS: Record<ShipmentStatus, string | null> = {
  SHIPMENT_CREATED: "SHIPMENT_ORDER_CONFIRMED",
  PREPARING_SHIPMENT: "SHIPMENT_PREPARING",
  SHIPPED: "SHIPMENT_DEPARTED_CHINA",
  IN_TRANSIT: "SHIPMENT_IN_TRANSIT",
  ARRIVED_AT_DESTINATION: "SHIPMENT_ARRIVED_GHANA",
  CUSTOMS_CLEARANCE: "SHIPMENT_CUSTOMS_CLEARANCE",
  OUT_FOR_DELIVERY: null,
  DELIVERED: null,
  ON_HOLD: "SHIPMENT_ON_HOLD",
};

export type ShipmentEmailStatus = keyof typeof SHIPMENT_EMAIL_EVENTS;
export type BrevoMilestone = ShipmentStatus;

// Fee reminders & payment prompts begin ONLY when shipment reaches ON THE WAY TO GHANA (IN_TRANSIT)
export const FEE_REMINDER_ELIGIBLE_STATUSES: ShipmentStatus[] = [
  "IN_TRANSIT",
  "ARRIVED_AT_DESTINATION",
  "CUSTOMS_CLEARANCE",
  "OUT_FOR_DELIVERY",
];

export function isFeeReminderEligibleStatus(status: ShipmentStatus | string): boolean {
  return FEE_REMINDER_ELIGIBLE_STATUSES.includes(status as ShipmentStatus);
}

export function isBrevoEmailMilestone(status: string): boolean {
  return Boolean(SHIPMENT_EMAIL_EVENTS[status as ShipmentStatus]);
}

// Milestone-specific descriptions
export const MILESTONE_EMAIL_MESSAGES: Record<ShipmentStatus, string> = {
  SHIPMENT_CREATED: "Your order has been confirmed and is being registered in the LMX8 IMPORTS system.",
  PREPARING_SHIPMENT: "Your item is being prepared, quality-checked, and consolidated for international shipment.",
  SHIPPED: "Your shipment has departed China and is now on its way to Ghana.",
  IN_TRANSIT: "Your shipment is currently on the way to Ghana. We will notify you as soon as it arrives.",
  ARRIVED_AT_DESTINATION: "Your shipment has arrived in Ghana and is being processed for clearance.",
  CUSTOMS_CLEARANCE: "Your shipment is currently undergoing customs clearance.",
  OUT_FOR_DELIVERY: "Your shipment is out for delivery with our dispatch team and will arrive at your destination soon.",
  DELIVERED: "Your shipment has been successfully delivered. Thank you for choosing LMX8 IMPORTS!",
  ON_HOLD: "Your shipment has been placed on hold. Please contact our customer support team for more details.",
};

// Milestone-specific subjects
export function getMilestoneEmailSubject(
  milestone: ShipmentStatus | string,
  batchDisplay: string,
  isShippingFeeUnpaid: boolean = false
): string {
  const batchSuffix = batchDisplay && batchDisplay !== "Consignment" ? ` — ${batchDisplay}` : "";
  switch (milestone) {
    case "SHIPMENT_CREATED":
      return `Your LMX8 IMPORTS shipment has been confirmed${batchSuffix}`;
    case "PREPARING_SHIPMENT":
      return `Your shipment is being prepared — LMX8 IMPORTS${batchSuffix}`;
    case "SHIPPED":
      return `Your shipment has departed China — LMX8 IMPORTS${batchSuffix}`;
    case "IN_TRANSIT":
      return `Your shipment is on the way to Ghana — LMX8 IMPORTS${batchSuffix}`;
    case "ARRIVED_AT_DESTINATION":
      return isShippingFeeUnpaid
        ? `Your shipment has arrived in Ghana — shipping fee outstanding`
        : `Your shipment has arrived in Ghana — LMX8 IMPORTS${batchSuffix}`;
    case "CUSTOMS_CLEARANCE":
      return isShippingFeeUnpaid
        ? `Your shipment is undergoing customs clearance — action required`
        : `Your shipment is currently undergoing customs clearance — LMX8 IMPORTS${batchSuffix}`;
    case "OUT_FOR_DELIVERY":
      return `Your shipment is out for delivery — LMX8 IMPORTS${batchSuffix}`;
    case "DELIVERED":
      return `Your shipment has been delivered — LMX8 IMPORTS${batchSuffix}`;
    case "ON_HOLD":
      return `Shipment status update: On hold — LMX8 IMPORTS${batchSuffix}`;
    default:
      return `LMX8 IMPORTS Shipment Update${batchSuffix}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Environment Validation Helper
// ─────────────────────────────────────────────────────────────────────────────
export function validateEmailEnv() {
  const result = validateBrevoConfig();
  if (!result.valid) {
    return { valid: false, error: result.errors[0] || "Brevo configuration is incomplete" };
  }
  return {
    valid: true,
    apiKey: result.apiKey!,
    senderEmail: result.senderEmail!,
    senderName: result.senderName!,
  };
}

import { ensureEmailLogSchema } from "@/lib/email-log-schema";
export { ensureEmailLogSchema };

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
  category?: "CONFIGURATION_ERROR" | "AUTHENTICATION_ERROR" | "VALIDATION_ERROR" | "BREVO_API_ERROR" | "NETWORK_ERROR" | "APPLICATION_ERROR";
  status?: number;
  provider: "brevo";
}

export async function sendBrevoEmail(params: SendBrevoEmailParams): Promise<BrevoSendResult> {
  const envVal = validateEmailEnv();
  if (!envVal.valid) {
    console.warn(`[BREVO_DISPATCH_FAILED] Config validation failed: ${envVal.error}`);
    return {
      success: false,
      error: envVal.error,
      category: "CONFIGURATION_ERROR",
      provider: "brevo",
    };
  }

  if (!params.to || params.to.length === 0 || !params.to[0]?.email) {
    return {
      success: false,
      error: "No recipient email provided.",
      category: "VALIDATION_ERROR",
      provider: "brevo",
    };
  }

  const recipientEmail = params.to[0].email.trim();
  if (!recipientEmail.includes("@") || !recipientEmail.includes(".")) {
    return {
      success: false,
      error: `Invalid recipient email format: ${recipientEmail}`,
      category: "VALIDATION_ERROR",
      provider: "brevo",
    };
  }

  console.log("[BREVO_DISPATCH_START]", JSON.stringify({
    timestamp: new Date().toISOString(),
    senderEmail: envVal.senderEmail,
    senderName: envVal.senderName,
    recipientEmail,
    subject: params.subject,
  }));

  try {
    const payload = {
      sender: {
        name: envVal.senderName,
        email: envVal.senderEmail,
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
        "api-key": envVal.apiKey || "",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      let rawMsg = `Brevo HTTP ${response.status}: ${response.statusText}`;
      if (typeof data?.message === "string") {
        rawMsg = data.message;
      } else if (typeof data?.error === "string") {
        rawMsg = data.error;
      } else if (data?.errors) {
        rawMsg = typeof data.errors === "string" ? data.errors : JSON.stringify(data.errors);
      } else if (typeof data === "string") {
        rawMsg = data;
      }

      let category: BrevoSendResult["category"] = "BREVO_API_ERROR";
      if (response.status === 401 || response.status === 403) {
        category = "AUTHENTICATION_ERROR";
      } else if (response.status === 400 || response.status === 422) {
        category = "VALIDATION_ERROR";
      }

      console.error("[BREVO_DISPATCH_FAILED]", JSON.stringify({
        timestamp: new Date().toISOString(),
        senderEmail: envVal.senderEmail,
        recipientEmail,
        status: response.status,
        error: rawMsg,
        category,
      }));

      return {
        success: false,
        error: rawMsg,
        category,
        status: response.status,
        provider: "brevo",
      };
    }

    const messageId = String(data?.messageId || data?.id || `brevo-${Date.now()}`);

    console.log("[BREVO_DISPATCH_SUCCESS]", JSON.stringify({
      timestamp: new Date().toISOString(),
      senderEmail: envVal.senderEmail,
      recipientEmail,
      status: response.status,
      messageId,
    }));

    return {
      success: true,
      messageId,
      status: response.status,
      provider: "brevo",
    };
  } catch (err: any) {
    const errorMsg =
      err?.name === "TimeoutError" || err?.name === "AbortError"
        ? "Brevo dispatch request timed out after 12s."
        : err?.message || "Unexpected network failure dispatching Brevo email.";

    console.error("[BREVO_DISPATCH_FAILED]", JSON.stringify({
      timestamp: new Date().toISOString(),
      senderEmail: envVal.senderEmail,
      recipientEmail,
      error: errorMsg,
      category: "NETWORK_ERROR",
    }));

    return {
      success: false,
      error: errorMsg,
      category: "NETWORK_ERROR",
      provider: "brevo",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML Layout & Templates
// ─────────────────────────────────────────────────────────────────────────────
function getPortalBaseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "https://lmx8imports.com";
}

export async function wrapInBrandedLayout(title: string, bodyContent: string, footerContent?: string, brandingOverride?: EmailBrandingInfo): Promise<string> {
  const branding = brandingOverride || (await getBrandingForEmail());
  const footer = footerContent || `
    <strong>${branding.businessName} CTRL ROOM</strong><br>
    Tema Port & Accra, Ghana · Shenzhen & Guangzhou, China<br>
    This is an automated notification. Secure payment processing powered by Paystack.
  `;

  // Main logo configured in Admin -> Branding replaces the static text header
  const headerLogoHtml = branding.logoUrl
    ? `<img src="${branding.logoUrl}" alt="${branding.businessName}" style="max-height: 48px; max-width: 240px; width: auto; height: auto; display: block; object-fit: contain; margin-bottom: 4px;" />`
    : `<h1 class="logo">${branding.shortName} <span>${branding.businessName.replace(branding.shortName, "").trim() || "IMPORTS"}</span></h1>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #F8FAFC; color: #172236; }
    .container { max-width: 600px; margin: 24px auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: ${branding.primaryColor || "#141B47"}; padding: 28px 32px; text-align: left; }
    .logo { color: #FFFFFF; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; margin: 0; }
    .logo span { color: ${branding.accentColor || "#F2901F"}; }
    .tagline { color: #94A3B8; font-size: 12px; font-weight: 500; margin-top: 6px; }
    .body { padding: 32px; }
    .greeting { font-size: 16px; font-weight: 600; color: ${branding.primaryColor || "#141B47"}; margin: 0 0 12px 0; }
    .lead { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0; }
    .status-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .status-badge { display: inline-block; background: ${branding.primaryColor || "#141B47"}; color: #FFFFFF; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
    .btn { display: inline-block; background: ${branding.accentColor || "#F2901F"}; color: #FFFFFF !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 10px; text-align: center; margin: 8px 0 24px 0; }
    .footer { background: #F1F5F9; padding: 20px 32px; font-size: 12px; color: #64748B; line-height: 1.6; border-top: 1px solid #E2E8F0; text-align: center; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    tr { border-top: 1px solid #E2E8F0; }
    td { padding: 8px 0; font-size: 13px; }
    .label { color: #64748B; font-weight: 500; }
    .val { color: #0F172A; font-weight: 700; text-align: right; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${headerLogoHtml}
      <div class="tagline">${branding.tagline}</div>
    </div>
    <div class="body">
      ${bodyContent}
    </div>
    <div class="footer">
      ${footer}
    </div>
  </div>
</body>
</html>`;
}

// Template Generators
export async function generateCustomerWelcomeHtml(data: { customerName: string; customerIdentifier: string; portalUrl: string }): Promise<string> {
  const content = `
    <p class="greeting">Hello ${data.customerName},</p>
    <p class="lead">Welcome to LMX8 IMPORTS! Your customer account has been created successfully.</p>
    <div class="status-card">
      <div class="status-badge">Account Confirmed</div>
      <p style="font-size: 14px; font-weight: 600; color: #141B47; margin: 0 0 16px 0;">Here is your unique Customer ID for reference:</p>
      <table>
        <tr>
          <td class="label">Customer ID</td>
          <td class="val" style="color: #141B47; font-size: 15px; font-family: monospace;">${data.customerIdentifier}</td>
        </tr>
      </table>
    </div>
    <p class="lead">You can log in to your portal using your Phone Number and the secure PIN provided by your administrator.</p>
    <div style="text-align: center;">
      <a href="${data.portalUrl}" class="btn">Log In to Customer Portal</a>
    </div>
  `;
  return wrapInBrandedLayout("Welcome to LMX8 IMPORTS", content);
}

export async function generateCustomerCredentialsHtml(data: {
  customerName: string;
  customerIdentifier: string;
  phone?: string;
  loginUrl: string;
}): Promise<string> {
  const content = `
    <p class="greeting">Hello ${data.customerName || "Valued Customer"},</p>
    <p class="lead">Here are your official LMX8 IMPORTS customer portal credentials and access instructions.</p>
    
    <div class="status-card" style="background: #F8FAFC; border-color: #E2E8F0;">
      <div class="status-badge" style="background: #141B47;">Account Access Details</div>
      <table>
        <tr>
          <td class="label">Customer ID</td>
          <td class="val" style="color: #141B47; font-size: 15px; font-weight: 800; font-family: monospace;">${data.customerIdentifier}</td>
        </tr>
        ${data.phone ? `
        <tr>
          <td class="label">Registered Phone</td>
          <td class="val" style="font-family: monospace; color: #172236;">${data.phone}</td>
        </tr>` : ""}
        <tr>
          <td class="label">Portal URL</td>
          <td class="val"><a href="${data.loginUrl}" style="color: #F2901F; font-weight: 700; text-decoration: none;">${data.loginUrl}</a></td>
        </tr>
      </table>
    </div>

    <div style="margin: 20px 0; padding: 16px; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0;">
      <p style="font-size: 14px; font-weight: 700; color: #141B47; margin: 0 0 10px 0;">How to Sign In to Your Portal:</p>
      <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.6;">
        <li>Go to the portal login page: <strong>${data.loginUrl}</strong></li>
        <li>Enter your <strong>Customer ID</strong> (<code>${data.customerIdentifier}</code>) or registered phone number.</li>
        <li>Enter your secret 6-8 digit Customer PIN.</li>
      </ol>
    </div>

    <div style="margin: 16px 0; padding: 14px; background: #FFFBEB; border-radius: 12px; border: 1px solid #FDE68A; font-size: 13px; color: #92400E; line-height: 1.5;">
      <strong>Account Security Guidance:</strong>
      <ul style="margin: 6px 0 0 0; padding-left: 18px;">
        <li>Never share your PIN with anyone, including staff members.</li>
        <li>You can change your PIN anytime inside your Customer Profile settings.</li>
        <li>If you forget your PIN or suspect unauthorized access, contact LMX8 IMPORTS administration immediately for a secure reset.</li>
      </ul>
    </div>

    <div style="text-align: center; margin: 24px 0 8px 0;">
      <a href="${data.loginUrl}" class="btn" style="background: #F2901F; color: #FFFFFF;">Log In to Customer Portal</a>
    </div>
  `;
  return wrapInBrandedLayout("Your LMX8 IMPORTS Portal Credentials", content);
}

export async function generateSourcingRequestCreatedHtml(data: {
  customerName: string;
  requestNumber: string;
  productDetails: string;
  quantity: number;
  preferredSizeColor?: string;
  additionalInstructions?: string;
  portalUrl: string;
}): Promise<string> {
  const content = `
    <p class="greeting">Hello ${data.customerName},</p>
    <p class="lead">We have successfully received your product sourcing request from China! Our team is already reviewing details to secure the best quotation for you.</p>
    <div class="status-card">
      <div class="status-badge" style="background: #F59E0B;">Sourcing Request Received</div>
      <table>
        <tr>
          <td class="label">Request Number</td>
          <td class="val" style="font-family: monospace;">${data.requestNumber}</td>
        </tr>
        <tr>
          <td class="label">Product Details</td>
          <td class="val">${data.productDetails}</td>
        </tr>
        <tr>
          <td class="label">Quantity</td>
          <td class="val">${data.quantity}</td>
        </tr>
        ${data.preferredSizeColor ? `
        <tr>
          <td class="label">Preferred Specs</td>
          <td class="val">${data.preferredSizeColor}</td>
        </tr>` : ""}
        ${data.additionalInstructions ? `
        <tr>
          <td class="label">Additional Instructions</td>
          <td class="val">${data.additionalInstructions}</td>
        </tr>` : ""}
      </table>
    </div>
    <p class="lead">Your account has been debited 1 credit. We will provide a quotation in your portal as soon as it is available.</p>
    <div style="text-align: center;">
      <a href="${data.portalUrl}" class="btn">Check Sourcing Request Status</a>
    </div>
  `;
  return wrapInBrandedLayout("Product Sourcing Request Received", content);
}

export async function generateShipmentCreatedHtml(data: {
  customerName: string;
  trackingNumber: string;
  description: string;
  status: string;
  estimatedArrival?: string;
  portalUrl: string;
}): Promise<string> {
  const content = `
    <p class="greeting">Hello ${data.customerName},</p>
    <p class="lead">A new shipment has been registered under your account! You can monitor its status throughout its logistics timeline.</p>
    <div class="status-card">
      <div class="status-badge">Shipment Registered</div>
      <table>
        <tr>
          <td class="label">Tracking ID</td>
          <td class="val" style="font-family: monospace; color: #141B47; font-size: 14px;">${data.trackingNumber}</td>
        </tr>
        <tr>
          <td class="label">Description</td>
          <td class="val">${data.description}</td>
        </tr>
        <tr>
          <td class="label">Status</td>
          <td class="val">${data.status}</td>
        </tr>
        ${data.estimatedArrival ? `
        <tr>
          <td class="label">Estimated Arrival</td>
          <td class="val" style="color: #10B981;">${data.estimatedArrival}</td>
        </tr>` : ""}
      </table>
    </div>
    <div style="text-align: center;">
      <a href="${data.portalUrl}" class="btn">Track Shipment Progress</a>
    </div>
  `;
  return wrapInBrandedLayout("New Shipment Registered - LMX8", content);
}

export async function generateShipmentStatusChangedHtml(data: {
  customerName: string;
  trackingNumber: string;
  previousStatus: string;
  newStatus: string;
  note?: string;
  portalUrl: string;
}): Promise<string> {
  const content = `
    <p class="greeting">Hello ${data.customerName},</p>
    <p class="lead">Your shipment's status has been updated in our warehouse/logistics system.</p>
    <div class="status-card">
      <div class="status-badge">${data.newStatus}</div>
      <table>
        <tr>
          <td class="label">Tracking ID</td>
          <td class="val" style="font-family: monospace;">${data.trackingNumber}</td>
        </tr>
        <tr>
          <td class="label">Previous Status</td>
          <td class="val" style="text-decoration: line-through; color: #94A3B8;">${data.previousStatus}</td>
        </tr>
        <tr>
          <td class="label">New Status</td>
          <td class="val" style="color: #141B47; font-weight: 800;">${data.newStatus}</td>
        </tr>
        ${data.note ? `
        <tr>
          <td class="label">Remarks</td>
          <td class="val" style="font-style: italic;">${data.note}</td>
        </tr>` : ""}
      </table>
    </div>
    <div style="text-align: center;">
      <a href="${data.portalUrl}" class="btn">View Live Timeline and Cargo Photos</a>
    </div>
  `;
  return wrapInBrandedLayout("Shipment Status Update - LMX8", content);
}

export async function generateCreditPurchaseSuccessHtml(data: {
  customerName: string;
  reference: string;
  amount: number;
  credits: number;
  date: string;
  portalUrl: string;
}): Promise<string> {
  const content = `
    <p class="greeting">Hello ${data.customerName},</p>
    <p class="lead">Your payment was processed successfully, and credits have been added to your sourcing account!</p>
    <div class="status-card" style="background: #ECFDF5; border-color: #A7F3D0;">
      <div class="status-badge" style="background: #10B981;">Payment Verified</div>
      <table>
        <tr>
          <td class="label" style="color: #065F46;">Reference</td>
          <td class="val" style="font-family: monospace;">${data.reference}</td>
        </tr>
        <tr>
          <td class="label" style="color: #065F46;">Amount Paid</td>
          <td class="val" style="color: #065F46;">GHS ${data.amount.toFixed(2)}</td>
        </tr>
        <tr>
          <td class="label" style="color: #065F46;">Sourcing Credits Added</td>
          <td class="val" style="color: #065F46; font-size: 15px;">+${data.credits} Credits</td>
        </tr>
        <tr>
          <td class="label" style="color: #065F46;">Date</td>
          <td class="val">${data.date}</td>
        </tr>
      </table>
    </div>
    <div style="text-align: center;">
      <a href="${data.portalUrl}" class="btn" style="background: #10B981;">Check Your Credit Balance</a>
    </div>
  `;
  return wrapInBrandedLayout("Sourcing Credits Payment Confirmed - LMX8", content);
}

export async function generateShippingFeePaidHtml(data: {
  customerName: string;
  trackingNumber: string;
  reference: string;
  amount: number;
  date: string;
  portalUrl: string;
}): Promise<string> {
  const content = `
    <p class="greeting">Hello ${data.customerName},</p>
    <p class="lead">Your shipping fee payment has been successfully processed and verified! Your cargo has been cleared for processing/release.</p>
    <div class="status-card" style="background: #ECFDF5; border-color: #A7F3D0;">
      <div class="status-badge" style="background: #10B981;">Shipping Fee Paid</div>
      <table>
        <tr>
          <td class="label" style="color: #065F46;">Tracking ID</td>
          <td class="val" style="font-family: monospace;">${data.trackingNumber}</td>
        </tr>
        <tr>
          <td class="label" style="color: #065F46;">Payment Reference</td>
          <td class="val" style="font-family: monospace;">${data.reference}</td>
        </tr>
        <tr>
          <td class="label" style="color: #065F46;">Amount Paid</td>
          <td class="val" style="color: #065F46; font-size: 15px;">GHS ${data.amount.toFixed(2)}</td>
        </tr>
        <tr>
          <td class="label" style="color: #065F46;">Date</td>
          <td class="val">${data.date}</td>
        </tr>
      </table>
    </div>
    <div style="text-align: center;">
      <a href="${data.portalUrl}" class="btn" style="background: #10B981;">View Shipment Timeline</a>
    </div>
  `;
  return wrapInBrandedLayout("Shipping Fee Payment Confirmed - LMX8", content);
}

export interface MilestoneEmailData {
  customerName: string;
  customerIdentifier: string;
  batchDisplay: string;
  trackingNumber: string;
  description: string;
  milestone: ShipmentStatus | string;
  statusDate: string;
  portalUrl: string;
  isShippingFeeUnpaid?: boolean;
  totalShippingFee?: number;
  amountPaid?: number;
  outstandingBalance?: number;
  paymentUrl?: string;
}

export async function generateMilestoneEmailHtml(data: MilestoneEmailData): Promise<string> {
  const milestoneLabel = (SHIPMENT_STATUS_ADMIN_LABELS as Record<string, string>)[data.milestone] || data.milestone;
  const formatGHS = (val: number) => `GHS ${val.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  let leadMessage = (MILESTONE_EMAIL_MESSAGES as Record<string, string>)[data.milestone] || "Your shipment status has been updated in our logistics system.";
  if (data.isShippingFeeUnpaid) {
    if (data.milestone === "ARRIVED_AT_DESTINATION") {
      leadMessage = `Your shipment has arrived in Ghana. Your shipping fee of ${formatGHS(data.outstandingBalance || 0)} is currently outstanding.`;
    } else if (data.milestone === "CUSTOMS_CLEARANCE") {
      leadMessage = `Your shipment is currently undergoing customs clearance. Your shipping fee of ${formatGHS(data.outstandingBalance || 0)} is still outstanding.`;
    }
  }

  const paymentCard = data.isShippingFeeUnpaid && data.outstandingBalance && data.outstandingBalance > 0
    ? `
      <div class="status-card" style="background: #FFFBEB; border: 1px solid #FDE68A; margin-top: 18px; padding: 18px; border-radius: 12px;">
        <div class="status-badge" style="background: #D97706; color: #FFFFFF; font-weight: 700; margin-bottom: 12px;">ACTION REQUIRED: SHIPPING FEE DUE</div>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td class="label" style="padding: 6px 0; color: #78350F; font-size: 13px;">Total Shipping Fee:</td>
            <td class="val" style="padding: 6px 0; color: #1E293B; font-weight: 600; text-align: right; font-size: 13px;">${formatGHS(data.totalShippingFee || 0)}</td>
          </tr>
          <tr>
            <td class="label" style="padding: 6px 0; color: #78350F; font-size: 13px;">Amount Paid:</td>
            <td class="val" style="padding: 6px 0; color: #10B981; font-weight: 600; text-align: right; font-size: 13px;">${formatGHS(data.amountPaid || 0)}</td>
          </tr>
          <tr style="border-top: 1px dashed #FCD34D;">
            <td class="label" style="padding: 10px 0 0 0; font-size: 14px; font-weight: 800; color: #92400E;">Outstanding Balance:</td>
            <td class="val" style="padding: 10px 0 0 0; font-size: 16px; font-weight: 900; color: #B45309; text-align: right;">${formatGHS(data.outstandingBalance)}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 24px 0 16px 0;">
        <a href="${data.paymentUrl || data.portalUrl}" class="btn" style="background: #F2901F; color: #FFFFFF; font-weight: 800; font-size: 15px; padding: 15px 32px; text-decoration: none; border-radius: 10px; display: inline-block; box-shadow: 0 4px 12px rgba(242, 144, 31, 0.35); text-transform: uppercase; letter-spacing: 0.5px;">PAY SHIPPING FEE</a>
      </div>

      <p style="text-align: center; font-size: 13px; color: #64748B; margin: 0 0 20px 0;">
        <a href="${data.portalUrl}" style="color: #141B47; text-decoration: underline; font-weight: 600;">View full timeline in portal &rarr;</a>
      </p>
    `
    : `
      <div style="text-align: center; margin: 24px 0;">
        <a href="${data.portalUrl}" class="btn" style="background: #141B47; color: #FFFFFF; font-weight: 700; font-size: 14px; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block;">View Full Timeline in Portal</a>
      </div>
    `;

  const content = `
    <p class="greeting">Hello ${data.customerName || "Valued Customer"},</p>
    <p class="lead">${leadMessage}</p>
    
    <div class="status-card">
      <div class="status-badge">${milestoneLabel}</div>
      
      <table>
        <tr>
          <td class="label">Batch</td>
          <td class="val">${data.batchDisplay}</td>
        </tr>
        <tr>
          <td class="label">Tracking Number</td>
          <td class="val" style="color: #141B47; font-weight: 800; font-family: monospace;">${data.trackingNumber}</td>
        </tr>
        <tr>
          <td class="label">Description</td>
          <td class="val">${data.description}</td>
        </tr>
        <tr>
          <td class="label">Update Date</td>
          <td class="val">${data.statusDate}</td>
        </tr>
      </table>
    </div>

    ${paymentCard}

    <p style="font-size: 13px; color: #64748B; line-height: 1.5; margin: 16px 0 0 0;">
      You can log in to your customer portal at any time to inspect the full timeline, photos, and tracking events for your cargo.
    </p>
  `;
  return wrapInBrandedLayout(data.isShippingFeeUnpaid ? "Shipment Update — Action Required" : "Shipment Update", content);
}

// Retro-compatible reminder generator
export async function generateShippingFeeReminderHtml(data: {
  customerName: string;
  customerIdentifier: string;
  batchDisplay: string;
  trackingNumber: string;
  totalShippingFee: number;
  amountPaid: number;
  outstandingBalance: number;
  paymentUrl: string;
  portalUrl: string;
}): Promise<string> {
  const formatGHS = (val: number) => `GHS ${val.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const content = `
    <p class="greeting">Hello ${data.customerName || "Valued Customer"},</p>
    <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
      This is a statement regarding the shipping fee for your consignment <strong>${data.trackingNumber}</strong> (${data.batchDisplay}).
    </p>

    <div class="status-card" style="background: #FFFBEB; border-color: #FDE68A;">
      <div class="status-badge" style="background: #B45309;">Payment Notice</div>
      <table>
        <tr>
          <td class="label">Total Shipping Fee:</td>
          <td class="val">${formatGHS(data.totalShippingFee)}</td>
        </tr>
        <tr>
          <td class="label">Amount Paid to Date:</td>
          <td class="val" style="color: #10B981;">${formatGHS(data.amountPaid)}</td>
        </tr>
        <tr style="border-top: 2px solid #FDE68A;">
          <td class="label" style="font-size: 14px; font-weight: 800; color: #92400E; padding-top: 10px;">Outstanding Balance:</td>
          <td class="val" style="font-size: 15px; font-weight: 800; color: #B45309; padding-top: 10px;">${formatGHS(data.outstandingBalance)}</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${data.paymentUrl}" class="btn">Pay Outstanding Balance (${formatGHS(data.outstandingBalance)})</a>
    </div>

    <p style="font-size: 13px; color: #64748B; margin: 0;">
      You can also log in to your <a href="${data.portalUrl}" style="color: #141B47; font-weight: 600;">Customer Portal</a> to view payment receipts and invoice details.
    </p>
  `;
  return wrapInBrandedLayout("Shipping Fee Statement Notice", content);
}


// ─────────────────────────────────────────────────────────────────────────────
// High-Level Transactional Event Dispatchers (With Database Idempotency)
// ─────────────────────────────────────────────────────────────────────────────

// 1. Customer Welcome
export async function sendCustomerCreatedEmail(customerId: string): Promise<{ success: boolean; skipped?: boolean; reason?: string; error?: string }> {
  try {
    await ensureEmailLogSchema();
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) return { success: false, error: "Customer not found." };
    if (!customer.email || !customer.email.trim().includes("@")) {
      return { success: true, skipped: true, reason: "Customer has no valid email." };
    }

    const idempotencyKey = `customer-welcome-${customer.id}`;
    const existingLog = await prisma.emailLog.findUnique({ where: { idempotencyKey } });
    if (existingLog && existingLog.status === "SENT") {
      return { success: true, skipped: true, reason: "Welcome email already sent." };
    }

    const portalBase = getPortalBaseUrl();
    const portalUrl = `${portalBase}/login`;
    const htmlContent = await generateCustomerWelcomeHtml({
      customerName: customer.name,
      customerIdentifier: customer.customerIdentifier,
      portalUrl,
    });

    const subject = "Welcome to LMX8 IMPORTS — Your Account Details";

    await prisma.emailLog.upsert({
      where: { idempotencyKey },
      update: { status: "PENDING", updatedAt: new Date() },
      create: {
        customerId: customer.id,
        eventType: "CUSTOMER_WELCOME",
        status: "PENDING",
        recipient: customer.email.trim(),
        subject,
        idempotencyKey,
      },
    });

    const result = await sendBrevoEmail({
      to: [{ email: customer.email.trim(), name: customer.name }],
      subject,
      htmlContent,
    });

    if (result.success) {
      await prisma.emailLog.update({
        where: { idempotencyKey },
        data: { status: "SENT", providerMessageId: result.messageId || null, sentAt: new Date() },
      });
      return { success: true };
    } else {
      await prisma.emailLog.update({
        where: { idempotencyKey },
        data: { status: "FAILED", failedAt: new Date(), errorMessage: result.error || "Failed to send welcome email." },
      });
      return { success: false, error: result.error };
    }
  } catch (err: any) {
    console.error("[sendCustomerCreatedEmail] Exception:", err);
    return { success: false, error: err?.message || "Internal error." };
  }
}

// 2. Sourcing Request Created
export async function sendSourcingRequestCreatedEmail(requestId: string): Promise<{ success: boolean; skipped?: boolean; reason?: string; error?: string }> {
  try {
    await ensureEmailLogSchema();
    const request = await prisma.sourcingRequest.findUnique({
      where: { id: requestId },
      include: { customer: true },
    });

    if (!request) return { success: false, error: "Sourcing request not found." };
    const customer = request.customer;
    if (!customer) return { success: false, error: "Customer not found." };
    if (!customer.email || !customer.email.trim().includes("@")) {
      return { success: true, skipped: true, reason: "Customer has no valid email." };
    }

    const idempotencyKey = `sourcing-created-${request.id}`;
    const existingLog = await prisma.emailLog.findUnique({ where: { idempotencyKey } });
    if (existingLog && existingLog.status === "SENT") {
      return { success: true, skipped: true, reason: "Sourcing created email already sent." };
    }

    const portalBase = getPortalBaseUrl();
    const portalUrl = `${portalBase}/portal/sourcing`;
    const htmlContent = await generateSourcingRequestCreatedHtml({
      customerName: customer.name,
      requestNumber: request.requestNumber,
      productDetails: request.productDetails,
      quantity: request.quantity || 1,
      preferredSizeColor: request.preferredSizeColor || undefined,
      additionalInstructions: request.additionalInstructions || undefined,
      portalUrl,
    });

    const subject = `LMX8 Sourcing Request ${request.requestNumber} Received`;

    await prisma.emailLog.upsert({
      where: { idempotencyKey },
      update: { status: "PENDING", updatedAt: new Date() },
      create: {
        customerId: customer.id,
        eventType: "SOURCING_REQUEST_CREATED",
        status: "PENDING",
        recipient: customer.email.trim(),
        subject,
        idempotencyKey,
      },
    });

    const result = await sendBrevoEmail({
      to: [{ email: customer.email.trim(), name: customer.name }],
      subject,
      htmlContent,
    });

    if (result.success) {
      await prisma.emailLog.update({
        where: { idempotencyKey },
        data: { status: "SENT", providerMessageId: result.messageId || null, sentAt: new Date() },
      });
      return { success: true };
    } else {
      await prisma.emailLog.update({
        where: { idempotencyKey },
        data: { status: "FAILED", failedAt: new Date(), errorMessage: result.error || "Failed to send sourcing confirmation." },
      });
      return { success: false, error: result.error };
    }
  } catch (err: any) {
    console.error("[sendSourcingRequestCreatedEmail] Exception:", err);
    return { success: false, error: err?.message || "Internal error." };
  }
}

// 3. Shipment Created
export async function sendShipmentCreatedEmail(shipmentId: string): Promise<{ success: boolean; skipped?: boolean; reason?: string; error?: string }> {
  try {
    await ensureEmailLogSchema();
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { customer: true, batch: true },
    });

    if (!shipment) return { success: false, error: "Shipment not found." };
    const customer = shipment.customer;
    if (!customer) return { success: false, error: "Customer not found." };
    if (!customer.email || !customer.email.trim().includes("@")) {
      return { success: true, skipped: true, reason: "Customer has no valid email." };
    }

    const idempotencyKey = `shipment-created-${shipment.id}`;
    const existingLog = await prisma.emailLog.findUnique({ where: { idempotencyKey } });
    if (existingLog && existingLog.status === "SENT") {
      return { success: true, skipped: true, reason: "Shipment created email already sent." };
    }

    const statusLabel = SHIPMENT_STATUS_ADMIN_LABELS[shipment.status as ShipmentStatus] || shipment.status;
    const estArrival = shipment.estimatedArrival
      ? shipment.estimatedArrival.toLocaleDateString("en-GH")
      : undefined;

    const portalBase = getPortalBaseUrl();
    const portalUrl = `${portalBase}/portal/shipments/${shipment.trackingNumber}`;
    const htmlContent = await generateShipmentCreatedHtml({
      customerName: customer.name,
      trackingNumber: shipment.trackingNumber,
      description: shipment.description,
      status: statusLabel,
      estimatedArrival: estArrival,
      portalUrl,
    });

    const subject = `New Shipment Registered: ${shipment.trackingNumber} — LMX8 IMPORTS`;

    await prisma.emailLog.upsert({
      where: { idempotencyKey },
      update: { status: "PENDING", updatedAt: new Date() },
      create: {
        customerId: customer.id,
        shipmentId: shipment.id,
        batchId: shipment.batchId,
        eventType: "SHIPMENT_CREATED",
        status: "PENDING",
        recipient: customer.email.trim(),
        subject,
        idempotencyKey,
      },
    });

    const result = await sendBrevoEmail({
      to: [{ email: customer.email.trim(), name: customer.name }],
      subject,
      htmlContent,
    });

    if (result.success) {
      await prisma.emailLog.update({
        where: { idempotencyKey },
        data: { status: "SENT", providerMessageId: result.messageId || null, sentAt: new Date() },
      });
      return { success: true };
    } else {
      await prisma.emailLog.update({
        where: { idempotencyKey },
        data: { status: "FAILED", failedAt: new Date(), errorMessage: result.error || "Failed to send shipment registration email." },
      });
      return { success: false, error: result.error };
    }
  } catch (err: any) {
    console.error("[sendShipmentCreatedEmail] Exception:", err);
    return { success: false, error: err?.message || "Internal error." };
  }
}

// 4. Milestone/Shipment Status Changed Email Dispatcher
export interface SendShipmentStatusEmailParams {
  shipmentId: string;
  customerId?: string;
  status: ShipmentStatus;
  event?: string;
  force?: boolean;
}

export async function sendShipmentStatusEmail(params: SendShipmentStatusEmailParams): Promise<{
  success: boolean;
  messageId?: string;
  skipped?: boolean;
  reason?: string;
  error?: string;
}> {
  const eventType = params.event || SHIPMENT_EMAIL_EVENTS[params.status] || `SHIPMENT_${params.status}`;
  console.log(`SHIPMENT_EMAIL_EVENT_DETECTED\nevent: ${eventType}\nshipmentId: ${params.shipmentId}\nstatus: ${params.status}`);

  try {
    const settings = await getSystemSettings().catch(() => null);
    if (settings && !settings.shipmentEmailEnabled && !params.force) {
      console.log(`SHIPMENT_EMAIL_SKIPPED\nreason: DISABLED_IN_SYSTEM_SETTINGS`);
      return { success: true, skipped: true, reason: "Shipment status emails are disabled in System Settings." };
    }

    await ensureEmailLogSchema();
    const shipment = await prisma.shipment.findFirst({
      where: {
        OR: [
          { id: params.shipmentId },
          { trackingNumber: params.shipmentId },
          { trackingNumber: params.shipmentId.toUpperCase() },
        ],
      },
      include: { customer: true, batch: true, payments: true },
    });

    if (!shipment) {
      console.warn("SHIPMENT_EMAIL_SKIPPED\nreason: SHIPMENT_NOT_FOUND");
      return { success: false, skipped: true, reason: "SHIPMENT_NOT_FOUND" };
    }

    const customer = shipment.customer;
    if (!customer) {
      console.warn("SHIPMENT_EMAIL_SKIPPED\nreason: CUSTOMER_NOT_FOUND");
      return { success: false, skipped: true, reason: "CUSTOMER_NOT_FOUND" };
    }

    const recipientEmail = customer.email?.trim();
    if (!recipientEmail || !recipientEmail.includes("@") || !recipientEmail.includes(".")) {
      console.warn("SHIPMENT_EMAIL_SKIPPED\nreason: CUSTOMER_EMAIL_MISSING");
      const idempotencyKey = `milestone-${shipment.id}-${params.status}`;
      console.log(`EMAIL_LOG_WRITE\nstatus: SKIPPED\nidempotencyKey: ${idempotencyKey}\nreason: CUSTOMER_EMAIL_MISSING`);
      await prisma.emailLog.upsert({
        where: { idempotencyKey },
        update: { status: "SKIPPED", errorMessage: "CUSTOMER_EMAIL_MISSING", updatedAt: new Date() },
        create: {
          customerId: customer.id,
          shipmentId: shipment.id,
          batchId: shipment.batchId,
          eventType,
          status: "SKIPPED",
          recipient: "NONE",
          subject: getMilestoneEmailSubject(params.status, shipment.batch?.name || "Consignment"),
          idempotencyKey,
          errorMessage: "CUSTOMER_EMAIL_MISSING",
        },
      }).catch(() => {});
      return { success: true, skipped: true, reason: "CUSTOMER_EMAIL_MISSING" };
    }

    const idempotencyKey = params.force
      ? `milestone-${shipment.id}-${params.status}-${Date.now()}`
      : `milestone-${shipment.id}-${params.status}`;

    if (!params.force) {
      console.log(`EMAIL_LOG_CHECK\nidempotencyKey: ${idempotencyKey}`);
      const existingLog = await prisma.emailLog.findUnique({ where: { idempotencyKey } });
      if (existingLog && existingLog.status === "SENT") {
        console.log("SHIPMENT_EMAIL_SKIPPED\nreason: ALREADY_SENT");
        return {
          success: true,
          skipped: true,
          reason: "ALREADY_SENT",
        };
      }
    }

    const batch = shipment.batch;
    let batchDisplay = "Consignment";
    if (batch) {
      batchDisplay = batch.name || batch.batchNumber || "Consignment";
    }

    const successfulPayments = (shipment.payments || []).filter(
      (p) => p.status === "SUCCESS" && p.type === "SHIPPING_FEE"
    );
    const amountPaid = successfulPayments.reduce((acc, p) => acc + p.amount, 0);
    const totalShippingFee = shipment.fee || 0;
    const outstandingBalance = Math.max(0, totalShippingFee - amountPaid);
    const isShippingFeeUnpaid = totalShippingFee > 0 && outstandingBalance > 0;

    const portalBase = getPortalBaseUrl();
    const portalUrl = `${portalBase}/portal/shipments/${shipment.trackingNumber}`;
    const paymentUrl = `${portalBase}/pay/${shipment.id}`;
    const statusDate = new Date().toLocaleDateString("en-GH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    const subject = getMilestoneEmailSubject(params.status, batchDisplay, isShippingFeeUnpaid);

    const htmlContent = await generateMilestoneEmailHtml({
      customerName: customer.name,
      customerIdentifier: customer.customerIdentifier,
      batchDisplay,
      trackingNumber: shipment.trackingNumber,
      description: shipment.description,
      milestone: params.status,
      statusDate,
      portalUrl,
      isShippingFeeUnpaid,
      totalShippingFee,
      amountPaid,
      outstandingBalance,
      paymentUrl,
    });

    const textContent = `LMX8 IMPORTS\n\nHello ${customer.name},\n\nYour shipment status has been updated.\n\nBatch: ${batchDisplay}\nShipment: ${shipment.trackingNumber}\nStatus: ${SHIPMENT_STATUS_ADMIN_LABELS[params.status] || params.status}\nDate: ${statusDate}\n\n${MILESTONE_EMAIL_MESSAGES[params.status] || ""}\n\nView full tracking timeline in portal: ${portalUrl}\n\nRegards,\nLMX8 IMPORTS`;

    console.log(`EMAIL_LOG_WRITE\nstatus: PENDING\nidempotencyKey: ${idempotencyKey}`);
    await prisma.emailLog.upsert({
      where: { idempotencyKey },
      update: { status: "PENDING", recipient: recipientEmail, subject, eventType, updatedAt: new Date() },
      create: {
        customerId: customer.id,
        shipmentId: shipment.id,
        batchId: shipment.batchId,
        eventType,
        status: "PENDING",
        recipient: recipientEmail,
        subject,
        idempotencyKey,
      },
    }).catch(() => {});

    console.log(`BREVO_DISPATCH_START\nrecipient: ${recipientEmail}\nsubject: ${subject}\nevent: ${eventType}`);

    const sendResult = await sendBrevoEmail({
      to: [{ email: recipientEmail, name: customer.name }],
      subject,
      htmlContent,
      textContent,
    });

    if (sendResult.success) {
      console.log(`BREVO_DISPATCH_SUCCESS\nmessageId: ${sendResult.messageId || "dispatched"}`);
      console.log(`EMAIL_LOG_WRITE\nstatus: SENT\nidempotencyKey: ${idempotencyKey}\nmessageId: ${sendResult.messageId || "dispatched"}`);
      await prisma.emailLog.update({
        where: { idempotencyKey },
        data: {
          status: "SENT",
          providerMessageId: sendResult.messageId || null,
          sentAt: new Date(),
          errorMessage: null,
        },
      }).catch(() => {});
      return { success: true, messageId: sendResult.messageId };
    } else {
      console.error(`BREVO_DISPATCH_FAILED\nstatus: ${sendResult.status || 500}\nerror: ${sendResult.error}`);
      console.log(`EMAIL_LOG_WRITE\nstatus: FAILED\nidempotencyKey: ${idempotencyKey}`);
      await prisma.emailLog.update({
        where: { idempotencyKey },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          errorMessage: sendResult.error || "Failed to send email.",
        },
      }).catch(() => {});
      return { success: false, error: sendResult.error };
    }
  } catch (err: any) {
    const errorMsg = typeof err?.message === "string" ? err.message : "Internal error sending milestone email.";
    console.error(`BREVO_DISPATCH_FAILED\nstatus: 500\nerror: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

export async function sendShipmentMilestoneEmail(params: {
  shipmentId: string;
  milestone: ShipmentStatus;
  force?: boolean;
}): Promise<{ success: boolean; skipped?: boolean; reason?: string; error?: string }> {
  const event = SHIPMENT_EMAIL_EVENTS[params.milestone] || `SHIPMENT_${params.milestone}`;
  return sendShipmentStatusEmail({
    shipmentId: params.shipmentId,
    status: params.milestone,
    event,
    force: params.force ?? true,
  });
}

// 5. Shipping Fee Reminder
export async function sendShippingFeeReminderEmail(params: {
  shipmentId: string;
  force?: boolean;
}): Promise<{ success: boolean; messageId?: string; skipped?: boolean; reason?: string; error?: string }> {
  console.log(`[FEE_STATEMENT_START] Initiating shipping fee statement for shipment: ${params.shipmentId} (force: ${Boolean(params.force)})`);

  try {
    const settings = await getSystemSettings().catch(() => null);
    if (settings && !settings.feeReminderEnabled && !params.force) {
      console.log(`FEE_REMINDER_SKIPPED\nreason: DISABLED_IN_SYSTEM_SETTINGS`);
      return { success: true, skipped: true, reason: "Shipping fee reminders are disabled in System Settings." };
    }

    await ensureEmailLogSchema();
    const shipment = await prisma.shipment.findFirst({
      where: {
        OR: [
          { id: params.shipmentId },
          { trackingNumber: params.shipmentId },
          { trackingNumber: params.shipmentId.toUpperCase() },
        ],
      },
      include: { customer: true, batch: true, payments: true },
    });

    if (!shipment) return { success: false, error: "Shipment not found." };
    if (!shipment.fee || shipment.fee <= 0) {
      return { success: true, skipped: true, reason: "No shipping fee assigned to shipment." };
    }
    if (!isFeeReminderEligibleStatus(shipment.status) && !params.force) {
      return {
        success: true,
        skipped: true,
        reason: `Shipment status '${shipment.status}' is not eligible for shipping fee reminders yet. Reminders begin at 'On the Way to Ghana'.`,
      };
    }

    const customer = shipment.customer;
    if (!customer) return { success: false, error: "Customer not found." };

    const successfulPayments = (shipment.payments || []).filter((p) => p.status === "SUCCESS" && p.type === "SHIPPING_FEE");
    const amountPaid = successfulPayments.reduce((acc, p) => acc + p.amount, 0);
    const outstandingBalance = Math.max(0, shipment.fee - amountPaid);

    if (outstandingBalance <= 0) {
      return { success: true, skipped: true, reason: "Shipping fee is fully paid. No reminder needed." };
    }

    const recipientEmail = customer.email?.trim();
    if (!recipientEmail || !recipientEmail.includes("@") || !recipientEmail.includes(".")) {
      return { success: true, skipped: true, reason: "Customer has no valid email." };
    }

    const batch = shipment.batch;
    const batchDisplay = batch ? (batch.name || batch.batchNumber || "Consignment") : "Consignment";

    // Dynamic cadence frequency check (default 3 days or configured in settings)
    const intervalDays = settings?.feeReminderIntervalDays || 3;
    console.log(`EMAIL_LOG_CHECK_START\nshipmentId: ${shipment.id}\neventType: SHIPPING_FEE_REMINDER\nintervalDays: ${intervalDays}`);
    const intervalAgo = new Date(Date.now() - intervalDays * 24 * 60 * 60 * 1000);
    const recentReminder = await prisma.emailLog.findFirst({
      where: {
        shipmentId: shipment.id,
        eventType: "SHIPPING_FEE_REMINDER",
        status: "SENT",
        createdAt: { gte: intervalAgo },
      },
      orderBy: { createdAt: "desc" },
    });

    if (recentReminder && !params.force) {
      console.log(`EMAIL_LOG_DUPLICATE\nreason: SENT_WITHIN_${intervalDays}_DAYS\nlastSent: ${recentReminder.createdAt.toISOString()}`);
      return {
        success: true,
        skipped: true,
        reason: `Reminder already sent within the last ${intervalDays} days (${recentReminder.createdAt.toISOString().split("T")[0]}).`,
      };
    }
    console.log("EMAIL_LOG_CHECK_SUCCESS");

    const idempotencyKey = `fee-reminder-${shipment.id}-${Date.now()}`;
    const subject = `LMX8 IMPORTS — Shipping Fee Statement for ${shipment.trackingNumber}`;
    const portalBase = getPortalBaseUrl();
    const portalUrl = `${portalBase}/portal/payments`;
    const paymentUrl = `${portalBase}/pay/${shipment.id}`;

    const htmlContent = await generateShippingFeeReminderHtml({
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

    console.log(`EMAIL_LOG_WRITE_START\nidempotencyKey: ${idempotencyKey}\nstatus: PENDING`);
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
    }).catch((logErr) => {
      console.warn("EMAIL_LOG_WRITE_FAILED", logErr?.message || logErr);
    });
    console.log("EMAIL_LOG_WRITE_SUCCESS");

    console.log(`BREVO_DISPATCH_START\nrecipient: ${recipientEmail}\nsubject: ${subject}`);
    const sendResult = await sendBrevoEmail({
      to: [{ email: recipientEmail, name: customer.name }],
      subject,
      htmlContent,
    });

    console.log(`BREVO_RESPONSE\nstatus: ${sendResult.status || (sendResult.success ? 200 : 500)}`);

    if (sendResult.success) {
      console.log(`BREVO_DISPATCH_SUCCESS\nmessageId: ${sendResult.messageId || "dispatched"}`);
      await prisma.emailLog.update({
        where: { idempotencyKey },
        data: {
          status: "SENT",
          providerMessageId: sendResult.messageId || null,
          sentAt: new Date(),
        },
      }).catch(() => {});
      return { success: true, messageId: sendResult.messageId };
    } else {
      console.error(`BREVO_DISPATCH_FAILED\nstatus: ${sendResult.status || 500}\nerror: ${sendResult.error}`);
      await prisma.emailLog.update({
        where: { idempotencyKey },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          errorMessage: sendResult.error || "Failed to send reminder.",
        },
      }).catch(() => {});
      return { success: false, error: sendResult.error };
    }
  } catch (err: any) {
    const errorMsg = typeof err?.message === "string" ? err.message : "Internal error sending fee reminder.";
    console.error("[sendShippingFeeReminderEmail] Exception caught:", errorMsg);
    return { success: false, error: errorMsg };
  }
}

// 6. Sourcing Credit Purchase Success
export async function sendCreditPurchaseSuccessEmail(paymentId: string): Promise<{ success: boolean; skipped?: boolean; reason?: string; error?: string }> {
  try {
    await ensureEmailLogSchema();
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { customer: true },
    });

    if (!payment) return { success: false, error: "Payment not found." };
    const customer = payment.customer;
    if (!customer) return { success: false, error: "Customer not found." };
    if (!customer.email || !customer.email.trim().includes("@")) {
      return { success: true, skipped: true, reason: "Customer has no valid email." };
    }

    const idempotencyKey = `credit-purchase-success-${payment.reference}`;
    const existingLog = await prisma.emailLog.findUnique({ where: { idempotencyKey } });
    if (existingLog && existingLog.status === "SENT") {
      return { success: true, skipped: true, reason: "Credit purchase success email already sent." };
    }

    const metadata = payment.metadata as any;
    const credits = metadata?.credits || 0;

    const portalBase = getPortalBaseUrl();
    const portalUrl = `${portalBase}/portal/credits`;
    const htmlContent = await generateCreditPurchaseSuccessHtml({
      customerName: customer.name,
      reference: payment.reference,
      amount: payment.amount,
      credits,
      date: new Date(payment.createdAt).toLocaleDateString("en-GH"),
      portalUrl,
    });

    const subject = `LMX8 Sourcing Credits Purchased — Reference ${payment.reference}`;

    await prisma.emailLog.upsert({
      where: { idempotencyKey },
      update: { status: "PENDING", updatedAt: new Date() },
      create: {
        customerId: customer.id,
        eventType: "CREDIT_PURCHASE_SUCCESS",
        status: "PENDING",
        recipient: customer.email.trim(),
        subject,
        idempotencyKey,
      },
    });

    const result = await sendBrevoEmail({
      to: [{ email: customer.email.trim(), name: customer.name }],
      subject,
      htmlContent,
    });

    if (result.success) {
      await prisma.emailLog.update({
        where: { idempotencyKey },
        data: { status: "SENT", providerMessageId: result.messageId || null, sentAt: new Date() },
      });
      return { success: true };
    } else {
      await prisma.emailLog.update({
        where: { idempotencyKey },
        data: { status: "FAILED", failedAt: new Date(), errorMessage: result.error || "Failed to send credit purchase success email." },
      });
      return { success: false, error: result.error };
    }
  } catch (err: any) {
    console.error("[sendCreditPurchaseSuccessEmail] Exception:", err);
    return { success: false, error: err?.message || "Internal error." };
  }
}

// 7. Shipping Fee Paid Success
export async function sendShippingFeePaidSuccessEmail(paymentId: string): Promise<{ success: boolean; skipped?: boolean; reason?: string; error?: string }> {
  try {
    await ensureEmailLogSchema();
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { customer: true, shipment: true },
    });

    if (!payment) return { success: false, error: "Payment not found." };
    const customer = payment.customer;
    if (!customer) return { success: false, error: "Customer not found." };
    if (!customer.email || !customer.email.trim().includes("@")) {
      return { success: true, skipped: true, reason: "Customer has no valid email." };
    }

    const shipment = payment.shipment;
    if (!shipment) return { success: false, error: "Shipment not found for payment." };

    const idempotencyKey = `shipping-fee-success-${payment.reference}`;
    const existingLog = await prisma.emailLog.findUnique({ where: { idempotencyKey } });
    if (existingLog && existingLog.status === "SENT") {
      return { success: true, skipped: true, reason: "Shipping fee paid success email already sent." };
    }

    const portalBase = getPortalBaseUrl();
    const portalUrl = `${portalBase}/portal/payments`;
    const htmlContent = await generateShippingFeePaidHtml({
      customerName: customer.name,
      trackingNumber: shipment.trackingNumber,
      reference: payment.reference,
      amount: payment.amount,
      date: new Date(payment.createdAt).toLocaleDateString("en-GH"),
      portalUrl,
    });

    const subject = `LMX8 Shipping Fee Payment Confirmed for ${shipment.trackingNumber}`;

    await prisma.emailLog.upsert({
      where: { idempotencyKey },
      update: { status: "PENDING", updatedAt: new Date() },
      create: {
        customerId: customer.id,
        shipmentId: shipment.id,
        eventType: "SHIPPING_FEE_PAID",
        status: "PENDING",
        recipient: customer.email.trim(),
        subject,
        idempotencyKey,
      },
    });

    const result = await sendBrevoEmail({
      to: [{ email: customer.email.trim(), name: customer.name }],
      subject,
      htmlContent,
    });

    if (result.success) {
      await prisma.emailLog.update({
        where: { idempotencyKey },
        data: { status: "SENT", providerMessageId: result.messageId || null, sentAt: new Date() },
      });
      return { success: true };
    } else {
      await prisma.emailLog.update({
        where: { idempotencyKey },
        data: { status: "FAILED", failedAt: new Date(), errorMessage: result.error || "Failed to send shipping fee paid email." },
      });
      return { success: false, error: result.error };
    }
  } catch (err: any) {
    console.error("[sendShippingFeePaidSuccessEmail] Exception:", err);
    return { success: false, error: err?.message || "Internal error." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer Credential & Access Instructions Delivery
// ─────────────────────────────────────────────────────────────────────────────

export async function generateCustomerCredentialsEmailHtml(data: {
  customerName: string;
  customerIdentifier: string;
  phone?: string;
  loginUrl: string;
}): Promise<string> {
  const content = `
    <p class="greeting">Hello ${data.customerName || "Valued Customer"},</p>
    <p class="lead">Here are your official credentials and secure access instructions for the <strong>LMX8 IMPORTS Customer Portal</strong>.</p>
    
    <div class="status-card" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <div class="status-badge" style="background: #141B47; color: #FFFFFF; font-weight: 700; margin-bottom: 12px;">ACCOUNT ACCESS CREDENTIALS</div>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td class="label" style="padding: 8px 0; color: #64748B; font-size: 13px;">Customer Name</td>
          <td class="val" style="padding: 8px 0; color: #0F172A; font-weight: 700; text-align: right; font-size: 13px;">${data.customerName}</td>
        </tr>
        <tr>
          <td class="label" style="padding: 8px 0; color: #64748B; font-size: 13px;">Customer ID</td>
          <td class="val" style="padding: 8px 0; color: #141B47; font-weight: 800; text-align: right; font-size: 14px; font-family: monospace;">${data.customerIdentifier}</td>
        </tr>
        ${data.phone ? `
        <tr>
          <td class="label" style="padding: 8px 0; color: #64748B; font-size: 13px;">Registered Phone</td>
          <td class="val" style="padding: 8px 0; color: #0F172A; font-weight: 600; text-align: right; font-size: 13px;">${data.phone}</td>
        </tr>
        ` : ""}
      </table>
    </div>

    <div style="background: #EFF6FF; border-left: 4px solid #355DAF; padding: 16px 20px; border-radius: 8px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: #1E3A8A;">How to Sign In:</h3>
      <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #1E293B; line-height: 1.6;">
        <li>Visit the portal login at <a href="${data.loginUrl}" style="color: #355DAF; font-weight: 600;">${data.loginUrl}</a>.</li>
        <li>Enter your <strong>Customer ID (${data.customerIdentifier})</strong> or your registered phone number.</li>
        <li>Enter your confidential 6-digit access PIN provided to you.</li>
        <li>Once signed in, you can update your PIN anytime under <strong>My Profile &gt; Change PIN</strong>.</li>
      </ol>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${data.loginUrl}" class="btn" style="background: #F2901F; color: #FFFFFF; font-weight: 800; font-size: 14px; padding: 14px 32px; text-decoration: none; border-radius: 10px; display: inline-block;">Open Customer Portal</a>
    </div>

    <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 14px; margin-top: 20px; font-size: 12px; color: #78350F; line-height: 1.5;">
      <strong>Security Reminder:</strong> Never share your PIN with anyone. LMX8 IMPORTS representatives will never request your secret PIN over phone or email. If you suspect unauthorized access, contact administration immediately.
    </div>
  `;

  return wrapInBrandedLayout("Your LMX8 IMPORTS Account Access Credentials", content);
}

export async function sendCustomerCredentialsEmail(customerId: string): Promise<{
  success: boolean;
  messageId?: string;
  recipient?: string;
  error?: string;
}> {
  try {
    await ensureEmailLogSchema();

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return { success: false, error: "Customer record not found." };
    }

    if (!customer.email || !customer.email.trim().includes("@")) {
      return { success: false, error: "Customer has no verified email address configured." };
    }

    const recipient = customer.email.trim();
    const portalBase = getPortalBaseUrl();
    const loginUrl = `${portalBase}/login`;
    const idempotencyKey = `customer-credentials-${customer.id}-${Date.now()}`;

    const htmlContent = await generateCustomerCredentialsEmailHtml({
      customerName: customer.name,
      customerIdentifier: customer.customerIdentifier,
      phone: customer.phone || undefined,
      loginUrl,
    });

    const subject = `Your LMX8 IMPORTS Account Access Details (${customer.customerIdentifier})`;

    await prisma.emailLog.create({
      data: {
        customerId: customer.id,
        eventType: "CUSTOMER_CREDENTIAL_INSTRUCTIONS",
        status: "PENDING",
        recipient,
        subject,
        idempotencyKey,
        metadata: {
          customerIdentifier: customer.customerIdentifier,
          action: "ADMIN_CREDENTIAL_DELIVERY",
        },
      },
    });

    const result = await sendBrevoEmail({
      to: [{ email: recipient, name: customer.name }],
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

      return {
        success: true,
        messageId: result.messageId,
        recipient,
      };
    } else {
      await prisma.emailLog.update({
        where: { idempotencyKey },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          errorMessage: result.error || "Failed to deliver credentials email via Brevo.",
        },
      });

      return {
        success: false,
        recipient,
        error: result.error || "Brevo dispatch failed.",
      };
    }
  } catch (err: any) {
    console.error("[sendCustomerCredentialsEmail] Exception:", err);
    return { success: false, error: err?.message || "Internal delivery error." };
  }
}


