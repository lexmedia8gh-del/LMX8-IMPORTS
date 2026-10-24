"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { ensureInvoiceSchema } from "@/lib/invoice-schema";
import { normalizePhoneNumber } from "@/lib/phone";
import { sendBrevoEmail } from "@/lib/email/brevo";
import { generateInvoiceEmailHtml } from "@/lib/email/invoice-email";
import { getBrandSettings } from "@/lib/branding";
import { getBrandSettingsAction } from "@/app/actions/branding";
import { getSystemSettings } from "@/lib/system-settings";
import { revalidatePath } from "next/cache";

export interface InvoiceItemInput {
  description: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

export interface CreateInvoiceInput {
  customerId: string;
  shipmentId?: string | null;
  issueDate?: string;
  dueDate: string;
  currency?: string;
  items: InvoiceItemInput[];
  discountAmount?: number;
  discountPercent?: number;
  shippingCharges?: number;
  freightStatus?: "CONFIRMED" | "PENDING" | "NOT_APPLICABLE";
  freightNotes?: string;
  handlingCharges?: number;
  customsCharges?: number;
  otherCharges?: number;
  taxRate?: number;
  paymentInstructions?: string;
  clientNotes?: string;
  internalNotes?: string;
  purchaseOrderRef?: string;
  status?: "DRAFT" | "ISSUED" | "PAID" | "PARTIALLY_PAID";
  initialPaymentAmount?: number;
  initialPaymentMethod?: string;
  initialPaymentReference?: string;
}

export interface UpdateInvoiceInput extends Partial<CreateInvoiceInput> {
  id: string;
}

export interface UpdateFreightChargesInput {
  invoiceId: string;
  freightStatus: "CONFIRMED" | "PENDING" | "NOT_APPLICABLE";
  freightAmount: number;
  freightNotes?: string;
}

function getAppBaseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "https://lmx8imports.com";
}

// Calculate financial figures with safe decimal rounding
function calculateInvoiceFinancials(data: {
  items: InvoiceItemInput[];
  discountAmount?: number;
  discountPercent?: number;
  shippingCharges?: number;
  handlingCharges?: number;
  customsCharges?: number;
  otherCharges?: number;
  taxRate?: number;
  amountPaid?: number;
}) {
  const calculatedItems = data.items.map((item, idx) => {
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const price = Math.max(0, Number(item.unitPrice) || 0);
    const itemDiscount = Math.max(0, Number(item.discount) || 0);
    const lineTotal = Math.max(0, Math.round((qty * price - itemDiscount) * 100) / 100);
    return {
      description: item.description.trim() || `Item ${idx + 1}`,
      sku: item.sku?.trim() || null,
      quantity: qty,
      unitPrice: price,
      discount: itemDiscount,
      lineTotal,
      sortOrder: idx,
    };
  });

  const subtotal = Math.round(calculatedItems.reduce((acc, it) => acc + it.lineTotal, 0) * 100) / 100;

  // Invoice-level discount
  let discountAmount = Math.max(0, Number(data.discountAmount) || 0);
  const discountPercent = Math.max(0, Math.min(100, Number(data.discountPercent) || 0));
  if (discountPercent > 0 && discountAmount === 0) {
    discountAmount = Math.round((subtotal * (discountPercent / 100)) * 100) / 100;
  }
  discountAmount = Math.min(subtotal, discountAmount);

  const baseAfterDiscount = Math.max(0, subtotal - discountAmount);

  const shippingCharges = Math.max(0, Number(data.shippingCharges) || 0);
  const handlingCharges = Math.max(0, Number(data.handlingCharges) || 0);
  const customsCharges = Math.max(0, Number(data.customsCharges) || 0);
  const otherCharges = Math.max(0, Number(data.otherCharges) || 0);
  const totalCharges = Math.round((shippingCharges + handlingCharges + customsCharges + otherCharges) * 100) / 100;

  const taxRate = Math.max(0, Number(data.taxRate) || 0);
  const taxAmount = taxRate > 0 ? Math.round((baseAfterDiscount * (taxRate / 100)) * 100) / 100 : 0;

  const totalAmount = Math.round((baseAfterDiscount + totalCharges + taxAmount) * 100) / 100;
  const amountPaid = Math.max(0, Number(data.amountPaid) || 0);
  const outstandingBalance = Math.max(0, Math.round((totalAmount - amountPaid) * 100) / 100);

  return {
    calculatedItems,
    subtotal,
    discountAmount,
    discountPercent,
    shippingCharges,
    handlingCharges,
    customsCharges,
    otherCharges,
    taxRate,
    taxAmount,
    totalAmount,
    amountPaid,
    outstandingBalance,
  };
}

/**
 * Generate a unique sequential invoice number for the current year
 * Format: INV-YYYY-XXXX (e.g. INV-2026-0001)
 */
async function generateNextInvoiceNumber(): Promise<string> {
  await ensureInvoiceSchema();
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  try {
    const latest = await prisma.invoice.findFirst({
      where: {
        invoiceNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        invoiceNumber: "desc",
      },
      select: {
        invoiceNumber: true,
      },
    });

    if (latest && latest.invoiceNumber) {
      const parts = latest.invoiceNumber.split("-");
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        const nextSeq = (lastSeq + 1).toString().padStart(4, "0");
        return `${prefix}${nextSeq}`;
      }
    }
  } catch (err) {
    console.warn("[generateNextInvoiceNumber] Falling back to count-based sequence:", err);
  }

  // Fallback count-based sequence
  try {
    const count = await prisma.invoice.count();
    const nextSeq = (count + 1).toString().padStart(4, "0");
    return `${prefix}${nextSeq}`;
  } catch {
    return `${prefix}${Date.now().toString().slice(-4)}`;
  }
}

/**
 * Get all invoices with filtering, search, pagination, and dashboard metrics
 */
