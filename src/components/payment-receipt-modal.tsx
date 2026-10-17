"use client";

import React, { useRef, useState, useEffect } from "react";
import { formatCurrency } from "@/lib/currency";
import { getBrandSettingsAction } from "@/app/actions/branding";
import { 
  X, Printer, CheckCircle2, Building, Calendar, Hash, User, 
  CreditCard, ShieldCheck, FileText, ArrowDownRight, Tag
} from "lucide-react";

export interface ReceiptData {
  reference: string;
  amount: number;
  currency?: string;
  status: string;
  type?: string;
  provider?: string | null;
  paymentMethod?: string | null;
  paymentMethodLabel?: string | null;
  isOffline?: boolean;
  receiptNumber?: string | null;
  payerName?: string | null;
  notes?: string | null;
  recordedBy?: string | null;
  paymentDate?: string | null;
  createdAt: string;
  customer?: {
    id?: string;
    customerIdentifier?: string;
    name?: string;
    phone?: string | null;
    email?: string | null;
  } | null;
  shipment?: {
    trackingNumber?: string;
    description?: string;
    fee?: number;
    originalFee?: number | null;
    discountPercent?: number | null;
    discountAmount?: number | null;
    totalPaid?: number;
    outstanding?: number;
  } | null;
}

interface PaymentReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: ReceiptData | null;
}

interface BrandSettingsInfo {
  businessName: string;
  shortName: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  mainLogoUrl: string | null;
  lightLogoUrl: string | null;
  darkLogoUrl: string | null;
}

