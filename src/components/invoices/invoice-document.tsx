"use client";

import React from "react";
import { formatCurrency } from "@/lib/currency";
import { 
  CheckCircle2, Clock, AlertTriangle, XCircle, Truck, User, 
  Phone, Mail, FileText, ShieldCheck, Printer, Check, Award, CreditCard
} from "lucide-react";

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
  freightStatus?: "CONFIRMED" | "PENDING" | "NOT_APPLICABLE" | null;
  freightNotes?: string | null;
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
  supportEmail?: string;
  supportPhone?: string;
  invoiceLogo?: string | null;
  invoiceLogoUrl?: string | null;
  mainLogo?: string | null;
  mainLogoUrl?: string | null;
  lightLogo?: string | null;
  lightLogoUrl?: string | null;
  invoiceStamp?: string | null;
  invoiceStampUrl?: string | null;
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
  const supportEmail = branding?.supportEmail || "lexmedia8gh@gmail.com";
  const supportPhone = branding?.supportPhone || "0551515208";

  const logoUrl =
    branding?.invoiceLogoUrl ||
    branding?.invoiceLogo ||
    branding?.mainLogoUrl ||
    branding?.mainLogo ||
    branding?.lightLogoUrl ||
    branding?.lightLogo ||
    null;
  const stampUrl = branding?.invoiceStampUrl || branding?.invoiceStamp || null;

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

  // Authoritative full-payment determination
  const isPaid = invoice.status === "PAID" || (invoice.outstandingBalance <= 0 && invoice.totalAmount > 0);

  const getStatusBadge = () => {
    switch (invoice.status) {
      case "PAID":
        return {
          label: "PAID IN FULL",
          bg: "bg-emerald-50 text-emerald-800 border-emerald-300",
          icon: <CheckCircle2 className="w-3 h-3 text-emerald-600 stroke-[2.5]" />,
        };
      case "PARTIALLY_PAID":
        return {
          label: "PARTIALLY PAID",
          bg: "bg-blue-50 text-blue-800 border-blue-200",
          icon: <Clock className="w-3 h-3 text-blue-600" />,
        };
      case "OVERDUE":
        return {
          label: "OVERDUE",
          bg: "bg-red-50 text-red-800 border-red-200",
          icon: <AlertTriangle className="w-3 h-3 text-red-600" />,
        };
      case "ISSUED":
        return {
          label: "PAYMENT DUE",
          bg: "bg-amber-50 text-amber-800 border-amber-200",
          icon: <Clock className="w-3 h-3 text-amber-600" />,
        };
      case "CANCELLED":
        return {
          label: "CANCELLED",
          bg: "bg-slate-100 text-slate-600 border-slate-300",
          icon: <XCircle className="w-3 h-3 text-slate-500" />,
        };
      default:
        return {
          label: "DRAFT",
          bg: "bg-slate-100 text-slate-700 border-slate-300",
          icon: <FileText className="w-3 h-3 text-slate-500" />,
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <div className="invoice-container max-w-4xl mx-auto relative font-sans text-slate-900">
      {/* Print-specific style rules */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 9.5pt !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .invoice-sheet {
            box-shadow: none !important;
            border: none !important;
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border-radius: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          thead {
            display: table-header-group !important;
          }
          tr, .card-block, .summary-block {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}} />

      {/* Screen Action Bar if showPrintActions */}
      {showPrintActions && (
        <div className="no-print mb-4 p-3 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <FileText size={16} className="text-[#141B47]" />
            <span>Document Preview</span>
          </div>
          <button
            type="button"
            onClick={onPrint || (() => window.print())}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#141B47] text-white hover:bg-[#1E2968] flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Printer size={14} /> Print / Download PDF
          </button>
        </div>
      )}

      {/* Main Invoice Document Card */}
      <div className="invoice-sheet bg-white rounded-2xl shadow-md border border-slate-200/90 overflow-hidden relative">
        {/* Top Accent Strip */}
        <div style={{ backgroundColor: primaryColor }} className="h-1.5 w-full" />

        <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-5 print:p-0">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
            {/* Logo & Company Info */}
            <div className="space-y-2">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={businessName}
                  style={{ maxHeight: "46px", maxWidth: "210px" }}
                  className="object-contain h-auto w-auto"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black tracking-tight" style={{ color: primaryColor }}>
                    {branding?.shortName || "LMX8"}
                  </span>
                  <span className="text-xs font-bold tracking-widest text-slate-500 uppercase">
                    IMPORTS
                  </span>
                </div>
              )}
              <div className="text-[11px] text-slate-500 space-y-0.5 leading-snug">
                <p className="font-bold text-slate-800">{businessName}</p>
                <p>China to Ghana Freight Forwarding &amp; Sourcing</p>
                <p className="font-semibold text-slate-700 flex items-center gap-2 pt-0.5">
                  <span>Email: <strong className="text-slate-900">{supportEmail}</strong></span>
                  <span>·</span>
                  <span>Phone: <strong className="text-slate-900">{supportPhone}</strong></span>
                </p>
              </div>
            </div>

            {/* Document Title & Numbering & Paid Stamp */}
            <div className="sm:text-right space-y-1.5 relative">
              <div className="flex items-center sm:justify-end gap-2">
                <h1 
                  style={{ color: primaryColor }}
                  className="text-2xl sm:text-3xl font-black tracking-tight uppercase"
                >
                  INVOICE
                </h1>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold border ${badge.bg}`}>
                  {badge.icon}
                  {badge.label}
                </span>
              </div>

              {/* OFFICIAL PAID STAMP (Only when fully settled) */}
              {isPaid && (
                <div className="pt-1 flex justify-start sm:justify-end">
                  {stampUrl ? (
                    <img
                      src={stampUrl}
                      alt="Official Paid Stamp"
                      className="h-14 w-auto object-contain opacity-95 rotate-[-5deg] pointer-events-none"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border-2 border-emerald-600 text-emerald-800 font-black text-xs uppercase tracking-widest rotate-[-4deg] bg-emerald-50/90 shadow-2xs">
                      <CheckCircle2 size={13} className="text-emerald-600 stroke-[3]" /> PAID IN FULL
                    </div>
                  )}
                </div>
              )}

              <div className="text-xs text-slate-600 space-y-0.5 font-mono pt-0.5">
                <p><span className="text-slate-400 font-sans text-[11px]">Invoice #:</span> <strong>{invoice.invoiceNumber}</strong></p>
                <p><span className="text-slate-400 font-sans text-[11px]">Issue Date:</span> {formattedIssueDate}</p>
                <p><span className="text-slate-400 font-sans text-[11px]">Due Date:</span> <span className={`font-bold ${isPaid ? "text-slate-700" : "text-red-600"}`}>{formattedDueDate}</span></p>
                {invoice.purchaseOrderRef && (
                  <p><span className="text-slate-400 font-sans text-[11px]">PO / Ref:</span> {invoice.purchaseOrderRef}</p>
                )}
              </div>
            </div>
          </div>

          {/* Client & Shipment Details Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs card-block">
            {/* Bill To */}
            <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <User size={12} className="text-slate-500" /> Billed To (Client)
              </span>
              <p className="font-bold text-xs text-slate-900">{invoice.customer?.name || "Valued Client"}</p>
              {invoice.customer?.customerIdentifier && (
                <p className="font-mono text-[11px] text-slate-600">Client ID: {invoice.customer.customerIdentifier}</p>
              )}
              {invoice.customer?.phone && (
                <p className="text-[11px] text-slate-600 flex items-center gap-1">
                  <Phone size={10} className="text-slate-400 shrink-0" /> {invoice.customer.phone}
                </p>
              )}
              {invoice.customer?.email && (
                <p className="text-[11px] text-slate-600 flex items-center gap-1">
                  <Mail size={10} className="text-slate-400 shrink-0" /> {invoice.customer.email}
                </p>
              )}
              {invoice.customer?.address && (
                <p className="text-[11px] text-slate-600 leading-snug pt-0.5 border-t border-slate-200/60 mt-0.5">
                  {invoice.customer.address}
                </p>
              )}
            </div>

            {/* Linked Shipment Details */}
            <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Truck size={12} className="text-slate-500" /> Shipment Reference
              </span>
              {invoice.shipment ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-xs text-slate-900 font-mono">
                      {invoice.shipment.trackingNumber || "Assigned Shipment"}
                    </p>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-100 text-blue-800 uppercase tracking-wider">
                      Linked
                    </span>
                  </div>
                  {invoice.shipment.description && (
                    <p className="text-[11px] text-slate-600 line-clamp-1">
                      {invoice.shipment.description}
                    </p>
                  )}
                  {(invoice.shipment.origin || invoice.shipment.destination) && (
                    <p className="text-[10px] text-slate-500 pt-0.5">
                      Route: {invoice.shipment.origin || "China"} → {invoice.shipment.destination || "Ghana"}
                    </p>
                  )}
                </>
              ) : (
                <div className="text-[11px] text-slate-500 italic py-1">
                  Goods order — No international consignment linked.
                </div>
              )}
            </div>
          </div>

          {/* Item Table */}
          <div className="overflow-x-auto overflow-y-hidden border border-slate-200/80 rounded-xl print:overflow-visible">
            <table className="w-full text-left border-collapse text-xs min-w-[500px] sm:min-w-0">
              <thead>
                <tr 
                  style={{ backgroundColor: `${primaryColor}0F`, borderBottom: `2px solid ${primaryColor}` }}
                  className="text-slate-700 font-bold uppercase tracking-wider text-[10px]"
                >
                  <th className="py-2.5 px-3 w-8 text-center">#</th>
                  <th className="py-2.5 px-3">Description / Goods Details</th>
                  <th className="py-2.5 px-3 text-right w-16">Qty</th>
                  <th className="py-2.5 px-3 text-right w-24">Unit Price</th>
                  <th className="py-2.5 px-3 text-right w-20">Discount</th>
                  <th className="py-2.5 px-3 text-right w-28">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                      No line items listed on this invoice.
                    </td>
                  </tr>
                ) : (
                  invoice.items.map((item, index) => (
                    <tr key={item.id || index} className="hover:bg-slate-50/40">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">{index + 1}</td>
                      <td className="py-2.5 px-3">
                        <p className="font-semibold text-slate-900 text-xs break-words">{item.description}</p>
                        {item.sku && (
                          <span className="text-[9px] font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded mt-0.5 inline-block">
                            SKU: {item.sku}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-800 text-xs">{item.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600 text-xs">{formatCurrency(item.unitPrice, invoice.currency)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500 text-xs">
                        {item.discount && item.discount > 0 ? `-${formatCurrency(item.discount, invoice.currency)}` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 text-xs">
                        {formatCurrency(item.lineTotal, invoice.currency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Financial Summary & Information Cards Grid */}
          <div className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6 items-start print:grid-cols-2 print:gap-6 summary-block">
            {/* Left Column: Information Cards */}
            <div className="space-y-3 w-full min-w-0">
              {/* 1. Payment Status Card */}
              {isPaid ? (
                <div className="card-block p-4 rounded-xl bg-emerald-50/80 border border-emerald-200/90 text-xs space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-600 stroke-[2.5] shrink-0" /> Payment Status
                    </span>
                    <span className="px-2 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider bg-emerald-200/80 text-emerald-900 border border-emerald-300 shrink-0">
                      Settled in Full
                    </span>
                  </div>
                  <p className="text-emerald-900 text-[11px] font-medium leading-relaxed">
                    This invoice has been settled in full. Thank you for doing business with {businessName}. No further payment is required.
                  </p>
                </div>
              ) : (
                <div className="card-block p-4 rounded-xl bg-slate-50/90 border border-slate-200/90 text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Clock size={14} className="text-[#355DAF] shrink-0" /> Payment Status
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider border shrink-0 ${
                      invoice.status === "PARTIALLY_PAID"
                        ? "bg-blue-100 text-blue-800 border-blue-200"
                        : invoice.status === "OVERDUE"
                        ? "bg-red-100 text-red-800 border-red-200"
                        : "bg-amber-100 text-amber-900 border-amber-200"
                    }`}>
                      {invoice.status === "PARTIALLY_PAID"
                        ? "Partially Paid"
                        : invoice.status === "OVERDUE"
                        ? "Overdue"
                        : "Payment Due"}
                    </span>
                  </div>
                  {invoice.paymentInstructions ? (
                    <div className="space-y-1 pt-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Payment Instructions:
                      </span>
                      <div className="text-slate-700 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                        {invoice.paymentInstructions}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-600 leading-relaxed pt-0.5">
                      Payment is due by <strong className="text-slate-800">{formattedDueDate}</strong>. Please reference invoice <strong className="font-mono">#{invoice.invoiceNumber}</strong> with your remittance.
                    </p>
                  )}
                </div>
              )}

              {/* 2. Notice Card */}
              {invoice.clientNotes && (
                <div className="card-block p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <FileText size={13} className="text-amber-700 shrink-0" /> Notice &amp; Client Terms
                  </span>
                  <p className="text-[11px] text-amber-950/90 leading-relaxed break-words">
                    {invoice.clientNotes}
                  </p>
                </div>
              )}

              {/* 3. Payments Received Card */}
              {invoice.payments && invoice.payments.length > 0 && (
                <div className="card-block p-4 rounded-xl bg-slate-50/90 border border-slate-200/90 text-xs space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <CreditCard size={14} className="text-emerald-700 shrink-0" /> Payments Received
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                      {invoice.payments.length} {invoice.payments.length === 1 ? "Record" : "Records"}
                    </span>
                  </div>
                  <div className="space-y-1.5 divide-y divide-slate-200/60 pt-0.5">
                    {invoice.payments.map((p, pIdx) => {
                      const pDate = p.paymentDate
                        ? new Date(p.paymentDate).toLocaleDateString("en-GH", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—";
                      return (
                        <div
                          key={p.id || pIdx}
                          className={`flex items-center justify-between text-xs ${pIdx > 0 ? "pt-1.5" : ""}`}
                        >
                          <div className="min-w-0 pr-3">
                            <p className="font-semibold text-slate-800 text-[11px] truncate">
                              {pDate} · {p.paymentMethod || "Payment"}
                            </p>
                            {p.reference && (
                              <p className="font-mono text-[10px] text-slate-500 truncate">
                                Ref: {p.reference}
                              </p>
                            )}
                          </div>
                          <span className="font-mono font-bold text-slate-900 text-xs shrink-0 tabular-nums text-right">
                            {formatCurrency(p.amount, invoice.currency)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Financial Summary */}
            <div className="space-y-3 w-full min-w-0">
              {/* Summary Breakdown Card */}
              <div className="card-block p-4 rounded-xl bg-slate-50/90 border border-slate-200/90 space-y-2.5 text-xs">
                {/* Items Subtotal */}
                <div className="flex items-center justify-between py-0.5 text-slate-600 text-xs">
                  <span className="font-medium text-slate-600">Items Subtotal:</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(invoice.subtotal, invoice.currency)}
                  </span>
                </div>

                {/* Discount (if any) */}
                {invoice.discountAmount && invoice.discountAmount > 0 ? (
                  <div className="flex items-center justify-between py-0.5 text-emerald-700 text-xs font-medium">
                    <span>Discount {invoice.discountPercent ? `(${invoice.discountPercent}%)` : ""}:</span>
                    <span className="font-mono font-semibold tabular-nums">
                      -{formatCurrency(invoice.discountAmount, invoice.currency)}
                    </span>
                  </div>
                ) : null}

                {/* Shipping / Freight Card */}
                {invoice.freightStatus === "PENDING" ? (
                  <div className="p-2.5 sm:p-3 rounded-lg bg-amber-50/90 border border-amber-200/90 text-amber-900 space-y-1 my-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold flex items-center gap-1.5 text-xs text-amber-950">
                        <Truck size={13} className="text-amber-700 shrink-0" /> Shipping / Freight:
                      </span>
                      <span className="font-extrabold text-[9px] uppercase tracking-wider bg-amber-200/90 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300 shrink-0">
                        Pending Confirmation
                      </span>
                    </div>
                    <p className="text-[10.5px] text-amber-800 leading-snug">
                      {invoice.freightNotes || "* Shipping fee will be determined once cargo is weighed and measured at port."}
                    </p>
                  </div>
                ) : invoice.freightStatus === "NOT_APPLICABLE" ? (
                  <div className="flex items-center justify-between py-0.5 text-slate-400 text-xs italic">
                    <span className="flex items-center gap-1.5">
                      <Truck size={12} className="text-slate-400 shrink-0" /> Shipping / Freight:
                    </span>
                    <span className="text-[11px] font-mono">Not Applicable</span>
                  </div>
                ) : (invoice.shippingCharges && invoice.shippingCharges > 0) || invoice.freightStatus === "CONFIRMED" ? (
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between py-0.5 text-slate-600 text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-slate-600">
                        <Truck size={12} className="text-slate-400 shrink-0" /> Shipping / Freight:
                      </span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(invoice.shippingCharges || 0, invoice.currency)}
                      </span>
                    </div>
                    {invoice.freightNotes && (
                      <p className="text-[10px] text-slate-500 pl-4 leading-tight">
                        {invoice.freightNotes}
                      </p>
                    )}
                  </div>
                ) : null}

                {/* Handling Charges */}
                {invoice.handlingCharges && invoice.handlingCharges > 0 ? (
                  <div className="flex items-center justify-between py-0.5 text-slate-600 text-xs">
                    <span className="font-medium text-slate-600">Handling Charges:</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(invoice.handlingCharges, invoice.currency)}
                    </span>
                  </div>
                ) : null}

                {/* Customs / Clearance */}
                {invoice.customsCharges && invoice.customsCharges > 0 ? (
                  <div className="flex items-center justify-between py-0.5 text-slate-600 text-xs">
                    <span className="font-medium text-slate-600">Customs / Clearance:</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(invoice.customsCharges, invoice.currency)}
                    </span>
                  </div>
                ) : null}

                {/* Other Services */}
                {invoice.otherCharges && invoice.otherCharges > 0 ? (
                  <div className="flex items-center justify-between py-0.5 text-slate-600 text-xs">
                    <span className="font-medium text-slate-600">Other Services:</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(invoice.otherCharges, invoice.currency)}
                    </span>
                  </div>
                ) : null}

                {/* Tax */}
                {invoice.taxRate && invoice.taxRate > 0 ? (
                  <div className="flex items-center justify-between py-0.5 text-slate-600 text-xs">
                    <span className="font-medium text-slate-600">Tax ({invoice.taxRate}%):</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(invoice.taxAmount || 0, invoice.currency)}
                    </span>
                  </div>
                ) : null}

                {/* Total Invoiced */}
                <div className="border-t border-slate-200/90 pt-2.5 mt-1 flex items-center justify-between text-xs">
                  <span className="font-black text-xs sm:text-sm text-slate-900">Total Invoiced:</span>
                  <span className="font-mono text-sm sm:text-base font-black tabular-nums" style={{ color: primaryColor }}>
                    {formatCurrency(invoice.totalAmount, invoice.currency)}
                  </span>
                </div>

                {/* Total Paid to Date (positive verified sum, no misleading minus) */}
                <div className="flex items-center justify-between py-0.5 text-xs">
                  <span className="font-medium text-slate-600">Total Paid to Date:</span>
                  <span className="font-mono font-bold text-emerald-700 tabular-nums">
                    {formatCurrency(invoice.amountPaid || 0, invoice.currency)}
                  </span>
                </div>
              </div>

              {/* Balance Due Card */}
              <div
                className={`card-block p-4 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                  isPaid
                    ? "bg-emerald-50/90 border-emerald-300 text-emerald-950"
                    : "bg-[#141B47] border-[#141B47] text-white shadow-xs"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-xs font-black uppercase tracking-wider ${isPaid ? "text-emerald-950" : "text-white"}`}>
                    Balance Due:
                  </span>
                  {isPaid ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-200/90 text-emerald-900 border border-emerald-300 shrink-0">
                      SETTLED
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-[#F2901F] text-slate-950 shrink-0">
                      OUTSTANDING
                    </span>
                  )}
                </div>
                <span
                  className={`font-mono text-base sm:text-lg font-black tabular-nums text-right shrink-0 ${
                    isPaid ? "text-emerald-700" : "text-[#FFB800]"
                  }`}
                >
                  {formatCurrency(invoice.outstandingBalance, invoice.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Document Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200/80 text-center text-[11px] text-slate-500 space-y-0.5">
          <p className="font-semibold text-slate-700 flex items-center justify-center gap-1.5">
            <ShieldCheck size={13} className="text-emerald-600" />
            Official Business Document issued by {businessName}
          </p>
          <p className="text-slate-400">
            Email: <strong className="text-slate-600">{supportEmail}</strong> · Phone: <strong className="text-slate-600">{supportPhone}</strong> · Thank you for your business!
          </p>
        </div>
      </div>
    </div>
  );
}