export async function getInvoicesAction(filters?: {
  status?: string;
  customerId?: string;
  shipmentId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) {
  await requireAdminSession();
  await ensureInvoiceSchema();

  try {
    const now = new Date();
    const where: any = {};

    if (filters?.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters?.shipmentId) {
      where.shipmentId = filters.shipmentId;
    }

    if (filters?.status && filters.status !== "ALL") {
      if (filters.status === "OVERDUE") {
        where.status = { notIn: ["PAID", "CANCELLED"] };
        where.dueDate = { lt: now };
        where.outstandingBalance = { gt: 0 };
      } else {
        where.status = filters.status;
      }
    }

    if (filters?.startDate || filters?.endDate) {
      where.issueDate = {};
      if (filters.startDate) where.issueDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.issueDate.lte = new Date(filters.endDate);
    }

    if (filters?.search && filters.search.trim()) {
      const term = filters.search.trim();
      where.OR = [
        { invoiceNumber: { contains: term, mode: "insensitive" } },
        { purchaseOrderRef: { contains: term, mode: "insensitive" } },
        { customer: { name: { contains: term, mode: "insensitive" } } },
        { customer: { customerIdentifier: { contains: term, mode: "insensitive" } } },
        { customer: { email: { contains: term, mode: "insensitive" } } },
        { customer: { phone: { contains: term, mode: "insensitive" } } },
        { shipment: { trackingNumber: { contains: term, mode: "insensitive" } } },
      ];
    }

    const page = Math.max(1, filters?.page || 1);
    const limit = Math.max(1, Math.min(100, filters?.limit || 20));
    const skip = (page - 1) * limit;

    const [invoices, totalCount, allInvoicesForMetrics] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              customerIdentifier: true,
              name: true,
              phone: true,
              email: true,
            },
          },
          shipment: {
            select: {
              id: true,
              trackingNumber: true,
              description: true,
              status: true,
            },
          },
          _count: {
            select: {
              items: true,
              payments: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        select: {
          status: true,
          dueDate: true,
          totalAmount: true,
          amountPaid: true,
          outstandingBalance: true,
        },
      }),
    ]);

    // Calculate authoritative dashboard metrics
    let totalInvoices = allInvoicesForMetrics.length;
    let paidInvoices = 0;
    let unpaidInvoices = 0;
    let partiallyPaidInvoices = 0;
    let overdueInvoices = 0;
    let totalInvoicedAmount = 0;
    let totalOutstandingBalance = 0;

    for (const inv of allInvoicesForMetrics) {
      if (inv.status === "CANCELLED") continue;

      totalInvoicedAmount += inv.totalAmount || 0;
      totalOutstandingBalance += inv.outstandingBalance || 0;

      const isOverdue =
        inv.status !== "PAID" &&
        new Date(inv.dueDate) < now &&
        (inv.outstandingBalance || 0) > 0;

      if (isOverdue) {
        overdueInvoices++;
      }

      if (inv.status === "PAID" || (inv.outstandingBalance <= 0 && inv.totalAmount > 0)) {
        paidInvoices++;
      } else if (inv.status === "PARTIALLY_PAID" || (inv.amountPaid > 0 && inv.outstandingBalance > 0)) {
        partiallyPaidInvoices++;
      } else {
        unpaidInvoices++;
      }
    }

    // Determine runtime status for displayed invoices (detecting OVERDUE dynamically)
    const formattedInvoices = invoices.map((inv) => {
      let runtimeStatus = inv.status;
      if (
        inv.status !== "PAID" &&
        inv.status !== "CANCELLED" &&
        new Date(inv.dueDate) < now &&
        inv.outstandingBalance > 0
      ) {
        runtimeStatus = "OVERDUE" as any;
      }

      return {
        ...inv,
        status: runtimeStatus,
        issueDate: inv.issueDate.toISOString(),
        dueDate: inv.dueDate.toISOString(),
        createdAt: inv.createdAt.toISOString(),
        updatedAt: inv.updatedAt.toISOString(),
        lastSentAt: inv.lastSentAt ? inv.lastSentAt.toISOString() : null,
      };
    });

    return {
      success: true,
      invoices: formattedInvoices,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
      metrics: {
        totalInvoices,
        paidInvoices,
        unpaidInvoices,
        partiallyPaidInvoices,
        overdueInvoices,
        totalInvoicedAmount: Math.round(totalInvoicedAmount * 100) / 100,
        totalOutstandingBalance: Math.round(totalOutstandingBalance * 100) / 100,
      },
    };
  } catch (error: any) {
    console.error("[getInvoicesAction] Error loading invoices:", error);
    return {
      success: false,
      error: error?.message || "Failed to load invoices",
      invoices: [],
      pagination: { total: 0, page: 1, limit: 20, totalPages: 1 },
      metrics: {
        totalInvoices: 0,
        paidInvoices: 0,
        unpaidInvoices: 0,
        partiallyPaidInvoices: 0,
        overdueInvoices: 0,
        totalInvoicedAmount: 0,
        totalOutstandingBalance: 0,
      },
    };
  }
}

/**
 * Get an invoice by its ID or Invoice Number for admin viewing/editing
 */