export function PaymentReceiptModal({ isOpen, onClose, receipt }: PaymentReceiptModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [branding, setBranding] = useState<BrandSettingsInfo>({
    businessName: "LMX8 IMPORTS",
    shortName: "LMX8",
    tagline: "Your Goods. Our Priority.",
    primaryColor: "#141B47",
    secondaryColor: "#355DAF",
    accentColor: "#F2901F",
    mainLogoUrl: null,
    lightLogoUrl: null,
    darkLogoUrl: null,
  });

  useEffect(() => {
    if (isOpen) {
      getBrandSettingsAction()
        .then((data) => {
          if (data) {
            setBranding({
              businessName: data.businessName || "LMX8 IMPORTS",
              shortName: data.shortName || "LMX8",
              tagline: data.tagline || "Your Goods. Our Priority.",
              primaryColor: data.primaryColor || "#141B47",
              secondaryColor: data.secondaryColor || "#355DAF",
              accentColor: data.accentColor || "#F2901F",
              mainLogoUrl: data.mainLogoUrl || null,
              lightLogoUrl: data.lightLogoUrl || null,
              darkLogoUrl: data.darkLogoUrl || null,
            });
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen || !receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = receipt.paymentDate
    ? new Date(receipt.paymentDate).toLocaleDateString("en-GH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : new Date(receipt.createdAt).toLocaleDateString("en-GH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

  const formattedTime = new Date(receipt.createdAt).toLocaleTimeString("en-GH", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const customerId = receipt.customer?.customerIdentifier || receipt.customer?.id || "N/A";
  const customerName = receipt.customer?.name || receipt.payerName || "Valued Customer";
  const methodLabel = receipt.paymentMethodLabel || (receipt.isOffline ? "Offline Payment" : "Paystack Online");

  const primaryColor = branding.primaryColor || "#141B47";
  const accentColor = branding.accentColor || "#F2901F";

  const totalPaidToDate = receipt.shipment?.totalPaid ?? receipt.amount;
  const outstandingBalance = receipt.shipment?.outstanding ?? 0;
  const isPartialPayment = outstandingBalance > 0;

  // Correct Logo Variant: Use lightLogoUrl on dark header background if available; otherwise invert main logo
  const receiptLogoUrl = branding.lightLogoUrl || branding.mainLogoUrl || null;
  const needsLogoInversion = !branding.lightLogoUrl && Boolean(branding.mainLogoUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:overflow-visible print:fixed print:inset-0">
      {/* Background click to close */}
      <div className="fixed inset-0 print:hidden" onClick={onClose} />

      {/* Modal Dialog Card */}
      <div 
        ref={printRef}
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden z-10 print:shadow-none print:border-none print:rounded-none print:max-w-none print:w-full print:static"
      >
        {/* Printable Styling - Fixes blank print preview by ensuring visibility of print container */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body {
              background: #ffffff !important;
            }
            body > * {
              display: none !important;
            }
            .fixed.inset-0.z-50 {
              position: static !important;
              background: #ffffff !important;
              padding: 0 !important;
              overflow: visible !important;
              display: block !important;
            }
            .print-receipt-container {
              display: block !important;
              visibility: visible !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              background: #ffffff !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}} />

        <div className="print-receipt-container">
          {/* Top Header with Correct Logo Variant for Dark Background */}
          <div style={{ backgroundColor: primaryColor }} className="text-white p-6 relative">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                {receiptLogoUrl ? (
                  <img
                    src={receiptLogoUrl}
                    alt={branding.businessName}
                    style={{ 
                      maxHeight: "42px", 
                      maxWidth: "200px", 
                      filter: needsLogoInversion ? "brightness(0) invert(1)" : "none" 
                    }}
                    className="object-contain h-auto w-auto"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black tracking-widest uppercase" style={{ color: accentColor }}>
                      {branding.shortName}
                    </span>
                    <span className="font-bold text-xs tracking-wider opacity-90 uppercase">
                      {branding.businessName}
                    </span>
                  </div>
                )}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      PAYMENT RECEIPT
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-white/15 text-white uppercase tracking-wider">
                      {isPartialPayment ? "Partial Settlement" : "Full Settlement"}
                    </span>
                  </div>
                  <p className="text-xs text-white/75 font-mono">
                    Receipt Number: #{receipt.receiptNumber || receipt.reference}
                  </p>
                </div>
              </div>

              {/* Close & Print Buttons (Hidden in Print) */}
              <div className="flex items-center gap-2 no-print">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Print receipt or save to PDF"
                >
                  <Printer size={14} />
                  <span className="hidden sm:inline">Print / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close receipt"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Status Ribbon */}
            <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                <CheckCircle2 size={15} />
                <span className="uppercase tracking-wider font-extrabold text-[11px]">Payment Confirmed</span>
              </div>
              <span className="text-white/85 font-mono text-[11px]">
                Date Issued: {formattedDate} · {formattedTime}
              </span>
            </div>
          </div>

          {/* Receipt Body - Factual, Clean, Professional (Buzzwords Removed) */}
          <div className="p-5 sm:p-6 space-y-4">
            {/* Amount Banner */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Amount Received
              </span>
              <p className="text-3xl sm:text-4xl font-black font-mono tracking-tight" style={{ color: primaryColor }}>
                {formatCurrency(receipt.amount)}
              </p>
              <div className="flex items-center justify-center gap-1.5 pt-1">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Payment Status: Confirmed
                </span>
                {receipt.reference && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-slate-200 text-slate-700">
                    Ref: {receipt.reference}
                  </span>
                )}
              </div>
            </div>

            {/* Customer & Payment Method Grid */}
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-white border border-slate-200 text-xs">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Customer</p>
                <p className="font-bold text-sm text-slate-900 mt-0.5">{customerName}</p>
                <p className="font-mono text-slate-600 mt-0.5">ID: {customerId}</p>
                {receipt.customer?.phone && (
                  <p className="text-slate-600 mt-0.5 font-mono">{receipt.customer.phone}</p>
                )}
                {receipt.customer?.email && (
                  <p className="text-slate-600 mt-0.5 truncate">{receipt.customer.email}</p>
                )}
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Payment Method</p>
                <p className="font-bold text-sm text-slate-900 mt-0.5">{methodLabel}</p>
                <p className="text-slate-600 mt-0.5">
                  Source: <strong className="text-slate-900">{receipt.isOffline ? "Offline Manual" : "Online Gateway"}</strong>
                </p>
                {receipt.payerName && receipt.payerName !== customerName && (
                  <p className="text-slate-600 mt-0.5">
                    Payer: <strong className="text-slate-900">{receipt.payerName}</strong>
                  </p>
                )}
                {receipt.paymentDate && (
                  <p className="text-slate-600 mt-0.5 font-mono">Payment Date: {formattedDate}</p>
                )}
              </div>
            </div>

            {/* Shipment Reference & Financial Breakdown */}
            {receipt.shipment && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: primaryColor }}>
                    Shipment Reference
                  </span>
                  <span className="font-mono font-bold text-xs" style={{ color: primaryColor }}>
                    {receipt.shipment.trackingNumber || "N/A"}
                  </span>
                </div>

                {receipt.shipment.description && (
                  <p className="text-slate-600 text-xs leading-relaxed">
                    Description: {receipt.shipment.description}
                  </p>
                )}

                {/* Financial Summary */}
                {typeof receipt.shipment.fee === "number" && (
                  <div className="space-y-1.5 pt-1 text-[11px]">
                    {receipt.shipment.discountPercent && receipt.shipment.discountPercent > 0 ? (
                      <>
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Original Fee:</span>
                          <span className="line-through font-mono">
                            {formatCurrency(receipt.shipment.originalFee ?? receipt.shipment.fee)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-emerald-700 font-medium">
                          <span>Discount Applied ({receipt.shipment.discountPercent}%):</span>
                          <span className="font-mono">
                            −{formatCurrency(receipt.shipment.discountAmount ?? 0)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between font-bold text-slate-900">
                          <span>Total Amount Due:</span>
                          <span className="font-mono">{formatCurrency(receipt.shipment.fee)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Total Amount Due:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {formatCurrency(receipt.shipment.fee)}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-emerald-700 font-bold pt-1 border-t border-slate-200">
                      <span>Amount Received:</span>
                      <span className="font-mono">+{formatCurrency(receipt.amount)}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-700 font-medium">
                      <span>Total Paid:</span>
                      <span className="font-mono">{formatCurrency(totalPaidToDate)}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 font-extrabold text-xs">
                      <span className="text-slate-900">Outstanding Balance:</span>
                      <span className={`font-mono ${outstandingBalance > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                        {formatCurrency(outstandingBalance)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notes and Recorder Name (@lexmedia.gh) */}
            {(receipt.notes || receipt.recordedBy || receipt.isOffline) && (
              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-xs space-y-1">
                {receipt.notes && (
                  <div>
                    <span className="text-[10px] font-bold uppercase text-amber-800">Notes:</span>
                    <p className="text-slate-700 italic mt-0.5">{receipt.notes}</p>
                  </div>
                )}
                <div className="flex items-center justify-between pt-0.5 text-[11px] text-amber-900">
                  <span>Recorded By:</span>
                  <strong className="font-mono text-slate-900">@lexmedia.gh</strong>
                </div>
              </div>
            )}

            {/* Verification Footer */}
            <div className="pt-2 text-center text-[10px] text-slate-400 space-y-0.5 border-t border-slate-100">
              <p className="font-medium text-slate-600">
                Official Business Document · {branding.businessName}
              </p>
              <p>Support: support@lexmedialimited.com · Tel: +233 24 123 4567</p>
            </div>
          </div>
        </div>

        {/* Footer Actions (Hidden in Print) */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 no-print">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            style={{ backgroundColor: primaryColor }}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white hover:opacity-90 transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Printer size={14} /> Print / Save PDF
          </button>
        </div>
      </div>
    </div>
  );
}
