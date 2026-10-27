import { wrapInBrandedLayout } from "@/lib/email/brevo";
import { getBrandingForEmail, EmailBrandingInfo } from "@/lib/branding";
import { formatCurrency } from "@/lib/currency";

export interface InvoiceEmailData {
  clientName: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  totalAmount: number;
  amountPaid: number;
  outstandingBalance: number;
  status?: string;
  freightStatus?: "CONFIRMED" | "PENDING" | "NOT_APPLICABLE" | null;
  shipmentReference?: string | null;
  paymentInstructions?: string | null;
  clientNotes?: string | null;
  publicViewUrl: string;
  customNote?: string | null;
}

export async function generateInvoiceEmailHtml(data: InvoiceEmailData): Promise<string> {
  const branding = await getBrandingForEmail();

  const formattedTotal = formatCurrency(data.totalAmount, data.currency);
  const formattedPaid = formatCurrency(data.amountPaid, data.currency);
  const formattedBalance = formatCurrency(data.outstandingBalance, data.currency);
  const isPaid = data.status === "PAID" || (data.outstandingBalance <= 0 && data.totalAmount > 0);

  const shipmentRowHtml = data.shipmentReference
    ? `<tr>
        <td class="label" style="padding: 8px 0; color: #64748B; font-weight: 500; font-size: 13px;">Linked Shipment:</td>
        <td class="val" style="padding: 8px 0; color: #0F172A; font-weight: 700; text-align: right; font-size: 13px; font-family: monospace;">${data.shipmentReference}</td>
      </tr>`
    : "";

  const freightRowHtml = data.freightStatus === "PENDING"
    ? `<tr style="border-top: 1px solid #F1F5F9;">
        <td class="label" style="padding: 8px 0; color: #D97706; font-weight: 600; font-size: 13px;">Shipping / Freight:</td>
        <td class="val" style="padding: 8px 0; color: #B45309; font-weight: 700; text-align: right; font-size: 12px; text-transform: uppercase;">Pending Confirmation</td>
      </tr>`
    : "";

  const customNoteHtml = data.customNote
    ? `<div style="background-color: #FEF3C7; border: 1px solid #FCD34D; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #92400E;">
        <strong>Note from administrator:</strong><br>${data.customNote.replace(/\n/g, "<br>")}
      </div>`
    : "";

  // If paid in full, suppress payment instructions completely and show paid confirmation
  const paymentInstructionsHtml = isPaid
    ? `<div style="background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 10px; padding: 14px 18px; margin: 20px 0; font-size: 13px; color: #065F46;">
        <strong style="color: #047857; display: block; margin-bottom: 4px;">Payment Received · Paid in Full</strong>
        This invoice is paid in full. No further payment is required.
      </div>`
    : data.paymentInstructions
    ? `<div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px 18px; margin: 20px 0; font-size: 13px; color: #334155;">
        <strong style="color: ${branding.primaryColor || "#141B47"}; display: block; margin-bottom: 6px;">Payment Instructions:</strong>
        <div style="line-height: 1.5; white-space: pre-wrap;">${data.paymentInstructions}</div>
      </div>`
    : "";

  const clientNotesHtml = data.clientNotes
    ? `<div style="font-size: 12px; color: #64748B; margin-top: 12px; font-style: italic;">
        ${data.clientNotes}
      </div>`
    : "";

  const statusHeaderBadge = isPaid
    ? `<span style="background-color: #DCFCE7; color: #15803D; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 20px; border: 1px solid #86EFAC;">
        PAID IN FULL
       </span>`
    : `<span style="background-color: #FEF3C7; color: #B45309; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 20px; border: 1px solid #FCD34D;">
        PAYMENT DUE
       </span>`;

  const leadText = isPaid
    ? `Here is your payment receipt for invoice <strong>#${data.invoiceNumber}</strong> from <strong>${branding.businessName}</strong>.`
    : `Here is invoice <strong>#${data.invoiceNumber}</strong> from <strong>${branding.businessName}</strong>.`;

  const buttonText = isPaid ? "View Receipt →" : "View Invoice →";

  const bodyContent = `
    <h2 class="greeting" style="font-size: 18px; font-weight: 700; color: ${branding.primaryColor || "#141B47"}; margin: 0 0 12px 0;">
      Dear ${data.clientName},
    </h2>
    
    <p class="lead" style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
      ${leadText}
    </p>

    ${customNoteHtml}

    <div class="status-card" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; padding: 22px; margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #E2E8F0; padding-bottom: 12px; margin-bottom: 12px;">
        <div>
          <span style="font-size: 11px; font-weight: 800; color: ${branding.accentColor || "#F2901F"}; text-transform: uppercase; letter-spacing: 0.8px; display: block;">
            INVOICE SUMMARY
          </span>
          <span style="font-family: monospace; font-size: 13px; font-weight: 700; color: ${branding.primaryColor || "#141B47"};">
            #${data.invoiceNumber}
          </span>
        </div>
        <div>
          ${statusHeaderBadge}
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td class="label" style="padding: 8px 0; color: #64748B; font-weight: 500; font-size: 13px;">Invoice Date:</td>
          <td class="val" style="padding: 8px 0; color: #0F172A; font-weight: 700; text-align: right; font-size: 13px;">${data.issueDate}</td>
        </tr>
        <tr style="border-top: 1px solid #F1F5F9;">
          <td class="label" style="padding: 8px 0; color: #64748B; font-weight: 500; font-size: 13px;">Payment Due Date:</td>
          <td class="val" style="padding: 8px 0; color: ${isPaid ? "#475569" : "#B91C1C"}; font-weight: 700; text-align: right; font-size: 13px;">${data.dueDate}</td>
        </tr>
        ${shipmentRowHtml}
        ${freightRowHtml}
        <tr style="border-top: 1px solid #F1F5F9;">
          <td class="label" style="padding: 8px 0; color: #64748B; font-weight: 500; font-size: 13px;">Total Invoiced:</td>
          <td class="val" style="padding: 8px 0; color: #0F172A; font-weight: 700; text-align: right; font-size: 13px; font-family: monospace;">${formattedTotal}</td>
        </tr>
        <tr style="border-top: 1px solid #F1F5F9;">
          <td class="label" style="padding: 8px 0; color: #64748B; font-weight: 500; font-size: 13px;">Amount Paid:</td>
          <td class="val" style="padding: 8px 0; color: #16A34A; font-weight: 700; text-align: right; font-size: 13px; font-family: monospace;">${formattedPaid}</td>
        </tr>
        <tr style="border-top: 2px solid #E2E8F0;">
          <td class="label" style="padding: 10px 0; color: ${branding.primaryColor || "#141B47"}; font-weight: 800; font-size: 14px;">Outstanding Balance:</td>
          <td class="val" style="padding: 10px 0; color: ${data.outstandingBalance > 0 ? "#DC2626" : "#16A34A"}; font-weight: 900; text-align: right; font-size: 16px; font-family: monospace;">${formattedBalance}</td>
        </tr>
      </table>
    </div>

    ${paymentInstructionsHtml}

    <div style="text-align: center; margin: 30px 0 20px 0;">
      <a href="${data.publicViewUrl}" class="btn" style="display: inline-block; background-color: ${branding.accentColor || "#F2901F"}; color: #FFFFFF !important; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 10px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        ${buttonText}
      </a>
      <p style="font-size: 12px; color: #64748B; margin-top: 8px;">
        You can securely review, print, and download your invoice at any time using the link above.
      </p>
    </div>

    ${clientNotesHtml}

    <p style="font-size: 13px; line-height: 1.6; color: #475569; margin-top: 24px;">
      If you have any questions regarding this document, please do not hesitate to contact our desk.<br><br>
      Thank you for choosing <strong>${branding.businessName}</strong>.
    </p>
  `;

  return wrapInBrandedLayout(`Invoice ${data.invoiceNumber} — ${branding.businessName}`, bodyContent);
}