export async function getInvoiceByIdAction(idOrNumber: string) {
  await requireAdminSession();
  await ensureInvoiceSchema();

  try {
    const invoice = await prisma.invoice.findFirst({
      where: {
        OR: [{ id: idOrNumber }, { invoiceNumber: idOrNumber }],
      },
      include: {
        customer: true,
        shipment: true,
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
        payments: {
          orderBy: {
            paymentDate: "desc",
          },
        },
        communicationLogs: {
          orderBy: {
            createdAt: "desc",
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    const now = new Date();
    let runtimeStatus = invoice.status;
    if (
      invoice.status !== "PAID" &&
      invoice.status !== "CANCELLED" &&
      new Date(invoice.dueDate) < now &&
      invoice.outstandingBalance > 0
    ) {
      runtimeStatus = "OVERDUE" as any;
    }

    const publicUrl = `${getAppBaseUrl()}/invoices/${invoice.accessToken}`;
    const branding = await getBrandSettingsAction();

    return {
      success: true,
      invoice: {
        ...invoice,
        status: runtimeStatus,
        freightStatus: invoice.freightStatus || (invoice.shippingCharges > 0 ? "CONFIRMED" : "PENDING"),
        freightNotes: invoice.freightNotes || null,
        issueDate: invoice.issueDate.toISOString(),
        dueDate: invoice.dueDate.toISOString(),
        createdAt: invoice.createdAt.toISOString(),
        updatedAt: invoice.updatedAt.toISOString(),
        lastSentAt: invoice.lastSentAt ? invoice.lastSentAt.toISOString() : null,
        publicUrl,
        items: invoice.items.map((it) => ({
          ...it,
          createdAt: it.createdAt.toISOString(),
          updatedAt: it.updatedAt.toISOString(),
        })),
        payments: invoice.payments.map((p) => ({
          ...p,
          paymentDate: p.paymentDate.toISOString(),
          createdAt: p.createdAt.toISOString(),
        })),
        communicationLogs: invoice.communicationLogs.map((log) => ({
          ...log,
          createdAt: log.createdAt.toISOString(),
        })),
      },
      branding,
    };
  } catch (error: any) {
    console.error("[getInvoiceByIdAction] Error:", error);
    return { success: false, error: error?.message || "Failed to retrieve invoice" };
  }
}

/**
 * Public client-facing invoice retrieval by secure access token
 * Excludes internal admin notes for client confidentiality
 */
export async function getPublicInvoiceByTokenAction(token: string) {
  if (!token || typeof token !== "string" || token.length < 10) {
    return { success: false, error: "Invalid access link." };
  }

  await ensureInvoiceSchema();

  try {
    const invoice = await prisma.invoice.findUnique({
      where: {
        accessToken: token,
      },
      include: {
        customer: {
          select: {
            id: true,
            customerIdentifier: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        shipment: {
          select: {
            trackingNumber: true,
            description: true,
            origin: true,
            destination: true,
          },
        },
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            paymentMethod: true,
            reference: true,
          },
          orderBy: {
            paymentDate: "desc",
          },
        },
      },
    });

    if (!invoice) {
      return { success: false, error: "Invoice not found or link has expired." };
    }

    const branding = await getBrandSettingsAction();

    const now = new Date();
    let runtimeStatus = invoice.status;
    if (
      invoice.status !== "PAID" &&
      invoice.status !== "CANCELLED" &&
      new Date(invoice.dueDate) < now &&
      invoice.outstandingBalance > 0
    ) {
      runtimeStatus = "OVERDUE" as any;
    }

    return {
      success: true,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: runtimeStatus,
        issueDate: invoice.issueDate.toISOString(),
        dueDate: invoice.dueDate.toISOString(),
        currency: invoice.currency,
        subtotal: invoice.subtotal,
        discountAmount: invoice.discountAmount,
        discountPercent: invoice.discountPercent,
        shippingCharges: invoice.shippingCharges,
        freightStatus: invoice.freightStatus || (invoice.shippingCharges > 0 ? "CONFIRMED" : "PENDING"),
        freightNotes: invoice.freightNotes || null,
        handlingCharges: invoice.handlingCharges,
        customsCharges: invoice.customsCharges,
        otherCharges: invoice.otherCharges,
        taxRate: invoice.taxRate,
        taxAmount: invoice.taxAmount,
        totalAmount: invoice.totalAmount,
        amountPaid: invoice.amountPaid,
        outstandingBalance: invoice.outstandingBalance,
        paymentInstructions: invoice.paymentInstructions,
        clientNotes: invoice.clientNotes,
        // INTERNAL NOTES ARE STRICTLY OMITTED FOR PRIVACY
        purchaseOrderRef: invoice.purchaseOrderRef,
        customer: invoice.customer,
        shipment: invoice.shipment,
        items: invoice.items.map((it) => ({
          id: it.id,
          description: it.description,
          sku: it.sku,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: it.discount,
          lineTotal: it.lineTotal,
        })),
        payments: invoice.payments.map((p) => ({
          ...p,
          paymentDate: p.paymentDate.toISOString(),
        })),
      },
      branding,
    };
  } catch (error: any) {
    console.error("[getPublicInvoiceByTokenAction] Error:", error);
    return { success: false, error: "Failed to load invoice." };
  }
}

/**
 * Create a new invoice
 */
export async function createInvoiceAction(data: CreateInvoiceInput) {
  const admin = await requireAdminSession();
  await ensureInvoiceSchema();

  try {
    if (!data.customerId) {
      return { success: false, error: "Client selection is required." };
    }

    if (!data.items || data.items.length === 0) {
      return { success: false, error: "At least one item is required on the invoice." };
    }

    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
    });
    if (!customer) {
      return { success: false, error: "Selected client does not exist." };
    }

    // Verify shipment link belongs to the selected customer if linked
    if (data.shipmentId) {
      const shipment = await prisma.shipment.findUnique({
        where: { id: data.shipmentId },
        select: { id: true, customerId: true, trackingNumber: true },
      });
      if (!shipment) {
        return { success: false, error: "Selected shipment could not be found." };
      }
      if (shipment.customerId !== customer.id) {
        return { success: false, error: "The selected shipment does not belong to this client." };
      }
    }

    const freightStatus = data.freightStatus || (data.shippingCharges && data.shippingCharges > 0 ? "CONFIRMED" : "PENDING");
    const effectiveShippingCharges = freightStatus === "CONFIRMED" ? Math.max(0, Number(data.shippingCharges) || 0) : 0;

    const financials = calculateInvoiceFinancials({
      items: data.items,
      discountAmount: data.discountAmount,
      discountPercent: data.discountPercent,
      shippingCharges: effectiveShippingCharges,
      handlingCharges: data.handlingCharges,
      customsCharges: data.customsCharges,
      otherCharges: data.otherCharges,
      taxRate: data.taxRate,
      amountPaid: 0,
    });

    const invoiceNumber = await generateNextInvoiceNumber();
    const issueDate = data.issueDate ? new Date(data.issueDate) : new Date();
    const dueDate = new Date(data.dueDate);

    // Determine initial payment status and balance reconciliation
    let finalStatus: "DRAFT" | "ISSUED" | "PAID" | "PARTIALLY_PAID" = "DRAFT";
    let finalAmountPaid = 0;
    let finalOutstanding = financials.totalAmount;

    if (data.status === "PAID") {
      finalStatus = "PAID";
      finalAmountPaid = financials.totalAmount;
      finalOutstanding = 0;
    } else if (data.status === "PARTIALLY_PAID") {
      const initialPaid = Math.min(financials.totalAmount, Math.max(0, Number(data.initialPaymentAmount) || 0));
      finalAmountPaid = initialPaid;
      finalOutstanding = Math.max(0, Math.round((financials.totalAmount - initialPaid) * 100) / 100);
      finalStatus = finalOutstanding <= 0 ? "PAID" : initialPaid > 0 ? "PARTIALLY_PAID" : "ISSUED";
    } else if (data.status === "ISSUED") {
      finalStatus = "ISSUED";
      finalAmountPaid = 0;
      finalOutstanding = financials.totalAmount;
    } else {
      finalStatus = "DRAFT";
      finalAmountPaid = 0;
      finalOutstanding = financials.totalAmount;
    }

    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          status: finalStatus as any,
          issueDate,
          dueDate,
          currency: data.currency || "GHS",
          subtotal: financials.subtotal,
          discountAmount: financials.discountAmount,
          discountPercent: financials.discountPercent,
          shippingCharges: effectiveShippingCharges,
          freightStatus,
          freightNotes: data.freightNotes || null,
          handlingCharges: financials.handlingCharges,
          customsCharges: financials.customsCharges,
          otherCharges: financials.otherCharges,
          taxRate: financials.taxRate,
          taxAmount: financials.taxAmount,
          totalAmount: financials.totalAmount,
          amountPaid: finalAmountPaid,
          outstandingBalance: finalOutstanding,
          paymentInstructions: data.paymentInstructions || null,
          clientNotes: data.clientNotes || null,
          internalNotes: data.internalNotes || null,
          purchaseOrderRef: data.purchaseOrderRef || null,
          customerId: customer.id,
          shipmentId: data.shipmentId || null,
          createdById: admin.id,
          items: {
            create: financials.calculatedItems.map((it) => ({
              description: it.description,
              sku: it.sku,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              discount: it.discount,
              lineTotal: it.lineTotal,
              sortOrder: it.sortOrder,
            })),
          },
        },
      });

      // If marked as Paid or Partially Paid at creation, record auditable payment row
      if (finalStatus === "PAID" && financials.totalAmount > 0) {
        await tx.invoicePayment.create({
          data: {
            invoiceId: created.id,
            amount: financials.totalAmount,
            paymentDate: issueDate,
            paymentMethod: data.initialPaymentMethod || "ADMIN_CONFIRMED",
            reference: data.initialPaymentReference?.trim() || "CONFIRMED_ON_CREATION",
            notes: "Confirmed paid in full upon invoice creation by administrator",
            recordedBy: admin.name || admin.email,
          },
        });
      } else if (finalStatus === "PARTIALLY_PAID" && finalAmountPaid > 0) {
        await tx.invoicePayment.create({
          data: {
            invoiceId: created.id,
            amount: finalAmountPaid,
            paymentDate: issueDate,
            paymentMethod: data.initialPaymentMethod || "ADMIN_CONFIRMED",
            reference: data.initialPaymentReference?.trim() || "INITIAL_DEPOSIT",
            notes: "Initial partial payment recorded upon invoice creation",
            recordedBy: admin.name || admin.email,
          },
        });
      }

      return created;
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        action: "INVOICE_CREATED",
        entityType: "Invoice",
        entityId: invoice.id,
        description: `Invoice #${invoiceNumber} created for ${customer.name} with total amount ${data.currency || "GHS"} ${financials.totalAmount} (Status: ${finalStatus}, Freight: ${freightStatus}) by ${admin.name || admin.email}`,
        adminId: admin.id,
        metadata: {
          invoiceNumber,
          customerId: customer.id,
          totalAmount: financials.totalAmount,
          amountPaid: finalAmountPaid,
          outstandingBalance: finalOutstanding,
          status: finalStatus,
          freightStatus,
        },
      },
    });

    revalidatePath("/admin/invoices");

    return {
      success: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
    };
  } catch (error: any) {
    console.error("[createInvoiceAction] Error:", error);
    return { success: false, error: error?.message || "Failed to create invoice." };
  }
}

