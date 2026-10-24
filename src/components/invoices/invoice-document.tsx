"use client";

import React from "react";
import { formatCurrency } from "@/lib/currency";
import { CheckCircle2, Clock, AlertTriangle, XCircle, Truck, Building2, User, Phone, Mail, FileText, ShieldCheck } from "lucide-react";

export interface InvoiceDocumentData {
  id?: string;
  invoiceNumber: string;
  status: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED";
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotal: number;
  discountAmount?: number;
  discountPercent?: number;
  shippingCharges?: number;
  handlingCharges?: number;
  customsCharges?: number;
  otherCharges?: number;
  taxRate?: number;
  taxAmount?: number;
  totalAmount: number;
  amountPaid: number;
  outstandingBalance: number;
  paymentInstructions?: string | null;
  clientNotes?: string | null;
  purchaseOrderRef?: string | null;
  customer?: {
    id?: string;
    customerIdentifier?: string;
    name?: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  } | null;
  shipment?: {
    trackingNumber?: string;
    description?: string;
    origin?: string | null;
    destination?: string | null;
  } | null;
  items: Array<{
    id?: string;
    description: string;
    sku?: string | null;
    quantity: number;
    unitPrice: number;
    discount?: number;
    lineTotal: number;
  }>;
  payments?: Array<{
    id?: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    reference?: string | null;
  }>;
}

export interface InvoiceBrandingProps {
  businessName?: string;
  shortName?: string;
  tagline?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  invoiceLogo?: string | null;
  mainLogo?: string | null;
  lightLogo?: string | null;
  invoiceStamp?: string | null;
}

interface InvoiceDocumentProps {
  invoice: InvoiceDocumentData;
  branding?: InvoiceBrandingProps;
  showPrintActions?: boolean;
  onPrint?: () => void;
}

