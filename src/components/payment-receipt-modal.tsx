"use client";

import React, { useRef } from "react";
import { formatCurrency } from "@/lib/currency";
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

export function PaymentReceiptModal({ isOpen, onClose, receipt }: PaymentReceiptModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      {/* Background click to close */}
      <div className="fixed inset-0 print:hidden" onClick={onClose} />

      {/* Modal Dialog Card */}
      <div 
        ref={printRef}
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden z-10 print:shadow-none print:border-none print:rounded-none print:max-w-none print:w-full"
      >
        {/* Printable Styling */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            .print-receipt-container, .print-receipt-container * {
              visibility: visible;
            }
            .print-receipt-container {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            .no-print {
              display: none !important;
            }
          }
        `}} />

        <div className="print-receipt-container">
          {/* Top Decorative Bar & Action Bar */}
          <div className="bg-[#141B47] text-white p-5 sm:p-6 relative">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black tracking-widest text-[#F2901F] uppercase">
                    LMX8 IMPORTS
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white/90 uppercase tracking-wider">
                    Official Receipt
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Payment Receipt
                </h2>
                <p className="text-xs text-white/70 font-mono">
                  Ref: {receipt.reference}
                </p>
              </div>

              {/* Close Button (Hidden in Print) */}
              <div className="flex items-center gap-2 no-print">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Print receipt or save to PDF"
                >
                  <Printer size={14} />
                  <span className="hidden sm:inline">Print / Save PDF</span>
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
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <CheckCircle2 size={15} />
                <span className="uppercase tracking-wider font-extrabold text-[11px]">Payment Confirmed</span>
              </div>
              <span className="text-white/80 font-mono text-[11px]">
                {formattedDate} · {formattedTime}
              </span>
            </div>
          </div>

          {/* Receipt Body */}
          <div className="p-5 sm:p-6 space-y-5">
            {/* Amount Banner */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#F7F9FC] border border-[#E5E7EB] text-center space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                Amount Paid
              </span>
              <p className="text-3xl sm:text-4xl font-black text-[#141B47] font-mono tracking-tight">
                {formatCurrency(receipt.amount)}
              </p>
              <div className="flex items-center justify-center gap-1.5 pt-1">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {receipt.isOffline ? `Offline · ${methodLabel}` : `Online · ${methodLabel}`}
                </span>
                {receipt.receiptNumber && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-slate-100 text-slate-700">
                    Slip #{receipt.receiptNumber}
                  </span>
                )}
              </div>
            </div>

            {/* Customer & Payer Details Grid */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 p-4 rounded-xl bg-white border border-[#E5E7EB] text-xs">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">Customer</p>
                <p className="font-bold text-sm text-[#172236] mt-0.5">{customerName}</p>
                <p className="font-mono text-[#667085] mt-0.5">{customerId}</p>
                {receipt.customer?.phone && (
                  <p className="text-[#667085] mt-0.5 font-mono">{receipt.customer.phone}</p>
                )}
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">Payment Method</p>
                <p className="font-bold text-sm text-[#172236] mt-0.5">{methodLabel}</p>
                <p className="text-[#667085] mt-0.5">
                  Source: <strong className="text-[#141B47]">{receipt.isOffline ? "Offline Manual" : "Online Gateway"}</strong>
                </p>
                {receipt.payerName && receipt.payerName !== customerName && (
                  <p className="text-[#667085] mt-0.5">
                    Payer: <strong className="text-[#172236]">{receipt.payerName}</strong>
                  </p>
                )}
              </div>
            </div>

            {/* Shipment Association Details (If applicable) */}
            {receipt.shipment && (
              <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#141B47]">
                    Associated Shipment
                  </span>
                  <span className="font-mono font-bold text-xs text-[#141B47]">
                    {receipt.shipment.trackingNumber}
                  </span>
                </div>

                {receipt.shipment.description && (
                  <p className="text-[#475569] text-xs leading-relaxed line-clamp-2">
                    {receipt.shipment.description}
                  </p>
                )}

                {/* Shipping Fee & Discount Breakdown */}
                {typeof receipt.shipment.fee === "number" && (
                  <div className="pt-2 border-t border-blue-100 space-y-1 text-[11px]">
                    {receipt.shipment.discountPercent && receipt.shipment.discountPercent > 0 ? (
                      <>
                        <div className="flex items-center justify-between text-[#64748B]">
                          <span>Original Shipping Fee:</span>
                          <span className="line-through font-mono">
                            {formatCurrency(receipt.shipment.originalFee ?? receipt.shipment.fee)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-emerald-700 font-medium">
                          <span>Discount Applied ({receipt.shipment.discountPercent}% OFF):</span>
                          <span className="font-mono">
                            −{formatCurrency(receipt.shipment.discountAmount ?? 0)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between font-bold text-[#141B47]">
                          <span>Final Shipping Fee:</span>
                          <span className="font-mono">{formatCurrency(receipt.shipment.fee)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between text-[#64748B]">
                        <span>Shipping Fee:</span>
                        <span className="font-mono font-bold text-[#141B47]">
                          {formatCurrency(receipt.shipment.fee)}
                        </span>
                      </div>
                    )}

                    {typeof receipt.shipment.outstanding === "number" && (
                      <div className="flex items-center justify-between pt-1 border-t border-blue-100 font-extrabold text-xs">
                        <span className="text-[#141B47]">Remaining Balance:</span>
                        <span className={`font-mono ${receipt.shipment.outstanding > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                          {formatCurrency(receipt.shipment.outstanding)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Notes or Admin Recorded Notice */}
            {(receipt.notes || receipt.recordedBy) && (
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-1">
                {receipt.notes && (
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#667085]">Payment Notes:</span>
                    <p className="text-[#334155] italic mt-0.5">{receipt.notes}</p>
                  </div>
                )}
                {receipt.recordedBy && (
                  <p className="text-[11px] text-[#667085] pt-0.5">
                    Recorded by authorized admin: <strong className="text-[#141B47]">{receipt.recordedBy}</strong>
                  </p>
                )}
              </div>
            )}

            {/* Verification & Watermark Footer */}
            <div className="pt-2 text-center text-[10px] text-[#94A3B8] space-y-1">
              <p className="flex items-center justify-center gap-1">
                <ShieldCheck size={12} className="text-emerald-600" />
                This is a computer-generated transaction receipt issued by LexMedia Logistics (LMX8).
              </p>
              <p>For questions or verification, contact support@lexmedialimited.com or WhatsApp +233 24 123 4567</p>
            </div>
          </div>
        </div>

        {/* Footer Actions (Hidden in Print) */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5 no-print">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#667085] hover:text-[#172236] hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#141B47] text-white hover:bg-[#202B6D] transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Printer size={14} /> Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