/**
 * Update an existing invoice (allowed for DRAFT or administrator revision)
 */
export async function updateInvoiceAction(data: UpdateInvoiceInput) {
  const admin = await requireAdminSession();
  await ensureInvoiceSchema();

  try {
    const existing = await prisma.invoice.findUnique({
      where: { id: data.id },
      include: { payments: true },
    });

    if (!existing) {
      return { success: false, error: "Invoice not found." };
    }

    if (existing.status === "CANCELLED") {
      return { success: false, error: "Cancelled invoices cannot be edited." };
    }

    // Verify shipment link belongs to customer if linked
    const targetCustomerId = data.customerId || existing.customerId;
    if (data.shipmentId) {
      const shipment = await prisma.shipment.findUnique({
        where: { id: data.shipmentId },
        select: { id: true, customerId: true },
      });
      if (!shipment || shipment.customerId !== targetCustomerId) {
        return { success: false, error: "The selected shipment does not belong to this client." };
      }
    }

    // Existing payments sum
    const totalPaymentsRecorded = existing.payments.reduce((acc, p) => acc + (p.amount || 0), 0);

    const freightStatus = data.freightStatus !== undefined ? data.freightStatus : (existing.freightStatus || "CONFIRMED");
    const rawShippingCharges = data.shippingCharges !== undefined ? data.shippingCharges : existing.shippingCharges;
    const effectiveShippingCharges = freightStatus === "CONFIRMED" ? Math.max(0, Number(rawShippingCharges) || 0) : 0;

    const itemsToCalculate = data.items || [];
    const financials = calculateInvoiceFinancials({
      items: itemsToCalculate,
      discountAmount: data.discountAmount ?? existing.discountAmount,
      discountPercent: data.discountPercent ?? existing.discountPercent ?? 0,
      shippingCharges: effectiveShippingCharges,
      handlingCharges: data.handlingCharges ?? existing.handlingCharges,
      customsCharges: data.customsCharges ?? existing.customsCharges,
      otherCharges: data.otherCharges ?? existing.otherCharges,
      taxRate: data.taxRate ?? existing.taxRate ?? 0,
      amountPaid: totalPaymentsRecorded,
    });

    // Update invoice record and replace items
    await prisma.$transaction(async (tx) => {
      // Delete old items
      await tx.invoiceItem.deleteMany({
        where: { invoiceId: existing.id },
      });

      // Update invoice details
      await tx.invoice.update({
        where: { id: existing.id },
        data: {
          customerId: targetCustomerId,
          shipmentId: data.shipmentId !== undefined ? data.shipmentId : existing.shipmentId,
          dueDate: data.dueDate ? new Date(data.dueDate) : existing.dueDate,
          issueDate: data.issueDate ? new Date(data.issueDate) : existing.issueDate,
          currency: data.currency || existing.currency,
          subtotal: financials.subtotal,
          discountAmount: financials.discountAmount,
          discountPercent: financials.discountPercent,
          shippingCharges: effectiveShippingCharges,
          freightStatus,
          freightNotes: data.freightNotes !== undefined ? data.freightNotes : existing.freightNotes,
          handlingCharges: financials.handlingCharges,
          customsCharges: financials.customsCharges,
          otherCharges: financials.otherCharges,
          taxRate: financials.taxRate,
          taxAmount: financials.taxAmount,
          totalAmount: financials.totalAmount,
          amountPaid: financials.amountPaid,
          outstandingBalance: financials.outstandingBalance,
          paymentInstructions: data.paymentInstructions !== undefined ? data.paymentInstructions : existing.paymentInstructions,
          clientNotes: data.clientNotes !== undefined ? data.clientNotes : existing.clientNotes,
          internalNotes: data.internalNotes !== undefined ? data.internalNotes : existing.internalNotes,
          purchaseOrderRef: data.purchaseOrderRef !== undefined ? data.purchaseOrderRef : existing.purchaseOrderRef,
          items: {
            create: financials.calculatedItems.map((it) => ({
              description: it.description,
              sku: it.sku,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              discount: it.discount,
              lineTotal: it.lineTotal,
              sortOrder: it.sortOrder,
            })),
          },
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        action: "INVOICE_UPDATED",
        entityType: "Invoice",
        entityId: existing.id,
        description: `Invoice #${existing.invoiceNumber} updated by ${admin.name || admin.email}`,
        adminId: admin.id,
      },
    });

    revalidatePath(`/admin/invoices/${existing.id}`);
    revalidatePath("/admin/invoices");

    return { success: true, invoiceId: existing.id };
  } catch (error: any) {
    console.error("[updateInvoiceAction] Error:", error);
    return { success: false, error: error?.message || "Failed to update invoice." };
  }
}

/**
 * Dedicated administrator action to Add or Update Freight Charge on an existing invoice
 * Transparently recomputes totals, preserves original goods payments, and logs changes.
 */
export async function updateFreightChargesAction(input: UpdateFreightChargesInput) {
  const admin = await requireAdminSession();
  await ensureInvoiceSchema();

  try {
    const existing = await prisma.invoice.findUnique({
      where: { id: input.invoiceId },
      include: {
        payments: true,
        items: true,
      },
    });

    if (!existing) return { success: false, error: "Invoice not found." };
    if (existing.status === "CANCELLED") return { success: false, error: "Cannot modify freight charges on a cancelled invoice." };

    const freightStatus = input.freightStatus || "CONFIRMED";
    const freightAmount = freightStatus === "CONFIRMED" ? Math.max(0, Number(input.freightAmount) || 0) : 0;
    const freightNotes = input.freightNotes?.trim() || null;

    // Recalculate subtotal from items
    const subtotal = existing.items.reduce((acc, it) => acc + (it.lineTotal || 0), 0);
    const discountAmount = Math.min(subtotal, existing.discountAmount || 0);
    const baseAfterDiscount = Math.max(0, subtotal - discountAmount);

    const totalCharges = Math.round((
      freightAmount +
      (existing.handlingCharges || 0) +
      (existing.customsCharges || 0) +
      (existing.otherCharges || 0)
    ) * 100) / 100;

    const taxAmount = (existing.taxRate && existing.taxRate > 0)
      ? Math.round((baseAfterDiscount * (existing.taxRate / 100)) * 100) / 100
      : 0;

    const newTotalAmount = Math.round((baseAfterDiscount + totalCharges + taxAmount) * 100) / 100;

    // Preserve existing payments completely
    const totalPaymentsRecorded = existing.payments.reduce((acc, p) => acc + (p.amount || 0), 0);
    const amountPaid = Math.max(existing.amountPaid, totalPaymentsRecorded);
    const newOutstandingBalance = Math.max(0, Math.round((newTotalAmount - amountPaid) * 100) / 100);

    // Transition status accurately
    let newStatus = existing.status;
    if (newOutstandingBalance <= 0 && newTotalAmount > 0) {
      newStatus = "PAID";
    } else if (amountPaid > 0) {
      newStatus = "PARTIALLY_PAID";
    } else {
      newStatus = existing.status === "DRAFT" ? "DRAFT" : "ISSUED";
    }

    const previousFreight = existing.shippingCharges;
    const previousTotal = existing.totalAmount;

    await prisma.invoice.update({
      where: { id: existing.id },
      data: {
        freightStatus,
        freightNotes,
        shippingCharges: freightAmount,
        totalAmount: newTotalAmount,
        amountPaid,
        outstandingBalance: newOutstandingBalance,
        status: newStatus as any,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "INVOICE_FREIGHT_UPDATED",
        entityType: "Invoice",
        entityId: existing.id,
        description: `Freight charges updated from ${existing.currency} ${previousFreight} to ${existing.currency} ${freightAmount} (Status: ${freightStatus}) on invoice #${existing.invoiceNumber}. New total: ${existing.currency} ${newTotalAmount}, balance due: ${existing.currency} ${newOutstandingBalance} by ${admin.name || admin.email}`,
        adminId: admin.id,
        metadata: {
          previousFreight,
          newFreight: freightAmount,
          freightStatus,
          previousTotal,
          newTotalAmount,
          newOutstandingBalance,
          newStatus,
          freightNotes,
        },
      },
    });

    revalidatePath(`/admin/invoices/${existing.id}`);
    revalidatePath("/admin/invoices");

    return {
      success: true,
      totalAmount: newTotalAmount,
      amountPaid,
      outstandingBalance: newOutstandingBalance,
      freightStatus,
      status: newStatus,
    };
  } catch (error: any) {
    console.error("[updateFreightChargesAction] Error:", error);
    return { success: false, error: error?.message || "Failed to update freight charges." };
  }
}

/**
 * Retrieve system default invoice settings for prefilling creation workflow
 */
export async function getDefaultInvoiceSettingsAction() {
  await requireAdminSession();
  try {
    const system = await getSystemSettings();
    return {
      success: true,
      defaultPaymentInstructions: system.defaultPaymentInstructions || "",
      defaultCurrency: system.defaultCurrency || "GHS",
    };
  } catch (err: any) {
    console.error("[getDefaultInvoiceSettingsAction] Error:", err);
    return {
      success: false,
      defaultPaymentInstructions: "",
      defaultCurrency: "GHS",
    };
  }
}

/**
 * Issue an invoice (transitions from DRAFT to ISSUED)
 */
export async function issueInvoiceAction(invoiceId: string) {
  const admin = await requireAdminSession();
  await ensureInvoiceSchema();

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) return { success: false, error: "Invoice not found." };
    if (invoice.status === "CANCELLED") return { success: false, error: "Cannot issue a cancelled invoice." };

    const newStatus = invoice.outstandingBalance <= 0 ? "PAID" : invoice.amountPaid > 0 ? "PARTIALLY_PAID" : "ISSUED";

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: newStatus as any },
    });

    await prisma.auditLog.create({
      data: {
        action: "INVOICE_ISSUED",
        entityType: "Invoice",
        entityId: invoiceId,
        description: `Invoice #${invoice.invoiceNumber} issued by ${admin.name || admin.email}`,
        adminId: admin.id,
      },
    });

    revalidatePath(`/admin/invoices/${invoiceId}`);
    revalidatePath("/admin/invoices");

    return { success: true };
  } catch (error: any) {
    console.error("[issueInvoiceAction] Error:", error);
    return { success: false, error: error?.message || "Failed to issue invoice." };
  }
}