export function InvoiceDocument({ invoice, branding, showPrintActions = false, onPrint }: InvoiceDocumentProps) {
  const businessName = branding?.businessName || "LMX8 IMPORTS";
  const primaryColor = branding?.primaryColor || "#141B47";
  const secondaryColor = branding?.secondaryColor || "#355DAF";
  const accentColor = branding?.accentColor || "#F2901F";
  const logoUrl = branding?.invoiceLogo || branding?.mainLogo || branding?.lightLogo || null;

  const formattedIssueDate = invoice.issueDate
    ? new Date(invoice.issueDate).toLocaleDateString("en-GH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  const formattedDueDate = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString("en-GH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  const getStatusBadge = () => {
    switch (invoice.status) {
      case "PAID":
        return {
          label: "PAID IN FULL",
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
        };
      case "PARTIALLY_PAID":
        return {
          label: "PARTIALLY PAID",
          bg: "bg-blue-50 text-blue-700 border-blue-200",
          icon: <Clock className="w-3.5 h-3.5 text-blue-600" />,
        };
      case "OVERDUE":
        return {
          label: "OVERDUE",
          bg: "bg-red-50 text-red-700 border-red-200",
          icon: <AlertTriangle className="w-3.5 h-3.5 text-red-600" />,
        };
      case "ISSUED":
        return {
          label: "PAYMENT DUE",
          bg: "bg-amber-50 text-amber-700 border-amber-200",
          icon: <Clock className="w-3.5 h-3.5 text-amber-600" />,
        };
      case "CANCELLED":
        return {
          label: "CANCELLED",
          bg: "bg-gray-100 text-gray-600 border-gray-300",
          icon: <XCircle className="w-3.5 h-3.5 text-gray-500" />,
        };
      default:
        return {
          label: "DRAFT",
          bg: "bg-slate-100 text-slate-700 border-slate-300",
          icon: <FileText className="w-3.5 h-3.5 text-slate-500" />,
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <div className="invoice-sheet bg-white text-slate-900 rounded-2xl shadow-xl border border-slate-200 overflow-hidden print:shadow-none print:border-none print:rounded-none max-w-4xl mx-auto">
      {/* Print-specific style rules */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 11pt !important;
          }
          .invoice-sheet {
            box-shadow: none !important;
            border: none !important;
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          thead {
            display: table-header-group !important;
          }
          tr {
            page-break-inside: avoid !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      {/* Top Header */}
      <div 
        style={{ borderTop: `6px solid ${primaryColor}` }}
        className="p-8 sm:p-10 border-b border-slate-100"
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          {/* Logo & Company Info */}
          <div className="space-y-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={businessName}
                style={{ maxHeight: "55px", maxWidth: "240px" }}
                className="object-contain h-auto w-auto"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight" style={{ color: primaryColor }}>
                  {branding?.shortName || "LMX8"}
                </span>
                <span className="text-sm font-bold tracking-widest text-slate-500 uppercase">
                  IMPORTS
                </span>
              </div>
            )}
            <div className="text-xs text-slate-500 space-y-0.5 leading-relaxed">
              <p className="font-semibold text-slate-700">{businessName}</p>
              <p>China to Ghana Freight Forwarding &amp; Sourcing</p>
              <p>Tema Port &amp; Accra Offices, Ghana</p>
              <p>Contact: support@lmx8imports.com · +233 24 123 4567</p>
            </div>
          </div>

          {/* Document Title & Meta Box */}
          <div className="sm:text-right space-y-2">
            <h1 
              style={{ color: primaryColor }}
              className="text-3xl sm:text-4xl font-black tracking-tight uppercase"
            >
              INVOICE
            </h1>
            <div className="inline-flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.bg}`}>
                {badge.icon}
                {badge.label}
              </span>
            </div>
            <div className="text-xs text-slate-600 space-y-1 pt-1 font-mono">
              <p><span className="text-slate-400 font-sans">Invoice #:</span> <strong>{invoice.invoiceNumber}</strong></p>
              <p><span className="text-slate-400 font-sans">Issue Date:</span> {formattedIssueDate}</p>
              <p><span className="text-slate-400 font-sans">Due Date:</span> <span className="font-bold text-red-600">{formattedDueDate}</span></p>
              {invoice.purchaseOrderRef && (
                <p><span className="text-slate-400 font-sans">PO / Ref:</span> {invoice.purchaseOrderRef}</p>
              )}
            </div>
          </div>
        </div>

        {/* Client & Shipment Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8 pt-6 border-t border-slate-100 text-xs">
          {/* Bill To */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <User size={12} className="text-slate-500" /> Billed To (Client)
            </span>
            <p className="font-bold text-sm text-slate-900">{invoice.customer?.name || "Valued Client"}</p>
            {invoice.customer?.customerIdentifier && (
              <p className="font-mono text-slate-600">Client ID: {invoice.customer.customerIdentifier}</p>
            )}
            {invoice.customer?.phone && (
              <p className="text-slate-600 flex items-center gap-1">
                <Phone size={11} className="text-slate-400 shrink-0" /> {invoice.customer.phone}
              </p>
            )}
            {invoice.customer?.email && (
              <p className="text-slate-600 flex items-center gap-1">
                <Mail size={11} className="text-slate-400 shrink-0" /> {invoice.customer.email}
              </p>
            )}
            {invoice.customer?.address && (
              <p className="text-slate-600 leading-relaxed pt-1 border-t border-slate-200">
                {invoice.customer.address}
              </p>
            )}
          </div>

          {/* Linked Shipment or Delivery */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Truck size={12} className="text-slate-500" /> Shipment Information
            </span>
            {invoice.shipment ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-slate-900 font-mono">
                    {invoice.shipment.trackingNumber || "Assigned Shipment"}
                  </p>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                    Linked
                  </span>
                </div>
                {invoice.shipment.description && (
                  <p className="text-slate-600 line-clamp-2">
                    {invoice.shipment.description}
                  </p>
                )}
                {(invoice.shipment.origin || invoice.shipment.destination) && (
                  <p className="text-slate-500 text-[11px] pt-1">
                    Route: {invoice.shipment.origin || "China"} → {invoice.shipment.destination || "Ghana"}
                  </p>
                )}
              </>
            ) : (
              <div className="text-slate-500 italic py-2">
                Goods order not linked to a specific international consignment.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="p-8 sm:p-10">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr 
              style={{ backgroundColor: `${primaryColor}0D`, borderBottom: `2px solid ${primaryColor}` }}
              className="text-slate-700 font-bold uppercase tracking-wider text-[10px]"
            >
              <th className="py-3 px-3 w-10 text-center">#</th>
              <th className="py-3 px-3">Description / Goods Details</th>
              <th className="py-3 px-3 text-right w-20">Qty</th>
              <th className="py-3 px-3 text-right w-28">Unit Price</th>
              <th className="py-3 px-3 text-right w-24">Discount</th>
              <th className="py-3 px-3 text-right w-32">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                  No line items listed on this invoice.
                </td>
              </tr>
            ) : (
              invoice.items.map((item, index) => (
                <tr key={item.id || index} className="hover:bg-slate-50/50">
                  <td className="py-3.5 px-3 text-center text-slate-400 font-mono">{index + 1}</td>
                  <td className="py-3.5 px-3">
                    <p className="font-semibold text-slate-900">{item.description}</p>
                    {item.sku && (
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                        SKU: {item.sku}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono font-medium text-slate-800">{item.quantity}</td>
                  <td className="py-3.5 px-3 text-right font-mono text-slate-600">{formatCurrency(item.unitPrice, invoice.currency)}</td>
                  <td className="py-3.5 px-3 text-right font-mono text-slate-500">
                    {item.discount && item.discount > 0 ? `-${formatCurrency(item.discount, invoice.currency)}` : "—"}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">
                    {formatCurrency(item.lineTotal, invoice.currency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Financial Summary & Calculations Breakdown */}
        <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between gap-8">
          {/* Payment Instructions & Notes */}
          <div className="sm:w-1/2 space-y-4 text-xs">
            {invoice.paymentInstructions && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Payment Instructions
                </span>
                <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {invoice.paymentInstructions}
                </div>
              </div>
            )}

            {invoice.clientNotes && (
              <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/60 text-amber-900 text-[11px] leading-relaxed">
                <span className="font-bold block mb-0.5">Note:</span>
                {invoice.clientNotes}
              </div>
            )}

            {/* Recorded Payments List (if any) */}
            {invoice.payments && invoice.payments.length > 0 && (
              <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200/60 text-xs space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 block">
                  Payments Received ({invoice.payments.length})
                </span>
                <div className="space-y-1 text-[11px]">
                  {invoice.payments.map((p, pIdx) => (
                    <div key={p.id || pIdx} className="flex justify-between items-center text-emerald-900 font-mono">
                      <span>{new Date(p.paymentDate).toLocaleDateString()} · {p.paymentMethod}</span>
                      <span className="font-bold">+{formatCurrency(p.amount, invoice.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Calculations Totals Card */}
          <div className="sm:w-1/2 max-w-sm ml-auto space-y-2 text-xs">
            <div className="flex justify-between py-1 text-slate-600">
              <span>Items Subtotal:</span>
              <span className="font-mono font-medium">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
            </div>

            {invoice.discountAmount && invoice.discountAmount > 0 ? (
              <div className="flex justify-between py-1 text-emerald-700">
                <span>
                  Discount {invoice.discountPercent ? `(${invoice.discountPercent}%)` : ""}:
                </span>
                <span className="font-mono font-medium">-{formatCurrency(invoice.discountAmount, invoice.currency)}</span>
              </div>
            ) : null}

            {invoice.shippingCharges && invoice.shippingCharges > 0 ? (
              <div className="flex justify-between py-1 text-slate-600">
                <span>Shipping / Freight:</span>
                <span className="font-mono font-medium">{formatCurrency(invoice.shippingCharges, invoice.currency)}</span>
              </div>
            ) : null}

            {invoice.handlingCharges && invoice.handlingCharges > 0 ? (
              <div className="flex justify-between py-1 text-slate-600">
                <span>Handling Charges:</span>
                <span className="font-mono font-medium">{formatCurrency(invoice.handlingCharges, invoice.currency)}</span>
              </div>
            ) : null}

            {invoice.customsCharges && invoice.customsCharges > 0 ? (
              <div className="flex justify-between py-1 text-slate-600">
                <span>Customs / Clearance:</span>
                <span className="font-mono font-medium">{formatCurrency(invoice.customsCharges, invoice.currency)}</span>
              </div>
            ) : null}

            {invoice.otherCharges && invoice.otherCharges > 0 ? (
              <div className="flex justify-between py-1 text-slate-600">
                <span>Other Services:</span>
                <span className="font-mono font-medium">{formatCurrency(invoice.otherCharges, invoice.currency)}</span>
              </div>
            ) : null}

            {invoice.taxRate && invoice.taxRate > 0 ? (
              <div className="flex justify-between py-1 text-slate-600">
                <span>Tax ({invoice.taxRate}%):</span>
                <span className="font-mono font-medium">{formatCurrency(invoice.taxAmount || 0, invoice.currency)}</span>
              </div>
            ) : null}

            <div className="flex justify-between py-2 border-t-2 border-slate-200 text-sm font-extrabold text-slate-900">
              <span>Total Invoiced:</span>
              <span className="font-mono text-base" style={{ color: primaryColor }}>
                {formatCurrency(invoice.totalAmount, invoice.currency)}
              </span>
            </div>

            <div className="flex justify-between py-1 text-emerald-700 font-semibold">
              <span>Total Paid to Date:</span>
              <span className="font-mono">-{formatCurrency(invoice.amountPaid, invoice.currency)}</span>
            </div>

            <div 
              style={{ backgroundColor: `${primaryColor}08` }}
              className="flex justify-between items-center p-3.5 rounded-xl border border-slate-200 mt-2"
            >
              <span className="font-black text-xs uppercase tracking-wider text-slate-900">
                Outstanding Balance:
              </span>
              <span className={`font-mono text-lg font-black ${invoice.outstandingBalance > 0 ? "text-red-600" : "text-emerald-700"}`}>
                {formatCurrency(invoice.outstandingBalance, invoice.currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Document Footer */}
      <div className="p-6 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500 space-y-1">
        <p className="font-medium text-slate-700 flex items-center justify-center gap-1.5">
          <ShieldCheck size={14} className="text-emerald-600" />
          Official Business Document issued by {businessName}
        </p>
        <p className="text-[11px] text-slate-400">
          Thank you for choosing {businessName}. For questions regarding this invoice, email billing@lmx8imports.com
        </p>
      </div>
    </div>
  );
}