/**
 * Cancel an invoice
 */
export async function cancelInvoiceAction(invoiceId: string, reason?: string) {
  const admin = await requireAdminSession();
  await ensureInvoiceSchema();

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) return { success: false, error: "Invoice not found." };

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "CANCELLED",
        internalNotes: invoice.internalNotes
          ? `${invoice.internalNotes}\n[Cancellation Reason: ${reason || "Admin cancelled"}]`
          : `[Cancellation Reason: ${reason || "Admin cancelled"}]`,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "INVOICE_CANCELLED",
        entityType: "Invoice",
        entityId: invoiceId,
        description: `Invoice #${invoice.invoiceNumber} cancelled by ${admin.name || admin.email}. Reason: ${reason || "None specified"}`,
        adminId: admin.id,
      },
    });

    revalidatePath(`/admin/invoices/${invoiceId}`);
    revalidatePath("/admin/invoices");

    return { success: true };
  } catch (error: any) {
    console.error("[cancelInvoiceAction] Error:", error);
    return { success: false, error: error?.message || "Failed to cancel invoice." };
  }
}

/**
 * Duplicate an existing invoice into a new draft
 */
export async function duplicateInvoiceAction(invoiceId: string) {
  const admin = await requireAdminSession();
  await ensureInvoiceSchema();

  try {
    const source = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: true,
      },
    });

    if (!source) return { success: false, error: "Source invoice not found." };

    const newNumber = await generateNextInvoiceNumber();
    const newDueDate = new Date();
    newDueDate.setDate(newDueDate.getDate() + 7);

    const duplicate = await prisma.invoice.create({
      data: {
        invoiceNumber: newNumber,
        status: "DRAFT",
        issueDate: new Date(),
        dueDate: newDueDate,
        currency: source.currency,
        subtotal: source.subtotal,
        discountAmount: source.discountAmount,
        discountPercent: source.discountPercent,
        shippingCharges: source.shippingCharges,
        handlingCharges: source.handlingCharges,
        customsCharges: source.customsCharges,
        otherCharges: source.otherCharges,
        taxRate: source.taxRate,
        taxAmount: source.taxAmount,
        totalAmount: source.totalAmount,
        amountPaid: 0,
        outstandingBalance: source.totalAmount,
        paymentInstructions: source.paymentInstructions,
        clientNotes: source.clientNotes,
        internalNotes: `Duplicated from #${source.invoiceNumber}`,
        purchaseOrderRef: source.purchaseOrderRef,
        customerId: source.customerId,
        shipmentId: source.shipmentId,
        createdById: admin.id,
        items: {
          create: source.items.map((it) => ({
            description: it.description,
            sku: it.sku,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            discount: it.discount,
            lineTotal: it.lineTotal,
            sortOrder: it.sortOrder,
          })),
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "INVOICE_DUPLICATED",
        entityType: "Invoice",
        entityId: duplicate.id,
        description: `Invoice #${duplicate.invoiceNumber} created as duplicate of #${source.invoiceNumber} by ${admin.name || admin.email}`,
        adminId: admin.id,
      },
    });

    revalidatePath("/admin/invoices");

    return { success: true, invoiceId: duplicate.id };
  } catch (error: any) {
    console.error("[duplicateInvoiceAction] Error:", error);
    return { success: false, error: error?.message || "Failed to duplicate invoice." };
  }
}

/**
 * Record payment on an invoice
 */
export async function recordInvoicePaymentAction(
  invoiceId: string,
  paymentData: {
    amount: number;
    paymentDate?: string;
    paymentMethod: string;
    reference?: string;
    notes?: string;
  }
) {
  const admin = await requireAdminSession();
  await ensureInvoiceSchema();

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true },
    });

    if (!invoice) return { success: false, error: "Invoice not found." };
    if (invoice.status === "CANCELLED") return { success: false, error: "Cannot record payments on a cancelled invoice." };

    const amount = Number(paymentData.amount);
    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: "Payment amount must be greater than zero." };
    }

    if (amount > invoice.outstandingBalance + 0.01) {
      return {
        success: false,
        error: `Payment amount (${invoice.currency} ${amount.toFixed(2)}) exceeds outstanding balance (${invoice.currency} ${invoice.outstandingBalance.toFixed(2)}).`,
      };
    }

    const paymentDate = paymentData.paymentDate ? new Date(paymentData.paymentDate) : new Date();
    const newAmountPaid = Math.round((invoice.amountPaid + amount) * 100) / 100;
    const newOutstanding = Math.max(0, Math.round((invoice.totalAmount - newAmountPaid) * 100) / 100);

    const newStatus = newOutstanding <= 0 ? "PAID" : "PARTIALLY_PAID";

    await prisma.$transaction(async (tx) => {
      await tx.invoicePayment.create({
        data: {
          invoiceId,
          amount,
          paymentDate,
          paymentMethod: paymentData.paymentMethod || "OFFLINE",
          reference: paymentData.reference?.trim() || null,
          notes: paymentData.notes?.trim() || null,
          recordedBy: "@lexmedia.gh",
        },
      });

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: newAmountPaid,
          outstandingBalance: newOutstanding,
          status: newStatus as any,
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        action: "INVOICE_PAYMENT_RECORDED",
        entityType: "Invoice",
        entityId: invoiceId,
        description: `Payment of ${invoice.currency} ${amount.toFixed(2)} recorded on invoice #${invoice.invoiceNumber} by ${admin.name || admin.email}`,
        adminId: admin.id,
        metadata: {
          amount,
          reference: paymentData.reference,
          newStatus,
          newOutstanding,
        },
      },
    });

    revalidatePath(`/admin/invoices/${invoiceId}`);
    revalidatePath("/admin/invoices");

    return { success: true };
  } catch (error: any) {
    console.error("[recordInvoicePaymentAction] Error:", error);
    return { success: false, error: error?.message || "Failed to record payment." };
  }
}

/**
 * Send invoice via Brevo email
 */
export async function sendInvoiceEmailAction(invoiceId: string, customNote?: string) {
  const admin = await requireAdminSession();
  await ensureInvoiceSchema();

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        shipment: true,
      },
    });

    if (!invoice) return { success: false, error: "Invoice not found." };
    if (!invoice.customer?.email || !invoice.customer.email.includes("@")) {
      return { success: false, error: "Client does not have a valid registered email address." };
    }

    const branding = await getBrandSettings();
    const publicUrl = `${getAppBaseUrl()}/invoices/${invoice.accessToken}`;

    const htmlContent = await generateInvoiceEmailHtml({
      clientName: invoice.customer.name,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate.toLocaleDateString("en-GH", { year: "numeric", month: "short", day: "numeric" }),
      dueDate: invoice.dueDate.toLocaleDateString("en-GH", { year: "numeric", month: "short", day: "numeric" }),
      currency: invoice.currency,
      totalAmount: invoice.totalAmount,
      amountPaid: invoice.amountPaid,
      outstandingBalance: invoice.outstandingBalance,
      status: invoice.status,
      freightStatus: (invoice as any).freightStatus || (invoice.shippingCharges > 0 ? "CONFIRMED" : "PENDING"),
      shipmentReference: invoice.shipment?.trackingNumber || null,
      paymentInstructions: invoice.paymentInstructions,
      clientNotes: invoice.clientNotes,
      publicViewUrl: publicUrl,
      customNote: customNote || null,
    });

    const subject = `Invoice ${invoice.invoiceNumber} — ${branding.businessName}`;

    const sendResult = await sendBrevoEmail({
      to: [{ email: invoice.customer.email, name: invoice.customer.name }],
      subject,
      htmlContent,
    });

    const logStatus = sendResult.success ? "SENT" : "FAILED";

    // Record communication log
    await prisma.invoiceCommunicationLog.create({
      data: {
        invoiceId: invoice.id,
        channel: "EMAIL",
        recipient: invoice.customer.email,
        subject,
        status: logStatus,
        providerMessageId: sendResult.messageId || null,
        errorMessage: sendResult.error || null,
        metadata: {
          adminId: admin.id,
          adminEmail: admin.email,
          provider: "brevo",
        },
      },
    });

    if (sendResult.success) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          lastDeliveryMethod: "EMAIL",
          lastSentAt: new Date(),
          sentCount: { increment: 1 },
          status: invoice.status === "DRAFT" ? ("ISSUED" as any) : invoice.status,
        },
      });

      await prisma.auditLog.create({
        data: {
          action: "INVOICE_SENT_EMAIL",
          entityType: "Invoice",
          entityId: invoice.id,
          description: `Invoice #${invoice.invoiceNumber} emailed to ${invoice.customer.email} via Brevo by ${admin.name || admin.email}`,
          adminId: admin.id,
          metadata: { messageId: sendResult.messageId },
        },
      });

      revalidatePath(`/admin/invoices/${invoice.id}`);
      revalidatePath("/admin/invoices");

      return { success: true, messageId: sendResult.messageId };
    } else {
      return { success: false, error: sendResult.error || "Brevo delivery failed." };
    }
  } catch (error: any) {
    console.error("[sendInvoiceEmailAction] Error:", error);
    return { success: false, error: error?.message || "Failed to dispatch email." };
  }
}

/**
 * Prepare WhatsApp invoice message and generate wa.me link
 */
export async function prepareInvoiceWhatsAppMessageAction(invoiceId: string) {
  const admin = await requireAdminSession();
  await ensureInvoiceSchema();

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        shipment: true,
        items: true,
      },
    });

    if (!invoice) return { success: false, error: "Invoice not found." };
    if (!invoice.customer?.phone) {
      return { success: false, error: "Client does not have a registered phone number for WhatsApp delivery." };
    }

    const phoneValidation = normalizePhoneNumber(invoice.customer.phone);
    if (!phoneValidation.isValid) {
      return { success: false, error: `Invalid phone format: ${invoice.customer.phone}. ${phoneValidation.error || ""}` };
    }

    const branding = await getBrandSettings();
    const publicUrl = `${getAppBaseUrl()}/invoices/${invoice.accessToken}`;

    // Create item summary
    const shortItems = invoice.items.slice(0, 3).map((it) => `${it.quantity}x ${it.description}`).join(", ");
    const itemsSummary = invoice.items.length > 3 ? `${shortItems} +${invoice.items.length - 3} more` : shortItems || "Goods Ordered";

    const dueDateStr = invoice.dueDate.toLocaleDateString("en-GH", { year: "numeric", month: "short", day: "numeric" });

    const messageLines = [
      `Hello ${invoice.customer.name},`,
      ``,
      `Your official invoice from *${branding.businessName}* is ready.`,
      ``,
      `*Invoice:* #${invoice.invoiceNumber}`,
      `*Goods:* ${itemsSummary}`,
      `*Total:* ${invoice.currency} ${invoice.totalAmount.toFixed(2)}`,
      `*Amount Paid:* ${invoice.currency} ${invoice.amountPaid.toFixed(2)}`,
      `*Balance Due:* ${invoice.currency} ${invoice.outstandingBalance.toFixed(2)}`,
      `*Due Date:* ${dueDateStr}`,
    ];

    if (invoice.shipment?.trackingNumber) {
      messageLines.push(`*Shipment Ref:* ${invoice.shipment.trackingNumber}`);
    }

    messageLines.push(``);
    messageLines.push(`*View & Download Invoice:*`);
    messageLines.push(publicUrl);
    messageLines.push(``);
    messageLines.push(`Please review your invoice and let us know if you have any questions.`);
    messageLines.push(``);
    messageLines.push(`Thank you for choosing *${branding.businessName}*.`);

    const messageText = messageLines.join("\n");
    const cleanPhone = phoneValidation.normalized.replace("+", "");
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;

    // Record that WhatsApp message was prepared (Not claiming confirmed delivery)
    await prisma.invoiceCommunicationLog.create({
      data: {
        invoiceId: invoice.id,
        channel: "WHATSAPP",
        recipient: phoneValidation.normalized,
        subject: `WhatsApp Invoice #${invoice.invoiceNumber}`,
        status: "PREPARED",
        metadata: {
          phone: phoneValidation.normalized,
          adminId: admin.id,
          adminEmail: admin.email,
        },
      },
    });

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        lastDeliveryMethod: "WHATSAPP",
        lastSentAt: new Date(),
        sentCount: { increment: 1 },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "INVOICE_WHATSAPP_PREPARED",
        entityType: "Invoice",
        entityId: invoice.id,
        description: `WhatsApp message for invoice #${invoice.invoiceNumber} prepared for ${phoneValidation.normalized} by ${admin.name || admin.email}`,
        adminId: admin.id,
      },
    });

    revalidatePath(`/admin/invoices/${invoice.id}`);
    revalidatePath("/admin/invoices");

    return {
      success: true,
      whatsappUrl,
      messageText,
      recipientPhone: phoneValidation.normalized,
    };
  } catch (error: any) {
    console.error("[prepareInvoiceWhatsAppMessageAction] Error:", error);
    return { success: false, error: error?.message || "Failed to prepare WhatsApp message." };
  }
}

/**
 * Helper to fetch clients list for invoice creation form
 */
export async function getInvoiceEligibleClientsAction() {
  await requireAdminSession();
  try {
    const clients = await prisma.customer.findMany({
      select: {
        id: true,
        customerIdentifier: true,
        name: true,
        phone: true,
        email: true,
      },
      orderBy: {
        name: "asc",
      },
    });
    return { success: true, clients };
  } catch (err: any) {
    console.error("[getInvoiceEligibleClientsAction] Error:", err);
    return { success: false, clients: [] };
  }
}

/**
 * Helper to fetch shipments for a selected client for linking
 */
export async function getInvoiceClientShipmentsAction(customerId: string) {
  await requireAdminSession();
  try {
    const shipments = await prisma.shipment.findMany({
      where: { customerId },
      select: {
        id: true,
        trackingNumber: true,
        description: true,
        status: true,
        fee: true,
        estimatedArrival: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      success: true,
      shipments: shipments.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        estimatedArrival: s.estimatedArrival ? s.estimatedArrival.toISOString() : null,
      })),
    };
  } catch (err: any) {
    console.error("[getInvoiceClientShipmentsAction] Error:", err);
    return { success: false, shipments: [] };
  }
}
